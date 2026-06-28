from rest_framework import generics

from accounts.permissions import IsActiveFarmUser

from .serializers import FarmSerializer


class CurrentFarmView(generics.RetrieveUpdateAPIView):
    serializer_class = FarmSerializer
    permission_classes = [IsActiveFarmUser]

    def get_object(self):
        return self.request.user.farm
