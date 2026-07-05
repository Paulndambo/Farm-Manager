from django.db import transaction
from rest_framework import serializers

from inventory.models import FeedItem
from livestock.models import Animal

from .models import Expense, FarmContract, Invoice, InvoiceItem, Loan, LoanPayment, Sale, TradingPartner


class TradingPartnerSerializer(serializers.ModelSerializer):
    partnerType = serializers.CharField(source="partner_type")
    contactPerson = serializers.CharField(source="contact_person", required=False, allow_blank=True)
    isActive = serializers.BooleanField(source="is_active", required=False)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = TradingPartner
        fields = ["id", "name", "partnerType", "contactPerson", "phone", "email", "address", "notes", "isActive", "createdAt"]


class FarmContractSerializer(serializers.ModelSerializer):
    partnerId = serializers.PrimaryKeyRelatedField(source="partner", queryset=TradingPartner.objects.all())
    partnerName = serializers.CharField(source="partner.name", read_only=True)
    startDate = serializers.DateField(source="start_date")
    endDate = serializers.DateField(source="end_date", required=False, allow_null=True)
    billingCycle = serializers.CharField(source="billing_cycle")
    agreedRate = serializers.DecimalField(source="agreed_rate", max_digits=12, decimal_places=2, required=False, allow_null=True)
    goodsOrServices = serializers.CharField(source="goods_or_services")
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = FarmContract
        fields = [
            "id",
            "partnerId",
            "partnerName",
            "direction",
            "title",
            "goodsOrServices",
            "startDate",
            "endDate",
            "billingCycle",
            "agreedRate",
            "terms",
            "status",
            "createdAt",
        ]

    def validate_partnerId(self, partner):
        if partner.farm_id != self.context["request"].user.farm_id:
            raise serializers.ValidationError("Partner does not belong to your farm.")
        return partner


