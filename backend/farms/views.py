from rest_framework import generics
from rest_framework.permissions import AllowAny

from accounts.permissions import IsActiveFarmUser, IsAdminRole

from .serializers import ContactInquirySerializer, FarmSerializer


class CurrentFarmView(generics.RetrieveUpdateAPIView):
    serializer_class = FarmSerializer

    def get_permissions(self):
        if self.request.method in {"PUT", "PATCH"}:
            return [IsAdminRole()]
        return [IsActiveFarmUser()]

    def get_object(self):
        return self.request.user.farm


class ContactInquiryCreateView(generics.CreateAPIView):
    serializer_class = ContactInquirySerializer
    permission_classes = [AllowAny]
