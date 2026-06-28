from django.db import models


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
