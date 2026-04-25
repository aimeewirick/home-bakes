"""
HomeBakes — Set Admin User
Run once to grant admin privileges to a user.

Usage: python set_admin.py
"""
import firebase_admin
from firebase_admin import credentials, auth
import os, json

cred_json = os.environ.get("FIREBASE_CREDENTIALS")
if cred_json:
    cred = credentials.Certificate(json.loads(cred_json))
else:
    cred = credentials.Certificate("firebase_admin_key.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

# ── Set admin by email ────────────────────────────────────────────────────────
ADMIN_EMAIL = "aimeewirick@hotmail.com"

try:
    user = auth.get_user_by_email(ADMIN_EMAIL)
    auth.set_custom_user_claims(user.uid, {"admin": True})
    print(f"✅ Admin claim set for {ADMIN_EMAIL} (uid: {user.uid})")
    print(f"\n⚠️  The user must log out and log back in for the claim to take effect.")
except auth.UserNotFoundError:
    print(f"❌ User not found: {ADMIN_EMAIL}")
    print(f"   Make sure this account is registered first.")
