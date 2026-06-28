from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsActiveFarmUser
from finances.models import Expense

from .models import FeedAdjustment, FeedItem
from .serializers import AdjustStockSerializer, FeedAdjustmentSerializer, FeedItemSerializer


class FeedItemViewSet(viewsets.ModelViewSet):
    serializer_class = FeedItemSerializer
    permission_classes = [IsActiveFarmUser]

    def get_queryset(self):
        return FeedItem.objects.filter(farm=self.request.user.farm)

    @transaction.atomic
    def perform_create(self, serializer):
        item = serializer.save(farm=self.request.user.farm)
        if item.quantity_kg > 0:
            FeedAdjustment.objects.create(
                feed_item=item,
                mode=FeedAdjustment.Mode.RESTOCK,
                quantity_kg=item.quantity_kg,
                note="Initial stock",
                created_by=self.request.user,
            )
            if item.cost_per_kg > 0:
                Expense.objects.create(
                    farm=item.farm,
                    category=Expense.Category.FEED_PURCHASE,
                    description=f"Initial stock - {item.feed_type}",
                    date=item.last_restocked or timezone.localdate(),
                    amount=item.quantity_kg * item.cost_per_kg,
                    vendor=item.supplier,
                    notes=f"Auto-logged initial stock for {item.feed_type}",
                    auto_logged=True,
                    feed_item=item,
                )

    @action(detail=True, methods=["post"], url_path="adjust-stock")
    @transaction.atomic
    def adjust_stock(self, request, pk=None):
        item = self.get_object()
        serializer = AdjustStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        mode = serializer.validated_data["mode"]
        quantity = serializer.validated_data["quantityKg"]
        note = serializer.validated_data.get("note", "")

        if mode == FeedAdjustment.Mode.USE and quantity > item.quantity_kg:
            return Response({"detail": "Cannot use more feed than is in stock."}, status=status.HTTP_400_BAD_REQUEST)

        delta = quantity if mode == FeedAdjustment.Mode.RESTOCK else -quantity
        if mode == FeedAdjustment.Mode.CORRECTION:
            delta = quantity - item.quantity_kg

        item.quantity_kg = max(Decimal("0"), item.quantity_kg + delta)
        if mode == FeedAdjustment.Mode.RESTOCK:
            item.last_restocked = timezone.localdate()
        item.save()

        adjustment = FeedAdjustment.objects.create(
            feed_item=item,
            mode=mode,
            quantity_kg=quantity,
            note=note,
            created_by=request.user,
        )

        if mode == FeedAdjustment.Mode.RESTOCK and serializer.validated_data["createExpense"] and item.cost_per_kg > 0:
            Expense.objects.create(
                farm=item.farm,
                category=Expense.Category.FEED_PURCHASE,
                description=f"Feed restock - {item.feed_type}",
                date=timezone.localdate(),
                amount=quantity * item.cost_per_kg,
                vendor=item.supplier,
                notes=note or f"Feed restock for {item.feed_type}",
                auto_logged=True,
                feed_item=item,
            )

        return Response(
            {
                "feedItem": FeedItemSerializer(item).data,
                "adjustment": FeedAdjustmentSerializer(adjustment, context={"request": request}).data,
            }
        )


class FeedAdjustmentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FeedAdjustmentSerializer
    permission_classes = [IsActiveFarmUser]

    def get_queryset(self):
        return FeedAdjustment.objects.filter(feed_item__farm=self.request.user.farm).select_related("feed_item", "created_by")
