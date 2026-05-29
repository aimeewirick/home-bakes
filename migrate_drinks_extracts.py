"""
migrate_drinks_extracts.py
──────────────────────────
One-time migration script to split "Drinks & Extracts" into:
  1. Extracts & Flavorings
  2. Beverages
  3. Liquors

Run from your project root:
  python migrate_drinks_extracts.py

Requires FIREBASE_CREDENTIALS environment variable or firebase_admin_key.json in project root.
"""

import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

# ── Firebase init ─────────────────────────────────────────────────────────────
if os.environ.get("FIREBASE_CREDENTIALS"):
    cred_dict = json.loads(os.environ["FIREBASE_CREDENTIALS"])
    cred = credentials.Certificate(cred_dict)
else:
    key_path = os.path.join(os.path.dirname(__file__), "firebase_admin_key.json")
    cred = credentials.Certificate(key_path)

firebase_admin.initialize_app(cred)
db = firestore.client()

NEW_CATEGORIES = {
    "1": "Extracts & Flavorings",
    "2": "Beverages",
    "3": "Liquors",
}

print("\n" + "═" * 60)
print("  HomeBakes — Drinks & Extracts Category Migration")
print("═" * 60)
print("\nThis script will reassign all ingredients currently in")
print('"Drinks & Extracts" to one of these new categories:\n')
for key, name in NEW_CATEGORIES.items():
    print(f"  {key}. {name}")
print()

# ── Fetch all ingredients with old category ───────────────────────────────────
print("Fetching ingredients from Firestore...")
docs = db.collection("ingredients") \
         .where("category", "==", "Drinks & Extracts") \
         .stream()

ingredients = [{"id": d.id, **d.to_dict()} for d in docs]

if not ingredients:
    print("\nNo ingredients found with category 'Drinks & Extracts'. Nothing to migrate.")
    exit(0)

print(f"Found {len(ingredients)} ingredient(s) to reassign.\n")
print("─" * 60)

# ── Ask user for each ingredient ──────────────────────────────────────────────
assignments = {}
for ing in ingredients:
    name = ing.get("name", "Unknown")
    while True:
        print(f"\n  Ingredient: {name}")
        print(f"  Current category: Drinks & Extracts")
        choice = input(f"  Assign to [1] Extracts & Flavorings  [2] Beverages  [3] Liquors  → ").strip()
        if choice in NEW_CATEGORIES:
            assignments[ing["id"]] = {
                "name": name,
                "new_category": NEW_CATEGORIES[choice]
            }
            print(f"  ✓ Will move '{name}' → {NEW_CATEGORIES[choice]}")
            break
        else:
            print("  Please enter 1, 2, or 3.")

# ── Confirm before writing ────────────────────────────────────────────────────
print("\n" + "─" * 60)
print("\nSummary of changes:")
for ing_id, data in assignments.items():
    print(f"  {data['name']} → {data['new_category']}")

print()
confirm = input("Apply these changes to Firestore? [y/n] → ").strip().lower()
if confirm != "y":
    print("Migration cancelled. No changes made.")
    exit(0)

# ── Apply ingredient updates ──────────────────────────────────────────────────
print("\nUpdating ingredients...")
for ing_id, data in assignments.items():
    db.collection("ingredients").document(ing_id).update({
        "category": data["new_category"]
    })
    print(f"  ✓ Updated '{data['name']}' → {data['new_category']}")

# ── Update ingredient_categories collection ───────────────────────────────────
print("\nUpdating ingredient categories collection...")

# Add new categories if they don't exist
new_cats = ["Extracts & Flavorings", "Liquors"]
existing_cats = db.collection("ingredient_categories").stream()
existing_names = {d.to_dict().get("name") for d in existing_cats}

for cat_name in new_cats:
    if cat_name not in existing_names:
        db.collection("ingredient_categories").add({"name": cat_name})
        print(f"  ✓ Added category '{cat_name}'")
    else:
        print(f"  — Category '{cat_name}' already exists, skipping")

# Remove old category
old_cat_docs = db.collection("ingredient_categories") \
                 .where("name", "==", "Drinks & Extracts") \
                 .stream()
removed = 0
for doc in old_cat_docs:
    doc.reference.delete()
    removed += 1

if removed:
    print(f"  ✓ Removed old category 'Drinks & Extracts'")
else:
    print(f"  — 'Drinks & Extracts' not found in categories collection")

# ── Done ──────────────────────────────────────────────────────────────────────
print("\n" + "═" * 60)
print("  Migration complete!")
print("═" * 60)
print("\nNext steps:")
print("  1. Update ingredients.csv to reflect the new categories")
print("  2. Update populate_reference_collections.py to remove")
print("     'Drinks & Extracts' and add 'Extracts & Flavorings'")
print("     and 'Liquors'")
print("  3. Deploy your app — the new categories will appear")
print("     automatically in the admin and recipe form dropdowns")
print()
