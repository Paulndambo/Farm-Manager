from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from farms.models import Farm

from .models import FarmContract, Invoice, Loan, TradingPartner


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
        self.assertEqual(summary_response.data["totalRevenue"], "100000.00")
        self.assertEqual(summary_response.data["totalExpenses"], "15000.00")
        self.assertEqual(summary_response.data["revenueByType"]["Loan proceeds"], "100000.00")
        self.assertEqual(summary_response.data["expensesByCategory"]["Loan payments"], "15000.00")

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
