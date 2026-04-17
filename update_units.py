"""
update_units.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Updates unit abbreviations and adds missing units.

Changes:
  - tablespoon: "tbsp" → "Tbsp"
  - cup: "c" → "cup"  
  - teaspoon: stays "tsp" (universal standard)
  - Adds: "each" (ea) for eggs, whole items etc

HOW TO USE:
  python update_units.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import firebase_admin
from firebase_admin import credentials, firestore

print("\n🔥 Connecting to Firebase...")
cred = credentials.Certificate("firebase_admin_key.json")
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()
print("✅ Connected!\n")

# ── Units to UPDATE ───────────────────────────────────────────────────────────
UPDATES = {
    "tablespoon": {"abbreviation": "Tbsp"},
    "cup":        {"abbreviation": "cup"},
}

# ── Units to ADD if missing ───────────────────────────────────────────────────
NEW_UNITS = [
    {"name": "each",   "abbreviation": "ea",   "type": "count"},
    {"name": "head",   "abbreviation": "head", "type": "count"},
    {"name": "stalk",  "abbreviation": "stalk","type": "count"},
    {"name": "strip",  "abbreviation": "strip","type": "count"},
]

print("📏 Updating unit abbreviations...")
print("─" * 50)

# Update existing units
for unit_name, changes in UPDATES.items():
    docs = db.collection("units").where("name", "==", unit_name).get()
    if docs:
        for doc in docs:
            doc.reference.update(changes)
            old = doc.to_dict().get("abbreviation", "?")
            new = changes.get("abbreviation", "?")
            print(f"✅ Updated: {unit_name} → '{old}' changed to '{new}'")
    else:
        print(f"⚠️  Not found: {unit_name}")

# Add new units
print("\n📏 Adding new units...")
for unit in NEW_UNITS:
    existing = db.collection("units").where("name", "==", unit["name"]).limit(1).get()
    if existing:
        print(f"⏭️  Skipped (exists): {unit['name']}")
    else:
        db.collection("units").add(unit)
        print(f"✅ Added: {unit['name']} ({unit['abbreviation']})")

print("\n" + "═" * 50)
print("✅ Units updated successfully!")
print("═" * 50 + "\n")
