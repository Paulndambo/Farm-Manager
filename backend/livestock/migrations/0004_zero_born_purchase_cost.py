from django.db import migrations


def zero_born_purchase_cost(apps, schema_editor):
    Animal = apps.get_model("livestock", "Animal")
    Animal.objects.filter(origin="Born in herd").exclude(purchase_cost=0).update(purchase_cost=0)


class Migration(migrations.Migration):

    dependencies = [
        ("livestock", "0003_backfill_current_value"),
    ]

    operations = [
        migrations.RunPython(zero_born_purchase_cost, migrations.RunPython.noop),
    ]
