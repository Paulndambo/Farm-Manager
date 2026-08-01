from django.db import models
from decimal import Decimal


class Animal(models.Model):
    class Sex(models.TextChoices):
        FEMALE = "Female", "Female"
        MALE = "Male", "Male"

    class Status(models.TextChoices):
        HEALTHY = "Healthy", "Healthy"
        SICK = "Sick", "Sick"
        PREGNANT = "Pregnant", "Pregnant"
        QUARANTINE = "Quarantine", "Quarantine"
        SOLD = "Sold", "Sold"
        DECEASED = "Deceased", "Deceased"

    class Origin(models.TextChoices):
        BORN_IN_HERD = "Born in herd", "Born in herd"
        PURCHASED = "Purchased", "Purchased"

    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="animals")
    tag_id = models.CharField(max_length=60)
    name = models.CharField(max_length=120, blank=True)
    species = models.CharField(max_length=40)
    breed = models.CharField(max_length=120, blank=True)
    sex = models.CharField(max_length=10, choices=Sex.choices, default=Sex.FEMALE)
    dob = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.HEALTHY)
    weight_kg = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    location = models.CharField(max_length=120, blank=True)
    origin = models.CharField(max_length=30, choices=Origin.choices, default=Origin.BORN_IN_HERD)
    purchase_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1.00"))
    current_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1.00"))
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["tag_id"]
        constraints = [
            models.UniqueConstraint(fields=["farm", "tag_id"], name="unique_tag_per_farm"),
        ]

    def __str__(self):
        return f"{self.tag_id} {self.name}".strip()

    def save(self, *args, **kwargs):
        if self.origin == self.Origin.BORN_IN_HERD:
            self.purchase_cost = 1
        super().save(*args, **kwargs)


class Vaccination(models.Model):
    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name="vaccinations")
    vaccine = models.CharField(max_length=160)
    date_given = models.DateField()
    next_due = models.DateField(null=True, blank=True)
    administered_by = models.CharField(max_length=120, blank=True)
    batch_no = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_given", "-created_at"]

    def __str__(self):
        return f"{self.animal} - {self.vaccine}"


class GrowthRecord(models.Model):
    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name="growth_records")
    date = models.DateField()
    weight_kg = models.DecimalField(max_digits=10, decimal_places=2)
    body_condition = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date", "created_at"]

    def __str__(self):
        return f"{self.animal} - {self.weight_kg}kg"


class ProductionRecord(models.Model):
    class ProductionType(models.TextChoices):
        MILK = "Milk", "Milk"
        EGGS = "Eggs", "Eggs"
        WOOL_HIDE = "Wool / hide", "Wool / hide"
        HONEY = "Honey", "Honey"
        OTHER = "Other", "Other"

    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name="production_records")
    production_type = models.CharField(max_length=40, choices=ProductionType.choices, default=ProductionType.MILK)
    date = models.DateField()
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=30, default="litres")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date", "created_at"]

    def __str__(self):
        return f"{self.animal} - {self.quantity} {self.unit} {self.production_type}"


class HealthEvent(models.Model):
    class EventType(models.TextChoices):
        OBSERVATION = "Observation", "Observation"
        TREATMENT = "Treatment", "Treatment"
        INJURY = "Injury", "Injury"
        ILLNESS = "Illness", "Illness"
        RECOVERY = "Recovery", "Recovery"
        OTHER = "Other", "Other"

    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name="health_events")
    type = models.CharField(max_length=30, choices=EventType.choices, default=EventType.OBSERVATION)
    date = models.DateField()
    description = models.CharField(max_length=240)
    treatment = models.CharField(max_length=240, blank=True)
    vet_name = models.CharField(max_length=120, blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.animal} - {self.type}"
