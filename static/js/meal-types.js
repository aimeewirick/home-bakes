// meal-types.js
// Single source of truth for meal type dropdown rendering.
// Import this wherever meal type selects are needed.

// ── populateMealTypes ─────────────────────────────────────────────────────────
// Populates a <select> element by DOM id with meal types.
// placeholder: the blank first option text (default "Select...")
export function populateMealTypes(mealTypes, elementId, placeholder = "Select...") {
  const sel = document.getElementById(elementId);
  if (!sel) return;
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  mealTypes.forEach(mt => {
    const opt = document.createElement("option");
    opt.value = mt.name;
    opt.textContent = mt.name;
    sel.appendChild(opt);
  });
}
