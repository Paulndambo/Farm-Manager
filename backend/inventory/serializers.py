from rest_framework import serializers
from decimal import Decimal
from .models import FeedAdjustment, FeedItem


class FeedItemSerializer(serializers.ModelSerializer):
    feedType = serializers.CharField(source="feed_type")
    quantityKg = serializers.DecimalField(source="quantity_kg", max_digits=12, decimal_places=2, required=False)
    reorderLevel = serializers.DecimalField(source="reorder_level", max_digits=12, decimal_places=2, required=False)
    costPerKg = serializers.DecimalField(source="cost_per_kg", max_digits=12, decimal_places=2, required=False)
    lastRestocked = serializers.DateField(source="last_restocked", required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = FeedItem
        fields = [
            "id",
            "feedType",
            "quantityKg",
            "reorderLevel",
            "costPerKg",
            "supplier",
            "unit",
            "lastRestocked",
            "createdAt",
            "updatedAt",
        ]


class FeedAdjustmentSerializer(serializers.ModelSerializer):
    feedItemId = serializers.PrimaryKeyRelatedField(source="feed_item", queryset=FeedItem.objects.all())
    quantityKg = serializers.DecimalField(source="quantity_kg", max_digits=12, decimal_places=2)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = FeedAdjustment
        fields = ["id", "feedItemId", "mode", "quantityKg", "note", "createdAt"]

    def validate_feedItemId(self, feed_item):
        if feed_item.farm_id != self.context["request"].user.farm_id:
            raise serializers.ValidationError("Feed item does not belong to your farm.")
        return feed_item


class AdjustStockSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=FeedAdjustment.Mode.choices)
    quantityKg = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    note = serializers.CharField(required=False, allow_blank=True)
    createExpense = serializers.BooleanField(required=False, default=False)
