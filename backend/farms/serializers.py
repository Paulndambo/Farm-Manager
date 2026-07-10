from rest_framework import serializers

from .models import ContactInquiry, Farm


class FarmSerializer(serializers.ModelSerializer):
    subscriptionPlan = serializers.ChoiceField(
        source="subscription_plan",
        choices=Farm.SubscriptionPlan.choices,
        required=False,
    )
    subscriptionStatus = serializers.ChoiceField(source="subscription_status", choices=Farm.SubscriptionStatus.choices, read_only=True)
    subscriptionBillingCycle = serializers.ChoiceField(
        source="subscription_billing_cycle",
        choices=Farm.BillingCycle.choices,
        required=False,
    )
    subscriptionStartedAt = serializers.DateField(source="subscription_started_at", read_only=True)
    subscriptionExpiresAt = serializers.DateField(source="subscription_expires_at", read_only=True)

    class Meta:
        model = Farm
        fields = [
            "id",
            "name",
            "location",
            "subscriptionPlan",
            "subscriptionStatus",
            "subscriptionBillingCycle",
            "subscriptionStartedAt",
            "subscriptionExpiresAt",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "subscriptionStatus", "subscriptionStartedAt", "subscriptionExpiresAt", "created_at", "updated_at"]


class ContactInquirySerializer(serializers.ModelSerializer):
    farmName = serializers.CharField(source="farm_name", required=False, allow_blank=True, max_length=160)
    preferredContact = serializers.ChoiceField(
        source="preferred_contact",
        choices=ContactInquiry.PreferredContact.choices,
        required=False,
    )

    class Meta:
        model = ContactInquiry
        fields = ["id", "name", "email", "phone", "farmName", "preferredContact", "message", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        email = attrs.get("email", "")
        phone = attrs.get("phone", "")
        if not email and not phone:
            raise serializers.ValidationError("Provide either an email address or phone number.")
        return attrs
