from rest_framework.routers import DefaultRouter

from .views import AnimalViewSet, GrowthRecordViewSet, HealthEventViewSet, ProductionRecordViewSet, VaccinationViewSet

router = DefaultRouter()
router.register("animals", AnimalViewSet, basename="animal")
router.register("vaccinations", VaccinationViewSet, basename="vaccination")
router.register("growth-records", GrowthRecordViewSet, basename="growth-record")
router.register("production-records", ProductionRecordViewSet, basename="production-record")
router.register("health-events", HealthEventViewSet, basename="health-event")

urlpatterns = router.urls
