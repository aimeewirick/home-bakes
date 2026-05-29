// allergens.js
// Single source of truth for allergen rendering.
// Stores allergen.id as checkbox value — never name strings.

// ── populateAllergenCheckboxes ────────────────────────────────────────────────
// Renders allergen checkboxes into a container element.
// style: "admin" uses .allergen-check CSS class
//        "chips" uses inline styled chips (recipe-form modal style)
// Checkbox value = allergen.id (document ID)
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
        <input type="checkbox" value="${a.id}"
               style="accent-color:#DC2626; cursor:pointer;" />
        ${a.icon} ${a.name}
      </label>
    `).join("");

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
        <input type="checkbox" value="${a.id}" />
        ${a.icon} ${a.name}
      </label>
    `).join("");
  }
}

// ── populateAllergenChips ─────────────────────────────────────────────────────
// Renders allergen exclusion chips (toggle style) into a container.
// Used in meal-plan-form recipe search modal.
// Chip value = allergen.id
export function populateAllergenChips(allergens, elementId) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.innerHTML = allergens.map(a => `
    <label class="allergen-exclusion-chip" data-allergen="${a.id}">
      <input type="checkbox" value="${a.id}" />
      ${a.icon} ${a.name}
    </label>
  `).join("");
}

// ── getCheckedAllergens ───────────────────────────────────────────────────────
// Returns array of checked allergen IDs from a container element.
export function getCheckedAllergens(elementId) {
  return [...document.querySelectorAll(`#${elementId} input:checked`)]
    .map(cb => cb.value);
}

// ── setCheckedAllergens ───────────────────────────────────────────────────────
// Sets checkboxes to match an array of allergen IDs.
export function setCheckedAllergens(elementId, allergenIds = []) {
  document.querySelectorAll(`#${elementId} input[type=checkbox]`).forEach(cb => {
    cb.checked = allergenIds.includes(cb.value);
  });
}

// ── getAllergenDisplay ────────────────────────────────────────────────────────
// Given an allergen ID and the full allergen list, returns display HTML.
// Used for rendering allergen pills/badges from stored IDs.
export function getAllergenDisplay(allergenId, allergenList) {
  const found = allergenList.find(a => a.id === allergenId);
  return found ? { icon: found.icon, name: found.name } : { icon: "⚠️", name: allergenId };
}
