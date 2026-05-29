// units.js
// Single source of truth for unit dropdown rendering.
// Stores unit.id as option value — never abbreviation or name strings.
// Display shows unit.abbreviation (e.g. "Tbsp") for readability.

const UNIT_GROUPS = { volume: "Volume", weight: "Weight", count: "Count", other: "Other" };

// ── buildUnitSelect ───────────────────────────────────────────────────────────
// Returns a <select> element for ingredient rows.
// Stores unit.id as value, displays unit.abbreviation.
// selectedUnitId: the unit.id to pre-select (optional)
export function buildUnitSelect(allUnits, selectedUnitId = "") {
  const select = document.createElement("select");
  select.className = "unit-select";

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "unit";
  select.appendChild(blank);

  Object.entries(UNIT_GROUPS).forEach(([type, label]) => {
    const unitGroup = allUnits.filter(u => u.type === type);
    if (!unitGroup.length) return;
    const optgroup = document.createElement("optgroup");
    optgroup.label = label;
    unitGroup.forEach(unit => {
      const opt = document.createElement("option");
      opt.value        = unit.id;              // store ID — never strings
      opt.textContent  = unit.abbreviation;    // display abbreviation (e.g. "Tbsp")
      opt.dataset.name = unit.name;            // full name for display in recipe view
      opt.dataset.type = unit.type;            // type for calorie calculation
      if (unit.id === selectedUnitId) opt.selected = true;
      optgroup.appendChild(opt);
    });
    select.appendChild(optgroup);
  });

  return select;
}

// ── populateUnitSelect ────────────────────────────────────────────────────────
// Populates an existing <select> element by DOM id.
// Stores unit.id as value, displays "Tbsp (tablespoon)" format.
// selectedUnitId: the unit.id to pre-select (optional)
export function populateUnitSelect(allUnits, elementId, selectedUnitId = "") {
  const sel = document.getElementById(elementId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Select unit...</option>';

  Object.entries(UNIT_GROUPS).forEach(([type, label]) => {
    const groupUnits = allUnits.filter(u => u.type === type);
    if (!groupUnits.length) return;
    const optgroup = document.createElement("optgroup");
    optgroup.label = label;
    groupUnits.forEach(u => {
      const opt = document.createElement("option");
      opt.value       = u.id;                            // store ID
      opt.textContent = `${u.abbreviation} (${u.name})`; // display "Tbsp (tablespoon)"
      opt.dataset.name = u.name;
      opt.dataset.type = u.type;
      if (u.id === selectedUnitId) opt.selected = true;
      optgroup.appendChild(opt);
    });
    sel.appendChild(optgroup);
  });
}

// ── getUnitById ───────────────────────────────────────────────────────────────
// Looks up a unit from allUnits by its document ID.
// Returns the unit object or null.
export function getUnitById(allUnits, unitId) {
  if (!unitId) return null;
  return allUnits.find(u => u.id === unitId) || null;
}
