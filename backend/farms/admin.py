from django.contrib import admin

from .models import ContactInquiry, Farm


@admin.register(Farm)
class FarmAdmin(admin.ModelAdmin):
    list_display = ("name", "location", "subscription_plan", "subscription_status", "subscription_billing_cycle", "created_at")
    list_filter = ("subscription_plan", "subscription_status", "subscription_billing_cycle")
    search_fields = ("name", "location")


@admin.register(ContactInquiry)
class ContactInquiryAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "email", "preferred_contact", "farm_name", "is_resolved", "created_at")
    list_filter = ("preferred_contact", "is_resolved", "created_at")
    search_fields = ("name", "phone", "email", "farm_name", "message")
    readonly_fields = ("created_at",)
