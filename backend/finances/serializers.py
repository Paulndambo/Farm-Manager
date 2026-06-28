from rest_framework import serializers

from inventory.models import FeedItem
from livestock.models import Animal

from .models import Expense, Sale


class SaleSerializer(serializers.ModelSerializer):
    saleType = serializers.CharField(source="sale_type")
    animalId = serializers.PrimaryKeyRelatedField(source="animal", queryset=Animal.objects.all(), required=False, allow_null=True)
    animalLabel = serializers.SerializerMethodField()
    unitPrice = serializers.DecimalField(source="unit_price", max_digits=12, decimal_places=2, required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Sale
        fields = ["id", "saleType", "animalId", "animalLabel", "description", "date", "amount", "quantity", "unitPrice", "buyer", "notes", "createdAt"]

    def get_animalLabel(self, obj):
        if not obj.animal:
            return ""
        return f"{obj.animal.tag_id}{' - ' + obj.animal.name if obj.animal.name else ''}"

    def validate_animalId(self, animal):
        if animal and animal.farm_id != self.context["request"].user.farm_id:
            raise serializers.ValidationError("Animal does not belong to your farm.")
        return animal


class ExpenseSerializer(serializers.ModelSerializer):
    autoLogged = serializers.BooleanField(source="auto_logged", required=False)
    animalId = serializers.PrimaryKeyRelatedField(source="animal", queryset=Animal.objects.all(), required=False, allow_null=True)
    feedItemId = serializers.PrimaryKeyRelatedField(source="feed_item", queryset=FeedItem.objects.all(), required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Expense
        fields = ["id", "category", "description", "date", "amount", "vendor", "notes", "autoLogged", "animalId", "feedItemId", "createdAt"]

    def validate_animalId(self, animal):
        if animal and animal.farm_id != self.context["request"].user.farm_id:
            raise serializers.ValidationError("Animal does not belong to your farm.")
        return animal

    def validate_feedItemId(self, feed_item):
        if feed_item and feed_item.farm_id != self.context["request"].user.farm_id:
            raise serializers.ValidationError("Feed item does not belong to your farm.")
        return feed_item
