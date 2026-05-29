"""
migrate_recipe_allergens.py
────────────────────────────
Converts recipe top-level allergens arrays from name strings to
allergen document IDs.

Run from your project root:
  python migrate_recipe_allergens.py
"""

import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

if os.environ.get("FIREBASE_CREDENTIALS"):
    cred_dict = json.loads(os.environ["FIREBASE_CREDENTIALS"])
    cred = credentials.Certificate(cred_dict)
else:
    cred = credentials.Certificate("firebase_admin_key.json")

firebase_admin.initialize_app(cred)
db = firestore.client()

# Load allergens
allergens = {d.to_dict()["name"]: d.id for d in db.collection("allergens").stream()}
print(f"Loaded {len(allergens)} allergens: {allergens}")

# Update recipes
recipes = list(db.collection("recipes").stream())
print(f"\nFound {len(recipes)} recipes")

updated = 0
skipped = 0

for doc in recipes:
    data = doc.to_dict()
    current = data.get("allergens", [])
    if not current:
        skipped += 1
        continue

    # Check if already IDs (not names)
    if all(a not in allergens for a in current):
        skipped += 1
        continue

    # Convert names to IDs
    new_allergens = []
    for a in current:
        aid = allergens.get(a)
        if aid:
            new_allergens.append(aid)
        else:
            # Already an ID or unknown — keep as is
            new_allergens.append(a)

    doc.reference.update({"allergens": new_allergens})
    print(f"  ✅ {data.get('title', 'Unknown')}: {current} → {new_allergens}")
    updated += 1

print(f"\nUpdated: {updated} recipes")
print(f"Skipped: {skipped} recipes (no allergens or already IDs)")
