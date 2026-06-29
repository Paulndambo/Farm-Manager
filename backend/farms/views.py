from rest_framework import generics

from accounts.permissions import IsActiveFarmUser, IsAdminRole

from .serializers import FarmSerializer


class CurrentFarmView(generics.RetrieveUpdateAPIView):
    serializer_class = FarmSerializer

    def get_permissions(self):
        if self.request.method in {"PUT", "PATCH"}:
            return [IsAdminRole()]
        return [IsActiveFarmUser()]

    def get_object(self):
        return self.request.user.farm
