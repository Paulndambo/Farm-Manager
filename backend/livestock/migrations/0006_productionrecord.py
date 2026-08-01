from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("livestock", "0005_alter_animal_current_value_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProductionRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("production_type", models.CharField(choices=[("Milk", "Milk"), ("Eggs", "Eggs"), ("Wool / hide", "Wool / hide"), ("Honey", "Honey"), ("Other", "Other")], default="Milk", max_length=40)),
                ("date", models.DateField()),
                ("quantity", models.DecimalField(decimal_places=2, max_digits=10)),
                ("unit", models.CharField(default="litres", max_length=30)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("animal", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="production_records", to="livestock.animal")),
            ],
            options={"ordering": ["date", "created_at"]},
        ),
    ]
