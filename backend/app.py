import os
import json
import firebase_admin
from firebase_admin import credentials
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# ── CORS ────────────────────────────────────────────────────────────────────
# Allows requests from your local dev server AND your live Render frontend.
# Update RENDER_FRONTEND_URL in your Render environment variables once deployed.
allowed_origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    os.environ.get("RENDER_FRONTEND_URL", ""),   # e.g. https://home-bakes.onrender.com
]
CORS(app, origins=[o for o in allowed_origins if o])

# ── Firebase Admin SDK initialisation ───────────────────────────────────────
# On Render: store the entire JSON key as an environment variable called
# FIREBASE_CREDENTIALS (see README for instructions).
# Locally: place firebase_admin_key.json in the backend/ folder.

if os.environ.get("FIREBASE_CREDENTIALS"):
    # Render / production path
    cred_dict = json.loads(os.environ["FIREBASE_CREDENTIALS"])
    cred = credentials.Certificate(cred_dict)
else:
    # Local development path
    key_path = os.path.join(os.path.dirname(__file__), "firebase_admin_key.json")
    cred = credentials.Certificate(key_path)

firebase_admin.initialize_app(cred)

# ── Blueprints ───────────────────────────────────────────────────────────────
from routes.recipes import recipes_bp
from routes.meal_plans import meal_plans_bp
from routes.shopping_lists import shopping_lists_bp
from routes.ingredients import ingredients_bp

app.register_blueprint(recipes_bp,       url_prefix="/api/recipes")
app.register_blueprint(meal_plans_bp,    url_prefix="/api/meal-plans")
app.register_blueprint(shopping_lists_bp,url_prefix="/api/shopping-lists")
app.register_blueprint(ingredients_bp,   url_prefix="/api/ingredients")

# ── Health check ─────────────────────────────────────────────────────────────
@app.route("/api/health")
def health():
    return jsonify({"status": "HomeBakes API is running"})

# ── Entry point ───────────────────────────────────────────────────────────────
# Render runs gunicorn directly; this block is only used locally.
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, port=port)
