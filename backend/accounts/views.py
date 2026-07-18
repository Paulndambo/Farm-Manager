from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .permissions import IsActiveFarmUser, IsAdminRole
from .models import UserAction
from .serializers import CurrentUserSerializer, EmailTokenObtainPairSerializer, FarmRegistrationSerializer, UserActionSerializer, UserSerializer

User = get_user_model()


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    permission_classes = []


@api_view(["GET"])
@permission_classes([IsActiveFarmUser])
def me(request):
    return Response(CurrentUserSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def register_farm(request):
    serializer = FarmRegistrationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": CurrentUserSerializer(user).data,
        },
        status=status.HTTP_201_CREATED,
    )


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        return User.objects.filter(farm=self.request.user.farm)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.role == User.Role.ADMIN:
            return Response({"detail": "Admin users cannot be deleted from this endpoint."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request, pk=None):
        user = self.get_object()
        user.status = User.Status.DISABLED if user.status == User.Status.ACTIVE else User.Status.ACTIVE
        user.is_active = user.status == User.Status.ACTIVE
        user.save(update_fields=["status", "is_active"])
        return Response(self.get_serializer(user).data)


class UserActionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserActionSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        queryset = UserAction.objects.filter(farm=self.request.user.farm).select_related("user")
        user_id = self.request.query_params.get("userId")
        action_type = self.request.query_params.get("actionType")
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if action_type:
            queryset = queryset.filter(action_type=action_type)
        return queryset
