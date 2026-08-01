from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Expense, Invoice, InvoicePayment, LoanPayment, Sale


@transaction.atomic
def post_loan_payment_expense(payment: LoanPayment) -> Expense:
    expense, _ = Expense.objects.update_or_create(
        loan_payment=payment,
        defaults={
            "farm": payment.loan.farm,
            "category": Expense.Category.LOAN_PAYMENT,
            "description": f"Loan repayment - {payment.loan.lender}",
            "date": payment.date,
            "amount": payment.amount,
            "vendor": payment.loan.lender,
            "notes": payment.notes or (
                f"{payment.method}{' - ' + payment.reference if payment.reference else ''}".strip(" -")
            ),
            "auto_logged": True,
        },
    )
    return expense


@transaction.atomic
def record_invoice_payment(
    invoice: Invoice,
    *,
    date,
    amount,
    method="",
    reference="",
    notes="",
) -> InvoicePayment:
    amount = Decimal(str(amount)).quantize(Decimal("0.01"))
    if invoice.status in {Invoice.Status.CANCELLED, Invoice.Status.RECALLED, Invoice.Status.CLOSED}:
        raise ValidationError({"invoice": f"{invoice.status} invoices cannot receive payments."})
    if amount <= 0:
        raise ValidationError({"amount": "Payment amount must be greater than zero."})
    if amount > invoice.outstanding_balance:
        raise ValidationError(
            {"amount": f"Payment cannot exceed the outstanding balance of {invoice.outstanding_balance}."}
        )

    payment = InvoicePayment.objects.create(
        invoice=invoice,
        date=date,
        amount=amount,
        method=method,
        reference=reference,
        notes=notes,
    )
    common_notes = notes or (
        f"{method}{' - ' + reference if reference else ''}".strip(" -")
    )
    if invoice.direction == Invoice.Direction.RECEIVABLE:
        Sale.objects.create(
            farm=invoice.farm,
            sale_type=Sale.SaleType.INVOICE_COLLECTION,
            description=f"Invoice collection - {invoice.invoice_number}: {invoice.description}",
            date=date,
            amount=amount,
            buyer=invoice.partner.name,
            notes=common_notes,
            invoice_payment=payment,
        )
    else:
        Expense.objects.create(
            farm=invoice.farm,
            category=Expense.Category.SUPPLIER_INVOICE,
            description=f"Supplier invoice payment - {invoice.invoice_number}: {invoice.description}",
            date=date,
            amount=amount,
            vendor=invoice.partner.name,
            notes=common_notes,
            auto_logged=True,
            invoice_payment=payment,
        )
    invoice.refresh_payment_status()
    return payment
