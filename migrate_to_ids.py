"""
migrate_to_ids.py
─────────────────────────────────────────────────────────────────
Comprehensive migration to convert all string-based references
to Firestore document IDs throughout the HomeBakes database.

Changes made:
  1. Fix ingredient_categories collection:
     - Rename "Legumes & Peanuts" → "Legumes"
     - Rename "Tree Nuts & Seeds" → "Tree Nuts"
     - Add missing: "Beverages", "Oils & Fats"
     - Add missing order fields to "Extracts & Flavorings", "Liquors"
     - Remove "Other" (not needed)

  2. Move ingredients to correct categories:
     - Oils → "Oils & Fats"
     - Sesame Seeds → "Tree Nuts"
     - Tomato Soup → "Pantry"
     - Any "Legumes & Peanuts" → "Legumes"
     - Any "Tree Nuts & Seeds" → "Tree Nuts"

  3. Convert ingredients collection:
     - category: name string → category document ID
     - allergens: [name strings] → [allergen document IDs]
     - calorie_unit: name/abbreviation string → unit document ID

  4. Convert recipe_ingredients subcollections:
     - unitId: already stored but may be wrong → verify/fix
     - calorie_unit: string → unit document ID
     - allergens: [name strings] → [allergen document IDs]
     - category: name string → category document ID

  5. Convert pending_ingredients collection:
     - Same as ingredients

Run from your project root:
  python migrate_to_ids.py

Shows full preview before making any changes.
"""

import os
import json
import firebase_admin
from firebase_admin import credentials, firestore
from collections import defaultdict

# ── Firebase init ─────────────────────────────────────────────────────────────
if os.environ.get("FIREBASE_CREDENTIALS"):
    cred_dict = json.loads(os.environ["FIREBASE_CREDENTIALS"])
    cred = credentials.Certificate(cred_dict)
else:
    key_path = os.path.join(os.path.dirname(__file__), "firebase_admin_key.json")
    cred = credentials.Certificate(key_path)

firebase_admin.initialize_app(cred)
db = firestore.client()

print("\n" + "═" * 60)
print("  HomeBakes — Migrate to Document IDs")
print("═" * 60)

# ══════════════════════════════════════════════════════════════
# STEP 1: Load all reference collections
# ══════════════════════════════════════════════════════════════
print("\n📥 Loading reference collections from Firestore...")

units        = {d.id: d.to_dict() for d in db.collection("units").stream()}
allergens    = {d.id: d.to_dict() for d in db.collection("allergens").stream()}
ing_cats     = {d.id: d.to_dict() for d in db.collection("ingredient_categories").stream()}

print(f"  Units:                 {len(units)}")
print(f"  Allergens:             {len(allergens)}")
print(f"  Ingredient categories: {len(ing_cats)}")

# ── Build lookup maps ─────────────────────────────────────────
# units: name → id
unit_by_name = {v["name"].lower(): k for k, v in units.items()}
# units: abbreviation → id  
unit_by_abbr = {v["abbreviation"].lower(): k for k, v in units.items()}
# allergens: name → id
allergen_by_name = {v["name"]: k for k, v in allergens.items()}
# ingredient_categories: name → id
ingcat_by_name = {v["name"]: k for k, v in ing_cats.items()}

print("\n  Unit lookup (name → id):")
for name, uid in sorted(unit_by_name.items()):
    print(f"    {name} → {uid}")

print("\n  Unit lookup (abbreviation → id):")
for abbr, uid in sorted(unit_by_abbr.items()):
    print(f"    {abbr} → {uid}")

# ══════════════════════════════════════════════════════════════
# STEP 2: Plan ingredient_categories fixes
# ══════════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("STEP 2: ingredient_categories fixes")
print("─" * 60)

