from django.urls import path

from .views import CurrentFarmView

urlpatterns = [
    path("farm/", CurrentFarmView.as_view(), name="current_farm"),
]
