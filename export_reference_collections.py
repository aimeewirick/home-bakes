"""
export_reference_collections.py
────────────────────────────────
Exports the current state of all reference collections from Firestore:
  - ingredient_categories
  - meal_types  
  - recipe_categories
  - allergens
  - units

This gives us the true current state before making any changes.

Run from your project root:
  python export_reference_collections.py
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

collections = [
    "ingredient_categories",
    "meal_types",
    "recipe_categories",
    "allergens",
    "units",
]

for col_name in collections:
    docs = db.collection(col_name).stream()
    items = [{"id": d.id, **d.to_dict()} for d in docs]
    items.sort(key=lambda x: x.get("name", x.get("abbreviation", "")))
    
    print(f"\n{'═'*50}")
    print(f"{col_name} ({len(items)} items):")
    print(f"{'─'*50}")
    for item in items:
        print(f"  {item}")
