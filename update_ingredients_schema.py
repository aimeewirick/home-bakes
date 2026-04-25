"""
HomeBakes — Update Ingredients Schema v2
Adds/fixes allergens[], calories, calorie_unit fields.

- Uses ONLY valid unit abbreviations from units/ collection
- Overwrites incorrect calorie_unit values from previous run
- Safe to run multiple times

Run: python update_ingredients_schema.py
"""
import firebase_admin
from firebase_admin import credentials, firestore
import os, json

# ── Firebase init ─────────────────────────────────────────────────────────────
cred_json = os.environ.get("FIREBASE_CREDENTIALS")
if cred_json:
    cred = credentials.Certificate(json.loads(cred_json))
else:
    cred = credentials.Certificate("firebase_admin_key.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# ── Valid unit abbreviations (must match units/ collection exactly) ────────────
VALID_UNITS = {
    # Volume
    "tsp", "tbsp", "fl oz", "c", "pt", "qt", "gal", "ml", "l",
    # Weight
    "oz", "lb", "g", "kg",
    # Count
    "whole", "piece", "slice", "clove", "sprig", "bunch",
    "pinch", "dash", "to taste",
    # Packaging
    "pkg", "can", "jar", "bag", "box"
}

# ── Allergen mappings ─────────────────────────────────────────────────────────
ALLERGEN_MAP = {
    # Milk
    "butter":           ["Milk"],
    "milk":             ["Milk"],
    "cream cheese":     ["Milk"],
    "sour cream":       ["Milk"],
    "buttermilk":       ["Milk"],
    "whipped cream":    ["Milk"],
    "half and half":    ["Milk"],
    "heavy cream":      ["Milk"],
    "heavy whipping":   ["Milk"],
    "ice cream":        ["Milk"],
    "parmesan":         ["Milk"],
    "mozzarella":       ["Milk"],
    "cheddar":          ["Milk"],
    "cream":            ["Milk"],
    "cheese":           ["Milk"],
    "yogurt":           ["Milk"],
    "ghee":             ["Milk"],
    "casein":           ["Milk"],
    "whey":             ["Milk"],

    # Eggs
    "egg":              ["Eggs"],
    "mayonnaise":       ["Eggs"],
    "meringue":         ["Eggs"],

    # Wheat
    "flour":            ["Wheat"],
    "breadcrumb":       ["Wheat"],
    "panko":            ["Wheat"],
    "pasta":            ["Wheat"],
    "noodle":           ["Wheat"],
    "wheat":            ["Wheat"],
    "cracker":          ["Wheat"],
    "tortilla":         ["Wheat"],
    "cereal":           ["Wheat"],
    "couscous":         ["Wheat"],
    "semolina":         ["Wheat"],
    "farro":            ["Wheat"],
    "spelt":            ["Wheat"],
    "barley":           ["Wheat"],
    "rye":              ["Wheat"],

    # Soybeans
    "soy sauce":        ["Soybeans", "Wheat"],
    "soy":              ["Soybeans"],
    "tofu":             ["Soybeans"],
    "edamame":          ["Soybeans"],
    "miso":             ["Soybeans"],
    "tempeh":           ["Soybeans"],
    "tamari":           ["Soybeans"],

    # Peanuts
    "peanut":           ["Peanuts"],

    # Tree Nuts
    "almond":           ["Tree Nuts"],
    "walnut":           ["Tree Nuts"],
    "pecan":            ["Tree Nuts"],
    "cashew":           ["Tree Nuts"],
    "pistachio":        ["Tree Nuts"],
    "hazelnut":         ["Tree Nuts"],
    "macadamia":        ["Tree Nuts"],
    "pine nut":         ["Tree Nuts"],
    "brazil nut":       ["Tree Nuts"],
    "chestnut":         ["Tree Nuts"],

    # Fish
    "salmon":           ["Fish"],
    "tuna":             ["Fish"],
    "cod":              ["Fish"],
    "tilapia":          ["Fish"],
    "halibut":          ["Fish"],
    "anchovy":          ["Fish"],
    "sardine":          ["Fish"],
    "worcestershire":   ["Fish"],
    "mahi":             ["Fish"],
    "bass":             ["Fish"],
    "trout":            ["Fish"],
    "catfish":          ["Fish"],
    "pollock":          ["Fish"],
    "snapper":          ["Fish"],
    "flounder":         ["Fish"],

    # Shellfish
    "shrimp":           ["Shellfish"],
    "crab":             ["Shellfish"],
    "lobster":          ["Shellfish"],
    "clam":             ["Shellfish"],
    "oyster":           ["Shellfish"],
    "scallop":          ["Shellfish"],
    "mussel":           ["Shellfish"],
    "prawn":            ["Shellfish"],
    "crawfish":         ["Shellfish"],

    # Sesame
    "sesame":           ["Sesame"],
    "tahini":           ["Sesame"],
}

# ── Calorie data — ONLY using valid unit abbreviations ────────────────────────
# Format: "keyword": (calories, unit_abbreviation)
CALORIE_MAP = {
    # Dairy — volume or weight
    "butter":               (102,  "tbsp"),
    "whole milk":           (18,   "tbsp"),
    "skim milk":            (11,   "tbsp"),
    "milk":                 (15,   "tbsp"),
    "heavy cream":          (52,   "tbsp"),
    "heavy whipping cream": (52,   "tbsp"),
    "half and half":        (20,   "tbsp"),
    "cream cheese":         (50,   "tbsp"),
    "sour cream":           (30,   "tbsp"),
    "buttermilk":           (12,   "tbsp"),
    "cheddar cheese":       (28,   "oz"),
    "mozzarella":           (21,   "oz"),
    "parmesan":             (22,   "tbsp"),
    "cream":                (52,   "tbsp"),
    "yogurt":               (17,   "tbsp"),
    "ghee":                 (112,  "tbsp"),

    # Eggs — count
    "egg white":            (17,   "whole"),
    "egg yolk":             (55,   "whole"),
    "egg":                  (72,   "whole"),

    # Flours — volume
    "all-purpose flour":    (28,   "tbsp"),
    "bread flour":          (28,   "tbsp"),
    "whole wheat flour":    (28,   "tbsp"),
    "cake flour":           (25,   "tbsp"),
    "almond flour":         (40,   "tbsp"),
    "coconut flour":        (30,   "tbsp"),
    "flour":                (28,   "tbsp"),

    # Sugars — volume
    "granulated sugar":     (46,   "tbsp"),
    "brown sugar":          (45,   "tbsp"),
    "powdered sugar":       (30,   "tbsp"),
    "sugar":                (46,   "tbsp"),
    "honey":                (64,   "tbsp"),
    "maple syrup":          (52,   "tbsp"),
    "corn syrup":           (57,   "tbsp"),
    "agave":                (60,   "tbsp"),

    # Oils — volume
    "olive oil":            (119,  "tbsp"),
    "vegetable oil":        (120,  "tbsp"),
    "canola oil":           (124,  "tbsp"),
    "coconut oil":          (121,  "tbsp"),
    "sesame oil":           (120,  "tbsp"),

    # Baking — volume
    "baking powder":        (2,    "tsp"),
    "baking soda":          (0,    "tsp"),
    "salt":                 (0,    "tsp"),
    "yeast":                (3,    "tsp"),
    "cream of tartar":      (2,    "tsp"),
    "vanilla extract":      (12,   "tsp"),
    "cocoa powder":         (12,   "tbsp"),

    # Chocolate — volume or weight
    "chocolate chips":      (70,   "tbsp"),
    "dark chocolate":       (50,   "oz"),
    "milk chocolate":       (70,   "oz"),
    "white chocolate":      (80,   "oz"),

    # Nut butters — volume
    "peanut butter":        (94,   "tbsp"),
    "almond butter":        (98,   "tbsp"),
    "tahini":               (89,   "tbsp"),

    # Proteins — weight
    "chicken breast":       (31,   "oz"),
    "ground beef":          (76,   "oz"),
    "ground turkey":        (55,   "oz"),
    "pork chop":            (60,   "oz"),
    "bacon":                (43,   "slice"),
    "salmon":               (58,   "oz"),
    "tuna":                 (39,   "oz"),
    "shrimp":               (28,   "oz"),
    "egg":                  (72,   "whole"),

    # Grains — volume
    "white rice":           (37,   "tbsp"),
    "brown rice":           (34,   "tbsp"),
    "rice":                 (37,   "tbsp"),
    "oats":                 (38,   "tbsp"),
    "quinoa":               (55,   "tbsp"),
    "pasta":                (56,   "oz"),
    "couscous":             (36,   "tbsp"),

    # Legumes — volume
    "black beans":          (38,   "tbsp"),
    "chickpeas":            (45,   "tbsp"),
    "lentils":              (45,   "tbsp"),

    # Common vegetables — weight
    "potato":               (26,   "oz"),
    "sweet potato":         (26,   "oz"),
    "carrot":               (12,   "oz"),
    "onion":                (11,   "oz"),

    # Nuts — volume
    "almond":               (40,   "tbsp"),
    "walnut":               (48,   "tbsp"),
    "pecan":                (47,   "tbsp"),
    "cashew":               (42,   "tbsp"),
    "pine nut":             (57,   "tbsp"),

    # Sauces — volume
    "soy sauce":            (11,   "tbsp"),
    "worcestershire":       (15,   "tbsp"),
    "hot sauce":            (0,    "tsp"),
    "ketchup":              (15,   "tbsp"),
    "mayonnaise":           (90,   "tbsp"),
}

def get_allergens(name):
    name_lower = name.lower()
    allergens = set()
    for keyword, allergen_list in ALLERGEN_MAP.items():
        if keyword in name_lower:
            allergens.update(allergen_list)
    return sorted(list(allergens))

def get_calories(name):
    name_lower = name.lower()
    # Try longer matches first for specificity
    matches = [(k, v) for k, v in CALORIE_MAP.items() if k in name_lower]
    if matches:
        # Pick longest matching keyword (most specific)
        best = max(matches, key=lambda x: len(x[0]))
        return best[1]  # (calories, unit)
    return None, None

def update_ingredients():
    print("\n🔥 Updating ingredients schema v2...")
    docs = list(db.collection("ingredients").stream())
    print(f"Found {len(docs)} ingredients\n")

    updated   = 0
    skipped   = 0
    allergen_updated = 0

    for doc in docs:
        data = doc.to_dict()
        name = data.get("name", "")
        update_data = {}

        # ── Allergens ─────────────────────────────────────────────────────────
        # Always recompute — our map has improved
        new_allergens = get_allergens(name)
        if data.get("allergens") != new_allergens:
            update_data["allergens"] = new_allergens
            allergen_updated += 1

        # ── Calories ──────────────────────────────────────────────────────────
        current_unit = data.get("calorie_unit")
        calories_missing = data.get("calories") is None
        unit_invalid = current_unit not in VALID_UNITS if current_unit else True

        if calories_missing or unit_invalid:
            calories, unit = get_calories(name)
            update_data["calories"] = calories
            update_data["calorie_unit"] = unit

        if update_data:
            doc.reference.update(update_data)
            print(f"  ✅ {name}")
            if "allergens" in update_data and update_data["allergens"]:
                print(f"     allergens: {update_data['allergens']}")
            if "calories" in update_data and update_data["calories"]:
                print(f"     calories: {update_data['calories']} per {update_data['calorie_unit']}")
            updated += 1
        else:
            skipped += 1

    print(f"\n{'═'*50}")
    print(f"  ✅ Updated:  {updated} ingredients")
    print(f"  ⏭️  Skipped:  {skipped} already correct")
    print(f"  🥜 Allergens updated: {allergen_updated}")
    print(f"{'═'*50}")
    print("\n✅ Done!")

if __name__ == "__main__":
    update_ingredients()
