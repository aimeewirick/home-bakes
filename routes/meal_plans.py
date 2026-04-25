from flask import Blueprint, request, jsonify, g
from firebase_admin import firestore
from routes.auth import require_auth
from datetime import datetime, timezone

meal_plans_bp = Blueprint("meal_plans", __name__)
db = firestore.client()

# ── Get all meal plans for user ───────────────────────────────────────────────
@meal_plans_bp.route("/", methods=["GET"])
@require_auth
def get_meal_plans():
    docs = db.collection("meal_plans")\
             .where("uid", "==", g.uid)\
             .order_by("createdAt", direction=firestore.Query.DESCENDING)\
             .stream()
    plans = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        # Load days for count
        days = db.collection("meal_plans").document(doc.id)\
                 .collection("days").stream()
        day_list = list(days)
        data["num_days"] = len(day_list)
        data["days"] = [{**d.to_dict(), "id": d.id} for d in day_list]
        plans.append(data)
    return jsonify(plans)

# ── Get single meal plan ──────────────────────────────────────────────────────
@meal_plans_bp.route("/<plan_id>", methods=["GET"])
@require_auth
def get_meal_plan(plan_id):
    doc = db.collection("meal_plans").document(plan_id).get()
    if not doc.exists:
        return jsonify({"error": "Not found"}), 404
    data = doc.to_dict()
    if data["uid"] != g.uid:
        return jsonify({"error": "Unauthorized"}), 403
    data["id"] = doc.id

    days_docs = db.collection("meal_plans").document(plan_id)\
                  .collection("days").order_by("order").stream()
    data["days"] = [{**d.to_dict(), "id": d.id} for d in days_docs]
    return jsonify(data)

# ── Create meal plan ──────────────────────────────────────────────────────────
@meal_plans_bp.route("/", methods=["POST"])
@require_auth
def create_meal_plan():
    body = request.json
    now  = datetime.now(timezone.utc)
    days = body.get("days", [])

    ref = db.collection("meal_plans").add({
        "uid":       g.uid,
        "title":     body.get("title", "My Meal Plan"),
        "num_days":  len(days),
        "createdAt": now,
        "updatedAt": now,
    })
    plan_id = ref[1].id

    for i, day in enumerate(days):
        db.collection("meal_plans").document(plan_id)\
          .collection("days").add({
              "order":     i,
              "day_name":  day.get("day_name", f"Day {i+1}"),
              "meals":     day.get("meals", []),
              "breakfast": day.get("breakfast", []),
              "lunch":     day.get("lunch",     []),
              "dinner":    day.get("dinner",    []),
          })

    return jsonify({"id": plan_id}), 201

# ── Update meal plan ──────────────────────────────────────────────────────────
@meal_plans_bp.route("/<plan_id>", methods=["PUT"])
@require_auth
def update_meal_plan(plan_id):
    doc = db.collection("meal_plans").document(plan_id).get()
    if not doc.exists or doc.to_dict()["uid"] != g.uid:
        return jsonify({"error": "Not found or unauthorized"}), 403

    body = request.json
    days = body.get("days", [])

    db.collection("meal_plans").document(plan_id).update({
        "title":     body.get("title", "My Meal Plan"),
        "num_days":  len(days),
        "updatedAt": datetime.now(timezone.utc),
    })

    # Delete and re-save days
    existing = db.collection("meal_plans").document(plan_id)\
                 .collection("days").stream()
    for d in existing:
        d.reference.delete()

    for i, day in enumerate(days):
        db.collection("meal_plans").document(plan_id)\
          .collection("days").add({
              "order":     i,
              "day_name":  day.get("day_name", f"Day {i+1}"),
              "meals":     day.get("meals", []),
              "breakfast": day.get("breakfast", []),
              "lunch":     day.get("lunch",     []),
              "dinner":    day.get("dinner",    []),
          })

    return jsonify({"success": True})

# ── Delete meal plan ──────────────────────────────────────────────────────────
@meal_plans_bp.route("/<plan_id>", methods=["DELETE"])
@require_auth
def delete_meal_plan(plan_id):
    doc = db.collection("meal_plans").document(plan_id).get()
    if not doc.exists or doc.to_dict()["uid"] != g.uid:
        return jsonify({"error": "Not found or unauthorized"}), 403

    days = db.collection("meal_plans").document(plan_id)\
             .collection("days").stream()
    for d in days:
        d.reference.delete()

    db.collection("meal_plans").document(plan_id).delete()
    return jsonify({"success": True})
