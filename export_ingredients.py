"""
export_ingredients.py
─────────────────────
Exports all current ingredients from Firestore to a CSV file.
Captures ALL fields and flags data quality issues.

Run from your project root:
  python export_ingredients.py

Output: ingredients_current.csv
"""

import os
import json
import csv
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

VALID_UNITS = {"tsp","tbsp","fl oz","c","pt","qt","gal","ml","l",
               "oz","lb","g","kg","ea","whole","piece","slice",
               "clove","sprig","bunch","pinch","dash","to taste",
               "pkg","can","jar","bag","box"}

print("\nFetching ingredients from Firestore...")
docs = db.collection("ingredients").stream()

ingredients = []
for doc in docs:
    data = doc.to_dict()
    data["id"] = doc.id
    ingredients.append(data)

ingredients.sort(key=lambda x: x.get("name", "").lower())
print(f"Found {len(ingredients)} ingredients\n")

# Write to CSV
with open("ingredients_current.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow([
        "name", "category", "allergens", 
        "calories", "calorie_unit",
        "missing_calories", "unit_issue", "id"
    ])
    for ing in ingredients:
        cal       = ing.get("calories")
        cal_unit  = ing.get("calorie_unit", "") or ""
        missing   = "YES" if not cal else ""
        unit_issue = ""
        if cal and not cal_unit:
            unit_issue = "HAS CALORIES BUT NO UNIT"
        elif cal_unit and cal_unit.lower().strip() not in VALID_UNITS:
            unit_issue = f"UNKNOWN UNIT: {cal_unit}"
        elif cal_unit and cal_unit != cal_unit.lower().strip():
            unit_issue = f"NOT LOWERCASE: {cal_unit}"

        writer.writerow([
            ing.get("name", ""),
            ing.get("category", ""),
            "|".join(ing.get("allergens", [])),
            cal or "",
            cal_unit,
            missing,
            unit_issue,
            ing.get("id", ""),
        ])

print("✅ Exported to ingredients_current.csv")

# Summary
from collections import defaultdict
by_cat = defaultdict(list)
missing_cal = []
unit_issues = []

for ing in ingredients:
    by_cat[ing.get("category", "Unknown")].append(ing.get("name", ""))
    if not ing.get("calories"):
        missing_cal.append(ing.get("name", ""))
    cal_unit = (ing.get("calorie_unit") or "").strip()
    if ing.get("calories") and (not cal_unit or cal_unit.lower() not in VALID_UNITS or cal_unit != cal_unit.lower()):
        unit_issues.append(f"{ing.get('name')} → '{cal_unit}'")

print("\n── By category ──")
for cat in sorted(by_cat.keys()):
    print(f"  {cat}: {len(by_cat[cat])}")

print(f"\n── Total: {len(ingredients)} ingredients ──")
print(f"── Missing calories: {len(missing_cal)} ──")
print(f"── Unit issues: {len(unit_issues)} ──")
if unit_issues:
    for u in unit_issues:
        print(f"  {u}")
