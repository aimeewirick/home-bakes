"""
check_firestore.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run this after populate_ingredients.py and populate_units.py
to verify everything loaded correctly into Firestore.

HOW TO USE:
  python check_firestore.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import firebase_admin
from firebase_admin import credentials, firestore
from collections import Counter

print("\n🔥 Connecting to Firebase...")
cred = credentials.Certificate("firebase_admin_key.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()
print("✅ Connected!\n")


def check_ingredients():
    print("═" * 50)
    print("  📦 INGREDIENTS COLLECTION")
    print("═" * 50)

    docs = list(db.collection("ingredients").stream())
    total = len(docs)

    if total == 0:
        print("  ❌ No ingredients found!")
        print("     Run: python populate_ingredients.py")
        return

    # Count by category
    categories = Counter(d.to_dict().get("category", "Unknown") for d in docs)

    print(f"  Total ingredients: {total}\n")
    print("  By category:")
    for cat, count in sorted(categories.items()):
        bar = "█" * (count // 2)
        print(f"    {cat:<25} {count:>3}  {bar}")

    print()


def check_units():
    print("═" * 50)
    print("  📏 UNITS COLLECTION")
    print("═" * 50)

    docs = list(db.collection("units").stream())
    total = len(docs)

    if total == 0:
        print("  ❌ No units found!")
        print("     Run: python populate_units.py")
        return

    # Group by type
    by_type = {}
    for doc in docs:
        data = doc.to_dict()
        t = data.get("type", "unknown")
        if t not in by_type:
            by_type[t] = []
        by_type[t].append(f"{data['name']} ({data['abbreviation']})")

    print(f"  Total units: {total}\n")
    for unit_type, units in sorted(by_type.items()):
        print(f"  {unit_type.capitalize()}:")
        for u in units:
            print(f"    • {u}")
        print()


def check_recipes():
    print("═" * 50)
    print("  🍳 RECIPES COLLECTION")
    print("═" * 50)

    docs = list(db.collection("recipes").stream())
    total = len(docs)
    print(f"  Total recipes: {total}")

    if total > 0:
        print("\n  Recipes found:")
        for doc in docs:
            data = doc.to_dict()
            print(f"    • {data.get('title', 'Untitled')} "
                  f"[{data.get('meal_type', '?')} / "
                  f"{data.get('recipe_category', '?')}]")
    print()


# ── Run all checks ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n🔍 HomeBakes Firestore Health Check")
    print("=" * 50)
    check_ingredients()
    check_units()
    check_recipes()
    print("✅ Check complete!\n")
