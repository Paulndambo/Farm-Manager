from decimal import Decimal

from django.db import models


class TradingPartner(models.Model):
    class PartnerType(models.TextChoices):
        SUPPLIER = "Supplier", "Supplier"
        CUSTOMER = "Customer", "Customer"
        BOTH = "Both", "Both"

    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="trading_partners")
    name = models.CharField(max_length=180)
    partner_type = models.CharField(max_length=20, choices=PartnerType.choices)
    contact_person = models.CharField(max_length=160, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=240, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class FarmContract(models.Model):
    class Direction(models.TextChoices):
        SUPPLY_TO_FARM = "Supply to farm", "Supply to farm"
        FARM_OUTPUT = "Farm output", "Farm output"

    class Status(models.TextChoices):
        DRAFT = "Draft", "Draft"
        ACTIVE = "Active", "Active"
        PAUSED = "Paused", "Paused"
        ENDED = "Ended", "Ended"

    class BillingCycle(models.TextChoices):
        ON_DELIVERY = "On delivery", "On delivery"
        WEEKLY = "Weekly", "Weekly"
        MONTHLY = "Monthly", "Monthly"
        SEASONAL = "Seasonal", "Seasonal"
        OTHER = "Other", "Other"

    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="contracts")
    partner = models.ForeignKey(TradingPartner, on_delete=models.CASCADE, related_name="contracts")
    direction = models.CharField(max_length=30, choices=Direction.choices)
    title = models.CharField(max_length=180)
    goods_or_services = models.CharField(max_length=240)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    billing_cycle = models.CharField(max_length=30, choices=BillingCycle.choices, default=BillingCycle.MONTHLY)
    agreed_rate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    terms = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date", "title"]

    def __str__(self):
        return self.title


class Invoice(models.Model):
    class Direction(models.TextChoices):
        PAYABLE = "Payable", "Payable"
        RECEIVABLE = "Receivable", "Receivable"

    class Status(models.TextChoices):
        DRAFT = "Draft", "Draft"
        ISSUED = "Issued", "Issued"
        PART_PAID = "Part paid", "Part paid"
        PAID = "Paid", "Paid"
        OVERDUE = "Overdue", "Overdue"
        CANCELLED = "Cancelled", "Cancelled"

    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="invoices")
    partner = models.ForeignKey(TradingPartner, on_delete=models.CASCADE, related_name="invoices")
    contract = models.ForeignKey(FarmContract, on_delete=models.SET_NULL, related_name="invoices", null=True, blank=True)
    direction = models.CharField(max_length=20, choices=Direction.choices)
    invoice_number = models.CharField(max_length=80)
    issue_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=240)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ISSUED)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-issue_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["farm", "invoice_number"], name="unique_invoice_number_per_farm")
        ]

    def __str__(self):
        return f"{self.invoice_number} {self.amount}"


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")
    description = models.CharField(max_length=240)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit = models.CharField(max_length=40, blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def save(self, *args, **kwargs):
        self.line_total = (self.quantity or 0) * (self.unit_price or 0)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.description} {self.line_total}"


class Loan(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "Active", "Active"
        PAID = "Paid", "Paid"
        DEFAULTED = "Defaulted", "Defaulted"
        WRITTEN_OFF = "Written off", "Written off"

    class PaymentFrequency(models.TextChoices):
        WEEKLY = "Weekly", "Weekly"
        MONTHLY = "Monthly", "Monthly"
        QUARTERLY = "Quarterly", "Quarterly"
        SEASONAL = "Seasonal", "Seasonal"
        FLEXIBLE = "Flexible", "Flexible"

    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="loans")
    lender = models.CharField(max_length=180)
    purpose = models.CharField(max_length=240)
    principal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    issue_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    payment_frequency = models.CharField(
        max_length=30,
        choices=PaymentFrequency.choices,
        default=PaymentFrequency.MONTHLY,
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    collateral = models.CharField(max_length=180, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["status", "due_date", "-issue_date", "lender"]

    @property
    def total_due(self):
        interest = self.principal_amount * (self.interest_rate or 0) / 100
        return (self.principal_amount + interest).quantize(Decimal("0.01"))

    @property
    def total_paid(self):
        total = sum((payment.amount for payment in self.payments.all()), start=Decimal("0"))
        return total.quantize(Decimal("0.01"))

    @property
    def outstanding_balance(self):
        return max(self.total_due - self.total_paid, Decimal("0")).quantize(Decimal("0.01"))

    def refresh_payment_status(self):
        if self.outstanding_balance <= Decimal("0") and self.status != self.Status.PAID:
            self.status = self.Status.PAID
            self.save(update_fields=["status"])
        elif self.outstanding_balance > Decimal("0") and self.status == self.Status.PAID:
            self.status = self.Status.ACTIVE
            self.save(update_fields=["status"])

    def __str__(self):
        return f"{self.lender} {self.principal_amount}"


class LoanPayment(models.Model):
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name="payments")
    date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=80, blank=True)
    reference = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.loan.lender} payment {self.amount}"


class Sale(models.Model):
    class SaleType(models.TextChoices):
        ANIMAL = "Animal sale", "Animal sale"
        MILK = "Milk / dairy", "Milk / dairy"
        EGGS = "Eggs", "Eggs"
        WOOL_HIDE = "Wool / hide", "Wool / hide"
        OTHER_PRODUCE = "Other produce", "Other produce"
        OTHER = "Other", "Other"

    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="sales")
    sale_type = models.CharField(max_length=40, choices=SaleType.choices)
    description = models.CharField(max_length=240, blank=True)
    animal = models.ForeignKey(
        "livestock.Animal",
        on_delete=models.SET_NULL,
        related_name="sales",
        null=True,
        blank=True,
    )
    date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    buyer = models.CharField(max_length=160, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.sale_type} {self.amount}"


class Expense(models.Model):
    class Category(models.TextChoices):
        ANIMAL_PURCHASE = "Animal purchase", "Animal purchase"
        FEED_PURCHASE = "Feed purchase", "Feed purchase"
        VETERINARY = "Veterinary", "Veterinary"
        MEDICATION = "Medication", "Medication"
        LABOR = "Labor", "Labor"
        EQUIPMENT = "Equipment", "Equipment"
        TRANSPORT = "Transport", "Transport"
        UTILITIES = "Utilities", "Utilities"
        OTHER = "Other", "Other"

    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="expenses")
    category = models.CharField(max_length=40, choices=Category.choices)
    description = models.CharField(max_length=240, blank=True)
    date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    vendor = models.CharField(max_length=160, blank=True)
    notes = models.TextField(blank=True)
    auto_logged = models.BooleanField(default=False)
    animal = models.ForeignKey(
        "livestock.Animal",
        on_delete=models.SET_NULL,
        related_name="expenses",
        null=True,
        blank=True,
    )
    feed_item = models.ForeignKey(
        "inventory.FeedItem",
        on_delete=models.SET_NULL,
        related_name="expenses",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.category} {self.amount}"
