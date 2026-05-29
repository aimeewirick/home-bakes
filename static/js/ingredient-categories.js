// ingredient-categories.js
// Single source of truth for ingredient category dropdown rendering.
// Stores category.id as option value — never name strings.

// ── populateIngredientCategories ──────────────────────────────────────────────
// Populates a <select> element by DOM id with ingredient categories.
// Option value = category.id (document ID)
// includeAll: set true for filter dropdowns that need an "All" option
export function populateIngredientCategories(categories, elementId, includeAll = false) {
  const sel = document.getElementById(elementId);
  if (!sel) return;

  const filtered = includeAll ? categories : categories.filter(c => c.name !== "All");
  filtered.forEach(cat => {
    const opt = document.createElement("option");
    opt.value       = cat.id;    // store ID — never name string
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
}

// ── getCategoryById ───────────────────────────────────────────────────────────
// Looks up a category from allCategories by its document ID.
export function getCategoryById(allCategories, categoryId) {
  if (!categoryId) return null;
  return allCategories.find(c => c.id === categoryId) || null;
}
