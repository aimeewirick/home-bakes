from flask import Blueprint, jsonify
from firebase_admin import firestore

recipe_categories_bp = Blueprint("recipe_categories", __name__)
meal_types_bp = Blueprint("meal_types", __name__)
allergens_bp = Blueprint("allergens", __name__)
ingredient_categories_bp = Blueprint("ingredient_categories", __name__)

@recipe_categories_bp.route("/", methods=["GET"])
def get_recipe_categories():
    db = firestore.client()   # ← moved inside function
    docs = db.collection("recipe_categories").order_by("order").stream()
    return jsonify([{**d.to_dict(), "id": d.id} for d in docs])

@meal_types_bp.route("/", methods=["GET"])
def get_meal_types():
    db = firestore.client()   # ← moved inside function
    docs = db.collection("meal_types").order_by("order").stream()
    return jsonify([{**d.to_dict(), "id": d.id} for d in docs])

@allergens_bp.route("/", methods=["GET"])
def get_allergens():
    db = firestore.client()
    docs = db.collection("allergens").order_by("order").stream()
    return jsonify([{**d.to_dict(), "id": d.id} for d in docs])

@ingredient_categories_bp.route("/", methods=["GET"])
def get_ingredient_categories():
    db = firestore.client()
    docs = db.collection("ingredient_categories").order_by("order").stream()
    return jsonify([{**d.to_dict(), "id": d.id} for d in docs])