class InvoiceItemSerializer(serializers.ModelSerializer):
    unitPrice = serializers.DecimalField(source="unit_price", max_digits=12, decimal_places=2)
    lineTotal = serializers.DecimalField(source="line_total", max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = InvoiceItem
        fields = ["id", "description", "quantity", "unit", "unitPrice", "lineTotal"]
        read_only_fields = ["id", "lineTotal"]


class InvoiceSerializer(serializers.ModelSerializer):
    partnerId = serializers.PrimaryKeyRelatedField(source="partner", queryset=TradingPartner.objects.all())
    partnerName = serializers.CharField(source="partner.name", read_only=True)
    contractId = serializers.PrimaryKeyRelatedField(source="contract", queryset=FarmContract.objects.all(), required=False, allow_null=True)
    contractTitle = serializers.CharField(source="contract.title", read_only=True)
    invoiceNumber = serializers.CharField(source="invoice_number")
    issueDate = serializers.DateField(source="issue_date")
    dueDate = serializers.DateField(source="due_date", required=False, allow_null=True)
    amountPaid = serializers.DecimalField(source="amount_paid", max_digits=12, decimal_places=2, required=False)
    items = InvoiceItemSerializer(many=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "partnerId",
            "partnerName",
            "contractId",
            "contractTitle",
            "direction",
            "invoiceNumber",
            "issueDate",
            "dueDate",
            "description",
            "amount",
            "amountPaid",
            "status",
            "notes",
            "items",
            "createdAt",
        ]
        read_only_fields = ["amount"]

    def validate_partnerId(self, partner):
        if partner.farm_id != self.context["request"].user.farm_id:
            raise serializers.ValidationError("Partner does not belong to your farm.")
        return partner

    def validate_contractId(self, contract):
        if contract and contract.farm_id != self.context["request"].user.farm_id:
            raise serializers.ValidationError("Contract does not belong to your farm.")
        return contract

    def validate(self, attrs):
        partner = attrs.get("partner") or getattr(self.instance, "partner", None)
        contract = attrs.get("contract") or getattr(self.instance, "contract", None)
        if contract and partner and contract.partner_id != partner.id:
            raise serializers.ValidationError("Invoice contract must belong to the selected partner.")
        items = attrs.get("items")
        if self.instance is None and not items:
            raise serializers.ValidationError({"items": "Add at least one invoice item."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop("items")
        invoice = Invoice.objects.create(**validated_data, amount=0)
        self._replace_items(invoice, items)
        return invoice

    @transaction.atomic
    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if items is not None:
            instance.items.all().delete()
            self._replace_items(instance, items)
        return instance

    def _replace_items(self, invoice, items):
        total = 0
        for item in items:
            quantity = item.get("quantity") or 0
            unit_price = item.get("unit_price") or 0
            line = InvoiceItem.objects.create(
                invoice=invoice,
                description=item["description"],
                quantity=quantity,
                unit=item.get("unit", ""),
                unit_price=unit_price,
                line_total=quantity * unit_price,
            )
            total += line.line_total
        invoice.amount = total
        invoice.save(update_fields=["amount"])


class LoanPaymentSerializer(serializers.ModelSerializer):
    loanId = serializers.PrimaryKeyRelatedField(source="loan", queryset=Loan.objects.all())
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = LoanPayment
        fields = ["id", "loanId", "date", "amount", "method", "reference", "notes", "createdAt"]

    def validate_loanId(self, loan):
        if loan.farm_id != self.context["request"].user.farm_id:
            raise serializers.ValidationError("Loan does not belong to your farm.")
        return loan


class LoanSerializer(serializers.ModelSerializer):
    principalAmount = serializers.DecimalField(source="principal_amount", max_digits=12, decimal_places=2)
    interestRate = serializers.DecimalField(source="interest_rate", max_digits=5, decimal_places=2, required=False)
    issueDate = serializers.DateField(source="issue_date")
    dueDate = serializers.DateField(source="due_date", required=False, allow_null=True)
    paymentFrequency = serializers.CharField(source="payment_frequency")
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    payments = LoanPaymentSerializer(many=True, read_only=True)
    totalDue = serializers.DecimalField(source="total_due", max_digits=12, decimal_places=2, read_only=True)
    totalPaid = serializers.DecimalField(source="total_paid", max_digits=12, decimal_places=2, read_only=True)
    outstandingBalance = serializers.DecimalField(source="outstanding_balance", max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Loan
        fields = [
            "id",
            "lender",
            "purpose",
            "principalAmount",
            "interestRate",
            "issueDate",
            "dueDate",
            "paymentFrequency",
            "status",
            "collateral",
            "notes",
            "totalDue",
            "totalPaid",
            "outstandingBalance",
            "payments",
            "createdAt",
        ]


class SaleSerializer(serializers.ModelSerializer):
    saleType = serializers.CharField(source="sale_type")
    animalId = serializers.PrimaryKeyRelatedField(source="animal", queryset=Animal.objects.all(), required=False, allow_null=True)
    animalLabel = serializers.SerializerMethodField()
    unitPrice = serializers.DecimalField(source="unit_price", max_digits=12, decimal_places=2, required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Sale
        fields = ["id", "saleType", "animalId", "animalLabel", "description", "date", "amount", "quantity", "unitPrice", "buyer", "notes", "createdAt"]

    def get_animalLabel(self, obj):
        if not obj.animal:
            return ""
        return f"{obj.animal.tag_id}{' - ' + obj.animal.name if obj.animal.name else ''}"

    def validate_animalId(self, animal):
        if animal and animal.farm_id != self.context["request"].user.farm_id:
            raise serializers.ValidationError("Animal does not belong to your farm.")
        return animal


class ExpenseSerializer(serializers.ModelSerializer):
    autoLogged = serializers.BooleanField(source="auto_logged", required=False)
    animalId = serializers.PrimaryKeyRelatedField(source="animal", queryset=Animal.objects.all(), required=False, allow_null=True)
    feedItemId = serializers.PrimaryKeyRelatedField(source="feed_item", queryset=FeedItem.objects.all(), required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Expense
        fields = ["id", "category", "description", "date", "amount", "vendor", "notes", "autoLogged", "animalId", "feedItemId", "createdAt"]

    def validate_animalId(self, animal):
        if animal and animal.farm_id != self.context["request"].user.farm_id:
            raise serializers.ValidationError("Animal does not belong to your farm.")
        return animal

    def validate_feedItemId(self, feed_item):
        if feed_item and feed_item.farm_id != self.context["request"].user.farm_id:
            raise serializers.ValidationError("Feed item does not belong to your farm.")
        return feed_item
