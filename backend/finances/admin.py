from django.contrib import admin

from .models import Expense, FarmContract, Invoice, InvoiceItem, Sale, TradingPartner


@admin.register(TradingPartner)
class TradingPartnerAdmin(admin.ModelAdmin):
    list_display = ("name", "partner_type", "farm", "phone", "email", "is_active")
    list_filter = ("partner_type", "is_active", "farm")
    search_fields = ("name", "contact_person", "phone", "email")


@admin.register(FarmContract)
class FarmContractAdmin(admin.ModelAdmin):
    list_display = ("title", "partner", "direction", "status", "billing_cycle", "start_date", "end_date")
    list_filter = ("direction", "status", "billing_cycle", "farm")
    search_fields = ("title", "goods_or_services", "partner__name")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "partner", "direction", "status", "issue_date", "due_date", "amount", "amount_paid")
    list_filter = ("direction", "status", "farm")
    search_fields = ("invoice_number", "description", "partner__name")


@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = ("invoice", "description", "quantity", "unit", "unit_price", "line_total")
    search_fields = ("invoice__invoice_number", "description")


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
