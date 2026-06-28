from django.contrib import admin

from .models import Expense, Sale


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("sale_type", "date", "amount", "farm", "animal")
    list_filter = ("sale_type", "date", "farm")
    search_fields = ("buyer", "notes", "animal__tag_id")


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("category", "date", "amount", "farm", "auto_logged")
    list_filter = ("category", "date", "farm", "auto_logged")
    search_fields = ("vendor", "notes", "animal__tag_id", "feed_item__feed_type")
