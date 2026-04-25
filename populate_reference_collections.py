"""
HomeBakes — Seed Reference Collections
Safe to run multiple times — checks for duplicates before adding.

Seeds:
  - recipe_categories/
  - meal_types/
  - allergens/
"""
import firebase_admin
from firebase_admin import credentials, firestore
import os, json

# ── Firebase init ─────────────────────────────────────────────────────────────
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
    {"name": "All",                  "order": 0},
    {"name": "Beverages",            "order": 1},
    {"name": "Breads & Cereals",     "order": 2},
    {"name": "Cakes",                "order": 3},
    {"name": "Candy",                "order": 4},
    {"name": "Cookies",              "order": 5},
    {"name": "Curry, Soups & Stews", "order": 6},
    {"name": "Desserts",             "order": 7},
    {"name": "Eggs & Cheese",        "order": 8},
    {"name": "Fish & Seafood",       "order": 9},
    {"name": "Meat & Proteins",      "order": 10},
    {"name": "Pasta",                "order": 11},
    {"name": "Pies",                 "order": 12},
    {"name": "Poultry",              "order": 13},
    {"name": "Rice & Grains",        "order": 14},
    {"name": "Salads",               "order": 15},
    {"name": "Sauces & Relishes",    "order": 16},
    {"name": "Vegetables",           "order": 17},
    {"name": "Other",                "order": 18},
]

# ── Meal Types ────────────────────────────────────────────────────────────────
meal_types = [
    {"name": "Breakfast", "order": 0},
    {"name": "Brunch",    "order": 1},
    {"name": "Lunch",     "order": 2},
    {"name": "Dinner",    "order": 3},
    {"name": "Dessert",   "order": 4},
    {"name": "Snack",     "order": 5},
    {"name": "Drink",     "order": 6},
    {"name": "Side Dish", "order": 7},
    {"name": "Other",     "order": 8},
]

# ── Allergens (FDA 9 Major) ───────────────────────────────────────────────────
allergens = [
    {"name": "Eggs",      "icon": "🥚", "order": 0},
    {"name": "Fish",      "icon": "🐟", "order": 1},
    {"name": "Milk",      "icon": "🥛", "order": 2},
    {"name": "Peanuts",   "icon": "🥜", "order": 3},
    {"name": "Sesame",    "icon": "🫙", "order": 4},
    {"name": "Shellfish", "icon": "🦐", "order": 5},
    {"name": "Soybeans",  "icon": "🫘", "order": 6},
    {"name": "Tree Nuts", "icon": "🌰", "order": 7},
    {"name": "Wheat",     "icon": "🌾", "order": 8},
]

# ── Ingredient Categories ────────────────────────────────────────────────────
ingredient_categories = [
    {"name": "Acids & Liquids",    "order": 0},
    {"name": "Baking",             "order": 1},
    {"name": "Breads & Doughs",    "order": 2},
    {"name": "Candy & Chocolate",  "order": 3},
    {"name": "Condiments",         "order": 4},
    {"name": "Dairy",              "order": 5},
    {"name": "Drinks & Extracts",  "order": 6},
    {"name": "Eggs",               "order": 7},
    {"name": "Fish & Seafood",     "order": 8},
    {"name": "Fruits",             "order": 9},
    {"name": "Grains",             "order": 10},
    {"name": "Herbs & Spices",     "order": 11},
    {"name": "Legumes",            "order": 12},
    {"name": "Meat",               "order": 13},
    {"name": "Pantry",             "order": 14},
    {"name": "Poultry",            "order": 15},
    {"name": "Tree Nuts",          "order": 16},
    {"name": "Vegetables",         "order": 17},
    {"name": "Other",              "order": 18},
]

def seed_collection(collection_name, data):
    """Add items that don't already exist — safe to run multiple times."""
    print(f"\nSeeding {collection_name}...")

    # Get existing names
    existing = db.collection(collection_name).stream()
    existing_names = {doc.to_dict()["name"] for doc in existing}
    print(f"  Found {len(existing_names)} existing items")

    added = 0
    skipped = 0
    for item in data:
        if item["name"] in existing_names:
            print(f"  ⏭️  Skipped (already exists): {item['name']}")
            skipped += 1
        else:
            db.collection(collection_name).add(item)
            print(f"  ✅ Added: {item['name']}")
            added += 1

    print(f"  Done — {added} added, {skipped} skipped")

seed_collection("recipe_categories", recipe_categories)
seed_collection("meal_types", meal_types)
seed_collection("allergens", allergens)
seed_collection("ingredient_categories", ingredient_categories)

print("\n✅ All reference collections seeded!")
