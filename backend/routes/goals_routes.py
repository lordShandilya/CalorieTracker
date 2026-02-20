"""
Goals routes: get and update user nutritional goals.
"""

from flask import Blueprint, request, jsonify, g
from database import get_db
from auth import require_auth

goals_bp = Blueprint("goals", __name__, url_prefix="/api/goals")

GOAL_FIELDS = ["daily_calories", "protein_g", "carbs_g", "fat_g",
               "weight_goal_kg", "fiber_g", "sodium_mg", "sugar_g"]


@goals_bp.route("", methods=["GET"])
@require_auth
def get_goals():
    """Get current user's nutritional goals."""
    conn = get_db()
    try:
        goal = conn.execute(
            "SELECT * FROM goals WHERE user_id=?", (g.user_id,)
        ).fetchone()
        if not goal:
            return jsonify({"error": "Goals not found"}), 404
        return jsonify(dict(goal))
    finally:
        conn.close()


@goals_bp.route("", methods=["PUT"])
@require_auth
def update_goals():
    """Update current user's nutritional goals."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    # Build update with only known fields, validate numeric values
    updates = {}
    for field in GOAL_FIELDS:
        if field in data:
            val = data[field]
            if val is not None and not isinstance(val, (int, float)):
                return jsonify({"error": f"{field} must be a number"}), 400
            if val is not None and val < 0:
                return jsonify({"error": f"{field} must be non-negative"}), 400
            updates[field] = val

    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400

    set_clause = ", ".join(f"{k}=?" for k in updates)
    values = list(updates.values()) + [g.user_id]

    conn = get_db()
    try:
        conn.execute(
            f"UPDATE goals SET {set_clause}, updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
            values
        )
        conn.commit()
        goal = conn.execute("SELECT * FROM goals WHERE user_id=?", (g.user_id,)).fetchone()
        return jsonify(dict(goal))
    finally:
        conn.close()
