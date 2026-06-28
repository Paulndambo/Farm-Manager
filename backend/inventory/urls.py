from rest_framework.routers import DefaultRouter

from .views import FeedAdjustmentViewSet, FeedItemViewSet

router = DefaultRouter()
router.register("feed-items", FeedItemViewSet, basename="feed-item")
router.register("feed-adjustments", FeedAdjustmentViewSet, basename="feed-adjustment")

urlpatterns = router.urls
