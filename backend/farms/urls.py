from django.urls import path

from .views import ContactInquiryCreateView, CurrentFarmView

urlpatterns = [
    path("farm/", CurrentFarmView.as_view(), name="current_farm"),
    path("contact/", ContactInquiryCreateView.as_view(), name="contact_inquiry"),
]
