// recipe-form.js
// Handles recipe creation/editing including image upload to Firebase Storage

import { requireAuth } from "/static/js/auth.js";
import { auth } from "/static/js/firebase-init.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import {
  createRecipe,
  updateRecipe,
  getRecipe,
  getIngredients,
  getUnits
} from "/static/js/api.js";

const storage = getStorage();

// ── State ─────────────────────────────────────────────────────────────────────
let allIngredients  = [];
let allUnits        = [];
let ingredientRows  = [];
let editingId       = null;
let pendingImageFile = null;   // holds selected image file until save

// ── DOM refs ──────────────────────────────────────────────────────────────────
const ingredientsBody = document.getElementById("ingredientsBody");
const directionsBody  = document.getElementById("directionsBody");
const saveBtn         = document.getElementById("saveBtn");
const savingMsg       = document.getElementById("savingMsg");
const pageTitle       = document.getElementById("pageTitle");
const cardTab         = document.getElementById("cardTab");
const imageInput      = document.getElementById("recipeImageInput");
const imagePreview    = document.getElementById("imagePreview");
const imagePlaceholder= document.getElementById("imagePlaceholder");

// ── Init ──────────────────────────────────────────────────────────────────────
requireAuth(async () => {
  const params = new URLSearchParams(window.location.search);
  editingId = params.get("id");

  if (editingId) {
    pageTitle.textContent = "Edit Recipe";
    cardTab.textContent   = "EDIT RECIPE";
  }

  try {
    const [ingredients, units] = await Promise.all([
      getIngredients(),
      getUnits()
    ]);

    allIngredients = ingredients.sort((a, b) => a.name.localeCompare(b.name));
    allUnits = units.sort((a, b) => {
      const order = { volume: 0, weight: 1, count: 2, other: 3 };
      return (order[a.type] ?? 4) - (order[b.type] ?? 4) || a.name.localeCompare(b.name);
    });

    addIngredientRow();
    addDirectionBlock();

    if (editingId) await loadRecipeForEdit(editingId);

  } catch (err) {
    console.error("Failed to load form data:", err);
    alert("Failed to load ingredients. Please refresh the page.");
  }
});

// ── Image upload handling ─────────────────────────────────────────────────────
document.getElementById("imageUploadArea").addEventListener("click", () => {
  imageInput.click();
});

// Drag and drop
const uploadArea = document.getElementById("imageUploadArea");

uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("drag-over");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("drag-over");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) {
    handleImageSelected(file);
  }
});

imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) handleImageSelected(file);
});

function handleImageSelected(file) {
  pendingImageFile = file;

  // Show preview immediately
  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreview.src = e.target.result;
    imagePreview.style.display = "block";
    imagePlaceholder.style.display = "none";
  };
  reader.readAsDataURL(file);
}

async function uploadRecipeImage(recipeId) {
  if (!pendingImageFile) return null;
  const storageRef = ref(storage, `recipe-images/${recipeId}`);
  await uploadBytes(storageRef, pendingImageFile);
  return await getDownloadURL(storageRef);
}

