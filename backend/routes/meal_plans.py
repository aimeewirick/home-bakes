from flask import Blueprint, request, jsonify, g
from firebase_admin import firestore
from routes.auth import require_auth
from datetime import datetime, timezone

meal_plans_bp = Blueprint("meal_plans", __name__)
db = firestore.client()


@meal_plans_bp.route("/", methods=["GET"])
@require_auth
def get_meal_plans():
    docs = db.collection("meal_plans").where("uid", "==", g.uid).stream()
    return jsonify([{**d.to_dict(), "id": d.id} for d in docs])


@meal_plans_bp.route("/<plan_id>", methods=["GET"])
@require_auth
def get_meal_plan(plan_id):
    doc = db.collection("meal_plans").document(plan_id).get()
    if not doc.exists or doc.to_dict()["uid"] != g.uid:
        return jsonify({"error": "Not found or unauthorized"}), 403
    data = {**doc.to_dict(), "id": doc.id}
    days = db.collection("meal_plans").document(plan_id).collection("days").stream()
    data["days"] = [{**d.to_dict(), "id": d.id} for d in days]
    return jsonify(data)


@meal_plans_bp.route("/", methods=["POST"])
@require_auth
def create_meal_plan():
    body = request.json
    days = body.pop("days", [])
    now = datetime.now(timezone.utc)
    body["uid"] = g.uid
    body["createdAt"] = now
    body["updatedAt"] = now
    ref = db.collection("meal_plans").add(body)
    plan_id = ref[1].id
    for day in days:
        db.collection("meal_plans").document(plan_id).collection("days").add(day)
    return jsonify({"id": plan_id}), 201


@meal_plans_bp.route("/<plan_id>", methods=["PUT"])
@require_auth
def update_meal_plan(plan_id):
    doc = db.collection("meal_plans").document(plan_id).get()
    if not doc.exists or doc.to_dict()["uid"] != g.uid:
        return jsonify({"error": "Not found or unauthorized"}), 403
    body = request.json
    days = body.pop("days", None)
    body["updatedAt"] = datetime.now(timezone.utc)
    db.collection("meal_plans").document(plan_id).update(body)
    if days is not None:
        existing = db.collection("meal_plans").document(plan_id).collection("days").stream()
        for d in existing:
            d.reference.delete()
        for day in days:
            db.collection("meal_plans").document(plan_id).collection("days").add(day)
    return jsonify({"success": True})


@meal_plans_bp.route("/<plan_id>", methods=["DELETE"])
@require_auth
def delete_meal_plan(plan_id):
    doc = db.collection("meal_plans").document(plan_id).get()
    if not doc.exists or doc.to_dict()["uid"] != g.uid:
        return jsonify({"error": "Not found or unauthorized"}), 403
    days = db.collection("meal_plans").document(plan_id).collection("days").stream()
    for d in days:
        d.reference.delete()
    db.collection("meal_plans").document(plan_id).delete()
    return jsonify({"success": True})
