from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from farms.models import Farm

from .models import Expense, FarmContract, Invoice, InvoicePayment, Loan, Sale, TradingPartner


User = get_user_model()


class ContractInvoiceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.farm = Farm.objects.create(name="Green Farm")
        self.other_farm = Farm.objects.create(name="Other Farm")
        self.user = User.objects.create_user(
            username="admin@example.com",
            email="admin@example.com",
            password="secret123",
            role=User.Role.ADMIN,
            farm=self.farm,
        )
        self.client.force_authenticate(self.user)

    def test_contract_and_invoice_flow_supports_supplier_and_customer(self):
        supplier_response = self.client.post(
            "/api/partners/",
            {
                "name": "Highland Millers",
                "partnerType": TradingPartner.PartnerType.SUPPLIER,
                "phone": "+254700111111",
            },
            format="json",
        )
        customer_response = self.client.post(
            "/api/partners/",
            {
                "name": "Githunguri Dairy",
                "partnerType": TradingPartner.PartnerType.CUSTOMER,
                "email": "buyer@example.com",
            },
            format="json",
        )

        self.assertEqual(supplier_response.status_code, 201)
        self.assertEqual(customer_response.status_code, 201)

        supplier_contract_response = self.client.post(
            "/api/contracts/",
            {
                "partnerId": supplier_response.data["id"],
                "direction": FarmContract.Direction.SUPPLY_TO_FARM,
                "title": "Monthly dairy meal supply",
                "goodsOrServices": "Dairy meal and mineral supplements",
                "startDate": "2026-07-01",
                "billingCycle": FarmContract.BillingCycle.MONTHLY,
                "agreedRate": "48.00",
                "status": FarmContract.Status.ACTIVE,
            },
            format="json",
        )
        customer_contract_response = self.client.post(
            "/api/contracts/",
            {
                "partnerId": customer_response.data["id"],
                "direction": FarmContract.Direction.FARM_OUTPUT,
                "title": "Milk delivery agreement",
                "goodsOrServices": "Raw milk",
                "startDate": "2026-07-01",
                "billingCycle": FarmContract.BillingCycle.WEEKLY,
                "agreedRate": "65.00",
                "status": FarmContract.Status.ACTIVE,
            },
            format="json",
        )

        self.assertEqual(supplier_contract_response.status_code, 201)
        self.assertEqual(customer_contract_response.status_code, 201)

        payable_response = self.client.post(
            "/api/invoices/",
            {
                "partnerId": supplier_response.data["id"],
                "contractId": supplier_contract_response.data["id"],
                "direction": Invoice.Direction.PAYABLE,
                "invoiceNumber": "SUP-001",
                "issueDate": "2026-07-04",
                "dueDate": "2026-07-18",
                "description": "Dairy meal July delivery",
                "amountPaid": "0.00",
                "status": Invoice.Status.ISSUED,
                "items": [
                    {
                        "description": "Dairy meal",
                        "quantity": "500.00",
                        "unit": "kg",
                        "unitPrice": "48.00",
                    }
                ],
            },
            format="json",
        )
        receivable_response = self.client.post(
            "/api/invoices/",
            {
                "partnerId": customer_response.data["id"],
                "contractId": customer_contract_response.data["id"],
                "direction": Invoice.Direction.RECEIVABLE,
                "invoiceNumber": "OUT-001",
                "issueDate": "2026-07-04",
                "dueDate": "2026-07-11",
                "description": "Milk deliveries week 27",
                "amountPaid": "5000.00",
                "status": Invoice.Status.PART_PAID,
                "items": [
                    {
                        "description": "Raw milk",
                        "quantity": "180.00",
                        "unit": "litres",
                        "unitPrice": "65.00",
                    },
                    {
                        "description": "Evening top-up",
                        "quantity": "10.00",
                        "unit": "litres",
                        "unitPrice": "65.00",
                    },
                ],
            },
            format="json",
        )

        self.assertEqual(payable_response.status_code, 201)
        self.assertEqual(receivable_response.status_code, 201)
        self.assertEqual(payable_response.data["direction"], Invoice.Direction.PAYABLE)
        self.assertEqual(receivable_response.data["direction"], Invoice.Direction.RECEIVABLE)
        self.assertEqual(payable_response.data["amount"], "24000.00")
        self.assertEqual(receivable_response.data["amount"], "12350.00")
        self.assertEqual(len(receivable_response.data["items"]), 2)

    def test_contracts_and_invoices_are_scoped_to_current_farm(self):
        partner = TradingPartner.objects.create(
            farm=self.farm,
            name="Farm Customer",
            partner_type=TradingPartner.PartnerType.CUSTOMER,
        )
        other_partner = TradingPartner.objects.create(
            farm=self.other_farm,
            name="Hidden Partner",
            partner_type=TradingPartner.PartnerType.SUPPLIER,
        )
        contract = FarmContract.objects.create(
            farm=self.farm,
            partner=partner,
            direction=FarmContract.Direction.FARM_OUTPUT,
            title="Egg supply",
            goods_or_services="Eggs",
            start_date="2026-07-01",
        )
        FarmContract.objects.create(
            farm=self.other_farm,
            partner=other_partner,
            direction=FarmContract.Direction.SUPPLY_TO_FARM,
            title="Hidden contract",
            goods_or_services="Feed",
            start_date="2026-07-01",
        )
        Invoice.objects.create(
            farm=self.farm,
            partner=partner,
            contract=contract,
            direction=Invoice.Direction.RECEIVABLE,
            invoice_number="EGG-001",
            issue_date="2026-07-04",
            description="Eggs",
            amount="3000.00",
        )
        Invoice.objects.create(
            farm=self.other_farm,
            partner=other_partner,
            direction=Invoice.Direction.PAYABLE,
            invoice_number="HID-001",
            issue_date="2026-07-04",
            description="Hidden",
            amount="1000.00",
        )

        partners_response = self.client.get("/api/partners/")
        contracts_response = self.client.get("/api/contracts/")
        invoices_response = self.client.get("/api/invoices/")

        self.assertEqual([partner["name"] for partner in partners_response.data], ["Farm Customer"])
        self.assertEqual([contract["title"] for contract in contracts_response.data], ["Egg supply"])
        self.assertEqual([invoice["invoiceNumber"] for invoice in invoices_response.data], ["EGG-001"])

    def test_loans_and_payments_track_outstanding_balances_by_farm(self):
        loan_response = self.client.post(
            "/api/loans/",
            {
                "lender": "Agri Credit SACCO",
                "purpose": "Dairy shed expansion",
                "principalAmount": "100000.00",
                "interestRate": "12.50",
                "issueDate": "2026-07-01",
                "dueDate": "2027-07-01",
                "paymentFrequency": Loan.PaymentFrequency.MONTHLY,
                "status": Loan.Status.ACTIVE,
                "collateral": "Milk deliveries",
            },
            format="json",
        )

        self.assertEqual(loan_response.status_code, 201)
        self.assertEqual(loan_response.data["totalDue"], "112500.00")
        self.assertEqual(loan_response.data["outstandingBalance"], "112500.00")

        payment_response = self.client.post(
            "/api/loan-payments/",
            {
                "loanId": loan_response.data["id"],
                "date": "2026-08-01",
                "amount": "15000.00",
                "method": "M-Pesa",
                "reference": "QH123",
            },
            format="json",
        )

        self.assertEqual(payment_response.status_code, 201)
        repayment_expense = Expense.objects.get(loan_payment__id=payment_response.data["id"])
        self.assertEqual(repayment_expense.amount, 15000)
        self.assertEqual(repayment_expense.category, Expense.Category.LOAN_PAYMENT)
        self.assertTrue(repayment_expense.auto_logged)

        loans_response = self.client.get("/api/loans/")
        self.assertEqual(len(loans_response.data), 1)
        self.assertEqual(loans_response.data[0]["totalPaid"], "15000.00")
        self.assertEqual(loans_response.data[0]["outstandingBalance"], "97500.00")
        self.assertEqual(len(loans_response.data[0]["payments"]), 1)

        other_loan = Loan.objects.create(
            farm=self.other_farm,
            lender="Hidden Bank",
            purpose="Hidden",
            principal_amount="20000.00",
            interest_rate="10.00",
            issue_date="2026-07-01",
        )
        blocked_payment = self.client.post(
            "/api/loan-payments/",
            {
                "loanId": other_loan.id,
                "date": "2026-08-01",
                "amount": "1000.00",
            },
            format="json",
        )

        summary_response = self.client.get("/api/finances/summary/")

        self.assertEqual(blocked_payment.status_code, 400)
        self.assertEqual(summary_response.data["loans"]["totalPrincipal"], "100000.00")
        self.assertEqual(summary_response.data["loans"]["totalDebt"], "112500.00")
        self.assertEqual(summary_response.data["loans"]["totalPaid"], "15000.00")
        self.assertEqual(summary_response.data["loans"]["outstandingDebt"], "97500.00")
        self.assertEqual(summary_response.data["totalRevenue"], "0.00")
        self.assertEqual(summary_response.data["totalExpenses"], "15000.00")
        self.assertEqual(summary_response.data["netProfit"], "-15000.00")
        self.assertNotIn("Loan proceeds", summary_response.data["revenueByType"])
        self.assertEqual(summary_response.data["expensesByCategory"]["Loan payment"], "15000.00")

        overpayment_response = self.client.post(
            "/api/loan-payments/",
            {
                "loanId": loan_response.data["id"],
                "date": "2026-09-01",
                "amount": "97500.01",
            },
            format="json",
        )
        self.assertEqual(overpayment_response.status_code, 400)

        final_payment_response = self.client.post(
            "/api/loan-payments/",
            {
                "loanId": loan_response.data["id"],
                "date": "2026-09-01",
                "amount": "97500.00",
            },
            format="json",
        )
        self.assertEqual(final_payment_response.status_code, 201)

        paid_loan_response = self.client.get("/api/loans/")
        self.assertEqual(paid_loan_response.data[0]["totalPaid"], "112500.00")
        self.assertEqual(paid_loan_response.data[0]["outstandingBalance"], "0.00")
        self.assertEqual(paid_loan_response.data[0]["status"], Loan.Status.PAID)

        blocked_after_paid_response = self.client.post(
            "/api/loan-payments/",
            {
                "loanId": loan_response.data["id"],
                "date": "2026-10-01",
                "amount": "1.00",
            },
            format="json",
        )
        self.assertEqual(blocked_after_paid_response.status_code, 400)

    def test_invoice_payments_post_once_to_the_correct_ledger(self):
        supplier = TradingPartner.objects.create(
            farm=self.farm, name="Feed Supplier", partner_type=TradingPartner.PartnerType.SUPPLIER
        )
        customer = TradingPartner.objects.create(
            farm=self.farm, name="Milk Buyer", partner_type=TradingPartner.PartnerType.CUSTOMER
        )
        payable = Invoice.objects.create(
            farm=self.farm, partner=supplier, direction=Invoice.Direction.PAYABLE,
            invoice_number="PAY-001", issue_date="2026-07-01", description="Feed", amount="20000.00",
        )
        receivable = Invoice.objects.create(
            farm=self.farm, partner=customer, direction=Invoice.Direction.RECEIVABLE,
            invoice_number="REC-001", issue_date="2026-07-01", description="Milk", amount="30000.00",
        )

        paid = self.client.post(
            f"/api/invoices/{payable.id}/record-payment/",
            {"date": "2026-07-10", "amount": "7500.00", "method": "Bank"},
            format="json",
        )
        collected = self.client.post(
            f"/api/invoices/{receivable.id}/record-payment/",
            {"date": "2026-07-11", "amount": "12000.00", "method": "M-Pesa"},
            format="json",
        )

        self.assertEqual(paid.status_code, 201)
        self.assertEqual(collected.status_code, 201)
        self.assertEqual(paid.data["status"], Invoice.Status.PART_PAID)
        self.assertEqual(collected.data["outstandingBalance"], "18000.00")
        self.assertTrue(Expense.objects.filter(invoice_payment__invoice=payable, amount="7500.00").exists())
        self.assertTrue(Sale.objects.filter(invoice_payment__invoice=receivable, amount="12000.00").exists())

        summary = self.client.get("/api/finances/summary/").data
        self.assertEqual(summary["totalRevenue"], "12000.00")
        self.assertEqual(summary["totalExpenses"], "7500.00")
        self.assertEqual(summary["netProfit"], "4500.00")

        payment_id = collected.data["payments"][0]["id"]
        reversed_response = self.client.post(
            f"/api/invoices/{receivable.id}/reverse-payment/",
            {"paymentId": payment_id},
            format="json",
        )
        self.assertEqual(reversed_response.status_code, 200)
        self.assertEqual(reversed_response.data["amountPaid"], "0.00")
        self.assertFalse(InvoicePayment.objects.filter(pk=payment_id).exists())
        self.assertFalse(Sale.objects.filter(invoice_payment_id=payment_id).exists())

    def test_invoice_lifecycle_and_contract_editing(self):
        partner = TradingPartner.objects.create(
            farm=self.farm, name="Customer", partner_type=TradingPartner.PartnerType.CUSTOMER
        )
        contract = FarmContract.objects.create(
            farm=self.farm, partner=partner, direction=FarmContract.Direction.FARM_OUTPUT,
            title="Original", goods_or_services="Milk", start_date="2026-07-01",
        )
        invoice = Invoice.objects.create(
            farm=self.farm, partner=partner, contract=contract,
            direction=Invoice.Direction.RECEIVABLE, invoice_number="LIFE-001",
            issue_date="2026-07-01", description="Milk", amount="1000.00",
        )

        edited = self.client.patch(
            f"/api/contracts/{contract.id}/",
            {"title": "Updated agreement", "status": FarmContract.Status.PAUSED},
            format="json",
        )
        recalled = self.client.post(
            f"/api/invoices/{invoice.id}/transition/", {"action": "recall"}, format="json"
        )
        reopened = self.client.post(
            f"/api/invoices/{invoice.id}/transition/", {"action": "reopen"}, format="json"
        )
        closed = self.client.post(
            f"/api/invoices/{invoice.id}/transition/", {"action": "close"}, format="json"
        )

        self.assertEqual(edited.status_code, 200)
        self.assertEqual(edited.data["title"], "Updated agreement")
        self.assertEqual(recalled.data["status"], Invoice.Status.RECALLED)
        self.assertEqual(reopened.data["status"], Invoice.Status.ISSUED)
        self.assertEqual(closed.data["status"], Invoice.Status.CLOSED)