// ── Typeahead ─────────────────────────────────────────────────────────────────
function createTypeahead(rowIndex) {
  const wrapper  = document.createElement("div");
  wrapper.className = "typeahead-wrapper";

  const input    = document.createElement("input");
  input.type     = "text";
  input.className = "typeahead-input";
  input.placeholder = "Search ingredient...";
  input.autocomplete = "off";

  const dropdown = document.createElement("div");
  dropdown.className = "typeahead-dropdown";

  wrapper.appendChild(input);
  wrapper.appendChild(dropdown);

  let highlightIndex = -1;

  function renderDropdown(query) {
    dropdown.innerHTML = "";
    highlightIndex = -1;
    if (!query) { dropdown.classList.remove("open"); return; }

    const q = query.toLowerCase();
    const matches = allIngredients.filter(i =>
      i.name.toLowerCase().includes(q)
    ).slice(0, 12);

    if (matches.length === 0) {
      dropdown.innerHTML = `<div class="typeahead-empty">No ingredients found for "${query}"</div>`;
      dropdown.classList.add("open");
      return;
    }

    matches.forEach(ingredient => {
      const item = document.createElement("div");
      item.className = "typeahead-item";
      item.innerHTML = `
        <span>${highlightMatch(ingredient.name, query)}</span>
        <span class="typeahead-category">${ingredient.category}</span>`;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
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
    input.value = ingredient.name;
    ingredientRows[rowIndex] = ingredient;
    dropdown.classList.remove("open");
  }

  input.addEventListener("keydown", (e) => {
    const items = dropdown.querySelectorAll(".typeahead-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightIndex = Math.min(highlightIndex + 1, items.length - 1);
      items.forEach((item, idx) => item.classList.toggle("highlighted", idx === highlightIndex));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightIndex = Math.max(highlightIndex - 1, -1);
      items.forEach((item, idx) => item.classList.toggle("highlighted", idx === highlightIndex));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      items[highlightIndex].dispatchEvent(new Event("mousedown"));
    } else if (e.key === "Escape") {
      dropdown.classList.remove("open");
    }
  });

  input.addEventListener("input", () => {
    ingredientRows[rowIndex] = null;
    renderDropdown(input.value);
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      dropdown.classList.remove("open");

      // ── Validation: if text doesn't match a selected ingredient, clear it ──
      // This prevents free-text entries that won't save properly
      if (input.value && !ingredientRows[rowIndex]) {
        // Check if typed text exactly matches an ingredient name
        const exact = allIngredients.find(
          i => i.name.toLowerCase() === input.value.toLowerCase()
        );
        if (exact) {
          // Exact match found — auto-select it
          selectIngredient(exact);
        } else {
          // No match — clear the field and show hint
          input.value = "";
          input.placeholder = "⚠️ Select from list...";
          input.style.borderColor = "#C0392B";
          setTimeout(() => {
            input.placeholder = "Search ingredient...";
            input.style.borderColor = "";
          }, 2500);
        }
      }
    }, 150);
  });

  input.addEventListener("focus", () => {
    if (input.value) renderDropdown(input.value);
  });

  wrapper._setIngredient = (ingredient) => selectIngredient(ingredient);
  return wrapper;
}

