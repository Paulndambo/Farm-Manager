from django.db import models


class FeedItem(models.Model):
    farm = models.ForeignKey("farms.Farm", on_delete=models.CASCADE, related_name="feed_items")
    feed_type = models.CharField(max_length=120)
    quantity_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reorder_level = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cost_per_kg = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    supplier = models.CharField(max_length=160, blank=True)
    unit = models.CharField(max_length=20, default="kg")
    last_restocked = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["feed_type"]
        constraints = [
            models.UniqueConstraint(fields=["farm", "feed_type"], name="unique_feed_type_per_farm"),
        ]

    def __str__(self):
        return self.feed_type


class FeedAdjustment(models.Model):
    class Mode(models.TextChoices):
        RESTOCK = "restock", "Restock"
        USE = "use", "Use"
        CORRECTION = "correction", "Correction"

    feed_item = models.ForeignKey(FeedItem, on_delete=models.CASCADE, related_name="adjustments")
    mode = models.CharField(max_length=20, choices=Mode.choices)
    quantity_kg = models.DecimalField(max_digits=12, decimal_places=2)
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        related_name="feed_adjustments",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.feed_item} {self.mode} {self.quantity_kg}"
