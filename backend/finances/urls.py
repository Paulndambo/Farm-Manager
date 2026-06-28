from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ExpenseViewSet, SaleViewSet, dashboard_summary, finance_summary

router = DefaultRouter()
router.register("sales", SaleViewSet, basename="sale")
router.register("expenses", ExpenseViewSet, basename="expense")

urlpatterns = [
    path("dashboard/summary/", dashboard_summary, name="dashboard_summary"),
    path("finances/summary/", finance_summary, name="finance_summary"),
]

urlpatterns += router.urls
