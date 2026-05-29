// allergens.js
// Single source of truth for allergen rendering.
// Import this wherever allergen checkboxes or chips are needed.

// ── populateAllergenCheckboxes ────────────────────────────────────────────────
// Renders allergen checkboxes into a container element.
// Used in admin modal and recipe-form create-ingredient modal.
// style: "admin" uses .allergen-check CSS class
//        "chips" uses inline styled chips (recipe-form modal style)
export function populateAllergenCheckboxes(allergens, elementId, style = "admin") {
  const container = document.getElementById(elementId);
  if (!container) return;

  if (style === "chips") {
    container.innerHTML = allergens.map(a => `
      <label style="display:inline-flex; align-items:center; gap:0.3rem;
                    background:#F8F5EE; border:1.5px solid #E8E0D5;
                    border-radius:100px; padding:0.2rem 0.6rem;
                    font-size:0.78rem; font-family:'Lato',sans-serif;
                    cursor:pointer; user-select:none; transition:all 0.15s;"
             class="ing-allergen-chip">
        <input type="checkbox" value="${a.name}"
               style="accent-color:#DC2626; cursor:pointer;" />
        ${a.icon} ${a.name}
      </label>
    `).join("");

    // Style checked allergens red
    container.querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", () => {
        const chip = cb.closest(".ing-allergen-chip");
        chip.style.background  = cb.checked ? "rgba(220,38,38,0.08)" : "#F8F5EE";
        chip.style.borderColor = cb.checked ? "rgba(220,38,38,0.4)"  : "#E8E0D5";
        chip.style.color       = cb.checked ? "#DC2626" : "";
        chip.style.fontWeight  = cb.checked ? "700" : "";
      });
    });
  } else {
    container.innerHTML = allergens.map(a => `
      <label class="allergen-check">
        <input type="checkbox" value="${a.name}" />
        ${a.icon} ${a.name}
      </label>
    `).join("");
  }
}

// ── populateAllergenChips ─────────────────────────────────────────────────────
// Renders allergen exclusion chips (toggle style) into a container.
// Used in meal-plan-form recipe search modal.
export function populateAllergenChips(allergens, elementId) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.innerHTML = allergens.map(a => `
    <label class="allergen-exclusion-chip" data-allergen="${a.name}">
      <input type="checkbox" value="${a.name}" />
      ${a.icon} ${a.name}
    </label>
  `).join("");
}

// ── getCheckedAllergens ───────────────────────────────────────────────────────
// Returns array of checked allergen names from a container element.
export function getCheckedAllergens(elementId) {
  return [...document.querySelectorAll(`#${elementId} input:checked`)]
    .map(cb => cb.value);
}

// ── setCheckedAllergens ───────────────────────────────────────────────────────
// Sets checkboxes to match an array of allergen names.
export function setCheckedAllergens(elementId, allergens = []) {
  document.querySelectorAll(`#${elementId} input[type=checkbox]`).forEach(cb => {
    cb.checked = allergens.includes(cb.value);
  });
}
