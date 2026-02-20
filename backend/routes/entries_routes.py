"""
Food entry routes: CRUD operations for meal logging with filtering and pagination.
"""

from flask import Blueprint, request, jsonify, g
from database import get_db
from auth import require_auth
from datetime import date

entries_bp = Blueprint("entries", __name__, url_prefix="/api/entries")

VALID_MEAL_TYPES = {"breakfast", "lunch", "dinner", "snacks"}
NUTRIENT_FIELDS = [
    "calories", "protein_g", "carbs_g", "fat_g",
    "fiber_g", "sugar_g", "sodium_mg",
    "vitamin_c_mg", "vitamin_d_iu", "calcium_mg", "iron_mg"
]


def validate_entry(data: dict) -> tuple[dict | None, str | None]:
    """Validate and sanitize food entry data. Returns (entry_dict, error_msg)."""
    meal_type = (data.get("meal_type") or "").lower().strip()
    food_name = (data.get("food_name") or "").strip()
    entry_date = data.get("entry_date") or str(date.today())

    if meal_type not in VALID_MEAL_TYPES:
        return None, f"meal_type must be one of: {', '.join(VALID_MEAL_TYPES)}"
    if not food_name:
        return None, "food_name is required"

    try:
        quantity = float(data.get("quantity", 1))
        if quantity <= 0:
            return None, "quantity must be positive"
    except (TypeError, ValueError):
        return None, "quantity must be a number"

    # Parse date
    try:
        parsed_date = str(date.fromisoformat(entry_date))
    except ValueError:
        return None, "entry_date must be in YYYY-MM-DD format"

    entry = {
        "meal_type": meal_type,
        "food_name": food_name,
        "quantity": quantity,
        "quantity_unit": (data.get("quantity_unit") or "g").strip()[:20],
        "entry_date": parsed_date,
        "notes": (data.get("notes") or "").strip()[:500] or None,
    }

    for field in NUTRIENT_FIELDS:
        val = data.get(field, 0)
        try:
            entry[field] = max(0.0, float(val)) if val is not None else 0.0
        except (TypeError, ValueError):
            return None, f"{field} must be a number"

    return entry, None


@entries_bp.route("", methods=["GET"])
@require_auth
def list_entries():
    """
    List food entries with filtering and pagination.
    Query params: start_date, end_date, meal_type, page (default 1), per_page (default 20, max 100)
    """
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    meal_type = request.args.get("meal_type", "").lower()

    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(100, max(1, int(request.args.get("per_page", 20))))
    except ValueError:
        return jsonify({"error": "page and per_page must be integers"}), 400

    # Validate date filters
    if start_date:
        try:
            date.fromisoformat(start_date)
        except ValueError:
            return jsonify({"error": "start_date must be YYYY-MM-DD"}), 400
    if end_date:
        try:
            date.fromisoformat(end_date)
        except ValueError:
            return jsonify({"error": "end_date must be YYYY-MM-DD"}), 400
    if meal_type and meal_type not in VALID_MEAL_TYPES:
        return jsonify({"error": f"meal_type must be one of: {', '.join(VALID_MEAL_TYPES)}"}), 400

    conditions = ["user_id=?"]
    params = [g.user_id]

    if start_date:
        conditions.append("entry_date >= ?")
        params.append(start_date)
    if end_date:
        conditions.append("entry_date <= ?")
        params.append(end_date)
    if meal_type:
        conditions.append("meal_type = ?")
        params.append(meal_type)

    where = " AND ".join(conditions)
    offset = (page - 1) * per_page

    conn = get_db()
    try:
        total = conn.execute(
            f"SELECT COUNT(*) FROM food_entries WHERE {where}", params
        ).fetchone()[0]

        rows = conn.execute(
            f"SELECT * FROM food_entries WHERE {where} ORDER BY entry_date DESC, created_at DESC LIMIT ? OFFSET ?",
            params + [per_page, offset]
        ).fetchall()

        return jsonify({
            "items": [dict(r) for r in rows],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": (total + per_page - 1) // per_page
            }
        })
    finally:
        conn.close()


