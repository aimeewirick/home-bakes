from flask import Blueprint, request, jsonify, g
from firebase_admin import firestore, auth
from routes.auth import require_admin

user_admin_bp = Blueprint("user_admin", __name__)

# ── List all users ────────────────────────────────────────────────────────────
@user_admin_bp.route("/users", methods=["GET"])
@require_admin
def get_users():
    db = firestore.client()
    users = []

    # Get all users from Firebase Auth
    page = auth.list_users()
    while page:
        for firebase_user in page.users:
            uid = firebase_user.uid
            # Get extra data from Firestore users collection
            user_doc = db.collection("users").document(uid).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}

            users.append({
                "uid":          uid,
                "email":        firebase_user.email or "",
                "displayName":  firebase_user.display_name or user_data.get("displayName", ""),
                "disabled":     firebase_user.disabled,
                "isAdmin":      bool(firebase_user.custom_claims and firebase_user.custom_claims.get("admin")),
                "createdAt":    firebase_user.user_metadata.creation_timestamp,
                "lastSignIn":   firebase_user.user_metadata.last_sign_in_timestamp,
                "emailVerified": firebase_user.email_verified,
            })
        page = page.get_next_page()

    users.sort(key=lambda u: u.get("email", "").lower())
    return jsonify(users)

# ── Set or remove admin claim ─────────────────────────────────────────────────
@user_admin_bp.route("/users/<uid>/admin", methods=["PUT"])
@require_admin
def set_admin(uid):
    # Prevent removing your own admin claim
    if uid == g.uid:
        return jsonify({"error": "Cannot modify your own admin status"}), 400

    body      = request.json
    is_admin  = bool(body.get("admin", False))
    auth.set_custom_user_claims(uid, {"admin": is_admin})
    return jsonify({"success": True, "admin": is_admin})

# ── Enable or disable user ────────────────────────────────────────────────────
@user_admin_bp.route("/users/<uid>/disabled", methods=["PUT"])
@require_admin
def set_disabled(uid):
    if uid == g.uid:
        return jsonify({"error": "Cannot disable your own account"}), 400

    body     = request.json
    disabled = bool(body.get("disabled", False))
    auth.update_user(uid, disabled=disabled)
    return jsonify({"success": True, "disabled": disabled})

# ── Delete user and all their data ────────────────────────────────────────────
@user_admin_bp.route("/users/<uid>", methods=["DELETE"])
@require_admin
def delete_user(uid):
    if uid == g.uid:
        return jsonify({"error": "Cannot delete your own account"}), 400

    db = firestore.client()

    def delete_subcollection(parent_ref, subcollection_name):
        docs = parent_ref.collection(subcollection_name).stream()
        for doc in docs:
            doc.reference.delete()

    try:
        # Handle recipes:
        # - Public recipes: remove uid association but keep the recipe
        # - Private recipes: delete entirely
        recipes = db.collection("recipes").where("uid", "==", uid).stream()
        for recipe in recipes:
            data = recipe.to_dict()
            if data.get("isPublic"):
                # Orphan public recipe — remove uid so it's no longer tied to deleted user
                recipe.reference.update({"uid": None, "ownerDeleted": True})
            else:
                # Delete private recipe and its subcollections
                delete_subcollection(recipe.reference, "recipe_ingredients")
                delete_subcollection(recipe.reference, "directions")
                recipe.reference.delete()

        # Delete meal plans
        meal_plans = db.collection("meal_plans").where("uid", "==", uid).stream()
        for plan in meal_plans:
            delete_subcollection(plan.reference, "days")
            plan.reference.delete()

        # Delete shopping lists
        shopping_lists = db.collection("shopping_lists").where("uid", "==", uid).stream()
        for lst in shopping_lists:
            delete_subcollection(lst.reference, "items")
            lst.reference.delete()

        # Delete private ingredients (user's personal subcollection)
        # Note: approved/global ingredients submitted by this user are in the
        # global 'ingredients' collection and are intentionally left intact.
        user_ref = db.collection("users").document(uid)
        delete_subcollection(user_ref, "ingredients")

        # Delete user document
        user_ref.delete()

        # Delete Firebase Auth account
        auth.delete_user(uid)

        return jsonify({"success": True})

    except Exception as e:
        print(f"Error deleting user {uid}: {e}")
        return jsonify({"error": "Failed to delete user"}), 500
