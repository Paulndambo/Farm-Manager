from django.db import migrations


def backfill_current_value(apps, schema_editor):
    Animal = apps.get_model("livestock", "Animal")
    for animal in Animal.objects.filter(current_value=0, purchase_cost__gt=0):
        animal.current_value = animal.purchase_cost
        animal.save(update_fields=["current_value"])


def reverse_backfill(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("livestock", "0002_animal_current_value"),
    ]

    operations = [
        migrations.RunPython(backfill_current_value, reverse_backfill),
    ]
