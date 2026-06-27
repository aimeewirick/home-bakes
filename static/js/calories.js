// calories.js
// Single source of truth for calorie calculation logic.
// Uses Firestore document IDs for all lookups — no string matching.

// ── Unit conversion tables ────────────────────────────────────────────────────
// Keyed by unit NAME (full lowercase word) — names are unambiguous unlike abbreviations.
// Base unit for volume: teaspoon (1)
// Base unit for weight: gram (1)

const VOLUME_TO_TSP = {
  "teaspoon":    1,
  "tablespoon":  3,
  "fluid ounce": 6,
  "cup":         48,
  "pint":        96,
  "quart":       192,
  "gallon":      768,
  "milliliter":  0.202,
  "liter":       202.884,
};

const WEIGHT_TO_G = {
  "gram":     1,
  "kilogram": 1000,
  "ounce":    28.3495,
  "pound":    453.592,
};

// ── Category IDs that are silently skipped ────────────────────────────────────
// Herbs & Spices and Extracts & Flavorings are always skipped.
// Baking < 1 tbsp and Vegetables < 1 tbsp are also skipped (see logic below).
const SKIP_CATEGORY_IDS = new Set([
  "bcypMARswiOWsaeH6zMB",  // Herbs & Spices
  "Qx1JjwWIE0kKIzUNsFFc",  // Extracts & Flavorings
]);

const BAKING_CATEGORY_ID    = "BMIrCHKScNU3abUmVkuv";
const VEGETABLE_CATEGORY_ID = "AGkrf7qgPeTfLf0inX2Y";
const SMALL_AMOUNT_TSP      = 3; // 1 tbsp — threshold for small baking/vegetable amounts

// ── convertToBase ─────────────────────────────────────────────────────────────
// Converts amount to base unit (tsp for volume, g for weight) using unit name.
function convertToBase(amount, unitName) {
  if (!unitName) return null;
  const name = unitName.toLowerCase();
  if (VOLUME_TO_TSP[name] !== undefined) return amount * VOLUME_TO_TSP[name];
  if (WEIGHT_TO_G[name]   !== undefined) return amount * WEIGHT_TO_G[name];
  return null;
}

// ── getUnitType ───────────────────────────────────────────────────────────────
// Returns "volume", "weight", or "count" for a unit name.
export function getUnitType(unitName) {
  if (!unitName) return "count";
  const name = unitName.toLowerCase();
  if (VOLUME_TO_TSP[name] !== undefined) return "volume";
  if (WEIGHT_TO_G[name]   !== undefined) return "weight";
  return "count";
}

