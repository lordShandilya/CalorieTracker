"""
Reports routes: nutritional analytics, trends, and goal comparisons.
"""

from flask import Blueprint, request, jsonify, g
from database import get_db
from auth import require_auth
from datetime import date, timedelta

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")


def get_date_range(period: str):
    """Return (start_date, end_date) for common periods."""
    today = date.today()
    if period == "week":
        start = today - timedelta(days=6)
    elif period == "month":
        start = today - timedelta(days=29)
    elif period == "30days":
        start = today - timedelta(days=29)
    else:
        start = today - timedelta(days=6)  # default week
    return str(start), str(today)


@reports_bp.route("/daily", methods=["GET"])
@require_auth
def daily_summary():
    """
    Daily nutritional summary for a date range.
    Returns per-day totals of all macros/micros.
    Query params: start_date, end_date, period (week|month)
    """
    period = request.args.get("period", "week")
    default_start, default_end = get_date_range(period)

    start_date = request.args.get("start_date", default_start)
    end_date = request.args.get("end_date", default_end)

    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT
                entry_date,
                meal_type,
                SUM(calories) as calories,
                SUM(protein_g) as protein_g,
                SUM(carbs_g) as carbs_g,
                SUM(fat_g) as fat_g,
                SUM(fiber_g) as fiber_g,
                SUM(sugar_g) as sugar_g,
                SUM(sodium_mg) as sodium_mg,
                SUM(vitamin_c_mg) as vitamin_c_mg,
                SUM(vitamin_d_iu) as vitamin_d_iu,
                SUM(calcium_mg) as calcium_mg,
                SUM(iron_mg) as iron_mg,
                COUNT(*) as entry_count
            FROM food_entries
            WHERE user_id=? AND entry_date >= ? AND entry_date <= ?
            GROUP BY entry_date, meal_type
            ORDER BY entry_date ASC
        """, (g.user_id, start_date, end_date)).fetchall()

        # Aggregate by day
        day_map = {}
        for r in rows:
            d = r["entry_date"]
            if d not in day_map:
                day_map[d] = {
                    "date": d,
                    "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0,
                    "fiber_g": 0, "sugar_g": 0, "sodium_mg": 0,
                    "vitamin_c_mg": 0, "vitamin_d_iu": 0, "calcium_mg": 0,
                    "iron_mg": 0, "entry_count": 0,
                    "by_meal": {}
                }
            for field in ["calories", "protein_g", "carbs_g", "fat_g",
                          "fiber_g", "sugar_g", "sodium_mg", "vitamin_c_mg",
                          "vitamin_d_iu", "calcium_mg", "iron_mg"]:
                day_map[d][field] += (r[field] or 0)
            day_map[d]["entry_count"] += r["entry_count"]
            day_map[d]["by_meal"][r["meal_type"]] = {
                "calories": r["calories"] or 0,
                "protein_g": r["protein_g"] or 0,
                "carbs_g": r["carbs_g"] or 0,
                "fat_g": r["fat_g"] or 0,
            }

        return jsonify({
            "start_date": start_date,
            "end_date": end_date,
            "days": list(day_map.values())
        })
    finally:
        conn.close()


@reports_bp.route("/weekly", methods=["GET"])
@require_auth
def weekly_summary():
    """Aggregate weekly nutritional totals and averages."""
    end_date = request.args.get("end_date", str(date.today()))
    start_date = request.args.get("start_date", str(date.today() - timedelta(days=27)))

    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT
                strftime('%Y-W%W', entry_date) as week,
                SUM(calories) as total_calories,
                AVG(calories) as avg_daily_calories,
                SUM(protein_g) as protein_g,
                SUM(carbs_g) as carbs_g,
                SUM(fat_g) as fat_g,
                COUNT(DISTINCT entry_date) as days_tracked
            FROM food_entries
            WHERE user_id=? AND entry_date >= ? AND entry_date <= ?
            GROUP BY week
            ORDER BY week ASC
        """, (g.user_id, start_date, end_date)).fetchall()

        return jsonify({
            "start_date": start_date,
            "end_date": end_date,
            "weeks": [dict(r) for r in rows]
        })
    finally:
        conn.close()


@reports_bp.route("/goal-comparison", methods=["GET"])
@require_auth
def goal_comparison():
    """Compare actual intake vs goals for a date range."""
    period = request.args.get("period", "week")
    default_start, default_end = get_date_range(period)
    start_date = request.args.get("start_date", default_start)
    end_date = request.args.get("end_date", default_end)

    conn = get_db()
    try:
        goals = conn.execute(
            "SELECT * FROM goals WHERE user_id=?", (g.user_id,)
        ).fetchone()

        actuals = conn.execute("""
            SELECT
                AVG(daily_cals) as avg_calories,
                AVG(daily_protein) as avg_protein_g,
                AVG(daily_carbs) as avg_carbs_g,
                AVG(daily_fat) as avg_fat_g,
                AVG(daily_fiber) as avg_fiber_g,
                AVG(daily_sodium) as avg_sodium_mg,
                COUNT(*) as days_tracked
            FROM (
                SELECT
                    entry_date,
                    SUM(calories) as daily_cals,
                    SUM(protein_g) as daily_protein,
                    SUM(carbs_g) as daily_carbs,
                    SUM(fat_g) as daily_fat,
                    SUM(fiber_g) as daily_fiber,
                    SUM(sodium_mg) as daily_sodium
                FROM food_entries
                WHERE user_id=? AND entry_date >= ? AND entry_date <= ?
                GROUP BY entry_date
            )
        """, (g.user_id, start_date, end_date)).fetchone()

        return jsonify({
            "start_date": start_date,
            "end_date": end_date,
            "goals": dict(goals) if goals else {},
            "actuals": dict(actuals) if actuals else {},
        })
    finally:
        conn.close()


@reports_bp.route("/micronutrients", methods=["GET"])
@require_auth
def micronutrient_summary():
    """Micronutrient totals and daily averages for a period."""
    period = request.args.get("period", "week")
    default_start, default_end = get_date_range(period)
    start_date = request.args.get("start_date", default_start)
    end_date = request.args.get("end_date", default_end)

    conn = get_db()
    try:
        row = conn.execute("""
            SELECT
                SUM(vitamin_c_mg) as total_vitamin_c_mg,
                SUM(vitamin_d_iu) as total_vitamin_d_iu,
                SUM(calcium_mg) as total_calcium_mg,
                SUM(iron_mg) as total_iron_mg,
                SUM(fiber_g) as total_fiber_g,
                SUM(sodium_mg) as total_sodium_mg,
                SUM(sugar_g) as total_sugar_g,
                COUNT(DISTINCT entry_date) as days_tracked
            FROM food_entries
            WHERE user_id=? AND entry_date >= ? AND entry_date <= ?
        """, (g.user_id, start_date, end_date)).fetchone()

        result = dict(row)
        days = max(1, result.get("days_tracked") or 1)

        # Add daily averages
        for key in list(result.keys()):
            if key.startswith("total_"):
                avg_key = "avg_daily_" + key[6:]
                result[avg_key] = round((result[key] or 0) / days, 2)

        result["start_date"] = start_date
        result["end_date"] = end_date

        return jsonify(result)
    finally:
        conn.close()
