from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from farms.models import Farm
from livestock.models import Animal


User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class FarmScopingTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_farm_registration_creates_admin_tied_to_new_farm(self):
        response = self.client.post(
            "/api/auth/register-farm/",
            {
                "farmName": "North Ridge Farm",
                "farmLocation": "Nakuru",
                "firstName": "Asha",
                "lastName": "Mwangi",
                "email": "asha@example.com",
                "gender": User.Gender.FEMALE,
                "phoneNumber": "+254711111111",
                "subscriptionPlan": Farm.SubscriptionPlan.BUSINESS,
                "subscriptionBillingCycle": Farm.BillingCycle.ANNUAL,
                "password": "secret123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="asha@example.com")
        self.assertEqual(user.role, User.Role.ADMIN)
        self.assertEqual(user.gender, User.Gender.FEMALE)
        self.assertEqual(user.phone_number, "+254711111111")
        self.assertEqual(user.farm.name, "North Ridge Farm")
        self.assertEqual(user.farm.subscription_plan, Farm.SubscriptionPlan.BUSINESS)
        self.assertEqual(user.farm.subscription_billing_cycle, Farm.BillingCycle.ANNUAL)
        self.assertEqual(response.data["user"]["farm"]["name"], "North Ridge Farm")
        self.assertEqual(response.data["user"]["farm"]["subscriptionPlan"], Farm.SubscriptionPlan.BUSINESS)
        self.assertEqual(response.data["user"]["phoneNumber"], "+254711111111")
        self.assertIn("access", response.data)

    def test_created_users_inherit_current_admin_farm(self):
        farm = Farm.objects.create(name="Admin Farm")
        admin = User.objects.create_user(
            username="admin@example.com",
            email="admin@example.com",
            password="secret123",
            role=User.Role.ADMIN,
            farm=farm,
        )
        self.client.force_authenticate(admin)

        response = self.client.post(
            "/api/users/",
            {
                "first_name": "Farm",
                "last_name": "Worker",
                "email": "worker@example.com",
                "gender": User.Gender.FEMALE,
                "phoneNumber": "+254700000000",
                "password": "secret123",
                "role": User.Role.WORKER,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        worker = User.objects.get(email="worker@example.com")
        self.assertEqual(worker.farm, farm)
        self.assertEqual(worker.gender, User.Gender.FEMALE)
        self.assertEqual(worker.phone_number, "+254700000000")
        self.assertEqual(response.data["farm"]["id"], farm.id)
        self.assertEqual(response.data["phoneNumber"], "+254700000000")

    def test_user_list_returns_every_user_for_current_farm(self):
        farm = Farm.objects.create(name="Admin Farm")
        other_farm = Farm.objects.create(name="Other Farm")
        admin = User.objects.create_user(
            username="admin@example.com",
            email="admin@example.com",
            password="secret123",
            role=User.Role.ADMIN,
            farm=farm,
        )
        User.objects.create_user(
            username="manager@example.com",
            email="manager@example.com",
            password="secret123",
            role=User.Role.MANAGER,
            farm=farm,
        )
        User.objects.create_user(
            username="disabled@example.com",
            email="disabled@example.com",
            password="secret123",
            role=User.Role.WORKER,
            status=User.Status.DISABLED,
            is_active=False,
            farm=farm,
        )
        User.objects.create_user(
            username="other@example.com",
            email="other@example.com",
            password="secret123",
            role=User.Role.WORKER,
            farm=other_farm,
        )

        self.client.force_authenticate(admin)
        response = self.client.get("/api/users/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {user["email"] for user in response.data},
            {"admin@example.com", "manager@example.com", "disabled@example.com"},
        )

    def test_livestock_list_is_scoped_to_logged_in_users_farm(self):
        farm_a = Farm.objects.create(name="Farm A")
        farm_b = Farm.objects.create(name="Farm B")
        user_a = User.objects.create_user(
            username="a@example.com",
            email="a@example.com",
            password="secret123",
            role=User.Role.ADMIN,
            farm=farm_a,
        )
        Animal.objects.create(farm=farm_a, tag_id="A-001", species="Cattle")
        Animal.objects.create(farm=farm_b, tag_id="B-001", species="Goat")

        self.client.force_authenticate(user_a)
        response = self.client.get("/api/animals/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([animal["tagId"] for animal in response.data], ["A-001"])
