from collections import defaultdict
from decimal import Decimal

from django.db import models
from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import viewsets

from accounts.permissions import IsActiveFarmUser
from inventory.models import FeedItem
from livestock.models import Animal, HealthEvent, Vaccination

from .models import Expense, FarmContract, Invoice, Sale, TradingPartner
from .serializers import (
    ExpenseSerializer,
    FarmContractSerializer,
    InvoiceSerializer,
    SaleSerializer,
    TradingPartnerSerializer,
)


def money(value):
    return str(value or Decimal("0"))


class SaleViewSet(viewsets.ModelViewSet):
    serializer_class = SaleSerializer
    permission_classes = [IsActiveFarmUser]

    def get_queryset(self):
        return Sale.objects.filter(farm=self.request.user.farm).select_related("animal")

    def perform_create(self, serializer):
        serializer.save(farm=self.request.user.farm)


class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [IsActiveFarmUser]

    def get_queryset(self):
        return Expense.objects.filter(farm=self.request.user.farm).select_related("animal", "feed_item")

    def perform_create(self, serializer):
        serializer.save(farm=self.request.user.farm)


class TradingPartnerViewSet(viewsets.ModelViewSet):
    serializer_class = TradingPartnerSerializer
    permission_classes = [IsActiveFarmUser]

    def get_queryset(self):
        return TradingPartner.objects.filter(farm=self.request.user.farm)

    def perform_create(self, serializer):
        serializer.save(farm=self.request.user.farm)


class FarmContractViewSet(viewsets.ModelViewSet):
    serializer_class = FarmContractSerializer
    permission_classes = [IsActiveFarmUser]

    def get_queryset(self):
        return FarmContract.objects.filter(farm=self.request.user.farm).select_related("partner")

    def perform_create(self, serializer):
        serializer.save(farm=self.request.user.farm)


class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsActiveFarmUser]

    def get_queryset(self):
        return Invoice.objects.filter(farm=self.request.user.farm).select_related("partner", "contract")

    def perform_create(self, serializer):
        serializer.save(farm=self.request.user.farm)


@api_view(["GET"])
@permission_classes([IsActiveFarmUser])
def dashboard_summary(request):
    farm = request.user.farm
    total_animals = Animal.objects.filter(farm=farm).count()
    status_counts = {
        row["status"]: row["total"]
        for row in Animal.objects.filter(farm=farm).values("status").annotate(total=Count("id"))
    }
    open_health_events = HealthEvent.objects.filter(animal__farm=farm, resolved=False).count()
    low_feed_items = FeedItem.objects.filter(farm=farm, quantity_kg__lte=models.F("reorder_level")).count()
    overdue_vaccinations = Vaccination.objects.filter(animal__farm=farm, next_due__lt=timezone.localdate()).count()

    return Response(
        {
            "animals": {
                "total": total_animals,
                "byStatus": status_counts,
            },
            "health": {"openEvents": open_health_events},
            "feed": {"lowStockItems": low_feed_items},
            "vaccinations": {"overdue": overdue_vaccinations},
            "finances": build_finance_summary(farm),
        }
    )


@api_view(["GET"])
@permission_classes([IsActiveFarmUser])
def finance_summary(request):
    return Response(build_finance_summary(request.user.farm))


def build_finance_summary(farm):
    total_revenue = Sale.objects.filter(farm=farm).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    total_expenses = Expense.objects.filter(farm=farm).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    net = total_revenue - total_expenses
    margin = (net / total_revenue * Decimal("100")) if total_revenue else Decimal("0")

    revenue_by_type = {
        row["sale_type"]: money(row["total"])
        for row in Sale.objects.filter(farm=farm).values("sale_type").annotate(total=Sum("amount")).order_by("sale_type")
    }
    expenses_by_category = {
        row["category"]: money(row["total"])
        for row in Expense.objects.filter(farm=farm).values("category").annotate(total=Sum("amount")).order_by("category")
    }

    monthly = defaultdict(lambda: {"revenue": Decimal("0"), "expenses": Decimal("0")})
    for row in Sale.objects.filter(farm=farm).annotate(month=TruncMonth("date")).values("month").annotate(total=Sum("amount")):
        monthly[month_key(row["month"])]["revenue"] = row["total"] or Decimal("0")
    for row in Expense.objects.filter(farm=farm).annotate(month=TruncMonth("date")).values("month").annotate(total=Sum("amount")):
        monthly[month_key(row["month"])]["expenses"] = row["total"] or Decimal("0")

    return {
        "totalRevenue": money(total_revenue),
        "totalExpenses": money(total_expenses),
        "netProfit": money(net),
        "profitMargin": str(round(margin, 2)),
        "revenueByType": revenue_by_type,
        "expensesByCategory": expenses_by_category,
        "monthly": [
            {
                "month": month,
                "revenue": money(values["revenue"]),
                "expenses": money(values["expenses"]),
                "net": money(values["revenue"] - values["expenses"]),
            }
            for month, values in sorted(monthly.items())
        ],
    }


def month_key(value):
    if hasattr(value, "date"):
        value = value.date()
    return value.isoformat()
