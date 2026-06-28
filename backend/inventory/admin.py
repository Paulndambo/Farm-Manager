from django.contrib import admin

from .models import FeedAdjustment, FeedItem


@admin.register(FeedItem)
class FeedItemAdmin(admin.ModelAdmin):
    list_display = ("feed_type", "quantity_kg", "reorder_level", "farm", "last_restocked")
    list_filter = ("farm", "last_restocked")
    search_fields = ("feed_type", "supplier")


@admin.register(FeedAdjustment)
class FeedAdjustmentAdmin(admin.ModelAdmin):
    list_display = ("feed_item", "mode", "quantity_kg", "created_by", "created_at")
    list_filter = ("mode", "created_at")
    search_fields = ("feed_item__feed_type", "note")
