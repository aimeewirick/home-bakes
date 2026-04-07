from flask import Blueprint, jsonify, request
from firebase_admin import firestore
from routes.auth import require_auth

ingredients_bp = Blueprint("ingredients", __name__)
db = firestore.client()


@ingredients_bp.route("/", methods=["GET"])
@require_auth
def get_ingredients():
    category = request.args.get("category")
    ref = db.collection("ingredients")
    if category:
        ref = ref.where("category", "==", category)
    docs = ref.order_by("name").stream()
    return jsonify([{**d.to_dict(), "id": d.id} for d in docs])


@ingredients_bp.route("/categories", methods=["GET"])
@require_auth
def get_categories():
    docs = db.collection("ingredients").stream()
    categories = sorted(set(d.to_dict().get("category", "Other") for d in docs))
    return jsonify(categories)
