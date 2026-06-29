from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class FarmUserAdmin(UserAdmin):
    list_display = ("email", "display_name", "gender", "phone_number", "role", "status", "farm", "is_staff")
    list_filter = ("gender", "role", "status", "farm", "is_staff")
    search_fields = ("email", "first_name", "last_name", "phone_number")
    ordering = ("email",)
    fieldsets = UserAdmin.fieldsets + (
        ("Contact details", {"fields": ("gender", "phone_number")}),
        ("Farm access", {"fields": ("farm", "role", "status")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Farm access", {"fields": ("email", "gender", "phone_number", "farm", "role", "status")}),
    )
