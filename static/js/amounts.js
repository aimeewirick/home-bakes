// amounts.js
// Single source of truth for recipe amount input and display.
// Import this wherever amounts are entered or displayed.

// ── Common amounts list ───────────────────────────────────────────────────────
// Each entry has a label (what the user sees) and a value (what gets stored).
// Organized into three optgroups: fractions up to 5, whole numbers 6-20, custom.
export const COMMON_AMOUNTS = [
  // Fractions & mixed numbers up to 5
  { label: "1/8",    value: 0.125,  group: "fractions" },
  { label: "1/4",    value: 0.25,   group: "fractions" },
  { label: "1/3",    value: 0.333,  group: "fractions" },
  { label: "1/2",    value: 0.5,    group: "fractions" },
  { label: "2/3",    value: 0.667,  group: "fractions" },
  { label: "3/4",    value: 0.75,   group: "fractions" },
  { label: "1",      value: 1,      group: "fractions" },
  { label: "1 1/4",  value: 1.25,   group: "fractions" },
  { label: "1 1/3",  value: 1.333,  group: "fractions" },
  { label: "1 1/2",  value: 1.5,    group: "fractions" },
  { label: "1 2/3",  value: 1.667,  group: "fractions" },
  { label: "1 3/4",  value: 1.75,   group: "fractions" },
  { label: "2",      value: 2,      group: "fractions" },
  { label: "2 1/4",  value: 2.25,   group: "fractions" },
  { label: "2 1/3",  value: 2.333,  group: "fractions" },
  { label: "2 1/2",  value: 2.5,    group: "fractions" },
  { label: "2 2/3",  value: 2.667,  group: "fractions" },
  { label: "2 3/4",  value: 2.75,   group: "fractions" },
  { label: "3",      value: 3,      group: "fractions" },
  { label: "3 1/4",  value: 3.25,   group: "fractions" },
  { label: "3 1/3",  value: 3.333,  group: "fractions" },
  { label: "3 1/2",  value: 3.5,    group: "fractions" },
  { label: "3 2/3",  value: 3.667,  group: "fractions" },
  { label: "3 3/4",  value: 3.75,   group: "fractions" },
  { label: "4",      value: 4,      group: "fractions" },
  { label: "4 1/4",  value: 4.25,   group: "fractions" },
  { label: "4 1/3",  value: 4.333,  group: "fractions" },
  { label: "4 1/2",  value: 4.5,    group: "fractions" },
  { label: "4 2/3",  value: 4.667,  group: "fractions" },
  { label: "4 3/4",  value: 4.75,   group: "fractions" },
  { label: "5",      value: 5,      group: "fractions" },
  { label: "5 1/4",  value: 5.25,   group: "fractions" },
  { label: "5 1/3",  value: 5.333,  group: "fractions" },
  { label: "5 1/2",  value: 5.5,    group: "fractions" },
  { label: "5 2/3",  value: 5.667,  group: "fractions" },
  { label: "5 3/4",  value: 5.75,   group: "fractions" },

  // Whole numbers 6–20
  { label: "6",    value: 6,      group: "whole" },
  { label: "7",    value: 7,      group: "whole" },
  { label: "8",    value: 8,      group: "whole" },
  { label: "9",    value: 9,      group: "whole" },
  { label: "10",   value: 10,     group: "whole" },
  { label: "12",   value: 12,     group: "whole" },
  { label: "14",   value: 14,     group: "whole" },
  { label: "16",   value: 16,     group: "whole" },
  { label: "18",   value: 18,     group: "whole" },
  { label: "20",   value: 20,     group: "whole" },
];

// ── decimalToFraction(num) ────────────────────────────────────────────────────
// Converts a stored decimal into a display string.
// Examples: 0.25 → "¼"   1.5 → "1 ½"   3.333 → "3 ⅓"   100 → "100"
// Used in recipe-view.html and shopping-lists.html for display only.
export function decimalToFraction(num) {
  if (num === null || num === undefined || isNaN(num)) return "—";

  // Map of decimal parts to fraction symbols
  const fractionMap = [
    { decimal: 0.125, symbol: "1/8" },
    { decimal: 0.25,  symbol: "1/4" },
    { decimal: 0.333, symbol: "1/3" },
    { decimal: 0.5,   symbol: "1/2" },
    { decimal: 0.667, symbol: "2/3" },
    { decimal: 0.75,  symbol: "3/4" },
  ];

  const whole   = Math.floor(num);
  // Round to 3 decimal places to avoid floating point weirdness like 0.33300000001
  const decimal = Math.round((num - whole) * 1000) / 1000;

  if (decimal === 0) return `${whole}`;

  const match = fractionMap.find(f => Math.abs(f.decimal - decimal) < 0.01);
  const fractionSymbol = match ? match.symbol : `${decimal}`;

  return whole === 0 ? fractionSymbol : `${whole} ${fractionSymbol}`;
}

