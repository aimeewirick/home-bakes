from flask import Blueprint, request, jsonify, g
from firebase_admin import firestore
from routes.auth import require_auth
from datetime import datetime, timezone

recipes_bp = Blueprint("recipes", __name__)
db = firestore.client()


@recipes_bp.route("/", methods=["GET"])
@require_auth
def get_my_recipes():
    docs = db.collection("recipes").where("uid", "==", g.uid).stream()
    return jsonify([{**d.to_dict(), "id": d.id} for d in docs])


@recipes_bp.route("/public", methods=["GET"])
def get_public_recipes():
    docs = db.collection("recipes").where("isPublic", "==", True).stream()
    return jsonify([{**d.to_dict(), "id": d.id} for d in docs])


@recipes_bp.route("/<recipe_id>", methods=["GET"])
@require_auth
def get_recipe(recipe_id):
    doc = db.collection("recipes").document(recipe_id).get()
    if not doc.exists:
        return jsonify({"error": "Recipe not found"}), 404
    data = doc.to_dict()
    if data["uid"] != g.uid and not data.get("isPublic", False):
        return jsonify({"error": "Unauthorized"}), 403
    data["id"] = doc.id
    ingredient_docs = db.collection("recipes").document(recipe_id).collection("recipe_ingredients").stream()
    data["ingredients"] = [{**i.to_dict(), "id": i.id} for i in ingredient_docs]
    return jsonify(data)


@recipes_bp.route("/", methods=["POST"])
@require_auth
def create_recipe():
    body = request.json
    ingredients = body.pop("ingredients", [])
    now = datetime.now(timezone.utc)
    body["uid"] = g.uid
    body["isPublic"] = body.get("isPublic", False)
    body["createdAt"] = now
    body["updatedAt"] = now
    ref = db.collection("recipes").add(body)
    recipe_id = ref[1].id
    for ingredient in ingredients:
        db.collection("recipes").document(recipe_id).collection("recipe_ingredients").add(ingredient)
    return jsonify({"id": recipe_id}), 201


@recipes_bp.route("/<recipe_id>", methods=["PUT"])
@require_auth
def update_recipe(recipe_id):
    doc = db.collection("recipes").document(recipe_id).get()
    is_admin = g.token.get("admin", False) if hasattr(g, "token") else False
    if not doc.exists or (doc.to_dict()["uid"] != g.uid and not is_admin):
        return jsonify({"error": "Not found or unauthorized"}), 403
    body = request.json
    ingredients = body.pop("ingredients", None)
    body["updatedAt"] = datetime.now(timezone.utc)
    db.collection("recipes").document(recipe_id).update(body)
    if ingredients is not None:
        existing = db.collection("recipes").document(recipe_id).collection("recipe_ingredients").stream()
        for e in existing:
            e.reference.delete()
        for ingredient in ingredients:
            db.collection("recipes").document(recipe_id).collection("recipe_ingredients").add(ingredient)
    return jsonify({"success": True})


@recipes_bp.route("/<recipe_id>", methods=["DELETE"])
@require_auth
def delete_recipe(recipe_id):
    doc = db.collection("recipes").document(recipe_id).get()
    is_admin = g.token.get("admin", False) if hasattr(g, "token") else False
    if not doc.exists or (doc.to_dict()["uid"] != g.uid and not is_admin):
        return jsonify({"error": "Not found or unauthorized"}), 403
    recipe_ref = db.collection("recipes").document(recipe_id)
    # Delete recipe_ingredients subcollection
    for i in recipe_ref.collection("recipe_ingredients").stream():
        i.reference.delete()
    # Delete directions subcollection
    for d in recipe_ref.collection("directions").stream():
        d.reference.delete()
    recipe_ref.delete()
    return jsonify({"success": True})
