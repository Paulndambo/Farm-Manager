from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import ContactInquiry, Farm


User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class CurrentFarmProfileTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.farm = Farm.objects.create(name="Old Farm", location="Old Town")
        self.admin = User.objects.create_user(
            username="admin@example.com",
            email="admin@example.com",
            password="secret123",
            role=User.Role.ADMIN,
            farm=self.farm,
        )
        self.worker = User.objects.create_user(
            username="worker@example.com",
            email="worker@example.com",
            password="secret123",
            role=User.Role.WORKER,
            farm=self.farm,
        )

    def test_active_farm_user_can_view_their_farm_profile(self):
        self.farm.subscription_plan = Farm.SubscriptionPlan.STANDARD
        self.farm.save(update_fields=["subscription_plan"])
        self.client.force_authenticate(self.worker)

        response = self.client.get("/api/farm/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "Old Farm")
        self.assertEqual(response.data["subscriptionPlan"], Farm.SubscriptionPlan.STANDARD)

    def test_admin_can_update_farm_profile(self):
        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            "/api/farm/",
            {
                "name": "Updated Farm",
                "location": "Nakuru",
                "subscriptionPlan": Farm.SubscriptionPlan.BUSINESS,
                "subscriptionBillingCycle": Farm.BillingCycle.ANNUAL,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.farm.refresh_from_db()
        self.assertEqual(self.farm.name, "Updated Farm")
        self.assertEqual(self.farm.location, "Nakuru")
        self.assertEqual(self.farm.subscription_plan, Farm.SubscriptionPlan.BUSINESS)
        self.assertEqual(self.farm.subscription_billing_cycle, Farm.BillingCycle.ANNUAL)

    def test_worker_cannot_update_farm_profile(self):
        self.client.force_authenticate(self.worker)

        response = self.client.patch(
            "/api/farm/",
            {"name": "Worker Edit"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.farm.refresh_from_db()
        self.assertEqual(self.farm.name, "Old Farm")


@override_settings(SECURE_SSL_REDIRECT=False)
class ContactInquiryTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_public_visitor_can_submit_contact_inquiry(self):
        response = self.client.post(
            "/api/contact/",
            {
                "name": "Asha Mwangi",
                "email": "asha@example.com",
                "phone": "+254745491093",
                "farmName": "Green Valley Farm",
                "preferredContact": ContactInquiry.PreferredContact.WHATSAPP,
                "message": "I would like help choosing a plan.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        inquiry = ContactInquiry.objects.get()
        self.assertEqual(inquiry.name, "Asha Mwangi")
        self.assertEqual(inquiry.farm_name, "Green Valley Farm")
        self.assertEqual(inquiry.preferred_contact, ContactInquiry.PreferredContact.WHATSAPP)

    def test_contact_inquiry_requires_email_or_phone(self):
        response = self.client.post(
            "/api/contact/",
            {
                "name": "Asha Mwangi",
                "message": "Please contact me.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
