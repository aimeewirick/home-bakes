// recipe-form.js
// Handles the recipe creation and editing form.
// - Typeahead ingredient search
// - Dynamic ingredient rows
// - Direction sections
// - Save to Firestore via Flask API

import { requireAuth } from "/static/js/auth.js";
import {
  createRecipe,
  updateRecipe,
  getRecipe,
  getIngredients,
  getUnits
} from "/static/js/api.js";

// ── State ─────────────────────────────────────────────────────────────────────
let allIngredients = [];   // full list from Firestore
let allUnits       = [];   // full units list
let ingredientRows = [];   // tracks each row's selected ingredient
let editingId      = null; // recipe ID if editing existing recipe

// ── DOM refs ──────────────────────────────────────────────────────────────────
const ingredientsBody  = document.getElementById("ingredientsBody");
const directionsBody   = document.getElementById("directionsBody");
const saveBtn          = document.getElementById("saveBtn");
const savingMsg        = document.getElementById("savingMsg");
const pageTitle        = document.getElementById("pageTitle");
const cardTab          = document.getElementById("cardTab");

// ── Init ──────────────────────────────────────────────────────────────────────
requireAuth(async () => {
  // Check if editing existing recipe
  const params = new URLSearchParams(window.location.search);
  editingId = params.get("id");

  if (editingId) {
    pageTitle.textContent = "Edit Recipe";
    cardTab.textContent   = "EDIT RECIPE";
  }

  // Load ingredients and units in parallel
  try {
    const [ingredients, units] = await Promise.all([
      getIngredients(),
      getUnits()
    ]);
    allIngredients = ingredients.sort((a, b) => a.name.localeCompare(b.name));
    allUnits       = units.sort((a, b) => {
      // Sort by type: volume first, then weight, then count, then other
      const order = { volume: 0, weight: 1, count: 2, other: 3 };
      return (order[a.type] ?? 4) - (order[b.type] ?? 4) || a.name.localeCompare(b.name);
    });

    // Add first empty ingredient row
    addIngredientRow();

    // Add first empty direction section
    addDirectionBlock();

    // If editing, load existing recipe data
    if (editingId) {
      await loadRecipeForEdit(editingId);
    }

  } catch (err) {
    console.error("Failed to load form data:", err);
    alert("Failed to load ingredients. Please refresh the page.");
  }
});

