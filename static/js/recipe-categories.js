// recipe-categories.js
// Single source of truth for recipe category dropdown rendering.
// Import this wherever recipe category selects are needed.

// ── populateRecipeCategories ──────────────────────────────────────────────────
// Populates a <select> element by DOM id with recipe categories.
// Skips "All" by default (set includeAll=true for filter/tab usage).
// placeholder: the blank first option text (default "Select...")
export function populateRecipeCategories(categories, elementId, placeholder = "Select...", includeAll = false) {
  const sel = document.getElementById(elementId);
  if (!sel) return;
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  const filtered = includeAll ? categories : categories.filter(c => c.name !== "All");
  filtered.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.name;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
}
