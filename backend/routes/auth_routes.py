"""
Authentication routes: user registration and login.
"""

from flask import Blueprint, request, jsonify
from database import get_db
from auth import hash_password, verify_password, create_token

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/signup", methods=["POST"])
def signup():
    """Register a new user."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or not email or not password:
        return jsonify({"error": "username, email, and password are required"}), 400
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if "@" not in email:
        return jsonify({"error": "Invalid email address"}), 400

    conn = get_db()
    try:
        # Check for existing user
        existing = conn.execute(
            "SELECT id FROM users WHERE username=? OR email=?", (username, email)
        ).fetchone()
        if existing:
            return jsonify({"error": "Username or email already taken"}), 409

        password_hash = hash_password(password)
        cursor = conn.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, password_hash)
        )
        conn.commit()
        user_id = cursor.lastrowid

        # Create default empty goals
        conn.execute(
            "INSERT INTO goals (user_id, daily_calories, protein_g, carbs_g, fat_g) VALUES (?, 2000, 150, 250, 65)",
            (user_id,)
        )
        conn.commit()

        token = create_token(user_id, username)
        return jsonify({
            "token": token,
            "user": {"id": user_id, "username": username, "email": email}
        }), 201
    finally:
        conn.close()


@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticate a user and return a token."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    conn = get_db()
    try:
        user = conn.execute(
            "SELECT id, username, email, password_hash FROM users WHERE username=? OR email=?",
            (username, username)
        ).fetchone()

        if not user or not verify_password(password, user["password_hash"]):
            return jsonify({"error": "Invalid credentials"}), 401

        token = create_token(user["id"], user["username"])
        return jsonify({
            "token": token,
            "user": {"id": user["id"], "username": user["username"], "email": user["email"]}
        })
    finally:
        conn.close()