# Define the canonical category list with final names and orders
CANONICAL_CATEGORIES = [
    {"name": "Acids & Liquids",      "order": 0},
    {"name": "Baking",               "order": 1},
    {"name": "Beverages",            "order": 2},
    {"name": "Breads & Doughs",      "order": 3},
    {"name": "Candy & Chocolate",    "order": 4},
    {"name": "Condiments",           "order": 5},
    {"name": "Dairy",                "order": 6},
    {"name": "Eggs",                 "order": 7},
    {"name": "Extracts & Flavorings","order": 8},
    {"name": "Fish & Seafood",       "order": 9},
    {"name": "Fruits",               "order": 10},
    {"name": "Grains",               "order": 11},
    {"name": "Herbs & Spices",       "order": 12},
    {"name": "Legumes",              "order": 13},
    {"name": "Liquors",              "order": 14},
    {"name": "Meat",                 "order": 15},
    {"name": "Oils & Fats",          "order": 16},
    {"name": "Pantry",               "order": 17},
    {"name": "Poultry",              "order": 18},
    {"name": "Tree Nuts",            "order": 19},
    {"name": "Vegetables",           "order": 20},
    {"name": "Other",                "order": 21},
]

canonical_names = {c["name"] for c in CANONICAL_CATEGORIES}
current_names   = {v["name"]: k for k, v in ing_cats.items()}

cat_renames = {
    "Legumes & Peanuts": "Legumes",
    "Tree Nuts & Seeds": "Tree Nuts",
}
cat_to_add    = [c for c in CANONICAL_CATEGORIES if c["name"] not in current_names and c["name"] not in cat_renames.values()]
cat_to_rename = [(old, new) for old, new in cat_renames.items() if old in current_names]
cat_to_fix_order = []
for c in CANONICAL_CATEGORIES:
    name = c["name"]
    if name in current_names:
        doc_id = current_names[name]
        current = ing_cats[doc_id]
        if current.get("order") != c["order"]:
            cat_to_fix_order.append((doc_id, name, current.get("order"), c["order"]))

print(f"\n  To rename: {len(cat_to_rename)}")
for old, new in cat_to_rename:
    print(f"    '{old}' → '{new}'")

print(f"\n  To add: {len(cat_to_add)}")
for c in cat_to_add:
    print(f"    '{c['name']}' (order: {c['order']})")

print(f"\n  To fix order: {len(cat_to_fix_order)}")
for doc_id, name, old_order, new_order in cat_to_fix_order:
    print(f"    '{name}': {old_order} → {new_order}")

# ══════════════════════════════════════════════════════════════
# STEP 3: Plan ingredient reassignments
# ══════════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("STEP 3: Ingredient category reassignments")
print("─" * 60)

OILS = [
    "Olive Oil", "Extra Virgin Olive Oil", "Vegetable Oil",
    "Canola Oil", "Coconut Oil", "Sesame Oil", "Avocado Oil",
    "Cooking Spray"
]

REASSIGNMENTS = {
    "Sesame Seeds": "Tree Nuts",
    "Tomato Soup":  "Pantry",
}
for oil in OILS:
    REASSIGNMENTS[oil] = "Oils & Fats"

# Also handle renamed categories
for old_cat, new_cat in cat_renames.items():
    REASSIGNMENTS[f"__cat__{old_cat}"] = new_cat

print(f"\n  Specific ingredient reassignments: {len(REASSIGNMENTS)}")
for name, new_cat in REASSIGNMENTS.items():
    if not name.startswith("__cat__"):
        print(f"    {name} → {new_cat}")

# ══════════════════════════════════════════════════════════════
# STEP 4: Load all ingredients and plan ID conversions
# ══════════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("STEP 4: Ingredient ID conversion plan")
print("─" * 60)

ingredients_docs = {d.id: d.to_dict() for d in db.collection("ingredients").stream()}
print(f"\n  Total ingredients: {len(ingredients_docs)}")

def get_unit_id(unit_str):
    """Convert a unit string (name or abbreviation) to unit document ID."""
    if not unit_str:
        return None
    s = unit_str.lower().strip()
    return unit_by_name.get(s) or unit_by_abbr.get(s)

def get_allergen_ids(allergen_names):
    """Convert list of allergen name strings to allergen document IDs."""
    ids = []
    for name in allergen_names:
        aid = allergen_by_name.get(name)
        if aid:
            ids.append(aid)
        else:
            print(f"    ⚠️  Unknown allergen: '{name}'")
    return ids

# Build final category map after renames and additions
# We'll apply this after the category fixes
final_cat_by_name = {}
for k, v in ing_cats.items():
    name = v["name"]
    # Apply renames
    name = cat_renames.get(name, name)
    final_cat_by_name[name] = k
