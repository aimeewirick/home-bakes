import os
import json
from flask import Blueprint, jsonify
from firebase_admin import auth as firebase_auth
from functools import wraps
from flask import request
import google.auth
from google.oauth2 import service_account
from googleapiclient.discovery import build

feedback_bp = Blueprint("feedback", __name__)

SHEET_ID = "1T2JmQhE7XYC5mv6eVD8ytCaaGOoH2l8KLhEx1R50SNk"
SCOPES    = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

def get_sheets_service():
    """Build Google Sheets service using service account credentials from env."""
    cred_json = os.environ.get("GOOGLE_SHEETS_CREDENTIALS")
    if not cred_json:
        raise Exception("GOOGLE_SHEETS_CREDENTIALS environment variable not set")
    cred_dict = json.loads(cred_json)
    creds = service_account.Credentials.from_service_account_info(
        cred_dict, scopes=SCOPES
    )
    return build("sheets", "v4", credentials=creds)

def require_admin(f):
    """Decorator — only allows requests from verified admin users."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401
        token = auth_header.split(" ")[1]
        try:
            decoded = firebase_auth.verify_id_token(token)
            if not decoded.get("admin"):
                return jsonify({"error": "Admin access required"}), 403
        except Exception:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated

@feedback_bp.route("/", methods=["GET"])
@require_admin
def get_feedback():
    """Return all feedback responses from Google Sheet."""
    try:
        service = get_sheets_service()
        result  = service.spreadsheets().values().get(
            spreadsheetId=SHEET_ID,
            range="A:Z"  # grab all columns
        ).execute()

        rows = result.get("values", [])
        if not rows:
            return jsonify({"headers": [], "rows": []})

        headers = rows[0]
        data    = rows[1:]  # everything after the header row

        return jsonify({
            "headers": headers,
            "rows":    data,
            "total":   len(data)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
