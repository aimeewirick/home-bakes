"""
populate_ingredients.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reads ingredients.csv and populates the Firestore
ingredients collection.

HOW TO USE:
  1. Place ingredients.csv in the same folder as this file
  2. Make sure firebase_admin_key.json is in the same folder
  3. Run: python populate_ingredients.py

SAFE TO RUN MULTIPLE TIMES:
  Already-existing ingredients are skipped automatically.
  You will never get duplicates.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import csv
import os
import firebase_admin
from firebase_admin import credentials, firestore

# ── Valid categories ──────────────────────────────────────────────────────────
# These must match exactly what is in your CSV.
# If a category in your CSV doesn't match, it will be saved as "Other"
# and you will see a warning in the output.
VALID_CATEGORIES = [
    "Baking",
    "Dairy",
    "Eggs",
    "Meat",
    "Poultry",
    "Fish & Seafood",
    "Legumes",
    "Tree Nuts",
    "Grains",
    "Fruits",
    "Vegetables",
    "Herbs & Spices",
    "Pantry",
    "Candy & Chocolate",
    "Condiments",
    "Acids & Liquids",
    "Drinks & Extracts",
    "Breads & Doughs",
    "Other"
]

# ── Connect to Firebase ───────────────────────────────────────────────────────
print("\n🔥 Connecting to Firebase...")
cred = credentials.Certificate("firebase_admin_key.json")
firebase_admin.initialize_app(cred)
db = firestore.client()
print("✅ Connected!\n")


def populate_ingredients(csv_file="ingredients.csv"):
    """
    Reads a CSV file with columns: name, category
    Adds each row as a document in the Firestore ingredients collection.
    Skips duplicates automatically.
    """

    if not os.path.exists(csv_file):
        print(f"❌ ERROR: Could not find '{csv_file}'")
        print(f"   Make sure ingredients.csv is in the same folder as this script.")
        return

    added    = 0
    skipped  = 0
    warnings = 0
    errors   = []

    print(f"📂 Reading from: {csv_file}")
    print("─" * 50)

    with open(csv_file, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        # Validate that the CSV has the right columns
        if "name" not in reader.fieldnames or "category" not in reader.fieldnames:
            print("❌ ERROR: CSV must have columns named 'name' and 'category'")
            print(f"   Found columns: {reader.fieldnames}")
            return

        for row_num, row in enumerate(reader, start=2):  # start=2 because row 1 is header
            name     = row.get("name", "").strip()
            category = row.get("category", "").strip()

            # Skip blank rows
            if not name:
                continue

            # Validate category — warn but don't skip
            if category not in VALID_CATEGORIES:
                print(f"⚠️  Row {row_num}: Unknown category '{category}' for '{name}' → saved as 'Other'")
                category = "Other"
                warnings += 1

            # Check for duplicates in Firestore before adding
            try:
                existing = db.collection("ingredients") \
                             .where("name", "==", name) \
                             .limit(1) \
                             .get()

                if existing:
                    print(f"⏭️  Skipped (already exists): {name}")
                    skipped += 1
                    continue

                # Add to Firestore
                db.collection("ingredients").add({
                    "name":     name,
                    "category": category
                })
                print(f"✅ Added: {name} ({category})")
                added += 1

            except Exception as e:
                print(f"❌ Error adding '{name}': {e}")
                errors.append(name)

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "═" * 50)
    print(f"  ✅ Added:    {added} ingredients")
    print(f"  ⏭️  Skipped:  {skipped} already existed")
    print(f"  ⚠️  Warnings: {warnings} unknown categories (saved as 'Other')")
    if errors:
        print(f"  ❌ Errors:   {len(errors)} failed")
        for e in errors:
            print(f"     - {e}")
    print("═" * 50)
    print(f"\n🎉 Done! Your Firestore ingredients collection is ready.\n")


# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    populate_ingredients("ingredients.csv")
