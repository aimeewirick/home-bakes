from flask import Blueprint, request, jsonify, g
from firebase_admin import firestore
from routes.auth import require_auth
from datetime import datetime, timezone

shopping_lists_bp = Blueprint("shopping_lists", __name__)


@shopping_lists_bp.route("/", methods=["GET"])
@require_auth
def get_shopping_lists():
    db   = firestore.client()
    docs = db.collection("shopping_lists").where("uid", "==", g.uid).stream()
    return jsonify([{**d.to_dict(), "id": d.id} for d in docs])


@shopping_lists_bp.route("/<list_id>", methods=["GET"])
@require_auth
def get_shopping_list(list_id):
    db  = firestore.client()
    doc = db.collection("shopping_lists").document(list_id).get()
    if not doc.exists or doc.to_dict()["uid"] != g.uid:
        return jsonify({"error": "Not found or unauthorized"}), 403
    data  = {**doc.to_dict(), "id": doc.id}
    items = db.collection("shopping_lists").document(list_id).collection("items").stream()
    data["items"] = [{**i.to_dict(), "id": i.id} for i in items]
    return jsonify(data)


@shopping_lists_bp.route("/", methods=["POST"])
@require_auth
def create_shopping_list():
    db    = firestore.client()
    body  = request.json
    items = body.pop("items", [])
    now   = datetime.now(timezone.utc)
    body["uid"]       = g.uid
    body["createdAt"] = now
    body["updatedAt"] = now
    ref     = db.collection("shopping_lists").add(body)
    list_id = ref[1].id
    for item in items:
        item["have_it"] = item.get("have_it", False)
        db.collection("shopping_lists").document(list_id).collection("items").add(item)
    return jsonify({"id": list_id}), 201


@shopping_lists_bp.route("/<list_id>/items/<item_id>", methods=["PATCH"])
@require_auth
def toggle_have_it(list_id, item_id):
    db  = firestore.client()
    doc = db.collection("shopping_lists").document(list_id).get()
    if not doc.exists or doc.to_dict()["uid"] != g.uid:
        return jsonify({"error": "Not found or unauthorized"}), 403
    body = request.json
    db.collection("shopping_lists").document(list_id)      .collection("items").document(item_id)      .update({"have_it": body.get("have_it", False)})
    return jsonify({"success": True})


@shopping_lists_bp.route("/<list_id>/items", methods=["POST"])
@require_auth
def add_item(list_id):
    db  = firestore.client()
    doc = db.collection("shopping_lists").document(list_id).get()
    if not doc.exists or doc.to_dict()["uid"] != g.uid:
        return jsonify({"error": "Not found or unauthorized"}), 403
    item = request.json
    item["have_it"] = False
    ref = db.collection("shopping_lists").document(list_id).collection("items").add(item)
    return jsonify({"id": ref[1].id}), 201


@shopping_lists_bp.route("/<list_id>", methods=["DELETE"])
@require_auth
def delete_shopping_list(list_id):
    db  = firestore.client()
    doc = db.collection("shopping_lists").document(list_id).get()
    if not doc.exists or doc.to_dict()["uid"] != g.uid:
        return jsonify({"error": "Not found or unauthorized"}), 403
    items = db.collection("shopping_lists").document(list_id).collection("items").stream()
    for i in items:
        i.reference.delete()
    db.collection("shopping_lists").document(list_id).delete()
    return jsonify({"success": True})