// ── Build unit select ─────────────────────────────────────────────────────────
function buildUnitSelect(selectedUnitId = "") {
  const select = document.createElement("select");
  select.className = "unit-select";

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "unit";
  select.appendChild(blank);

  const groups = { volume: "Volume", weight: "Weight", count: "Count", other: "Other" };
  Object.entries(groups).forEach(([type, label]) => {
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

// ── Add ingredient row ────────────────────────────────────────────────────────
function addIngredientRow(prefill = null) {
  const rowIndex = ingredientRows.length;
  ingredientRows.push(null);

  const tr = document.createElement("tr");
  tr.className = "ingredient-row";
  tr.dataset.rowIndex = rowIndex;

  const tdIngredient = document.createElement("td");
  const typeahead = createTypeahead(rowIndex);
  if (prefill) typeahead._setIngredient({ id: prefill.ingredientId, name: prefill.ingredientName, category: "" });
  tdIngredient.appendChild(typeahead);

  const tdAmount = document.createElement("td");
  tdAmount.style.width = "80px";
  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.className = "amount-input";
  amountInput.placeholder = "amt";
  amountInput.min = "0";
  amountInput.step = "0.25";
  if (prefill) amountInput.value = prefill.amount;
  tdAmount.appendChild(amountInput);

  const tdUnit = document.createElement("td");
  tdUnit.style.width = "90px";
  tdUnit.appendChild(buildUnitSelect(prefill?.unitId || ""));

  const tdNote = document.createElement("td");
  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.className = "note-input";
  noteInput.placeholder = "e.g. softened, sifted...";
  noteInput.maxLength = 60;
  if (prefill) noteInput.value = prefill.note || "";
  tdNote.appendChild(noteInput);

  const tdRemove = document.createElement("td");
  tdRemove.style.width = "32px";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-remove-row";
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", () => {
    tr.remove();
    ingredientRows[rowIndex] = null;
  });
  tdRemove.appendChild(removeBtn);

  tr.append(tdIngredient, tdAmount, tdUnit, tdNote, tdRemove);
  ingredientsBody.appendChild(tr);
}

// ── Add direction block ───────────────────────────────────────────────────────
function addDirectionBlock(prefill = null) {
  const block = document.createElement("div");
  block.className = "direction-block";

  const header = document.createElement("div");
  header.className = "direction-block-header";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "direction-title-input";
  titleInput.placeholder = "Section title (e.g. Crust Directions)";
  titleInput.maxLength = 60;
  if (prefill) titleInput.value = prefill.title;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-remove-row";
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", () => block.remove());

  header.append(titleInput, removeBtn);

  const textInput = document.createElement("textarea");
  textInput.className = "direction-text-input";
  textInput.placeholder = "Write your directions here...";
  if (prefill) textInput.value = prefill.text;

  block.append(header, textInput);
  directionsBody.appendChild(block);
}

// ── Button listeners ──────────────────────────────────────────────────────────
document.getElementById("addIngredientBtn").addEventListener("click", () => addIngredientRow());
document.getElementById("addDirectionBtn").addEventListener("click", () => addDirectionBlock());

// ── Load recipe for editing ───────────────────────────────────────────────────
async function loadRecipeForEdit(id) {
  try {
    const recipe = await getRecipe(id);
    document.getElementById("recipeTitle").value    = recipe.title || "";
    document.getElementById("mealType").value       = recipe.meal_type || "";
    document.getElementById("recipeCategory").value = recipe.recipe_category || "";
    document.getElementById("isPublic").checked     = recipe.isPublic || false;

    // Load existing image
    if (recipe.imageUrl) {
      imagePreview.src = recipe.imageUrl;
      imagePreview.style.display = "block";
      imagePlaceholder.style.display = "none";
    }

    ingredientsBody.innerHTML = "";
    directionsBody.innerHTML  = "";
    ingredientRows = [];

    (recipe.ingredients || []).sort((a,b) => a.order - b.order).forEach(ing => addIngredientRow(ing));
    if (!recipe.ingredients?.length) addIngredientRow();

    (recipe.directions || []).sort((a,b) => a.order - b.order).forEach(dir => addDirectionBlock(dir));
    if (!recipe.directions?.length) addDirectionBlock();

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

  if (!title) { alert("Please enter a recipe name."); return null; }

  const ingredients = [];
  ingredientsBody.querySelectorAll(".ingredient-row").forEach((row, index) => {
    const rowIndex   = parseInt(row.dataset.rowIndex);
    const ingredient = ingredientRows[rowIndex];
    if (!ingredient) return;
    const unitSelect = row.querySelector(".unit-select");
    const selectedUnit = unitSelect.options[unitSelect.selectedIndex];
    ingredients.push({
      order:          index + 1,
      ingredientId:   ingredient.id,
      ingredientName: ingredient.name,
      amount:         parseFloat(row.querySelector(".amount-input").value) || 0,
      unitId:         unitSelect.value,
      unitName:       selectedUnit?.dataset?.name || "",
      note:           row.querySelector(".note-input").value.trim()
    });
  });

  const directions = [];
  directionsBody.querySelectorAll(".direction-block").forEach((block, index) => {
    const text = block.querySelector(".direction-text-input").value.trim();
    if (!text) return;
    directions.push({
      order: index + 1,
      title: block.querySelector(".direction-title-input").value.trim() || `Step ${index + 1}`,
      text
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
    let recipeId = editingId;

    if (editingId) {
      await updateRecipe(editingId, data);
    } else {
      const result = await createRecipe(data);
      recipeId = result.id;
    }

    // Upload image if one was selected
    if (pendingImageFile && recipeId) {
      const imageUrl = await uploadRecipeImage(recipeId);
      if (imageUrl) {
        await updateRecipe(recipeId, { imageUrl });
      }
    }

    window.location.href = `/recipe-view.html?id=${recipeId}`;

  } catch (err) {
    console.error("Save failed:", err);
    alert("Failed to save recipe. Please try again.");
    saveBtn.disabled = false;
    savingMsg.classList.remove("visible");
  }
});
