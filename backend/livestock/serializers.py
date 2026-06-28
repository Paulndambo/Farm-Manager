from rest_framework import serializers

from .models import Animal, GrowthRecord, HealthEvent, Vaccination


class AnimalSerializer(serializers.ModelSerializer):
    tagId = serializers.CharField(source="tag_id")
    weightKg = serializers.DecimalField(source="weight_kg", max_digits=10, decimal_places=2, required=False, allow_null=True)
    purchaseCost = serializers.DecimalField(source="purchase_cost", max_digits=12, decimal_places=2, required=False)
    currentValue = serializers.DecimalField(source="current_value", max_digits=12, decimal_places=2, required=False)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Animal
        fields = [
            "id",
            "tagId",
            "name",
            "species",
            "breed",
            "sex",
            "dob",
            "status",
            "weightKg",
            "location",
            "origin",
            "purchaseCost",
            "currentValue",
            "notes",
            "createdAt",
            "updatedAt",
        ]

    def validate(self, attrs):
        origin = attrs.get("origin", getattr(self.instance, "origin", Animal.Origin.BORN_IN_HERD))
        if origin == Animal.Origin.BORN_IN_HERD:
            attrs["purchase_cost"] = 0
        return attrs


class VaccinationSerializer(serializers.ModelSerializer):
    animalId = serializers.PrimaryKeyRelatedField(source="animal", queryset=Animal.objects.all())
    dateGiven = serializers.DateField(source="date_given")
    nextDue = serializers.DateField(source="next_due", required=False, allow_null=True)
    administeredBy = serializers.CharField(source="administered_by", required=False, allow_blank=True)
    batchNo = serializers.CharField(source="batch_no", required=False, allow_blank=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Vaccination
        fields = ["id", "animalId", "vaccine", "dateGiven", "nextDue", "administeredBy", "batchNo", "notes", "createdAt"]

    def validate_animalId(self, animal):
        if animal.farm_id != self.context["request"].user.farm_id:
            raise serializers.ValidationError("Animal does not belong to your farm.")
        return animal


class GrowthRecordSerializer(serializers.ModelSerializer):
    animalId = serializers.PrimaryKeyRelatedField(source="animal", queryset=Animal.objects.all())
    weightKg = serializers.DecimalField(source="weight_kg", max_digits=10, decimal_places=2)
    bodyCondition = serializers.CharField(source="body_condition", required=False, allow_blank=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = GrowthRecord
        fields = ["id", "animalId", "date", "weightKg", "bodyCondition", "notes", "createdAt"]

    def validate_animalId(self, animal):
        if animal.farm_id != self.context["request"].user.farm_id:
            raise serializers.ValidationError("Animal does not belong to your farm.")
        return animal


class HealthEventSerializer(serializers.ModelSerializer):
    animalId = serializers.PrimaryKeyRelatedField(source="animal", queryset=Animal.objects.all())
    vetName = serializers.CharField(source="vet_name", required=False, allow_blank=True)
    followUpDate = serializers.DateField(source="follow_up_date", required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = HealthEvent
        fields = [
            "id",
            "animalId",
            "type",
            "date",
            "description",
            "treatment",
            "vetName",
            "followUpDate",
            "resolved",
            "createdAt",
            "updatedAt",
        ]

    def validate_animalId(self, animal):
        if animal.farm_id != self.context["request"].user.farm_id:
            raise serializers.ValidationError("Animal does not belong to your farm.")
        return animal
