import os
import json
import firebase_admin
from firebase_admin import credentials
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

# ── Flask setup ───────────────────────────────────────────────────────────────
app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static"
)

CORS(app)

# ── Firebase Admin SDK ────────────────────────────────────────────────────────
if os.environ.get("FIREBASE_CREDENTIALS"):
    cred_dict = json.loads(os.environ["FIREBASE_CREDENTIALS"])
    cred = credentials.Certificate(cred_dict)
else:
    key_path = os.path.join(os.path.dirname(__file__), "firebase_admin_key.json")
    cred = credentials.Certificate(key_path)

firebase_admin.initialize_app(cred)

# ── API Blueprints ────────────────────────────────────────────────────────────
from routes.recipes             import recipes_bp
from routes.meal_plans          import meal_plans_bp
from routes.shopping_lists      import shopping_lists_bp
from routes.ingredients         import ingredients_bp
from routes.units               import units_bp
from routes.recipe_categories   import recipe_categories_bp, meal_types_bp
from routes.admin               import admin_bp
from routes.recipe_categories   import recipe_categories_bp, meal_types_bp, allergens_bp

app.register_blueprint(recipes_bp,              url_prefix="/api/recipes")
app.register_blueprint(meal_plans_bp,           url_prefix="/api/meal-plans")
app.register_blueprint(shopping_lists_bp,       url_prefix="/api/shopping-lists")
app.register_blueprint(ingredients_bp,          url_prefix="/api/ingredients")
app.register_blueprint(units_bp,                url_prefix="/api/units")
app.register_blueprint(recipe_categories_bp,    url_prefix="/api/recipe-categories")
app.register_blueprint(meal_types_bp,           url_prefix="/api/meal-types")
app.register_blueprint(admin_bp,                url_prefix="/api/admin")
app.register_blueprint(allergens_bp,            url_prefix="/api/allergens")

# ── Health check ──────────────────────────────────────────────────────────────
@app.route("/api/health")
def health():
    return jsonify({"status": "HomeBakes API is running"})

# ── Serve HTML pages ──────────────────────────────────────────────────────────
@app.route("/")
@app.route("/index.html")
def home():
    return send_from_directory("templates", "index.html")

@app.route("/login.html")
def login():
    return send_from_directory("templates", "login.html")

@app.route("/register.html")
def register():
    return send_from_directory("templates", "register.html")

@app.route("/recipes.html")
def recipes():
    return send_from_directory("templates", "recipes.html")

@app.route("/recipe-form.html")
def recipe_form():
    return send_from_directory("templates", "recipe-form.html")

@app.route("/recipe-view.html")
def recipe_view():
    return send_from_directory("templates", "recipe-view.html")

@app.route("/meal-plans.html")
def meal_plans():
    return send_from_directory("templates", "meal-plans.html")

@app.route("/shopping-lists.html")
def shopping_lists():
    return send_from_directory("templates", "shopping-lists.html")

@app.route("/verify-email.html")
def verify_email():
    return send_from_directory("templates", "verify-email.html")

@app.route("/admin.html")
def admin():
    return send_from_directory("templates", "admin.html")

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, port=port)