// ── calculateIngredientCalories ───────────────────────────────────────────────
// Returns { calories, status, name }
// status: "ok" | "missing" | "incompatible" | "skipped"
//
// ingredient shape (all IDs stored in Firestore):
// {
//   amount:         1.5,                    // recipe amount
//   unitId:         "k4Ni3YyE4nqP94ELwnjG", // unit document ID
//   calories:       120,                    // calories per calorie_unit
//   calorie_unit:   "k4Ni3YyE4nqP94ELwnjG", // unit document ID
//   category:       "BMIrCHKScNU3abUmVkuv", // category document ID
//   ingredientName: "Butter Salted",
// }
// allUnits: full units array from Firestore (each has id, name, type)
export function calculateIngredientCalories(ingredient, allUnits) {
  const { amount, unitId, calories, calorie_unit, category, ingredientName } = ingredient;

  // Always skip these categories
  if (SKIP_CATEGORY_IDS.has(category)) {
    return { calories: null, status: "skipped", name: ingredientName };
  }

  // Look up units by ID
  const recipeUnit   = allUnits.find(u => u.id === unitId);
  const calorieUnit  = allUnits.find(u => u.id === calorie_unit);

  // Baking: skip if no amount/unit or amount < 1 tbsp (volume) or count unit
  if (category === BAKING_CATEGORY_ID) {
    if (!amount || !recipeUnit) {
      return { calories: null, status: "skipped", name: ingredientName };
    }
    if (recipeUnit.type === "volume") {
      const amountInTsp = convertToBase(amount, recipeUnit.name);
      if (amountInTsp !== null && amountInTsp < SMALL_AMOUNT_TSP) {
        return { calories: null, status: "skipped", name: ingredientName };
      }
    } else if (recipeUnit.type === "count") {
      return { calories: null, status: "skipped", name: ingredientName };
    }
  }

  // Vegetables: skip if volume amount < 1 tbsp (garnish amounts)
  if (category === VEGETABLE_CATEGORY_ID && amount && recipeUnit) {
    if (recipeUnit.type === "volume") {
      const amountInTsp = convertToBase(amount, recipeUnit.name);
      if (amountInTsp !== null && amountInTsp < SMALL_AMOUNT_TSP) {
        return { calories: null, status: "skipped", name: ingredientName };
      }
    }
  }

  // No calorie data
  if (calories === null || calories === undefined || !calorie_unit) {
    return { calories: null, status: "missing", name: ingredientName };
  }

  // No amount or unit
  if (!amount || !unitId) {
    return { calories: null, status: "missing", name: ingredientName };
  }

  // Units not found in allUnits
  if (!recipeUnit || !calorieUnit) {
    return { calories: null, status: "missing", name: ingredientName };
  }

  // Same unit ID — direct multiplication
  if (unitId === calorie_unit) {
    return { calories: amount * calories, status: "ok", name: ingredientName };
  }

  // Both count — proportional scaling
  if (recipeUnit.type === "count" && calorieUnit.type === "count") {
    return { calories: amount * calories, status: "ok", name: ingredientName };
  }

  // Different types — can't convert
  if (recipeUnit.type !== calorieUnit.type) {
    return { calories: null, status: "incompatible", name: ingredientName };
  }

  // Same type — convert both to base using unit name, then divide
  const recipeInBase  = convertToBase(amount, recipeUnit.name);
  const calorieInBase = convertToBase(1, calorieUnit.name);

  if (recipeInBase === null || calorieInBase === null) {
    return { calories: null, status: "incompatible", name: ingredientName };
  }

  const multiplier = recipeInBase / calorieInBase;
  return { calories: multiplier * calories, status: "ok", name: ingredientName };
}

// ── calculateRecipeCalories ───────────────────────────────────────────────────
// Returns:
// {
//   caloriesPerServing:  number | null,
//   totalCalories:       number | null,
//   status:              "ok" | "partial" | "unavailable",
//   excludedIngredients: string[],
// }
export function calculateRecipeCalories(ingredients, servings, allUnits) {
  if (!ingredients || ingredients.length === 0 || !allUnits) {
    return { caloriesPerServing: null, totalCalories: null, status: "unavailable", excludedIngredients: [] };
  }

  let totalCalories = 0;
  let hasAnyCalories = false;
  const excludedIngredients = [];

  ingredients.forEach(ing => {
    const result = calculateIngredientCalories(ing, allUnits);
    if (result.status === "ok") {
      totalCalories += result.calories;
      hasAnyCalories = true;
    } else if (result.status === "missing" || result.status === "incompatible") {
      if (result.name) excludedIngredients.push(result.name);
    }
    // "skipped" silently ignored
  });

  if (!hasAnyCalories) {
    return { caloriesPerServing: null, totalCalories: null, status: "unavailable", excludedIngredients };
  }

  const numServings     = servings && servings > 0 ? servings : 1;
  const caloriesPerServing = Math.round(totalCalories / numServings);

  return {
    caloriesPerServing,
    totalCalories:       Math.round(totalCalories),
    status:              excludedIngredients.length > 0 ? "partial" : "ok",
    excludedIngredients,
  };
}

// ── formatCalories ────────────────────────────────────────────────────────────
export function formatCalories(result) {
  if (!result || result.status === "unavailable" || result.caloriesPerServing === null) {
    return "Incomplete calorie data";
  }
  if (result.status === "partial") {
    return `~${result.caloriesPerServing} cal/serving*`;
  }
  return `${result.caloriesPerServing} cal/serving`;
}

// ── formatCaloriesNote ────────────────────────────────────────────────────────
export function formatCaloriesNote(result) {
  if (!result || result.status !== "partial" || !result.excludedIngredients?.length) return null;
  return `* Estimated — calorie data unavailable for: ${result.excludedIngredients.join(", ")}`;
}