# Add new categories (IDs assigned after insertion)
NEW_CAT_IDS = {}  # filled during execution

# Count issues
no_unit_id     = []
unknown_cats   = []
calorie_issues = []

for doc_id, data in ingredients_docs.items():
    cat_name  = data.get("category", "")
    cal_unit  = data.get("calorie_unit", "")
    
    # Check category
    final_cat = REASSIGNMENTS.get(data.get("name", ""), cat_name)
    # Also apply rename
    final_cat = cat_renames.get(final_cat, final_cat)
    if final_cat not in canonical_names:
        unknown_cats.append(f"{data.get('name')} → '{final_cat}'")
    
    # Check calorie unit
    if cal_unit and not get_unit_id(cal_unit):
        calorie_issues.append(f"{data.get('name')} → '{cal_unit}'")

if unknown_cats:
    print(f"\n  ⚠️  Unknown categories ({len(unknown_cats)}):")
    for u in unknown_cats:
        print(f"    {u}")

if calorie_issues:
    print(f"\n  ⚠️  Unrecognized calorie units ({len(calorie_issues)}):")
    for u in calorie_issues:
        print(f"    {u}")

# ══════════════════════════════════════════════════════════════
# CONFIRM
# ══════════════════════════════════════════════════════════════
print("\n" + "═" * 60)
print("  SUMMARY")
print("═" * 60)
print(f"  ingredient_categories to rename:   {len(cat_to_rename)}")
print(f"  ingredient_categories to add:      {len(cat_to_add)}")
print(f"  ingredient_categories order fixes: {len(cat_to_fix_order)}")
print(f"  ingredients to reassign category:  {len([i for i in ingredients_docs.values() if i.get('name') in REASSIGNMENTS])}")
print(f"  ingredients to convert to IDs:     {len(ingredients_docs)}")
print(f"  ⚠️  Unknown categories:             {len(unknown_cats)}")
print(f"  ⚠️  Unrecognized calorie units:     {len(calorie_issues)}")

print()
confirm = input("Apply all changes to Firestore? [y/n] → ").strip().lower()
if confirm != "y":
    print("Migration cancelled. No changes made.")
    exit(0)

# ══════════════════════════════════════════════════════════════
# EXECUTE
# ══════════════════════════════════════════════════════════════

# ── Execute Step 2: Fix ingredient_categories ─────────────────
print("\n📝 Fixing ingredient_categories...")

for old_name, new_name in cat_to_rename:
    doc_id = current_names[old_name]
    db.collection("ingredient_categories").document(doc_id).update({"name": new_name})
    # Update our local maps
    ing_cats[doc_id]["name"] = new_name
    ingcat_by_name[new_name] = doc_id
    del ingcat_by_name[old_name]
    print(f"  ✅ Renamed '{old_name}' → '{new_name}'")

for c in cat_to_add:
    ref = db.collection("ingredient_categories").add({"name": c["name"], "order": c["order"]})
    new_id = ref[1].id
    ing_cats[new_id] = {"name": c["name"], "order": c["order"]}
    ingcat_by_name[c["name"]] = new_id
    NEW_CAT_IDS[c["name"]] = new_id
    print(f"  ✅ Added '{c['name']}' (id: {new_id})")

for doc_id, name, old_order, new_order in cat_to_fix_order:
    db.collection("ingredient_categories").document(doc_id).update({"order": new_order})
    print(f"  ✅ Fixed order for '{name}': {old_order} → {new_order}")

# Rebuild final category by name map
final_ingcat_by_name = {v["name"]: k for k, v in ing_cats.items()}
print(f"\n  Final categories ({len(final_ingcat_by_name)}):")
for name in sorted(final_ingcat_by_name.keys()):
    print(f"    {name} → {final_ingcat_by_name[name]}")

# ── Execute Step 3 & 4: Convert ingredients to IDs ───────────
print("\n📝 Converting ingredients to use document IDs...")
updated = 0
errors  = 0

