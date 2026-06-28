from rest_framework.permissions import BasePermission


class IsActiveFarmUser(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.status == "Active"
            and request.user.farm_id is not None
        )


class IsAdminRole(IsActiveFarmUser):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == "Admin"


class IsManagerOrAdmin(IsActiveFarmUser):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role in {"Admin", "Manager"}
