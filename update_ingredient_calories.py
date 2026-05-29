"""
update_ingredient_calories.py
──────────────────────────────
Bulk updates calorie data for 206 ingredients missing calories.
All values sourced from USDA FoodData Central.

Stores calorie_unit as unit document ID (not string).

Run from your project root:
  python update_ingredient_calories.py
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
    cred = credentials.Certificate("firebase_admin_key.json")

firebase_admin.initialize_app(cred)
db = firestore.client()

# ── Load units — build name → id lookup ───────────────────────────────────────
units = {d.to_dict()["name"]: d.id for d in db.collection("units").stream()}
print(f"Loaded {len(units)} units")

# ── Calorie data (USDA FoodData Central) ──────────────────────────────────────
# Format: "Ingredient Name": (calories, unit_name)
CALORIE_DATA = {
    # Acids & Liquids
    "Apple Cider Vinegar":    (3,    "tablespoon"),
    "Balsamic Vinegar":       (14,   "tablespoon"),
    "Beer":                   (153,  "cup"),
    "Lemon Juice":            (4,    "tablespoon"),
    "Lime Juice":             (4,    "tablespoon"),
    "Orange Juice":           (112,  "cup"),
    "Red Wine":               (125,  "cup"),
    "Red Wine Vinegar":       (3,    "tablespoon"),
    "Water":                  (0,    "cup"),
    "White Wine":             (121,  "cup"),
    "White Wine Vinegar":     (3,    "tablespoon"),

    # Baking
    "Arrowroot Powder":       (29,   "tablespoon"),
    "Baking Soda":            (0,    "teaspoon"),
    "Cornstarch":             (30,   "tablespoon"),
    "Jello":                  (80,   "cup"),
    "Molasses":               (58,   "tablespoon"),
    "Salt":                   (0,    "teaspoon"),
    "Tapioca Starch":         (30,   "tablespoon"),
    "Unflavored Gelatin":     (20,   "tablespoon"),

    # Beverages
    "Coffee Brewed":          (2,    "cup"),
    "Coffee Espresso":        (5,    "cup"),

    # Breads & Doughs
    "Bagels":                 (270,  "each"),
    "Brioche":                (90,   "slice"),
    "Corn Tortillas":         (52,   "each"),
    "Crescent Roll Dough":    (100,  "each"),
    "English Muffins":        (132,  "each"),
    "French Bread":           (185,  "slice"),
    "Hamburger Buns":         (120,  "each"),
    "Hot Dog Buns":           (120,  "each"),
    "Italian Bread":          (81,   "slice"),
    "Naan":                   (262,  "each"),
    "Phyllo Dough":           (57,   "each"),
    "Pie Crust Store Bought": (119,  "slice"),
    "Pita Bread":             (165,  "each"),
    "Pizza Dough":            (130,  "slice"),
    "Puff Pastry":            (170,  "slice"),
    "Sandwich Bread":         (67,   "slice"),
    "Sourdough Bread":        (93,   "slice"),
    "Whole Wheat Bread":      (69,   "slice"),

    # Candy & Chocolate
    "Candy Canes":            (60,   "each"),
    "Caramel Bits":           (70,   "tablespoon"),
    "Graham Crackers":        (59,   "each"),
    "M&Ms":                   (70,   "tablespoon"),
    "Mini Marshmallows":      (23,   "tablespoon"),
    "Oreos":                  (53,   "each"),
    "Reeses Pieces":          (88,   "tablespoon"),
    "Sprinkles":              (20,   "tablespoon"),
    "Toffee Bits":            (70,   "tablespoon"),

    # Condiments
    "Balsamic Glaze":         (20,   "tablespoon"),
    "Caesar Dressing":        (78,   "tablespoon"),
    "Dijon Mustard":          (15,   "tablespoon"),
    "Guacamole":              (23,   "tablespoon"),
    "Hummus":                 (25,   "tablespoon"),
    "Italian Dressing":       (43,   "tablespoon"),
    "Ranch Dressing":         (73,   "tablespoon"),
    "Salsa":                  (10,   "tablespoon"),
    "Whole Grain Mustard":    (10,   "tablespoon"),
    "Yellow Mustard":         (9,    "tablespoon"),

    # Dairy
    "Coolwhip":               (25,   "tablespoon"),
    "Feta Cheese":            (75,   "ounce"),
    "Goat Cheese":            (76,   "ounce"),
    "Gruyere Cheese":         (117,  "ounce"),
    "Mascarpone":             (120,  "tablespoon"),
    "Pectin":                 (0,    "tablespoon"),
    "Ricotta Cheese":         (39,   "tablespoon"),

    # Fish & Seafood
    "Anchovies":              (42,   "ounce"),
    "Clams":                  (42,   "ounce"),
    "Cod Fillet":             (30,   "ounce"),
    "Crab Meat":              (28,   "ounce"),
    "Halibut":                (40,   "ounce"),
    "Lobster":                (28,   "ounce"),
    "Mussels":                (49,   "ounce"),
    "Oysters":                (41,   "ounce"),
    "Sardines":               (59,   "ounce"),
    "Scallops":               (26,   "ounce"),
    "Tilapia":                (36,   "ounce"),

    # Fruits
    "Apples":                 (95,   "each"),
    "Avocado":                (240,  "each"),
    "Bananas":                (105,  "each"),
    "Blackberries":           (62,   "cup"),
    "Blueberries":            (84,   "cup"),
    "Cantaloupe":             (54,   "cup"),
    "Cherries":               (87,   "cup"),
    "Coconut":                (283,  "cup"),
    "Dates":                  (20,   "each"),
    "Dried Cranberries":      (123,  "cup"),
    "Grapefruit":             (52,   "each"),
    "Grapes":                 (104,  "cup"),
    "Lemons":                 (17,   "each"),
    "Limes":                  (20,   "each"),
    "Mangoes":                (99,   "each"),
    "Oranges":                (62,   "each"),
    "Peaches":                (59,   "each"),
    "Pears":                  (101,  "each"),
    "Pineapple":              (82,   "cup"),
    "Plums":                  (30,   "each"),
    "Raisins":                (129,  "cup"),
    "Raspberries":            (64,   "cup"),
    "Strawberries":           (49,   "cup"),
    "Watermelon":             (86,   "cup"),

    # Grains
    "Barley":                 (193,  "cup"),
    "Breadcrumbs Panko":      (30,   "tablespoon"),
    "Breadcrumbs Plain":      (30,   "tablespoon"),
    "Cornmeal":               (110,  "cup"),
    "Fettuccine":             (220,  "cup"),
    "Lasagna Noodles":        (196,  "cup"),
    "Linguine":               (220,  "cup"),
    "Penne":                  (220,  "cup"),
    "Ramen Noodles":          (188,  "cup"),
    "Rigatoni":               (220,  "cup"),
    "Spaghetti":              (220,  "cup"),

    # Legumes
    "Cannellini Beans":       (255,  "cup"),
    "Edamame":                (189,  "cup"),
    "Kidney Beans":           (225,  "cup"),
    "Navy Beans":             (255,  "cup"),
    "Peanuts":                (166,  "ounce"),
    "Pinto Beans":            (245,  "cup"),
    "Tofu Firm":              (70,   "cup"),
    "Tofu Silken":            (45,   "cup"),

    # Liquors
    "Bourbon":                (70,   "fluid ounce"),
    "Brandy":                 (65,   "fluid ounce"),
    "Kahlua":                 (91,   "fluid ounce"),
    "Rum":                    (65,   "fluid ounce"),

    # Meat
    "Beef Brisket":           (74,   "ounce"),
    "Beef Short Ribs":        (80,   "ounce"),
    "Beef Tenderloin":        (54,   "ounce"),
    "Breakfast Sausage":      (90,   "ounce"),
    "Chuck Roast":            (70,   "ounce"),
    "Flank Steak":            (55,   "ounce"),
    "Ground Lamb":            (80,   "ounce"),
    "Ground Pork":            (72,   "ounce"),
    "Ham":                    (52,   "ounce"),
    "Italian Sausage":        (90,   "ounce"),
    "Lamb Chops":             (73,   "ounce"),
    "Pepperoni":              (130,  "ounce"),
    "Pork Tenderloin":        (46,   "ounce"),
    "Prosciutto":             (55,   "ounce"),
    "Ribeye Steak":           (77,   "ounce"),
    "Sirloin Steak":          (58,   "ounce"),

    # Pantry
    "Avocado Oil":            (120,  "tablespoon"),
    "Beef Broth":             (17,   "cup"),
    "Chicken Broth":          (15,   "cup"),
    "Cooking Spray":          (0,    "each"),
    "Diced Tomatoes Canned":  (41,   "cup"),
    "Fish Sauce":             (6,    "tablespoon"),
    "Hoisin Sauce":           (35,   "tablespoon"),
    "Hot Sauce":              (1,    "teaspoon"),
    "Oyster Sauce":           (9,    "tablespoon"),
    "Sriracha":               (5,    "teaspoon"),
    "Teriyaki Sauce":         (16,   "tablespoon"),
    "Tomato Paste":           (13,   "tablespoon"),
    "Tomato Sauce Canned":    (59,   "cup"),
    "Vegetable Broth":        (12,   "cup"),
    "Whole Tomatoes Canned":  (41,   "cup"),

    # Poultry
    "Chicken Drumsticks":     (47,   "ounce"),
    "Chicken Thighs":         (53,   "ounce"),
    "Chicken Wings":          (56,   "ounce"),
    "Duck Breast":            (57,   "ounce"),
    "Ground Chicken":         (45,   "ounce"),
    "Turkey Breast":          (38,   "ounce"),
    "Whole Chicken":          (54,   "ounce"),
    "Whole Turkey":           (54,   "ounce"),

    # Tree Nuts
    "Brazil Nuts":            (186,  "ounce"),
    "Hazelnuts":              (178,  "ounce"),
    "Macadamia Nuts":         (204,  "ounce"),
    "Pistachios":             (159,  "ounce"),

    # Vegetables
    "Acorn Squash":           (115,  "cup"),
    "Artichoke Hearts":       (45,   "cup"),
    "Arugula":                (5,    "cup"),
    "Asparagus":              (27,   "cup"),
    "Beets":                  (59,   "cup"),
    "Bell Pepper Green":      (31,   "cup"),
    "Bell Pepper Red":        (46,   "cup"),
    "Bell Pepper Yellow":     (50,   "cup"),
    "Broccoli":               (31,   "cup"),
    "Brussels Sprouts":       (38,   "cup"),
    "Cabbage Green":          (22,   "cup"),
    "Cabbage Red":            (28,   "cup"),
    "Cauliflower":            (27,   "cup"),
    "Celery":                 (16,   "cup"),
    "Cherry Tomatoes":        (27,   "cup"),
    "Corn":                   (132,  "cup"),
    "Cucumber":               (16,   "cup"),
    "Garlic":                 (4,    "clove"),
    "Green Beans":            (31,   "cup"),
    "Iceberg Lettuce":        (10,   "cup"),
    "Jalapeno":               (4,    "each"),
    "Kale":                   (33,   "cup"),
    "Leeks":                  (54,   "cup"),
    "Mushrooms Button":       (15,   "cup"),
    "Mushrooms Cremini":      (15,   "cup"),
    "Mushrooms Portobello":   (22,   "cup"),
    "Mushrooms Shiitake":     (40,   "cup"),
    "Peas Fresh":             (118,  "cup"),
    "Peas Frozen":            (103,  "cup"),
    "Poblano Pepper":         (48,   "each"),
    "Radishes":               (19,   "cup"),
    "Roma Tomatoes":          (35,   "each"),
    "Romaine Lettuce":        (8,    "cup"),
    "Serrano Pepper":         (2,    "each"),
    "Shallots":               (58,   "cup"),
    "Spinach":                (7,    "cup"),
    "Sun-Dried Tomatoes":     (139,  "cup"),
    "Tomatoes":               (32,   "cup"),
    "Yellow Squash":          (36,   "cup"),
    "Zucchini":               (21,   "cup"),
}

# ── Load ingredients ──────────────────────────────────────────────────────────
print("\nLoading ingredients from Firestore...")
docs = {d.to_dict()["name"]: {"id": d.id, **d.to_dict()} 
        for d in db.collection("ingredients").stream()}
print(f"Loaded {len(docs)} ingredients")

# ── Preview ───────────────────────────────────────────────────────────────────
print("\n" + "═" * 60)
print("  PREVIEW")
print("═" * 60)

not_found_ing  = []
not_found_unit = []
to_update      = []

for name, (calories, unit_name) in CALORIE_DATA.items():
    ing = docs.get(name)
    if not ing:
        not_found_ing.append(name)
        continue
    unit_id = units.get(unit_name)
    if not unit_id:
        not_found_unit.append(f"{name} → '{unit_name}'")
        continue
    to_update.append((ing["id"], name, calories, unit_id, unit_name))

print(f"\n  Ready to update:         {len(to_update)}")
print(f"  Ingredients not found:   {len(not_found_ing)}")
print(f"  Unit names not found:    {len(not_found_unit)}")

if not_found_ing:
    print(f"\n  Missing ingredients:")
    for n in not_found_ing:
        print(f"    - {n}")

if not_found_unit:
    print(f"\n  Missing units:")
    for u in not_found_unit:
        print(f"    - {u}")

print()
confirm = input("Apply updates to Firestore? [y/n] → ").strip().lower()
if confirm != "y":
    print("Cancelled.")
    exit(0)

# ── Apply updates ─────────────────────────────────────────────────────────────
print("\nUpdating ingredients...")
updated = 0
errors  = 0

for ing_id, name, calories, unit_id, unit_name in to_update:
    try:
        db.collection("ingredients").document(ing_id).update({
            "calories":     calories,
            "calorie_unit": unit_id,
        })
        print(f"  ✅ {name}: {calories} cal/{unit_name}")
        updated += 1
    except Exception as e:
        print(f"  ❌ {name}: {e}")
        errors += 1

print(f"\n{'═'*60}")
print(f"  Done! Updated: {updated}  Errors: {errors}")
print(f"{'═'*60}")
print("\nRe-save any recipes to recalculate calories with the new data.")
