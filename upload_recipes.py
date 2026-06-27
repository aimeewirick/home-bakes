"""
upload_recipes.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reads recipes_upload.csv and uploads recipes to
Firestore under the admin uid.

HOW TO USE:
  1. Generate and fill the Excel template:
       python generate_recipe_template.py
  2. Fill in your recipes in the Excel file
  3. Save As → CSV (Comma delimited) → recipes_upload.csv
  4. Run: python upload_recipes.py

WHAT IT DOES:
  - Looks up ingredient names against Firestore
  - Offers fuzzy suggestions for close matches
  - Asks if you want to add unmatched ingredients
  - Looks up unit names against Firestore
  - Validates meal type and category
  - Shows full recipe preview before uploading
  - Asks for confirmation before each recipe
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import csv
import os
import json
import sys
from datetime import datetime, timezone
from difflib import get_close_matches
import firebase_admin
from firebase_admin import credentials, firestore, auth

# ── Firebase init ─────────────────────────────────────────────────────────────
print("\n🔥 Connecting to Firebase...")
cred_json = os.environ.get("FIREBASE_CREDENTIALS")
if cred_json:
    cred = credentials.Certificate(json.loads(cred_json))
else:
    cred = credentials.Certificate("firebase_admin_key.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()
print("✅ Connected!\n")

# ── Load reference data from Firestore ───────────────────────────────────────
print("📂 Loading reference data from Firestore...")

ingredients_docs = list(db.collection("ingredients").stream())
ingredients_map  = {d.to_dict()["name"].lower(): {"id": d.id, "name": d.to_dict()["name"], "allergens": d.to_dict().get("allergens", [])} for d in ingredients_docs}
ingredient_names = list(ingredients_map.keys())

units_docs  = list(db.collection("units").stream())
units_map   = {d.to_dict()["name"].lower(): {"id": d.id, "name": d.to_dict()["name"], "abbreviation": d.to_dict().get("abbreviation", "")} for d in units_docs}
# Also index by abbreviation (case-insensitive) so 'tbsp', 'tsp', 'c' etc resolve directly
for d in units_docs:
    data = d.to_dict()
    abbr = data.get("abbreviation", "").lower().strip()
    if abbr and abbr not in units_map:
        units_map[abbr] = {"id": d.id, "name": data["name"], "abbreviation": data.get("abbreviation", "")}
unit_names  = list(units_map.keys())

meal_types_docs = list(db.collection("meal_types").stream())
meal_types_map  = {d.to_dict()["name"].lower(): {"id": d.id, "name": d.to_dict()["name"]} for d in meal_types_docs}

categories_docs = list(db.collection("recipe_categories").stream())
categories_map  = {d.to_dict()["name"].lower(): {"id": d.id, "name": d.to_dict()["name"]} for d in categories_docs}

ingredient_categories_docs = list(db.collection("ingredient_categories").stream())
ingredient_categories_map  = {d.to_dict()["name"]: d.id for d in ingredient_categories_docs}
ingredient_category_names  = list(ingredient_categories_map.keys())

print(f"  ✅ {len(ingredients_map)} ingredients")
print(f"  ✅ {len(units_map)} units")
print(f"  ✅ {len(meal_types_map)} meal types")
print(f"  ✅ {len(categories_map)} recipe categories\n")

# ── Get admin uid ─────────────────────────────────────────────────────────────
def get_admin_uid():
    """Find the first admin user in Firebase Auth."""
    print("🔑 Finding admin user...")
    page = auth.list_users()
    for user in page.users:
        try:
            claims = auth.get_user(user.uid).custom_claims or {}
            if claims.get("admin"):
                print(f"  ✅ Admin found: {user.email} ({user.uid})\n")
                return user.uid
        except Exception:
            continue
    print("  ❌ No admin user found. Make sure you have set admin claims.")
    sys.exit(1)

# ── Fuzzy lookup helpers ──────────────────────────────────────────────────────
def fuzzy_pick(name, lookup_map, label, cutoff=0.6):
    """
    Look up name in lookup_map (lowercase keys → {id, name}).
    Returns the matched {id, name} dict or None.
    Checks: exact → substring → fuzzy.
    """
    key = name.strip().lower()

    # Exact match
    if key in lookup_map:
        return lookup_map[key]

    # Substring match — sorted by length (shorter names = closer match)
    substring_matches = sorted(
        [k for k in lookup_map.keys() if key in k or k in key],
        key=lambda k: len(k)
    )

    # Fuzzy match
    fuzzy_matches = get_close_matches(key, lookup_map.keys(), n=5, cutoff=cutoff)

    # Combine, deduplicate, preserve order (substring first)
    seen = set()
    suggestions = []
    for m in substring_matches + fuzzy_matches:
        if m not in seen:
            seen.add(m)
            suggestions.append(m)
    suggestions = suggestions[:8]

    if not suggestions:
        print(f"\n  ❌ No match found for {label}: '{name}'")
        return None

    print(f"\n  ⚠️  No exact match for {label}: '{name}'")
    print(f"  Did you mean one of these?")
    for i, s in enumerate(suggestions, 1):
        print(f"    [{i}] {lookup_map[s]['name']}")
    if label == "ingredient":
        print(f"    [A] Add '{name}' as a new ingredient")
    print(f"    [S] Skip this {label}")

    while True:
        choice = input(f"  Select (1-{len(suggestions)}) or S to skip: ").strip().upper()
        if choice == "S":
            return None
        if choice == "A" and label == "ingredient":
            return None  # Signal to caller to add new
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(suggestions):
                return lookup_map[suggestions[idx]]
        except ValueError:
            pass
        print(f"  Please enter a number between 1 and {len(suggestions)}, or S")

def add_new_ingredient(name):
    """Prompt admin to add a new ingredient to Firestore."""
    print(f"\n  📝 Add '{name}' as a new ingredient?")
    print(f"  Available categories:")
    for i, cat in enumerate(sorted(ingredient_category_names), 1):
        print(f"    [{i}] {cat}")
    print(f"    [S] Skip — don't add this ingredient")

    while True:
        choice = input(f"  Select category (1-{len(ingredient_category_names)}) or S: ").strip().upper()
        if choice == "S":
            return None
        try:
            idx = int(choice) - 1
            sorted_cats = sorted(ingredient_category_names)
            if 0 <= idx < len(sorted_cats):
                cat_name = sorted_cats[idx]
                cat_id   = ingredient_categories_map[cat_name]
                # Add to Firestore
                ref = db.collection("ingredients").add({
                    "name":     name.strip(),
                    "category": cat_id,
                    "allergens": [],
                })
                new_id = ref[1].id
                new_entry = {"id": new_id, "name": name.strip(), "allergens": []}
                # Add to local map for this session
                ingredients_map[name.lower()] = new_entry
                ingredient_names.append(name.lower())
                print(f"  ✅ Added new ingredient: {name} ({cat_name})")
                return new_entry
        except ValueError:
            pass
        print(f"  Please enter a number between 1 and {len(ingredient_category_names)}, or S")

# ── Parse ingredients string ──────────────────────────────────────────────────
def parse_ingredients(ingredients_str):
    """
    Parse 'flour:2:cup|water:1.5:cup|salt:1:tsp'
    Returns list of resolved ingredient dicts or None on failure.
    """
    resolved = []
    parts    = [p.strip() for p in ingredients_str.split("|") if p.strip()]

    for part in parts:
        segments = part.split(":")
        if len(segments) < 2:
            print(f"  ⚠️  Skipping malformed ingredient: '{part}' (expected name:qty:unit)")
            continue

        ing_name  = segments[0].strip()
        qty_str   = segments[1].strip() if len(segments) > 1 else "1"
        unit_name = segments[2].strip() if len(segments) > 2 else ""

        # Quantity
        try:
            quantity = float(qty_str) if qty_str else None
        except ValueError:
            print(f"  ⚠️  Invalid quantity '{qty_str}' for '{ing_name}' — setting to null")
            quantity = None

        # Resolve ingredient
        ing = fuzzy_pick(ing_name, ingredients_map, "ingredient")
        if ing is None:
            add_it = input(f"  Add '{ing_name}' as a new ingredient? (y/n): ").strip().lower()
            if add_it == "y":
                ing = add_new_ingredient(ing_name)
            if ing is None:
                print(f"  ⏭️  Skipping ingredient: {ing_name}")
                continue

        # Resolve unit
        unit = None
        if unit_name:
            unit = fuzzy_pick(unit_name.lower().strip(), units_map, "unit")

        resolved.append({
            "ingredientId":   ing["id"],
            "ingredientName": ing["name"],
            "amount":         quantity,
            "unitId":         unit["id"] if unit else "",
            "unitName":       unit["name"] if unit else "",
            "unitType":       "count",
            "note":           "",
            "allergens":      ing.get("allergens", []),
            "calories":       None,
            "calorie_unit":   None,
            "category":       "",
        })

    return resolved

# ── Parse directions string ───────────────────────────────────────────────────
def parse_directions(directions_str):
    """Parse 'Mix ingredients|Knead dough|Bake 30 min' into direction dicts."""
    steps = [s.strip() for s in directions_str.split("|") if s.strip()]
    return [{"order": i + 1, "title": f"Step {i + 1}", "text": text} for i, text in enumerate(steps)]

# ── Preview recipe ────────────────────────────────────────────────────────────
def preview_recipe(recipe, ingredients, directions):
    print("\n" + "═" * 60)
    print(f"  📖 RECIPE PREVIEW")
    print("═" * 60)
    print(f"  Title:     {recipe['title']}")
    print(f"  Meal Type: {recipe['meal_type']}")
    print(f"  Category:  {recipe['recipe_category']}")
    print(f"  Servings:  {recipe.get('servings', '—')}")
    print(f"  Public:    {recipe.get('isPublic', False)}")
    if recipe.get("notes"):
        print(f"  Notes:     {recipe['notes']}")
    print(f"\n  🥕 Ingredients ({len(ingredients)}):")
    for ing in ingredients:
        qty = ing['amount']
        if qty is None:
            qty_str = ""
        else:
            qty_str = str(int(qty)) if qty == int(qty) else str(qty)
        print(f"     • {qty_str} {ing['unitName']} {ing['ingredientName']}".strip())
    print(f"\n  📝 Directions ({len(directions)}):")
    for d in directions:
        print(f"     {d['order']}. {d['text']}")
    print("═" * 60)

# ── Main upload loop ──────────────────────────────────────────────────────────
def upload_recipes(csv_file="recipes_upload.csv"):
    if not os.path.exists(csv_file):
        print(f"❌ Could not find '{csv_file}'")
        print(f"   Make sure you saved your Excel template as '{csv_file}'")
        sys.exit(1)

    admin_uid = get_admin_uid()
    added     = 0
    skipped   = 0
    errors    = []

    print(f"📂 Reading from: {csv_file}\n")

    with open(csv_file, newline="", encoding="cp1252") as f:
        reader = csv.DictReader(f)

        # Normalize headers to lowercase
        reader.fieldnames = [f.lower() for f in (reader.fieldnames or [])]

        # Validate columns
        required_cols = {"title", "meal_type", "category", "ingredients", "directions"}
        missing = required_cols - set(reader.fieldnames or [])
        if missing:
            print(f"❌ CSV is missing required columns: {missing}")
            print(f"   Found columns: {reader.fieldnames}")
            sys.exit(1)

        for row_num, row in enumerate(reader, start=2):
            title = row.get("title", "").strip()

            # Skip blank rows and the example row
            if not title or title.startswith("Grandma's Yeast Bread"):
                continue

            print(f"\n{'─' * 60}")
            print(f"📖 Processing row {row_num}: {title}")

            # ── Resolve meal type ─────────────────────────────────────────
            meal_type_raw = row.get("meal_type", "").strip()
            meal_type     = fuzzy_pick(meal_type_raw, meal_types_map, "meal type")
            if not meal_type:
                print(f"  ❌ Could not resolve meal type — skipping recipe")
                skipped += 1
                continue

            # ── Resolve category ──────────────────────────────────────────
            category_raw = row.get("category", "").strip()
            category     = fuzzy_pick(category_raw, categories_map, "category")
            if not category:
                print(f"  ❌ Could not resolve category — skipping recipe")
                skipped += 1
                continue

            # ── Servings ──────────────────────────────────────────────────
            servings_raw = row.get("servings", "").strip()
            try:
                servings = int(servings_raw) if servings_raw else None
            except ValueError:
                servings = None

            # ── Is Public ─────────────────────────────────────────────────
            is_public = row.get("is_public", "false").strip().lower() == "true"

            # ── Notes ─────────────────────────────────────────────────────
            notes = row.get("notes", "").strip()

            # ── Ingredients ───────────────────────────────────────────────
            ingredients_str = row.get("ingredients", "").strip()
            if not ingredients_str:
                print(f"  ❌ No ingredients — skipping recipe")
                skipped += 1
                continue

            ingredients = parse_ingredients(ingredients_str)
            if not ingredients:
                print(f"  ❌ No valid ingredients resolved — skipping recipe")
                skipped += 1
                continue

            # ── Directions ────────────────────────────────────────────────
            directions_str = row.get("directions", "").strip()
            directions     = parse_directions(directions_str) if directions_str else []

            # ── Build recipe dict ─────────────────────────────────────────
            recipe = {
                "title":            title,
                "meal_type":        meal_type["name"],
                "recipe_category":  category["name"],
                "isPublic":         is_public,
                "notes":            notes,
                "uid":              admin_uid,
            }
            if servings:
                recipe["servings"] = servings

            # Allergen summary from all ingredients
            allergen_set = set()
            for ing in ingredients:
                for a in (ing.get("allergens") or []):
                    allergen_set.add(a)
            recipe["allergens"] = list(allergen_set)

            # ── Preview + confirm ─────────────────────────────────────────
            preview_recipe(recipe, ingredients, directions)

            while True:
                choice = input("\n  Upload this recipe? (y/n/q to quit): ").strip().lower()
                if choice == "y":
                    break
                elif choice == "n":
                    print(f"  ⏭️  Skipped: {title}")
                    skipped += 1
                    break
                elif choice == "q":
                    print("\n👋 Upload cancelled by admin.")
                    print(f"  ✅ Uploaded: {added}  ⏭️  Skipped: {skipped}  ❌ Errors: {len(errors)}")
                    sys.exit(0)

            if choice != "y":
                continue

            # ── Write to Firestore ────────────────────────────────────────
            try:
                now = datetime.now(timezone.utc)
                recipe_data = dict(recipe)
                recipe_data["createdAt"]  = now
                recipe_data["updatedAt"]  = now
                recipe_data["directions"] = directions

                ref        = db.collection("recipes").add(recipe_data)
                recipe_id  = ref[1].id

                # Write ingredients subcollection
                for i, ing in enumerate(ingredients):
                    ing_data = {
                        "order":          i + 1,
                        "ingredientId":   ing["ingredientId"],
                        "ingredientName": ing["ingredientName"],
                        "unitId":         ing["unitId"],
                        "unitName":       ing["unitName"],
                        "unitType":       ing.get("unitType", "count"),
                        "note":           ing.get("note", ""),
                        "allergens":      ing.get("allergens", []),
                        "calories":       ing.get("calories"),
                        "calorie_unit":   ing.get("calorie_unit"),
                        "category":       ing.get("category", ""),
                    }
                    if ing["amount"] is not None:
                        ing_data["amount"] = ing["amount"]
                    db.collection("recipes").document(recipe_id) \
                      .collection("recipe_ingredients").add(ing_data)

                print(f"  ✅ Uploaded: {title} (id: {recipe_id})")
                added += 1

            except Exception as e:
                print(f"  ❌ Error uploading '{title}': {e}")
                errors.append(title)

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "═" * 60)
    print(f"  ✅ Uploaded: {added} recipes")
    print(f"  ⏭️  Skipped:  {skipped} recipes")
    if errors:
        print(f"  ❌ Errors:   {len(errors)}")
        for e in errors:
            print(f"     - {e}")
    print("═" * 60)
    print("\n🎉 Done!\n")

# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    csv_file = sys.argv[1] if len(sys.argv) > 1 else "recipes_upload.csv"
    upload_recipes(csv_file)
