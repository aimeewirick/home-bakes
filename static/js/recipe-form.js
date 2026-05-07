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
  getPrivateIngredients,
  addPrivateIngredient,
  addPendingIngredient,
  getUnits,
  getIngredientCategories,
  getAllergens
} from "/static/js/api.js";

const storage = getStorage();

// ── State ─────────────────────────────────────────────────────────────────────
let allIngredients   = [];
let allUnits         = [];
let allIngCategories = [];
let allAllergens     = [];
let ingredientRows   = [];
let editingId        = null;
let pendingImageFile = null;

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
    const [globalIngredients, privateIngredients, units, ingCategories, allergenList] = await Promise.all([
      getIngredients(),
      getPrivateIngredients().catch(() => []),
      getUnits(),
      getIngredientCategories(),
      getAllergens()
    ]);
    allIngCategories = ingCategories;
    allAllergens     = allergenList;

    // Merge global + private, deduplicate by name, sort alphabetically
    const seen = new Set();
    allIngredients = [...globalIngredients, ...privateIngredients]
      .filter(i => {
        if (seen.has(i.name.toLowerCase())) return false;
        seen.add(i.name.toLowerCase());
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
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
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "typeahead-empty";
      emptyDiv.textContent = `No ingredients found for "${query}"`;
      dropdown.appendChild(emptyDiv);

      const createBtn = document.createElement("div");
      createBtn.className = "typeahead-create-btn";
      createBtn.innerHTML = `<strong>+ Create private ingredient:</strong> "${query}"`;
      createBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        openCreateIngredientModal(query, rowIndex, input, dropdown);
      });
      dropdown.appendChild(createBtn);
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

    // Always show create option at bottom
    const createBtn = document.createElement("div");
    createBtn.className = "typeahead-create-btn";
    createBtn.innerHTML = `+ Create private ingredient`;
    createBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      openCreateIngredientModal(input.value, rowIndex, input, dropdown);
    });
    dropdown.appendChild(createBtn);

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
    // Snapshot full ingredient data including allergens + calories
    // Look up unit type from ingredient's calorie_unit
    const calorieUnitData = allUnits.find(u => u.abbreviation === ingredient.calorie_unit);
    const unitType = calorieUnitData?.type || "count";

    ingredientRows[rowIndex] = {
      id:           ingredient.id,
      name:         ingredient.name,
      category:     ingredient.category || "",
      allergens:    ingredient.allergens || [],
      calories:     ingredient.calories  || null,
      calorie_unit: ingredient.calorie_unit || null,
      unitType:     unitType,
    };
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
  if (prefill) {
    // Look up full ingredient data so allergens/calories are preserved
    const fullIngredient = allIngredients.find(i => i.id === prefill.ingredientId)
      || { id: prefill.ingredientId, name: prefill.ingredientName, category: "", allergens: prefill.allergens || [], calories: prefill.calories || null, calorie_unit: prefill.calorie_unit || null };
    typeahead._setIngredient(fullIngredient);
  }
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
    document.getElementById("recipeNotes").value    = recipe.notes || "";

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
  const notes    = document.getElementById("recipeNotes").value.trim();

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
      note:           row.querySelector(".note-input").value.trim(),
      allergens:      ingredient.allergens    || [],
      calories:       ingredient.calories     || null,
      calorie_unit:   ingredient.calorie_unit || null,
      unitType:       ingredient.unitType     || "count",
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

  // Compute recipe-level allergen summary from all ingredients
  const allergenSet = new Set();
  ingredients.forEach(ing => (ing.allergens || []).forEach(a => allergenSet.add(a)));
  const allergens = [...allergenSet].sort();

  return { title, meal_type: mealType, recipe_category: category, isPublic, ingredients, directions, allergens, notes };
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

    // If inside iframe (meal planner), notify parent instead of navigating
    if (window.parent !== window) {
      window.parent.postMessage("recipe-saved", "*");
    } else {
      window.location.href = `/recipe-view.html?id=${recipeId}`;
    }

  } catch (err) {
    console.error("Save failed:", err);
    alert("Failed to save recipe. Please try again.");
    saveBtn.disabled = false;
    savingMsg.classList.remove("visible");
  }
});


