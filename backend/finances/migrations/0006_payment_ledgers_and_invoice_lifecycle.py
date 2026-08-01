from django.db import migrations, models
import django.db.models.deletion


def backfill_payment_ledgers(apps, schema_editor):
    Invoice = apps.get_model("finances", "Invoice")
    InvoicePayment = apps.get_model("finances", "InvoicePayment")
    LoanPayment = apps.get_model("finances", "LoanPayment")
    Sale = apps.get_model("finances", "Sale")
    Expense = apps.get_model("finances", "Expense")

    for payment in LoanPayment.objects.select_related("loan").all():
        Expense.objects.get_or_create(
            loan_payment_id=payment.id,
            defaults={
                "farm_id": payment.loan.farm_id,
                "category": "Loan payment",
                "description": f"Loan repayment - {payment.loan.lender}",
                "date": payment.date,
                "amount": payment.amount,
                "vendor": payment.loan.lender,
                "notes": payment.notes,
                "auto_logged": True,
            },
        )

    for invoice in Invoice.objects.select_related("partner").filter(amount_paid__gt=0):
        amount = min(invoice.amount_paid, invoice.amount)
        payment = InvoicePayment.objects.create(
            invoice_id=invoice.id,
            date=invoice.issue_date,
            amount=amount,
            notes="Opening payment migrated from invoice balance",
        )
        if invoice.direction == "Receivable":
            Sale.objects.create(
                farm_id=invoice.farm_id,
                sale_type="Invoice collection",
                description=f"Invoice collection - {invoice.invoice_number}: {invoice.description}",
                date=invoice.issue_date,
                amount=amount,
                buyer=invoice.partner.name,
                notes=payment.notes,
                invoice_payment_id=payment.id,
            )
        else:
            Expense.objects.create(
                farm_id=invoice.farm_id,
                category="Supplier invoice",
                description=f"Supplier invoice payment - {invoice.invoice_number}: {invoice.description}",
                date=invoice.issue_date,
                amount=amount,
                vendor=invoice.partner.name,
                notes=payment.notes,
                auto_logged=True,
                invoice_payment_id=payment.id,
            )


class Migration(migrations.Migration):

    dependencies = [
        ("finances", "0005_loan_loanpayment"),
    ]

    operations = [
        migrations.AlterField(
            model_name="invoice",
            name="status",
            field=models.CharField(
                choices=[
                    ("Draft", "Draft"),
                    ("Issued", "Issued"),
                    ("Part paid", "Part paid"),
                    ("Paid", "Paid"),
                    ("Overdue", "Overdue"),
                    ("Recalled", "Recalled"),
                    ("Closed", "Closed"),
                    ("Cancelled", "Cancelled"),
                ],
                default="Issued",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="sale",
            name="sale_type",
            field=models.CharField(
                choices=[
                    ("Animal sale", "Animal sale"),
                    ("Milk / dairy", "Milk / dairy"),
                    ("Eggs", "Eggs"),
                    ("Wool / hide", "Wool / hide"),
                    ("Other produce", "Other produce"),
                    ("Invoice collection", "Invoice collection"),
                    ("Other", "Other"),
                ],
                max_length=40,
            ),
        ),
        migrations.AlterField(
            model_name="expense",
            name="category",
            field=models.CharField(
                choices=[
                    ("Animal purchase", "Animal purchase"),
                    ("Feed purchase", "Feed purchase"),
                    ("Veterinary", "Veterinary"),
                    ("Medication", "Medication"),
                    ("Labor", "Labor"),
                    ("Equipment", "Equipment"),
                    ("Transport", "Transport"),
                    ("Utilities", "Utilities"),
                    ("Loan payment", "Loan payment"),
                    ("Supplier invoice", "Supplier invoice"),
                    ("Other", "Other"),
                ],
                max_length=40,
            ),
        ),
        migrations.CreateModel(
            name="InvoicePayment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField()),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("method", models.CharField(blank=True, max_length=80)),
                ("reference", models.CharField(blank=True, max_length=120)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "invoice",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="payments",
                        to="finances.invoice",
                    ),
                ),
            ],
            options={"ordering": ["-date", "-created_at"]},
        ),
        migrations.AddField(
            model_name="sale",
            name="invoice_payment",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="sale_record",
                to="finances.invoicepayment",
            ),
        ),
        migrations.AddField(
            model_name="expense",
            name="invoice_payment",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="expense_record",
                to="finances.invoicepayment",
            ),
        ),
        migrations.AddField(
            model_name="expense",
            name="loan_payment",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="expense_record",
                to="finances.loanpayment",
            ),
        ),
        migrations.RunPython(backfill_payment_ledgers, migrations.RunPython.noop),
    ]
