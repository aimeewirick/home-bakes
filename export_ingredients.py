"""
export_ingredients.py
─────────────────────
Exports all current ingredients from Firestore to a CSV file.
Resolves unit and category IDs to human-readable names.
Flags genuine data quality issues.

Run from your project root:
  python export_ingredients.py

Output: ingredients_current.csv
"""

import os
import json
import csv
import firebase_admin
from firebase_admin import credentials, firestore
from collections import defaultdict

# ── Firebase init ─────────────────────────────────────────────────────────────
if os.environ.get("FIREBASE_CREDENTIALS"):
    cred_dict = json.loads(os.environ["FIREBASE_CREDENTIALS"])
    cred = credentials.Certificate(cred_dict)
else:
    cred = credentials.Certificate("firebase_admin_key.json")

firebase_admin.initialize_app(cred)
db = firestore.client()

print("Loading reference data...")
units      = {d.id: d.to_dict() for d in db.collection("units").stream()}
allergens  = {d.id: d.to_dict() for d in db.collection("allergens").stream()}
categories = {d.id: d.to_dict() for d in db.collection("ingredient_categories").stream()}
print(f"  Units: {len(units)}, Allergens: {len(allergens)}, Categories: {len(categories)}")

print("Fetching ingredients from Firestore...")
docs = db.collection("ingredients").stream()
ingredients = []
for doc in docs:
    data = doc.to_dict()
    data["id"] = doc.id
    ingredients.append(data)
ingredients.sort(key=lambda x: x.get("name", "").lower())
print(f"Found {len(ingredients)} ingredients")

with open("ingredients_current.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow([
        "name", "category_name", "category_id",
        "allergen_names", "allergen_ids",
        "calories", "calorie_unit_name", "calorie_unit_id",
        "missing_calories", "unit_issue", "id"
    ])
    for ing in ingredients:
        name         = ing.get("name", "")
        cat_id       = ing.get("category", "")
        cal          = ing.get("calories")
        cal_unit_id  = ing.get("calorie_unit", "")
        allergen_ids = ing.get("allergens", [])

        cat_name       = categories.get(cat_id, {}).get("name", f"UNKNOWN: {cat_id}") if cat_id else ""
        allergen_names = [allergens.get(a, {}).get("name", f"UNKNOWN:{a}") for a in allergen_ids]
        cal_unit_name  = units.get(cal_unit_id, {}).get("name", "") if cal_unit_id else ""

        missing    = "YES" if not cal else ""
        unit_issue = ""
        if cal and not cal_unit_id:
            unit_issue = "HAS CALORIES BUT NO UNIT"
        elif cal_unit_id and cal_unit_id not in units:
            unit_issue = f"INVALID UNIT ID: {cal_unit_id}"

        writer.writerow([
            name, cat_name, cat_id,
            "|".join(allergen_names), "|".join(allergen_ids),
            cal or "", cal_unit_name, cal_unit_id,
            missing, unit_issue, ing.get("id", "")
        ])

print("Exported to ingredients_current.csv")

by_cat       = defaultdict(list)
missing_list = []
issues_list  = []

for ing in ingredients:
    cat_name = categories.get(ing.get("category",""), {}).get("name", "Unknown")
    by_cat[cat_name].append(ing.get("name",""))
    if not ing.get("calories"):
        missing_list.append(ing.get("name",""))
    cal_unit_id = ing.get("calorie_unit","")
    if ing.get("calories") and cal_unit_id and cal_unit_id not in units:
        issues_list.append(f"{ing.get('name')} -> INVALID ID: {cal_unit_id}")

print(f"\n-- By category --")
for cat in sorted(by_cat.keys()):
    print(f"  {cat}: {len(by_cat[cat])}")

print(f"\n-- Missing calories: {len(missing_list)} --")
print(f"-- Unit issues: {len(issues_list)} --")
if issues_list:
    for u in issues_list:
        print(f"  {u}")
print(f"\nTotal: {len(ingredients)}")
