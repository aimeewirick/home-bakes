from firebase_admin import firestore
from routes.auth import require_auth
from flask import Blueprint, request, jsonify, g

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

# ── Private ingredients for current user ─────────────────────────────────────
@ingredients_bp.route("/private", methods=["GET"])
@require_auth
def get_private_ingredients():
    docs = db.collection("users").document(g.uid)             .collection("ingredients")             .order_by("name").stream()
    return jsonify([{**d.to_dict(), "id": d.id} for d in docs])

# ── Add private ingredient ────────────────────────────────────────────────────
@ingredients_bp.route("/private", methods=["POST"])
@require_auth
def add_private_ingredient():
    body = request.json
    if not body.get("name") or not body.get("category"):
        return jsonify({"error": "Name and category required"}), 400
    ref = db.collection("users").document(g.uid)            .collection("ingredients").add({
                "name":         body["name"],
                "category":     body["category"],
                "allergens":    body.get("allergens", []),
                "calories":     body.get("calories"),
                "calorie_unit": body.get("calorie_unit"),
            })
    return jsonify({"id": ref[1].id}), 201

# ── Submit pending ingredient ─────────────────────────────────────────────────
@ingredients_bp.route("/pending", methods=["POST"])
@require_auth
def add_pending_ingredient():
    db   = firestore.client()
    body = request.json
    if not body.get("name") or not body.get("category"):
        return jsonify({"error": "Name and category required"}), 400
    # Check not already in global ingredients
    existing = db.collection("ingredients")\
                 .where("name", "==", body["name"])\
                 .limit(1).get()
    if existing:
        return jsonify({"error": "Ingredient already exists globally"}), 409
    ref = db.collection("pending_ingredients").add({
        "name":         body["name"],
        "category":     body["category"],
        "allergens":    body.get("allergens", []),
        "calories":     body.get("calories"),
        "calorie_unit": body.get("calorie_unit"),
        "submitted_by": g.uid,
        "approved":     False,
    })
    return jsonify({"id": ref[1].id}), 201
