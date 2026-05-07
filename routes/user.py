from flask import Blueprint, jsonify, g
from firebase_admin import firestore, auth
from routes.auth import require_auth

user_bp = Blueprint("user", __name__)

def delete_subcollection(db, parent_ref, subcollection_name):
    """Delete all docs in a subcollection."""
    docs = parent_ref.collection(subcollection_name).stream()
    for doc in docs:
        doc.reference.delete()

@user_bp.route("/delete-account", methods=["DELETE"])
@require_auth
def delete_account():
    db  = firestore.client()
    uid = g.uid

    try:
        # ── Delete recipes + their subcollections ─────────────────────────────
        recipes = db.collection("recipes").where("uid", "==", uid).stream()
        for recipe in recipes:
            delete_subcollection(db, recipe.reference, "recipe_ingredients")
            delete_subcollection(db, recipe.reference, "directions")
            recipe.reference.delete()

        # ── Delete meal plans + their subcollections ──────────────────────────
        meal_plans = db.collection("meal_plans").where("uid", "==", uid).stream()
        for plan in meal_plans:
            delete_subcollection(db, plan.reference, "days")
            plan.reference.delete()

        # ── Delete shopping lists + their subcollections ──────────────────────
        shopping_lists = db.collection("shopping_lists").where("uid", "==", uid).stream()
        for lst in shopping_lists:
            delete_subcollection(db, lst.reference, "items")
            lst.reference.delete()

        # ── Delete private ingredients ────────────────────────────────────────
        user_ref = db.collection("users").document(uid)
        private_ings = user_ref.collection("ingredients").stream()
        for ing in private_ings:
            ing.reference.delete()

        # ── Delete user document ──────────────────────────────────────────────
        user_ref.delete()

        # ── Delete Firebase Auth account ──────────────────────────────────────
        auth.delete_user(uid)

        return jsonify({"success": True})

    except Exception as e:
        print(f"Error deleting account for {uid}: {e}")
        return jsonify({"error": "Failed to delete account"}), 500