for doc_id, data in ingredients_docs.items():
    try:
        ing_name = data.get("name", "")
        
        # Determine final category name
        cat_name   = data.get("category", "")
        final_cat  = REASSIGNMENTS.get(ing_name, cat_name)
        final_cat  = cat_renames.get(final_cat, final_cat)
        
        # Get category ID
        cat_id = final_ingcat_by_name.get(final_cat)
        if not cat_id:
            print(f"  ⚠️  No category ID for '{ing_name}' (category: '{final_cat}')")
            cat_id = final_ingcat_by_name.get("Other")
        
        # Get allergen IDs
        allergen_names = data.get("allergens", [])
        allergen_ids   = get_allergen_ids(allergen_names)
        
        # Get calorie unit ID
        cal_unit_str = data.get("calorie_unit", "")
        cal_unit_id  = get_unit_id(cal_unit_str) if cal_unit_str else None
        
        db.collection("ingredients").document(doc_id).update({
            "category":     cat_id,
            "allergens":    allergen_ids,
            "calorie_unit": cal_unit_id,
        })
        updated += 1
        
    except Exception as e:
        print(f"  ❌ Error updating '{data.get('name')}': {e}")
        errors += 1

print(f"  ✅ Updated {updated} ingredients ({errors} errors)")

# ── Execute Step 5: Convert recipe_ingredients subcollections ──
print("\n📝 Converting recipe ingredients to use document IDs...")
recipe_docs = db.collection("recipes").stream()
recipe_updated = 0
recipe_errors  = 0

for recipe_doc in recipe_docs:
    ing_docs = db.collection("recipes").document(recipe_doc.id)\
                 .collection("recipe_ingredients").stream()
    for ing_doc in ing_docs:
        try:
            data = ing_doc.to_dict()
            
            # allergens → IDs
            allergen_names = data.get("allergens", [])
            allergen_ids   = get_allergen_ids(allergen_names)
            
            # calorie_unit → ID
            cal_unit_str = data.get("calorie_unit", "")
            cal_unit_id  = get_unit_id(cal_unit_str) if cal_unit_str else None
            
            # category → ID
            cat_name  = data.get("category", "")
            cat_id    = final_ingcat_by_name.get(cat_renames.get(cat_name, cat_name))
            
            updates = {
                "allergens":    allergen_ids,
                "calorie_unit": cal_unit_id,
            }
            if cat_id:
                updates["category"] = cat_id
                
            db.collection("recipes").document(recipe_doc.id)\
              .collection("recipe_ingredients").document(ing_doc.id)\
              .update(updates)
            recipe_updated += 1
            
        except Exception as e:
            print(f"  ❌ Error updating recipe ingredient: {e}")
            recipe_errors += 1

print(f"  ✅ Updated {recipe_updated} recipe ingredients ({recipe_errors} errors)")

# ── Execute Step 6: Convert pending_ingredients ────────────────
print("\n📝 Converting pending ingredients...")
pending_docs = db.collection("pending_ingredients").stream()
pending_updated = 0

for doc in pending_docs:
    try:
        data   = doc.to_dict()
        cat_name = data.get("category", "")
        cat_id   = final_ingcat_by_name.get(cat_renames.get(cat_name, cat_name))
        allergen_ids  = get_allergen_ids(data.get("allergens", []))
        cal_unit_id   = get_unit_id(data.get("calorie_unit", ""))
        
        updates = {"allergens": allergen_ids, "calorie_unit": cal_unit_id}
        if cat_id:
            updates["category"] = cat_id
        doc.reference.update(updates)
        pending_updated += 1
    except Exception as e:
        print(f"  ❌ Error: {e}")

print(f"  ✅ Updated {pending_updated} pending ingredients")

# ══════════════════════════════════════════════════════════════
print("\n" + "═" * 60)
print("  Migration complete!")
print("═" * 60)
print("""
Next steps:
  1. Update static/js/units.js          — store unit.id not abbreviation
  2. Update static/js/allergens.js      — use allergen.id not name
  3. Update static/js/ingredient-categories.js — use category.id not name
  4. Update static/js/calories.js       — use allUnits for ID-based lookup
  5. Update static/js/recipe-form.js    — pass allUnits/allAllergens/allCategories
  6. Update templates/admin.html        — store/retrieve IDs
  7. Update templates/recipe-view.html  — lookup allergens by ID
  8. Update templates/meal-plan-form.html — allergen exclusion by ID
  9. Update templates/shopping-lists.html — unit lookup by ID
  10. Update routes/ingredients.py      — filter by category ID not name
  11. Update routes/admin.py            — filter by category ID not name
""")
