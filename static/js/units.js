// units.js
// Single source of truth for unit dropdown rendering.
// Import this wherever a unit select is needed — never duplicate this logic.

const UNIT_GROUPS = { volume: "Volume", weight: "Weight", count: "Count", other: "Other" };

// ── buildUnitSelect ───────────────────────────────────────────────────────────
// Returns a <select> element for ingredient rows.
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
      opt.value = unit.id;
      opt.textContent = unit.abbreviation;
      opt.dataset.name = unit.name;
      if (unit.id === selectedUnitId) opt.selected = true;
      optgroup.appendChild(opt);
    });
    select.appendChild(optgroup);
  });

  return select;
}

// ── populateUnitSelect ────────────────────────────────────────────────────────
// Populates an existing <select> element by DOM id.
// Used for modals where the <select> already exists in HTML.
// selectedValue: the unit.abbreviation to pre-select (optional)
export function populateUnitSelect(allUnits, elementId, selectedValue = "") {
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
      opt.value = u.abbreviation;
      opt.textContent = `${u.abbreviation} (${u.name})`;
      if (u.abbreviation === selectedValue) opt.selected = true;
      optgroup.appendChild(opt);
    });
    sel.appendChild(optgroup);
  });
}
