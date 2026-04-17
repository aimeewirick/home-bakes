// api.js
// Since Flask serves both the frontend AND the API, we use
// relative URLs — no need to switch between local and production URLs.

import { getToken } from "/static/js/auth.js";

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Recipes ───────────────────────────────────────────────────────────────────
export const getMyRecipes     = ()        => apiFetch("/api/recipes/");
export const getPublicRecipes = ()        => apiFetch("/api/recipes/public");
export const getRecipe        = (id)      => apiFetch(`/api/recipes/${id}`);
export const createRecipe     = (data)    => apiFetch("/api/recipes/",      { method: "POST",   body: JSON.stringify(data) });
export const updateRecipe     = (id,data) => apiFetch(`/api/recipes/${id}`, { method: "PUT",    body: JSON.stringify(data) });
export const deleteRecipe     = (id)      => apiFetch(`/api/recipes/${id}`, { method: "DELETE" });

// ── Ingredients ───────────────────────────────────────────────────────────────
export const getIngredients         = (cat="") => apiFetch(`/api/ingredients/${cat ? "?category="+cat : ""}`);
export const getIngredientCategories= ()       => apiFetch("/api/ingredients/categories");

// ── Meal Plans ────────────────────────────────────────────────────────────────
export const getMealPlans   = ()        => apiFetch("/api/meal-plans/");
export const getMealPlan    = (id)      => apiFetch(`/api/meal-plans/${id}`);
export const createMealPlan = (data)    => apiFetch("/api/meal-plans/",      { method: "POST",   body: JSON.stringify(data) });
export const updateMealPlan = (id,data) => apiFetch(`/api/meal-plans/${id}`, { method: "PUT",    body: JSON.stringify(data) });
export const deleteMealPlan = (id)      => apiFetch(`/api/meal-plans/${id}`, { method: "DELETE" });

// ── Shopping Lists ────────────────────────────────────────────────────────────
export const getShoppingLists  = ()           => apiFetch("/api/shopping-lists/");
export const getShoppingList   = (id)         => apiFetch(`/api/shopping-lists/${id}`);
export const createShoppingList= (data)       => apiFetch("/api/shopping-lists/",      { method: "POST",   body: JSON.stringify(data) });
export const deleteShoppingList= (id)         => apiFetch(`/api/shopping-lists/${id}`, { method: "DELETE" });
export const addShoppingItem   = (lid, item)  => apiFetch(`/api/shopping-lists/${lid}/items`,        { method: "POST",  body: JSON.stringify(item) });
export const toggleHaveIt      = (lid,iid,val)=> apiFetch(`/api/shopping-lists/${lid}/items/${iid}`, { method: "PATCH", body: JSON.stringify({ have_it: val }) });

// ── Units ─────────────────────────────────────────────────────────────────────
export const getUnits = () => apiFetch("/api/units/");
