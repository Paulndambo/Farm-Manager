from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class FarmUserAdmin(UserAdmin):
    list_display = ("email", "display_name", "role", "status", "farm", "is_staff")
    list_filter = ("role", "status", "farm", "is_staff")
    search_fields = ("email", "first_name", "last_name")
    ordering = ("email",)
    fieldsets = UserAdmin.fieldsets + (
        ("Farm access", {"fields": ("farm", "role", "status")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Farm access", {"fields": ("email", "farm", "role", "status")}),
    )
