"""
fix_vegetable_calories.py
──────────────────────────
Updates vegetable calorie data to use the most natural unit:
- Countable vegetables (onions, potatoes, peppers) → each (ea)
- Non-countable vegetables (spinach, broccoli, peas) → cup

All calorie values from USDA FoodData Central.

Run from your project root:
  python fix_vegetable_calories.py
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

# Load unit IDs
units_by_name = {d.to_dict()["name"]: d.id for d in db.collection("units").stream()}
print(f"Loaded {len(units_by_name)} units")

EA_ID  = units_by_name["each"]
CUP_ID = units_by_name["cup"]
print(f"  each → {EA_ID}")
print(f"  cup  → {CUP_ID}")

# ── Vegetable calorie data ────────────────────────────────────────────────────
# Format: "Name": (calories, unit_name)
# Countable = ea, non-countable = cup
VEGETABLE_CALORIES = {
    # Countable — ea
    "Yellow Onion":      (44,  "each"),   # medium onion
    "Red Onion":         (44,  "each"),   # medium onion
    "White Onion":       (44,  "each"),   # medium onion
    "Shallots":          (58,  "cup"),    # typically measured by cup
    "Red Potato":        (149, "each"),   # medium red potato
    "Russet Potato":     (168, "each"),   # medium russet potato
    "Yukon Gold Potato": (149, "each"),   # medium potato
    "Sweet Potato":      (103, "each"),   # medium sweet potato
    "Carrots":           (25,  "each"),   # medium carrot
    "Eggplant":          (137, "each"),   # medium eggplant
    "Corn":              (132, "cup"),    # kernels (more flexible)
    "Butternut Squash":  (63,  "cup"),    # cubed
    "Acorn Squash":      (115, "cup"),    # cubed
    "Tomatoes":          (22,  "each"),   # medium tomato
    "Roma Tomatoes":     (35,  "each"),   # roma tomato
    "Cherry Tomatoes":   (27,  "cup"),    # by cup
    "Bell Pepper Red":   (37,  "each"),   # medium pepper
    "Bell Pepper Green": (24,  "each"),   # medium pepper
    "Bell Pepper Yellow": (50, "each"),   # medium pepper
    "Jalapeno":          (4,   "each"),   # one jalapeno
    "Serrano Pepper":    (2,   "each"),   # one serrano
    "Poblano Pepper":    (48,  "each"),   # one poblano
    "Cucumber":          (45,  "each"),   # medium cucumber
    "Zucchini":          (33,  "each"),   # medium zucchini
    "Yellow Squash":     (31,  "each"),   # medium squash
    "Leeks":             (54,  "cup"),    # sliced
    "Garlic":            (4,   "clove"),  # per clove

    # Non-countable — cup
    "Artichoke Hearts":  (45,  "cup"),
    "Arugula":           (5,   "cup"),
    "Asparagus":         (27,  "cup"),
    "Beets":             (59,  "cup"),
    "Broccoli":          (31,  "cup"),
    "Brussels Sprouts":  (38,  "cup"),
    "Cabbage Green":     (22,  "cup"),
    "Cabbage Red":       (28,  "cup"),
    "Cauliflower":       (27,  "cup"),
    "Celery":            (16,  "cup"),
    "Green Beans":       (31,  "cup"),
    "Green Onions":      (32,  "cup"),
    "Iceberg Lettuce":   (10,  "cup"),
    "Kale":              (33,  "cup"),
    "Mushrooms Button":  (15,  "cup"),
    "Mushrooms Cremini": (15,  "cup"),
    "Mushrooms Portobello": (22, "cup"),
    "Mushrooms Shiitake": (40, "cup"),
    "Peas Fresh":        (118, "cup"),
    "Peas Frozen":       (103, "cup"),
    "Radishes":          (19,  "cup"),
    "Romaine Lettuce":   (8,   "cup"),
    "Spinach":           (7,   "cup"),
    "Sun-Dried Tomatoes": (139, "cup"),
    "Watermelon":        (86,  "cup"),
}

# Load ingredients
print("\nLoading ingredients...")
docs = {d.to_dict()["name"]: {"id": d.id, **d.to_dict()}
        for d in db.collection("ingredients").stream()}

# Preview
print("\n" + "="*60)
print("  PREVIEW")
print("="*60)

to_update = []
not_found = []

for name, (calories, unit_name) in VEGETABLE_CALORIES.items():
    ing = docs.get(name)
    if not ing:
        not_found.append(name)
        continue
    unit_id = units_by_name.get(unit_name)
    if not unit_id:
        print(f"  ❌ Unknown unit '{unit_name}' for {name}")
        continue
    current_cal  = ing.get("calories")
    current_unit = ing.get("calorie_unit")
    to_update.append((ing["id"], name, calories, unit_id, unit_name,
                       current_cal, current_unit))

print(f"\n  Ready to update: {len(to_update)}")
if not_found:
    print(f"  Not found: {not_found}")

print("\n  Changes:")
for ing_id, name, cal, unit_id, unit_name, old_cal, old_unit in to_update:
    print(f"  {name}: {old_cal or '—'} → {cal} cal/{unit_name}")

print()
confirm = input("Apply updates? [y/n] → ").strip().lower()
if confirm != "y":
    print("Cancelled.")
    exit(0)

print("\nUpdating...")
updated = 0
for ing_id, name, cal, unit_id, unit_name, _, _ in to_update:
    try:
        db.collection("ingredients").document(ing_id).update({
            "calories":     cal,
            "calorie_unit": unit_id,
        })
        print(f"  ✅ {name}: {cal} cal/{unit_name}")
        updated += 1
    except Exception as e:
        print(f"  ❌ {name}: {e}")

print(f"\n{'='*60}")
print(f"  Done! Updated: {updated}")
print(f"{'='*60}")
print("\nRe-save any recipes using these vegetables to recalculate calories.")
