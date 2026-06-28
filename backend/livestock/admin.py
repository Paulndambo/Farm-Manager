from django.contrib import admin

from .models import Animal, GrowthRecord, HealthEvent, Vaccination


@admin.register(Animal)
class AnimalAdmin(admin.ModelAdmin):
    list_display = ("tag_id", "name", "species", "status", "purchase_cost", "current_value", "farm")
    list_filter = ("species", "status", "farm")
    search_fields = ("tag_id", "name", "breed")


@admin.register(Vaccination)
class VaccinationAdmin(admin.ModelAdmin):
    list_display = ("animal", "vaccine", "date_given", "next_due")
    list_filter = ("date_given", "next_due")
    search_fields = ("animal__tag_id", "vaccine", "batch_no")


@admin.register(GrowthRecord)
class GrowthRecordAdmin(admin.ModelAdmin):
    list_display = ("animal", "date", "weight_kg", "body_condition")
    list_filter = ("date",)
    search_fields = ("animal__tag_id", "animal__name")


@admin.register(HealthEvent)
class HealthEventAdmin(admin.ModelAdmin):
    list_display = ("animal", "type", "date", "resolved")
    list_filter = ("type", "resolved", "date")
    search_fields = ("animal__tag_id", "description", "vet_name")