// ── buildAmountInput(selectedValue) ──────────────────────────────────────────
// Creates and returns a wrapper <div> containing:
//   - A <select> dropdown with fraction/whole number optgroups + Custom option
//   - A hidden <input> that appears when "Custom" is selected
//   - Helper text that appears with the custom input
// selectedValue: the stored decimal to pre-select (e.g. 1.5), or null for blank.
export function buildAmountInput(selectedValue = null) {
  // Outer wrapper holds both the select and the custom input
  const wrapper = document.createElement("div");
  wrapper.className = "amount-wrapper";

  // ── The dropdown ──
  const select = document.createElement("select");
  select.className = "amount-select";

  // Blank default option
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "amt";
  select.appendChild(blank);

  // Fractions optgroup
  const fractionsGroup = document.createElement("optgroup");
  fractionsGroup.label = "Fractions & Mixed";
  COMMON_AMOUNTS.filter(a => a.group === "fractions").forEach(a => {
    const opt = document.createElement("option");
    opt.value = a.value;
    opt.textContent = a.label;
    // Pre-select if this matches the stored value (within rounding tolerance)
    if (selectedValue !== null && Math.abs(a.value - selectedValue) < 0.01) {
      opt.selected = true;
    }
    fractionsGroup.appendChild(opt);
  });
  select.appendChild(fractionsGroup);

  // Whole numbers optgroup
  const wholeGroup = document.createElement("optgroup");
  wholeGroup.label = "Whole Numbers";
  COMMON_AMOUNTS.filter(a => a.group === "whole").forEach(a => {
    const opt = document.createElement("option");
    opt.value = a.value;
    opt.textContent = a.label;
    if (selectedValue !== null && a.value === selectedValue) opt.selected = true;
    wholeGroup.appendChild(opt);
  });
  select.appendChild(wholeGroup);

  // Custom optgroup
  const customGroup = document.createElement("optgroup");
  customGroup.label = "Other";
  const customOpt = document.createElement("option");
  customOpt.value = "custom";
  customOpt.textContent = "Custom...";
  customGroup.appendChild(customOpt);
  select.appendChild(customGroup);

  // ── The custom input (hidden until "Custom" is picked) ──
  const customWrapper = document.createElement("div");
  customWrapper.className = "amount-custom-wrapper";
  customWrapper.style.display = "none";

  const customInput = document.createElement("input");
  customInput.type = "number";
  customInput.className = "amount-custom-input";
  customInput.placeholder = "e.g. 1.5, 0.25, 33";
  customInput.min = "0";
  customInput.step = "any";

  const helperText = document.createElement("span");
  helperText.className = "amount-helper-text";
  helperText.textContent = "Enter a decimal (e.g. 1.5 = 1½)";

  customWrapper.appendChild(customInput);
  customWrapper.appendChild(helperText);

  // ── If selectedValue doesn't match any common amount, show custom input ──
  if (selectedValue !== null) {
    const matchesCommon = COMMON_AMOUNTS.some(a => Math.abs(a.value - selectedValue) < 0.01);
    if (!matchesCommon) {
      // Pre-fill custom input and show it
      select.value = "custom";
      customInput.value = selectedValue;
      customWrapper.style.display = "block";
    }
  }

  // ── Event listener: show/hide custom input when dropdown changes ──
  select.addEventListener("change", () => {
    if (select.value === "custom") {
      customWrapper.style.display = "block";
      customInput.focus();
    } else {
      customWrapper.style.display = "none";
      customInput.value = "";
    }
  });

  wrapper.appendChild(select);
  wrapper.appendChild(customWrapper);

  return wrapper;
}

// ── getAmountValue(wrapper) ───────────────────────────────────────────────────
// Given the wrapper element returned by buildAmountInput(),
// returns the current amount as a number (e.g. 1.5, 0.25, 100).
// Returns 0 if nothing is selected.
// This is what gets saved to Firestore and used in calorie calculations.
export function getAmountValue(wrapper) {
  const select      = wrapper.querySelector(".amount-select");
  const customInput = wrapper.querySelector(".amount-custom-input");

  if (select.value === "custom") {
    return parseFloat(customInput.value) || 0;
  }
  return parseFloat(select.value) || 0;
}