// ── Typeahead ─────────────────────────────────────────────────────────────────
function createTypeahead(rowIndex) {
  const wrapper   = document.createElement("div");
  wrapper.className = "typeahead-wrapper";

  const input     = document.createElement("input");
  input.type      = "text";
  input.className = "typeahead-input";
  input.placeholder = "Search ingredient...";
  input.autocomplete = "off";

  const dropdown  = document.createElement("div");
  dropdown.className = "typeahead-dropdown";

  wrapper.appendChild(input);
  wrapper.appendChild(dropdown);

  let selectedIngredient = null;
  let highlightIndex     = -1;

  function renderDropdown(query) {
    dropdown.innerHTML = "";
    highlightIndex     = -1;

    if (!query || query.length < 1) {
      dropdown.classList.remove("open");
      return;
    }

    const q       = query.toLowerCase();
    const matches = allIngredients.filter(i =>
      i.name.toLowerCase().includes(q)
    ).slice(0, 12); // max 12 results

    if (matches.length === 0) {
      dropdown.innerHTML = `<div class="typeahead-empty">No ingredients found for "${query}"</div>`;
      dropdown.classList.add("open");
      return;
    }

    matches.forEach((ingredient, idx) => {
      const item        = document.createElement("div");
      item.className    = "typeahead-item";
      item.innerHTML    = `
        <span>${highlightMatch(ingredient.name, query)}</span>
        <span class="typeahead-category">${ingredient.category}</span>
      `;

      item.addEventListener("mousedown", (e) => {
        e.preventDefault(); // prevent blur before click registers
        selectIngredient(ingredient);
      });

      dropdown.appendChild(item);
    });

    dropdown.classList.add("open");
  }

  function highlightMatch(name, query) {
    const idx = name.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return name;
    return name.slice(0, idx) +
      `<strong>${name.slice(idx, idx + query.length)}</strong>` +
      name.slice(idx + query.length);
  }

  function selectIngredient(ingredient) {
    selectedIngredient               = ingredient;
    input.value                      = ingredient.name;
    ingredientRows[rowIndex]         = ingredient;
    dropdown.classList.remove("open");
  }

  // Keyboard navigation
  input.addEventListener("keydown", (e) => {
    const items = dropdown.querySelectorAll(".typeahead-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightIndex = Math.min(highlightIndex + 1, items.length - 1);
      updateHighlight(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightIndex = Math.max(highlightIndex - 1, -1);
      updateHighlight(items);
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      items[highlightIndex].dispatchEvent(new Event("mousedown"));
    } else if (e.key === "Escape") {
      dropdown.classList.remove("open");
    }
  });

  function updateHighlight(items) {
    items.forEach((item, idx) => {
      item.classList.toggle("highlighted", idx === highlightIndex);
    });
  }

  input.addEventListener("input", () => {
    selectedIngredient       = null;
    ingredientRows[rowIndex] = null;
    renderDropdown(input.value);
  });

  input.addEventListener("blur", () => {
    setTimeout(() => dropdown.classList.remove("open"), 150);
  });

  input.addEventListener("focus", () => {
    if (input.value) renderDropdown(input.value);
  });

  // Expose for pre-filling when editing
  wrapper._setIngredient = (ingredient) => {
    selectIngredient(ingredient);
  };

  return wrapper;
}

// ── Build unit select ─────────────────────────────────────────────────────────
function buildUnitSelect(selectedUnitId = "") {
  const select    = document.createElement("select");
  select.className = "unit-select";

  const blank     = document.createElement("option");
  blank.value     = "";
  blank.textContent = "unit";
  select.appendChild(blank);

  // Group by type
  const groups = { volume: "Volume", weight: "Weight", count: "Count", other: "Other" };
  Object.entries(groups).forEach(([type, label]) => {
    const unitGroup = allUnits.filter(u => u.type === type);
    if (unitGroup.length === 0) return;

    const optgroup     = document.createElement("optgroup");
    optgroup.label     = label;

    unitGroup.forEach(unit => {
      const opt       = document.createElement("option");
      opt.value       = unit.id;
      opt.textContent = unit.abbreviation;
      opt.dataset.name = unit.name;
      if (unit.id === selectedUnitId) opt.selected = true;
      optgroup.appendChild(opt);
    });

    select.appendChild(optgroup);
  });

  return select;
}

// ── Add ingredient row ────────────────────────────────────────────────────────
function addIngredientRow(prefill = null) {
  const rowIndex = ingredientRows.length;
  ingredientRows.push(null);

  const tr = document.createElement("tr");
  tr.className = "ingredient-row";
  tr.dataset.rowIndex = rowIndex;

  // Col 1: Ingredient typeahead
  const tdIngredient = document.createElement("td");
  const typeahead    = createTypeahead(rowIndex);
  if (prefill) typeahead._setIngredient({ id: prefill.ingredientId, name: prefill.ingredientName, category: "" });
  tdIngredient.appendChild(typeahead);

  // Col 2: Amount
  const tdAmount  = document.createElement("td");
  tdAmount.style.width = "80px";
  const amountInput = document.createElement("input");
  amountInput.type  = "number";
  amountInput.className = "amount-input";
  amountInput.placeholder = "amt";
  amountInput.min   = "0";
  amountInput.step  = "0.25";
  if (prefill) amountInput.value = prefill.amount;
  tdAmount.appendChild(amountInput);

  // Col 3: Unit
  const tdUnit   = document.createElement("td");
  tdUnit.style.width = "90px";
  const unitSelect = buildUnitSelect(prefill?.unitId || "");
  tdUnit.appendChild(unitSelect);

  // Col 4: Note
  const tdNote   = document.createElement("td");
  const noteInput = document.createElement("input");
  noteInput.type  = "text";
  noteInput.className = "note-input";
  noteInput.placeholder = "e.g. softened, sifted...";
  noteInput.maxLength = 60;
  if (prefill) noteInput.value = prefill.note || "";
  tdNote.appendChild(noteInput);

  // Col 5: Remove button
  const tdRemove = document.createElement("td");
  tdRemove.style.width = "32px";
  const removeBtn = document.createElement("button");
  removeBtn.type  = "button";
  removeBtn.className = "btn-remove-row";
  removeBtn.textContent = "✕";
  removeBtn.title = "Remove ingredient";
  removeBtn.addEventListener("click", () => {
    tr.remove();
    ingredientRows[rowIndex] = null;
  });
  tdRemove.appendChild(removeBtn);

  tr.appendChild(tdIngredient);
  tr.appendChild(tdAmount);
  tr.appendChild(tdUnit);
  tr.appendChild(tdNote);
  tr.appendChild(tdRemove);

  ingredientsBody.appendChild(tr);
}

// ── Add direction block ───────────────────────────────────────────────────────
function addDirectionBlock(prefill = null) {
  const block = document.createElement("div");
  block.className = "direction-block";

  const header = document.createElement("div");
  header.className = "direction-block-header";

  const titleInput = document.createElement("input");
  titleInput.type  = "text";
  titleInput.className = "direction-title-input";
  titleInput.placeholder = "Section title (e.g. Crust Directions)";
  titleInput.maxLength = 60;
  if (prefill) titleInput.value = prefill.title;

  const removeBtn  = document.createElement("button");
  removeBtn.type   = "button";
  removeBtn.className = "btn-remove-row";
  removeBtn.textContent = "✕";
  removeBtn.title  = "Remove section";
  removeBtn.addEventListener("click", () => block.remove());

  header.appendChild(titleInput);
  header.appendChild(removeBtn);

  const textInput  = document.createElement("textarea");
  textInput.className = "direction-text-input";
  textInput.placeholder = "Write your directions here...";
  if (prefill) textInput.value = prefill.text;

  block.appendChild(header);
  block.appendChild(textInput);
  directionsBody.appendChild(block);
}

// ── Button listeners ──────────────────────────────────────────────────────────
document.getElementById("addIngredientBtn").addEventListener("click", () => {
  addIngredientRow();
});

document.getElementById("addDirectionBtn").addEventListener("click", () => {
  addDirectionBlock();
});

// ── Load recipe for editing ───────────────────────────────────────────────────
async function loadRecipeForEdit(id) {
  try {
    const recipe = await getRecipe(id);

    document.getElementById("recipeTitle").value    = recipe.title || "";
    document.getElementById("mealType").value       = recipe.meal_type || "";
    document.getElementById("recipeCategory").value = recipe.recipe_category || "";
    document.getElementById("isPublic").checked     = recipe.isPublic || false;

    // Clear default empty rows
    ingredientsBody.innerHTML = "";
    directionsBody.innerHTML  = "";
    ingredientRows = [];

    // Load ingredients
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      recipe.ingredients
        .sort((a, b) => a.order - b.order)
        .forEach(ing => addIngredientRow(ing));
    } else {
      addIngredientRow();
    }

    // Load directions
    if (recipe.directions && recipe.directions.length > 0) {
      recipe.directions
        .sort((a, b) => a.order - b.order)
        .forEach(dir => addDirectionBlock(dir));
    } else {
      addDirectionBlock();
    }

  } catch (err) {
    console.error("Failed to load recipe:", err);
    alert("Failed to load recipe for editing.");
  }
}

