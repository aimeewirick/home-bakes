from flask import Blueprint, jsonify
from firebase_admin import firestore
from routes.auth import require_auth

units_bp = Blueprint("units", __name__)
db = firestore.client()


@units_bp.route("/", methods=["GET"])
@require_auth
def get_units():
    """Get all units of measurement ordered by type then name."""
    docs = db.collection("units").stream()
    units = [{**d.to_dict(), "id": d.id} for d in docs]
    # Sort by type order then name
    type_order = {"volume": 0, "weight": 1, "count": 2, "other": 3}
    units.sort(key=lambda u: (type_order.get(u.get("type", "other"), 4), u.get("name", "")))
    return jsonify(units)
