"""
Authentication utilities: password hashing and JWT token management.
"""

import hashlib
import hmac
import os
import json
import base64
import time
from functools import wraps
from flask import request, jsonify, g

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
TOKEN_EXPIRY = 60 * 60 * 24 * 7  # 7 days


def hash_password(password: str) -> str:
    """Hash a password using SHA-256 with a salt."""
    salt = os.urandom(16).hex()
    hashed = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"{salt}:{hashed}"


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    try:
        salt, hashed = password_hash.split(":", 1)
        expected = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
        return hmac.compare_digest(expected, hashed)
    except Exception:
        return False


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def create_token(user_id: int, username: str) -> str:
    """Create a simple JWT-like token."""
    header = _b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64encode(json.dumps({
        "sub": user_id,
        "username": username,
        "exp": int(time.time()) + TOKEN_EXPIRY
    }).encode())
    signature_input = f"{header}.{payload}".encode()
    sig = hmac.new(SECRET_KEY.encode(), signature_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64encode(sig)}"


def verify_token(token: str) -> dict | None:
    """Verify a token and return its payload, or None if invalid."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header, payload, sig = parts
        signature_input = f"{header}.{payload}".encode()
        expected_sig = hmac.new(SECRET_KEY.encode(), signature_input, hashlib.sha256).digest()
        if not hmac.compare_digest(_b64encode(expected_sig), sig):
            return None
        data = json.loads(_b64decode(payload))
        if data.get("exp", 0) < time.time():
            return None
        return data
    except Exception:
        return None


def require_auth(f):
    """Decorator to require authentication on route handlers."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization required"}), 401
        token = auth_header[7:]
        payload = verify_token(token)
        if not payload:
            return jsonify({"error": "Invalid or expired token"}), 401
        g.user_id = payload["sub"]
        g.username = payload["username"]
        return f(*args, **kwargs)
    return decorated
