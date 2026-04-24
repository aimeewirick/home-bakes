import firebase_admin
from firebase_admin import credentials, firestore
import os, json

# Initialize Firebase
cred_json = os.environ.get("FIREBASE_CREDENTIALS")
if cred_json:
    cred = credentials.Certificate(json.loads(cred_json))
else:
    cred = credentials.Certificate("firebase_admin_key.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# ── Recipe Categories ─────────────────────────────────────────────────────────
recipe_categories = [
    "All",
    "Beverages",
    "Breads & Cereals",
    "Cakes",
    "Candy",
    "Cookies",
    "Curry, Soups & Stews",
    "Desserts",
    "Eggs & Cheese",
    "Fish & Seafood",
    "Meat & Proteins",
    "Pasta",
    "Pies",
    "Poultry",
    "Rice & Grains",
    "Salads",
    "Sauces & Relishes",
    "Vegetables",
    "Other",
]

# ── Meal Types ────────────────────────────────────────────────────────────────
meal_types = [
    "Breakfast",
    "Brunch",
    "Lunch",
    "Dinner",
    "Dessert",
    "Snack",
    "Drink",
    "Side Dish",
    "Other",
]

print("Seeding recipe_categories...")
for i, name in enumerate(recipe_categories):
    db.collection("recipe_categories").add({
        "name": name,
        "order": i
    })
    print(f"  ✅ {name}")

print("\nSeeding meal_types...")
for i, name in enumerate(meal_types):
    db.collection("meal_types").add({
        "name": name,
        "order": i
    })
    print(f"  ✅ {name}")

print("\n✅ Done! Both collections seeded.")
