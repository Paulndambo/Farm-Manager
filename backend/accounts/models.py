from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "Admin", "Admin"
        MANAGER = "Manager", "Manager"
        WORKER = "Worker", "Worker"

    class Status(models.TextChoices):
        ACTIVE = "Active", "Active"
        DISABLED = "Disabled", "Disabled"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.WORKER)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    farm = models.ForeignKey(
        "farms.Farm",
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["first_name", "last_name", "email"]

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = self.email
        super().save(*args, **kwargs)

    @property
    def display_name(self):
        return self.get_full_name() or self.email

    def __str__(self):
        return self.display_name
