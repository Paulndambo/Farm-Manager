from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from farms.models import Farm

User = get_user_model()


class FarmSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    location = serializers.CharField()


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="display_name", read_only=True)
    phoneNumber = serializers.CharField(source="phone_number", required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, min_length=6)
    farm = FarmSummarySerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "first_name",
            "last_name",
            "email",
            "gender",
            "phoneNumber",
            "password",
            "role",
            "status",
            "is_active",
            "farm",
            "date_joined",
        ]
        read_only_fields = ["id", "is_active", "date_joined", "farm"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        request = self.context["request"]
        validated_data["farm"] = request.user.farm
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class CurrentUserSerializer(UserSerializer):
    pass


class FarmRegistrationSerializer(serializers.Serializer):
    farmName = serializers.CharField(max_length=160)
    farmLocation = serializers.CharField(max_length=160, required=False, allow_blank=True)
    firstName = serializers.CharField(max_length=150)
    lastName = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField()
    gender = serializers.ChoiceField(choices=User.Gender.choices, required=False, allow_blank=True)
    phoneNumber = serializers.CharField(max_length=30, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=6)

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    @transaction.atomic
    def create(self, validated_data):
        farm = Farm.objects.create(
            name=validated_data["farmName"],
            location=validated_data.get("farmLocation", ""),
        )
        user = User(
            username=validated_data["email"],
            email=validated_data["email"],
            first_name=validated_data["firstName"],
            last_name=validated_data.get("lastName", ""),
            gender=validated_data.get("gender", ""),
            phone_number=validated_data.get("phoneNumber", ""),
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            is_active=True,
            farm=farm,
        )
        user.set_password(validated_data["password"])
        user.save()
        return user


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = User.EMAIL_FIELD

    def validate(self, attrs):
        data = super().validate(attrs)
        if self.user.status != User.Status.ACTIVE:
            raise serializers.ValidationError("This account is disabled.")
        if not self.user.farm:
            raise serializers.ValidationError("This account is not assigned to a farm.")
        data["user"] = CurrentUserSerializer(self.user).data
        return data
