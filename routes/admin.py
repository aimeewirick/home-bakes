from flask import Blueprint, request, jsonify, g
from firebase_admin import firestore
from routes.auth import require_auth, require_admin

admin_bp = Blueprint("admin", __name__)
db = firestore.client()

# ── Get all ingredients (paginated) ──────────────────────────────────────────
@admin_bp.route("/ingredients", methods=["GET"])
@require_admin
def get_all_ingredients():
    category = request.args.get("category", "")
    query = db.collection("ingredients")
    if category:
        query = query.where("category", "==", category)
    docs = query.order_by("name").stream()
    return jsonify([{**d.to_dict(), "id": d.id} for d in docs])

# ── Add new global ingredient ─────────────────────────────────────────────────
@admin_bp.route("/ingredients", methods=["POST"])
@require_admin
def add_ingredient():
    body = request.json
    if not body.get("name") or not body.get("category"):
        return jsonify({"error": "Name and category required"}), 400

    # Check for duplicate
    existing = db.collection("ingredients")\
                 .where("name", "==", body["name"])\
                 .limit(1).get()
    if existing:
        return jsonify({"error": "Ingredient already exists"}), 409

    ref = db.collection("ingredients").add({
        "name":         body["name"],
        "category":     body["category"],
        "allergens":    body.get("allergens", []),
        "calories":     body.get("calories"),
        "calorie_unit": body.get("calorie_unit"),
    })
    return jsonify({"id": ref[1].id}), 201

# ── Update ingredient ─────────────────────────────────────────────────────────
@admin_bp.route("/ingredients/<ingredient_id>", methods=["PUT"])
@require_admin
def update_ingredient(ingredient_id):
    body = request.json
    db.collection("ingredients").document(ingredient_id).update({
        "name":         body["name"],
        "category":     body["category"],
        "allergens":    body.get("allergens", []),
        "calories":     body.get("calories"),
        "calorie_unit": body.get("calorie_unit"),
    })
    return jsonify({"success": True})

# ── Delete ingredient ─────────────────────────────────────────────────────────
@admin_bp.route("/ingredients/<ingredient_id>", methods=["DELETE"])
@require_admin
def delete_ingredient(ingredient_id):
    db.collection("ingredients").document(ingredient_id).delete()
    return jsonify({"success": True})

# ── Get pending user submissions ──────────────────────────────────────────────
@admin_bp.route("/pending-ingredients", methods=["GET"])
@require_admin
def get_pending_ingredients():
    db      = firestore.client()
    docs    = db.collection("pending_ingredients")               .where("approved", "==", False)               .stream()
    results = []
    for d in docs:
        data = {**d.to_dict(), "id": d.id}
        uid  = data.get("submitted_by")
        if uid:
            try:
                user_doc = db.collection("users").document(uid).get()
                if user_doc.exists:
                    u = user_doc.to_dict()
                    data["submitted_by"] = u.get("displayName") or u.get("email", uid)
            except:
                pass
        results.append(data)
    return jsonify(results)

# ── Approve pending ingredient → promote to global ────────────────────────────
@admin_bp.route("/pending-ingredients/<pending_id>/approve", methods=["POST"])
@require_admin
def approve_ingredient(pending_id):
    doc = db.collection("pending_ingredients").document(pending_id).get()
    if not doc.exists:
        return jsonify({"error": "Not found"}), 404
    data = doc.to_dict()

    # Add to global ingredients
    db.collection("ingredients").add({
        "name":         data["name"],
        "category":     data["category"],
        "allergens":    data.get("allergens", []),
        "calories":     data.get("calories"),
        "calorie_unit": data.get("calorie_unit"),
    })

    # Delete from pending
    db.collection("pending_ingredients").document(pending_id).delete()
    return jsonify({"success": True})

# ── Reject pending ingredient ─────────────────────────────────────────────────
@admin_bp.route("/pending-ingredients/<pending_id>/reject", methods=["DELETE"])
@require_admin
def reject_ingredient(pending_id):
    db.collection("pending_ingredients").document(pending_id).delete()
    return jsonify({"success": True})
