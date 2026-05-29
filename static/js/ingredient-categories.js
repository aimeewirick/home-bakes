// ingredient-categories.js
// Single source of truth for ingredient category dropdown rendering.
// Import this wherever ingredient category selects are needed.

// ── populateIngredientCategories ──────────────────────────────────────────────
// Populates a <select> element by DOM id with ingredient categories.
// Skips "All" by default (set includeAll=true for filter dropdowns).
export function populateIngredientCategories(categories, elementId, includeAll = false) {
  const sel = document.getElementById(elementId);
  if (!sel) return;

  const filtered = includeAll ? categories : categories.filter(c => c.name !== "All");
  filtered.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.name;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
}
