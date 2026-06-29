from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Farm


User = get_user_model()


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
        self.client.force_authenticate(self.worker)

        response = self.client.get("/api/farm/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "Old Farm")

    def test_admin_can_update_farm_profile(self):
        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            "/api/farm/",
            {"name": "Updated Farm", "location": "Nakuru"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.farm.refresh_from_db()
        self.assertEqual(self.farm.name, "Updated Farm")
        self.assertEqual(self.farm.location, "Nakuru")

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
