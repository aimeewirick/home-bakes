from functools import wraps
from flask import request, jsonify, g
from firebase_admin import auth


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401
        token = auth_header.replace("Bearer ", "").strip()
        try:
            decoded = auth.verify_id_token(token)
            g.uid   = decoded["uid"]
            g.token = decoded
        except auth.ExpiredIdTokenError:
            return jsonify({"error": "Token has expired"}), 401
        except auth.InvalidIdTokenError:
            return jsonify({"error": "Invalid token"}), 401
        except Exception:
            return jsonify({"error": "Authentication failed"}), 401
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401
        token = auth_header.replace("Bearer ", "").strip()
        try:
            decoded = auth.verify_id_token(token)
            g.uid   = decoded["uid"]
            g.token = decoded
            if not decoded.get("admin"):
                return jsonify({"error": "Admin access required"}), 403
        except auth.ExpiredIdTokenError:
            return jsonify({"error": "Token has expired"}), 401
        except auth.InvalidIdTokenError:
            return jsonify({"error": "Invalid token"}), 401
        except Exception:
            return jsonify({"error": "Authentication failed"}), 401
        return f(*args, **kwargs)
    return decorated