// ── Collect form data ─────────────────────────────────────────────────────────
function collectFormData() {
  const title    = document.getElementById("recipeTitle").value.trim();
  const mealType = document.getElementById("mealType").value;
  const category = document.getElementById("recipeCategory").value;
  const isPublic = document.getElementById("isPublic").checked;

  if (!title) {
    alert("Please enter a recipe name.");
    return null;
  }

  // Collect ingredients
  const ingredients = [];
  const rows = ingredientsBody.querySelectorAll(".ingredient-row");
  rows.forEach((row, index) => {
    const rowIndex    = parseInt(row.dataset.rowIndex);
    const ingredient  = ingredientRows[rowIndex];
    const amount      = row.querySelector(".amount-input").value;
    const unitSelect  = row.querySelector(".unit-select");
    const note        = row.querySelector(".note-input").value.trim();

    if (!ingredient) return; // skip rows with no ingredient selected

    const selectedUnit = unitSelect.options[unitSelect.selectedIndex];

    ingredients.push({
      order:          index + 1,
      ingredientId:   ingredient.id,
      ingredientName: ingredient.name,
      amount:         parseFloat(amount) || 0,
      unitId:         unitSelect.value,
      unitName:       selectedUnit?.dataset?.name || "",
      note:           note
    });
  });

  // Collect directions
  const directions = [];
  const blocks = directionsBody.querySelectorAll(".direction-block");
  blocks.forEach((block, index) => {
    const title = block.querySelector(".direction-title-input").value.trim();
    const text  = block.querySelector(".direction-text-input").value.trim();
    if (!text) return; // skip empty direction blocks
    directions.push({
      order: index + 1,
      title: title || `Step ${index + 1}`,
      text:  text
    });
  });

  return { title, meal_type: mealType, recipe_category: category, isPublic, ingredients, directions };
}

// ── Save recipe ───────────────────────────────────────────────────────────────
saveBtn.addEventListener("click", async () => {
  const data = collectFormData();
  if (!data) return;

  saveBtn.disabled = true;
  savingMsg.classList.add("visible");

  try {
    if (editingId) {
      await updateRecipe(editingId, data);
      window.location.href = `/recipe-view.html?id=${editingId}`;
    } else {
      const result = await createRecipe(data);
      window.location.href = `/recipe-view.html?id=${result.id}`;
    }
  } catch (err) {
    console.error("Save failed:", err);
    alert("Failed to save recipe. Please try again.");
    saveBtn.disabled = false;
    savingMsg.classList.remove("visible");
  }
});
