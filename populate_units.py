"""
populate_units.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Populates the Firestore units collection with all
standard units of measurement for HomeBakes recipes.

HOW TO USE:
  1. Make sure firebase_admin_key.json is in this folder
  2. Run: python populate_units.py

SAFE TO RUN MULTIPLE TIMES:
  Already-existing units are skipped automatically.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import firebase_admin
from firebase_admin import credentials, firestore

# ── Units master list ─────────────────────────────────────────────────────────
# Format: (name, abbreviation, type)
# type options: volume, weight, count, other
UNITS = [
    # Volume
    ("teaspoon",    "tsp",     "volume"),
    ("tablespoon",  "tbsp",    "volume"),
    ("fluid ounce", "fl oz",   "volume"),
    ("cup",         "c",       "volume"),
    ("pint",        "pt",      "volume"),
    ("quart",       "qt",      "volume"),
    ("gallon",      "gal",     "volume"),
    ("milliliter",  "ml",      "volume"),
    ("liter",       "l",       "volume"),

    # Weight
    ("ounce",       "oz",      "weight"),
    ("pound",       "lb",      "weight"),
    ("gram",        "g",       "weight"),
    ("kilogram",    "kg",      "weight"),

    # Count / descriptive
    ("whole",       "whole",   "count"),
    ("piece",       "piece",   "count"),
    ("slice",       "slice",   "count"),
    ("clove",       "clove",   "count"),
    ("sprig",       "sprig",   "count"),
    ("bunch",       "bunch",   "count"),
    ("pinch",       "pinch",   "count"),
    ("dash",        "dash",    "count"),
    ("to taste",    "to taste","count"),

    # Packaging
    ("package",     "pkg",     "other"),
    ("can",         "can",     "other"),
    ("jar",         "jar",     "other"),
    ("bag",         "bag",     "other"),
    ("box",         "box",     "other"),
]

# ── Connect to Firebase ───────────────────────────────────────────────────────
print("\n🔥 Connecting to Firebase...")
cred = credentials.Certificate("firebase_admin_key.json")

# Only initialize if not already initialized
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()
print("✅ Connected!\n")


def populate_units():
    """
    Adds all units to the Firestore units collection.
    Skips any that already exist.
    """
    added   = 0
    skipped = 0
    errors  = []

    print("📏 Adding units of measurement...")
    print("─" * 50)

    for name, abbreviation, unit_type in UNITS:
        try:
            # Check for duplicates
            existing = db.collection("units") \
                         .where("name", "==", name) \
                         .limit(1) \
                         .get()

            if existing:
                print(f"⏭️  Skipped (already exists): {name}")
                skipped += 1
                continue

            # Add to Firestore
            db.collection("units").add({
                "name":         name,
                "abbreviation": abbreviation,
                "type":         unit_type
            })
            print(f"✅ Added: {name} ({abbreviation}) [{unit_type}]")
            added += 1

        except Exception as e:
            print(f"❌ Error adding '{name}': {e}")
            errors.append(name)

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "═" * 50)
    print(f"  ✅ Added:   {added} units")
    print(f"  ⏭️  Skipped: {skipped} already existed")
    if errors:
        print(f"  ❌ Errors:  {len(errors)} failed")
        for e in errors:
            print(f"     - {e}")
    print("═" * 50)
    print(f"\n🎉 Done! Your Firestore units collection is ready.\n")


# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    populate_units()
