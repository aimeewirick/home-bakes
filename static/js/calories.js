// calories.js
// Single source of truth for calorie calculation logic.
// Import this wherever calorie counts need to be calculated or displayed.

// ── Unit conversion tables ────────────────────────────────────────────────────
// Base unit for volume: tsp
// Base unit for weight: g

const VOLUME_TO_TSP = {
  "tsp":   1,
  "tbsp":  3,
  "fl oz": 6,
  "cup":   48,
  "ml":    0.202,
  "l":     202.884,
};

const WEIGHT_TO_G = {
  "g":   1,
  "kg":  1000,
  "oz":  28.3495,
  "lb":  453.592,
};

// ── Categories silently skipped in calorie calculation ────────────────────────
// These are used in such tiny amounts that calories are negligible.
const SKIP_CATEGORIES = new Set([
  "Herbs & Spices",
  "Extracts & Flavorings",
]);

// Baking ingredients used in tiny amounts (< 1 tbsp = < 3 tsp) are also skipped.
// This catches salt, baking powder, baking soda, yeast etc.
// but correctly counts flour, sugar, cornstarch (always used in larger amounts).
const SMALL_BAKING_THRESHOLD_TSP = 3; // 1 tbsp

// ── getUnitType ───────────────────────────────────────────────────────────────
export function getUnitType(abbreviation) {
  if (!abbreviation) return "count";
  if (VOLUME_TO_TSP[abbreviation] !== undefined) return "volume";
  if (WEIGHT_TO_G[abbreviation]   !== undefined) return "weight";
  return "count";
}

// ── convertToBase ─────────────────────────────────────────────────────────────
function convertToBase(amount, unit) {
  if (VOLUME_TO_TSP[unit] !== undefined) return amount * VOLUME_TO_TSP[unit];
  if (WEIGHT_TO_G[unit]   !== undefined) return amount * WEIGHT_TO_G[unit];
  return null;
}

// ── calculateIngredientCalories ───────────────────────────────────────────────
// Returns { calories, status, name }
// status: "ok" | "missing" | "incompatible" | "skipped"
export function calculateIngredientCalories(ingredient) {
  const { amount, unitName, calories, calorie_unit, category, ingredientName } = ingredient;

  // Silently skip spices and extracts
  if (SKIP_CATEGORIES.has(category)) {
    return { calories: null, status: "skipped", name: ingredientName };
  }

  // Silently skip small baking amounts (< 1 tbsp)
  // Catches salt, baking powder, baking soda, yeast etc.
  // Also skips if no amount/unit (e.g. "to taste")
  if (category === "Baking") {
    if (!amount || !unitName) {
      return { calories: null, status: "skipped", name: ingredientName };
    }
    const unitType = getUnitType(unitName);
    if (unitType === "volume") {
      const amountInTsp = convertToBase(amount, unitName);
      if (amountInTsp !== null && amountInTsp < SMALL_BAKING_THRESHOLD_TSP) {
        return { calories: null, status: "skipped", name: ingredientName };
      }
    } else if (unitType === "count") {
      // count units in baking (e.g. 1 pinch) — always skip
      return { calories: null, status: "skipped", name: ingredientName };
    }
  }

  // Silently skip small vegetable amounts used as garnish (< 1 tbsp, volume only)
  // Catches green onions, parsley etc. but correctly counts avocado, potato etc.
  if (category === "Vegetables" && amount && unitName) {
    const unitType = getUnitType(unitName);
    if (unitType === "volume") {
      const amountInTsp = convertToBase(amount, unitName);
      if (amountInTsp !== null && amountInTsp < SMALL_BAKING_THRESHOLD_TSP) {
        return { calories: null, status: "skipped", name: ingredientName };
      }
    }
  }

  // No calorie data stored
  if (!calories || !calorie_unit) {
    return { calories: null, status: "missing", name: ingredientName };
  }

  // No amount or unit
  if (!amount || !unitName) {
    return { calories: null, status: "missing", name: ingredientName };
  }

  // Same unit — direct multiplication
  if (unitName === calorie_unit) {
    return { calories: amount * calories, status: "ok", name: ingredientName };
  }

  const recipeType  = getUnitType(unitName);
  const calorieType = getUnitType(calorie_unit);

  // Both count/other — proportional scaling
  if (recipeType === "count" && calorieType === "count") {
    return { calories: amount * calories, status: "ok", name: ingredientName };
  }

  // Different measurement types — can't convert
  if (recipeType !== calorieType) {
    return { calories: null, status: "incompatible", name: ingredientName };
  }

  // Same type — convert both to base unit then divide
  const recipeInBase  = convertToBase(amount, unitName);
  const calorieInBase = convertToBase(1, calorie_unit);

  if (recipeInBase === null || calorieInBase === null) {
    return { calories: null, status: "incompatible", name: ingredientName };
  }

  const multiplier = recipeInBase / calorieInBase;
  return { calories: multiplier * calories, status: "ok", name: ingredientName };
}

// ── calculateRecipeCalories ───────────────────────────────────────────────────
// Returns:
// {
//   caloriesPerServing: number | null,
//   totalCalories:      number | null,
//   status:             "ok" | "partial" | "unavailable",
//   excludedIngredients: string[],  // names of ingredients missing calorie data
// }
export function calculateRecipeCalories(ingredients, servings) {
  if (!ingredients || ingredients.length === 0) {
    return { caloriesPerServing: null, totalCalories: null, status: "unavailable", excludedIngredients: [] };
  }

  let totalCalories    = 0;
  let hasAnyCalories   = false;
  const excludedIngredients = [];

  ingredients.forEach(ing => {
    const result = calculateIngredientCalories(ing);
    if (result.status === "ok") {
      totalCalories += result.calories;
      hasAnyCalories = true;
    } else if (result.status === "missing" || result.status === "incompatible") {
      // Only flag non-skipped ingredients
      if (result.name) excludedIngredients.push(result.name);
    }
    // "skipped" silently ignored
  });

  if (!hasAnyCalories && excludedIngredients.length === 0) {
    return { caloriesPerServing: null, totalCalories: null, status: "unavailable", excludedIngredients: [] };
  }

  if (!hasAnyCalories) {
    return { caloriesPerServing: null, totalCalories: null, status: "unavailable", excludedIngredients };
  }

  const numServings      = servings && servings > 0 ? servings : 1;
  const caloriesPerServing = Math.round(totalCalories / numServings);

  return {
    caloriesPerServing,
    totalCalories:       Math.round(totalCalories),
    status:              excludedIngredients.length > 0 ? "partial" : "ok",
    excludedIngredients,
  };
}

// ── formatCalories ────────────────────────────────────────────────────────────
// Returns display string for the calorie badge.
// Examples:
//   "320 cal/serving"
//   "~320 cal/serving*"
//   "Incomplete calorie data"
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
// Returns footnote string for partial calculations, or null if not needed.
// Example: "* Estimated — calorie data unavailable for: Butter, Vanilla Extract"
export function formatCaloriesNote(result) {
  if (!result || result.status !== "partial" || !result.excludedIngredients?.length) return null;
  return `* Estimated — calorie data unavailable for: ${result.excludedIngredients.join(", ")}`;
}
