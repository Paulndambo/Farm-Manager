from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets

from accounts.permissions import IsActiveFarmUser
from finances.models import Expense

from .models import Animal, GrowthRecord, HealthEvent, ProductionRecord, Vaccination
from .serializers import AnimalSerializer, GrowthRecordSerializer, HealthEventSerializer, ProductionRecordSerializer, VaccinationSerializer


class FarmScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsActiveFarmUser]


class AnimalViewSet(FarmScopedViewSet):
    serializer_class = AnimalSerializer

    def get_queryset(self):
        return Animal.objects.filter(farm=self.request.user.farm)

    @transaction.atomic
    def perform_create(self, serializer):
        animal = serializer.save(farm=self.request.user.farm)
        if animal.origin == Animal.Origin.PURCHASED and animal.purchase_cost > 0:
            Expense.objects.create(
                farm=animal.farm,
                category=Expense.Category.ANIMAL_PURCHASE,
                description=f"Purchased {animal.tag_id}{' - ' + animal.name if animal.name else ''}",
                date=timezone.localdate(),
                amount=animal.purchase_cost,
                vendor="Animal purchase",
                notes=f"Auto-logged purchase cost for {animal.tag_id}",
                auto_logged=True,
                animal=animal,
            )


class VaccinationViewSet(FarmScopedViewSet):
    serializer_class = VaccinationSerializer

    def get_queryset(self):
        return Vaccination.objects.filter(animal__farm=self.request.user.farm).select_related("animal")


class GrowthRecordViewSet(FarmScopedViewSet):
    serializer_class = GrowthRecordSerializer

    def get_queryset(self):
        return GrowthRecord.objects.filter(animal__farm=self.request.user.farm).select_related("animal")

    @transaction.atomic
    def perform_create(self, serializer):
        record = serializer.save()
        Animal.objects.filter(id=record.animal_id).update(weight_kg=record.weight_kg)


class ProductionRecordViewSet(FarmScopedViewSet):
    serializer_class = ProductionRecordSerializer

    def get_queryset(self):
        return ProductionRecord.objects.filter(animal__farm=self.request.user.farm).select_related("animal")


class HealthEventViewSet(FarmScopedViewSet):
    serializer_class = HealthEventSerializer

    def get_queryset(self):
        return HealthEvent.objects.filter(animal__farm=self.request.user.farm).select_related("animal")
