from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from farms.models import Farm


class Command(BaseCommand):
    help = "Create a default farm and admin account for local development."

    def handle(self, *args, **options):
        farm, _ = Farm.objects.get_or_create(
            name="Pasture Ledger Demo Farm",
            defaults={"location": "Kenya"},
        )

        User = get_user_model()
        user, created = User.objects.get_or_create(
            email="admin@farm.local",
            defaults={
                "username": "admin@farm.local",
                "first_name": "Farm",
                "last_name": "Admin",
                "role": User.Role.ADMIN,
                "status": User.Status.ACTIVE,
                "farm": farm,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            user.set_password("admin123")
            user.save()
            self.stdout.write(self.style.SUCCESS("Created admin@farm.local / admin123"))
        else:
            changed = False
            if user.farm_id != farm.id:
                user.farm = farm
                changed = True
            if user.role != User.Role.ADMIN:
                user.role = User.Role.ADMIN
                changed = True
            if user.status != User.Status.ACTIVE:
                user.status = User.Status.ACTIVE
                changed = True
            if changed:
                user.save()
            self.stdout.write(self.style.WARNING("Demo admin already exists."))