@entries_bp.route("", methods=["POST"])
@require_auth
def create_entry():
    """Create a new food entry."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    entry, error = validate_entry(data)
    if error:
        return jsonify({"error": error}), 400

    cols = ["user_id"] + list(entry.keys())
    placeholders = ", ".join("?" * len(cols))
    values = [g.user_id] + list(entry.values())

    conn = get_db()
    try:
        cursor = conn.execute(
            f"INSERT INTO food_entries ({', '.join(cols)}) VALUES ({placeholders})",
            values
        )
        conn.commit()
        row = conn.execute("SELECT * FROM food_entries WHERE id=?", (cursor.lastrowid,)).fetchone()
        return jsonify(dict(row)), 201
    finally:
        conn.close()


@entries_bp.route("/<int:entry_id>", methods=["GET"])
@require_auth
def get_entry(entry_id):
    """Get a single food entry."""
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM food_entries WHERE id=? AND user_id=?", (entry_id, g.user_id)
        ).fetchone()
        if not row:
            return jsonify({"error": "Entry not found"}), 404
        return jsonify(dict(row))
    finally:
        conn.close()


@entries_bp.route("/<int:entry_id>", methods=["PUT"])
@require_auth
def update_entry(entry_id):
    """Update a food entry."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT * FROM food_entries WHERE id=? AND user_id=?", (entry_id, g.user_id)
        ).fetchone()
        if not existing:
            return jsonify({"error": "Entry not found"}), 404

        # Merge with existing data for partial updates
        merged = dict(existing)
        merged.update(data)
        entry, error = validate_entry(merged)
        if error:
            return jsonify({"error": error}), 400

        set_clause = ", ".join(f"{k}=?" for k in entry)
        values = list(entry.values()) + [entry_id, g.user_id]

        conn.execute(
            f"UPDATE food_entries SET {set_clause} WHERE id=? AND user_id=?", values
        )
        conn.commit()
        row = conn.execute("SELECT * FROM food_entries WHERE id=?", (entry_id,)).fetchone()
        return jsonify(dict(row))
    finally:
        conn.close()


@entries_bp.route("/<int:entry_id>", methods=["DELETE"])
@require_auth
def delete_entry(entry_id):
    """Delete a food entry."""
    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id FROM food_entries WHERE id=? AND user_id=?", (entry_id, g.user_id)
        ).fetchone()
        if not existing:
            return jsonify({"error": "Entry not found"}), 404
        conn.execute("DELETE FROM food_entries WHERE id=?", (entry_id,))
        conn.commit()
        return jsonify({"message": "Entry deleted"}), 200
    finally:
        conn.close()


@entries_bp.route("/bulk", methods=["POST"])
@require_auth
def bulk_create():
    """Create multiple food entries at once (used for PDF import)."""
    data = request.get_json()
    if not data or not isinstance(data.get("entries"), list):
        return jsonify({"error": "entries array required"}), 400

    entries_data = data["entries"]
    if len(entries_data) > 500:
        return jsonify({"error": "Maximum 500 entries per bulk import"}), 400

    validated = []
    for i, item in enumerate(entries_data):
        entry, error = validate_entry(item)
        if error:
            return jsonify({"error": f"Entry {i+1}: {error}"}), 400
        validated.append(entry)

    conn = get_db()
    try:
        created_ids = []
        for entry in validated:
            cols = ["user_id"] + list(entry.keys())
            placeholders = ", ".join("?" * len(cols))
            values = [g.user_id] + list(entry.values())
            cursor = conn.execute(
                f"INSERT INTO food_entries ({', '.join(cols)}) VALUES ({placeholders})", values
            )
            created_ids.append(cursor.lastrowid)
        conn.commit()
        return jsonify({"created": len(created_ids), "ids": created_ids}), 201
    finally:
        conn.close()