// ── Create private ingredient modal ──────────────────────────────────────────
// Inject modal HTML once
const createIngModal = document.createElement("div");
createIngModal.id = "createIngModal";
createIngModal.style.cssText = `
  display:none; position:fixed; inset:0;
  background:rgba(0,0,0,0.5); z-index:300;
  align-items:center; justify-content:center;
`;
createIngModal.innerHTML = `
  <div style="background:white; border-radius:16px; padding:1.75rem;
              max-width:400px; width:90%; box-shadow:0 8px 32px rgba(0,0,0,0.25);">
    <h3 style="font-family:'Playfair Display',serif; color:#2D3748;
               margin-bottom:1.25rem; font-size:1.1rem;">
      Create Private Ingredient
    </h3>

    <div style="margin-bottom:1rem;">
      <label style="display:block; font-size:0.78rem; font-weight:700;
                    color:#6B5B4E; text-transform:uppercase;
                    letter-spacing:0.06em; margin-bottom:0.4rem;">Name</label>
      <input type="text" id="createIngName"
             style="width:100%; padding:0.5rem 0.75rem; border:1.5px solid #E8E0D5;
                    border-radius:8px; font-family:'Lato',sans-serif;
                    font-size:0.9rem; box-sizing:border-box; outline:none;"
             maxlength="100" />
    </div>

    <div style="margin-bottom:1rem;">
      <label style="display:block; font-size:0.78rem; font-weight:700;
                    color:#6B5B4E; text-transform:uppercase;
                    letter-spacing:0.06em; margin-bottom:0.4rem;">Category</label>
      <select id="createIngCategory"
              style="width:100%; padding:0.5rem 0.75rem; border:1.5px solid #E8E0D5;
                     border-radius:8px; font-family:'Lato',sans-serif;
                     font-size:0.9rem; box-sizing:border-box; outline:none;
                     background:white; cursor:pointer;">
        <option value="">Select category...</option>
      </select>
    </div>

    <div style="margin-bottom:1rem;">
      <label style="display:block; font-size:0.78rem; font-weight:700;
                    color:#6B5B4E; text-transform:uppercase;
                    letter-spacing:0.06em; margin-bottom:0.5rem;">Allergens</label>
      <div id="createIngAllergens" style="display:flex; flex-wrap:wrap; gap:0.4rem;">
        <!-- Injected by JS -->
      </div>
    </div>

    <div style="margin-bottom:1.5rem; display:flex; gap:0.75rem; align-items:flex-end;">
      <div style="flex:1;">
        <label style="display:block; font-size:0.78rem; font-weight:700;
                      color:#6B5B4E; text-transform:uppercase;
                      letter-spacing:0.06em; margin-bottom:0.4rem;">Calories</label>
        <input type="number" id="createIngCalories" min="0"
               style="width:100%; padding:0.5rem 0.75rem; border:1.5px solid #E8E0D5;
                      border-radius:8px; font-family:'Lato',sans-serif;
                      font-size:0.9rem; box-sizing:border-box; outline:none;"
               placeholder="e.g. 102" />
      </div>
      <div style="flex:1;">
        <label style="display:block; font-size:0.78rem; font-weight:700;
                      color:#6B5B4E; text-transform:uppercase;
                      letter-spacing:0.06em; margin-bottom:0.4rem;">Per Unit</label>
        <select id="createIngCalorieUnit"
                style="width:100%; padding:0.5rem 0.75rem; border:1.5px solid #E8E0D5;
                       border-radius:8px; font-family:'Lato',sans-serif;
                       font-size:0.9rem; box-sizing:border-box; outline:none;
                       background:white; cursor:pointer;">
          <option value="">unit...</option>
        </select>
      </div>
    </div>

    <div style="margin-bottom:1.5rem; display:flex; align-items:center; gap:0.75rem;">
      <label class="toggle-switch" style="flex-shrink:0;">
        <input type="checkbox" id="createIngSuggest" />
        <span class="toggle-slider"></span>
      </label>
      <span style="font-family:'Lato',sans-serif; font-size:0.85rem; color:#6B5B4E;">
        Request this be added to the ingredients list
      </span>
    </div>

    <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
      <button id="createIngCancelBtn"
              style="background:#F8F5EE; border:1.5px solid #E8E0D5;
                     border-radius:8px; padding:0.5rem 1.1rem;
                     font-family:'Lato',sans-serif; font-weight:700;
                     font-size:0.85rem; cursor:pointer; color:#6B5B4E;">
        Cancel
      </button>
      <button id="createIngSaveBtn"
              style="background:#98D0D6; border:none; border-radius:8px;
                     padding:0.5rem 1.25rem; font-family:'Lato',sans-serif;
                     font-weight:700; font-size:0.85rem; cursor:pointer;
                     color:#35595F;">
        Add Ingredient
      </button>
    </div>
  </div>
`;
document.body.appendChild(createIngModal);

