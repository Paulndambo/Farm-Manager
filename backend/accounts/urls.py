from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import EmailTokenObtainPairView, UserViewSet, me, register_farm

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("auth/login/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/register-farm/", register_farm, name="register_farm"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", me, name="current_user"),
]

urlpatterns += router.urls