let _createIngCallback = null;

function openCreateIngredientModal(query, rowIndex, input, dropdown) {
  // Populate category dropdown
  const catSel = document.getElementById("createIngCategory");
  catSel.innerHTML = '<option value="">Select category...</option>';
  allIngCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.name;
    opt.textContent = cat.name;
    catSel.appendChild(opt);
  });

  // Populate allergen checkboxes
  const allergenContainer = document.getElementById("createIngAllergens");
  allergenContainer.innerHTML = allAllergens.map(a => `
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
  allergenContainer.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", () => {
      const chip = cb.closest(".ing-allergen-chip");
      chip.style.background    = cb.checked ? "rgba(220,38,38,0.08)" : "#F8F5EE";
      chip.style.borderColor   = cb.checked ? "rgba(220,38,38,0.4)"  : "#E8E0D5";
      chip.style.color         = cb.checked ? "#DC2626" : "";
      chip.style.fontWeight    = cb.checked ? "700" : "";
    });
  });

  // Populate calorie unit dropdown
  const unitSel = document.getElementById("createIngCalorieUnit");
  unitSel.innerHTML = '<option value="">unit...</option>';
  const groups = { volume: "Volume", weight: "Weight", count: "Count" };
  Object.entries(groups).forEach(([type, label]) => {
    const groupUnits = allUnits.filter(u => u.type === type);
    if (!groupUnits.length) return;
    const og = document.createElement("optgroup");
    og.label = label;
    groupUnits.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.abbreviation;
      opt.textContent = `${u.abbreviation} (${u.name})`;
      og.appendChild(opt);
    });
    unitSel.appendChild(og);
  });

  document.getElementById("createIngName").value     = query;
  document.getElementById("createIngCalories").value = "";
  document.getElementById("createIngSuggest").checked = false;
  createIngModal.style.display = "flex";
  document.getElementById("createIngName").focus();

  _createIngCallback = async () => {
    const name     = document.getElementById("createIngName").value.trim();
    const category = document.getElementById("createIngCategory").value;
    const suggest  = document.getElementById("createIngSuggest").checked;

    if (!name)     { alert("Please enter a name."); return; }
    if (!category) { alert("Please select a category."); return; }

    const allergens = [...document.querySelectorAll("#createIngAllergens input:checked")]
                        .map(cb => cb.value);
    const calories    = parseFloat(document.getElementById("createIngCalories").value) || null;
    const calUnit     = document.getElementById("createIngCalorieUnit").value || null;

    const ingData = { name, category, allergens, calories, calorie_unit: calUnit };

    try {
      // Always save to private ingredients
      await addPrivateIngredient(ingData);

      // If suggest toggle is on → also add to pending_ingredients
      if (suggest) {
        await addPendingIngredient({ ...ingData, submitted_by: "user" });
      }

      // Determine unitType from calorie unit
      const calUnitData = allUnits.find(u => u.abbreviation === ingData.calorie_unit);
      const unitType    = calUnitData?.type || "count";

      // Add to local allIngredients and select it
      allIngredients.push({ ...ingData, id: name, unitType });
      allIngredients.sort((a,b) => a.name.localeCompare(b.name));

      input.value = name;
      dropdown.classList.remove("open");

      // Snapshot onto row
      ingredientRows[rowIndex] = { ...ingData, id: name, unitType };

      createIngModal.style.display = "none";
    } catch(err) {
      console.error("Failed to create ingredient:", err);
      alert("Failed to create ingredient. Please try again.");
    }
  };
}

document.getElementById("createIngCancelBtn").addEventListener("click", () => {
  createIngModal.style.display = "none";
});

document.getElementById("createIngSaveBtn").addEventListener("click", () => {
  if (_createIngCallback) _createIngCallback();
});

document.getElementById("createIngName").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("createIngSaveBtn").click();
});
