"""
AI routes: image-based nutrition extraction and conversational chat interface.
Uses Claude API via the Anthropic artifact API endpoint pattern.
"""

import base64
import json
import os
from flask import Blueprint, request, jsonify, g
from database import get_db
from auth import require_auth

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


def call_claude(messages: list, system: str = "", max_tokens: int = 1024) -> str:
    """Call Claude API and return text response."""
    import urllib.request
    import urllib.error

    payload = {
        "model": "claude-opus-4-6",
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system:
        payload["system"] = system

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            return result["content"][0]["text"]
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        raise Exception(f"Claude API error {e.code}: {error_body}")


@ai_bp.route("/analyze-image", methods=["POST"])
@require_auth
def analyze_image():
    """
    Analyze a food/nutrition label image and extract nutritional info.
    Accepts multipart form data with an 'image' file field.
    """
    if "image" not in request.files:
        return jsonify({"error": "image file required"}), 400

    file = request.files["image"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    content_type = file.content_type or "image/jpeg"
    if content_type not in allowed_types:
        return jsonify({"error": "Image must be JPEG, PNG, GIF, or WebP"}), 400

    # Read and encode image
    image_data = file.read()
    if len(image_data) > 10 * 1024 * 1024:  # 10MB limit
        return jsonify({"error": "Image too large (max 10MB)"}), 400

    image_b64 = base64.b64encode(image_data).decode()

    system_prompt = """You are a nutrition extraction assistant. When given a food image or nutrition label, 
extract nutritional information and return it as valid JSON only (no markdown, no explanation).
Return this exact structure:
{
  "food_name": "string",
  "quantity": number,
  "quantity_unit": "string (g, ml, oz, serving, etc.)",
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number,
  "sugar_g": number,
  "sodium_mg": number,
  "vitamin_c_mg": number,
  "vitamin_d_iu": number,
  "calcium_mg": number,
  "iron_mg": number,
  "confidence": "high|medium|low",
  "notes": "any relevant notes about the extraction"
}
If a value cannot be determined, use 0. Estimate reasonable values for visible food if no label is present."""

    messages = [{
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": content_type,
                    "data": image_b64
                }
            },
            {
                "type": "text",
                "text": "Please analyze this food image or nutrition label and extract the nutritional information as JSON."
            }
        ]
    }]

    try:
        response_text = call_claude(messages, system=system_prompt, max_tokens=1024)
        # Clean up response in case of markdown fences
        response_text = response_text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1].rsplit("```", 1)[0]

        nutrition_data = json.loads(response_text)
        return jsonify(nutrition_data)
    except json.JSONDecodeError:
        return jsonify({"error": "Failed to parse nutritional data from image"}), 422
    except Exception as e:
        return jsonify({"error": f"Image analysis failed: {str(e)}"}), 500


@ai_bp.route("/chat", methods=["POST"])
@require_auth
def chat():
    """
    Conversational AI interface for meal logging, goal checking, and nutrition queries.
    """
    data = request.get_json()
    if not data or not data.get("message"):
        return jsonify({"error": "message required"}), 400

    user_message = data["message"].strip()
    if len(user_message) > 2000:
        return jsonify({"error": "Message too long (max 2000 characters)"}), 400

    conn = get_db()
    try:
        # Get recent chat history (last 10 messages for context)
        history = conn.execute(
            """SELECT role, content FROM chat_messages 
               WHERE user_id=? ORDER BY created_at DESC LIMIT 10""",
            (g.user_id,)
        ).fetchall()
        history = list(reversed([dict(h) for h in history]))

        # Get user's current goals and today's intake for context
        goals = conn.execute("SELECT * FROM goals WHERE user_id=?", (g.user_id,)).fetchone()

        from datetime import date
        today = str(date.today())
        today_totals = conn.execute("""
            SELECT SUM(calories) as cal, SUM(protein_g) as pro,
                   SUM(carbs_g) as carbs, SUM(fat_g) as fat
            FROM food_entries WHERE user_id=? AND entry_date=?
        """, (g.user_id, today)).fetchone()

        goals_ctx = dict(goals) if goals else {}
        totals_ctx = dict(today_totals) if today_totals else {}

        system_prompt = f"""You are a helpful personal nutrition assistant integrated with a calorie tracking app.

Current user context:
- Today's date: {today}
- Username: {g.username}
- Daily goals: calories={goals_ctx.get('daily_calories')}, protein={goals_ctx.get('protein_g')}g, carbs={goals_ctx.get('carbs_g')}g, fat={goals_ctx.get('fat_g')}g
- Today's intake so far: calories={totals_ctx.get('cal') or 0:.0f}, protein={totals_ctx.get('pro') or 0:.0f}g, carbs={totals_ctx.get('carbs') or 0:.0f}g, fat={totals_ctx.get('fat') or 0:.0f}g

You can help users:
1. Log meals - when they describe food, provide nutritional estimates
2. Check their goals and progress
3. Answer nutrition questions
4. Summarize their dietary patterns
5. Give personalized advice based on their goals

When a user wants to log a meal, extract the food details and provide a JSON block they can use:
```json_meal
{{"food_name": "...", "meal_type": "breakfast|lunch|dinner|snacks", "quantity": X, "quantity_unit": "g", "calories": X, "protein_g": X, "carbs_g": X, "fat_g": X}}
```

Be conversational, encouraging, and helpful. Keep responses concise."""

        messages = history + [{"role": "user", "content": user_message}]

        response_text = call_claude(messages, system=system_prompt, max_tokens=600)

        # Save messages to DB
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?)",
            (g.user_id, "user", user_message)
        )
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?)",
            (g.user_id, "assistant", response_text)
        )
        conn.commit()

        # Check if response contains meal data to log
        meal_data = None
        if "```json_meal" in response_text:
            try:
                start = response_text.index("```json_meal") + 12
                end = response_text.index("```", start)
                meal_json = response_text[start:end].strip()
                meal_data = json.loads(meal_json)
            except Exception:
                pass

        return jsonify({
            "response": response_text,
            "meal_suggestion": meal_data
        })

    finally:
        conn.close()


@ai_bp.route("/chat/history", methods=["GET"])
@require_auth
def chat_history():
    """Get paginated chat history."""
    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(50, max(1, int(request.args.get("per_page", 20))))
    except ValueError:
        return jsonify({"error": "page and per_page must be integers"}), 400

    offset = (page - 1) * per_page
    conn = get_db()
    try:
        total = conn.execute(
            "SELECT COUNT(*) FROM chat_messages WHERE user_id=?", (g.user_id,)
        ).fetchone()[0]
        rows = conn.execute(
            """SELECT id, role, content, created_at FROM chat_messages
               WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?""",
            (g.user_id, per_page, offset)
        ).fetchall()
        return jsonify({
            "items": [dict(r) for r in reversed(rows)],
            "pagination": {"page": page, "per_page": per_page, "total": total,
                          "pages": (total + per_page - 1) // per_page}
        })
    finally:
        conn.close()


@ai_bp.route("/parse-pdf", methods=["POST"])
@require_auth
def parse_pdf():
    """
    Parse a food diary PDF and extract entries for bulk import.
    Accepts a PDF file upload.
    """
    if "pdf" not in request.files:
        return jsonify({"error": "pdf file required"}), 400

    file = request.files["pdf"]
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "File must be a PDF"}), 400

    pdf_data = file.read()
    if len(pdf_data) > 20 * 1024 * 1024:
        return jsonify({"error": "PDF too large (max 20MB)"}), 400

    pdf_b64 = base64.b64encode(pdf_data).decode()

    system_prompt = """You are a food diary parser. Extract all food entries from the PDF and return them as JSON only.
Return this exact structure:
{
  "entries": [
    {
      "food_name": "string",
      "meal_type": "breakfast|lunch|dinner|snacks",
      "quantity": number,
      "quantity_unit": "string",
      "entry_date": "YYYY-MM-DD",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number,
      "sugar_g": number,
      "sodium_mg": number
    }
  ],
  "summary": "brief description of what was parsed"
}
For missing values use 0. If date is unclear use today's date. Meal type default is "snacks"."""

    messages = [{
        "role": "user",
        "content": [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": pdf_b64
                }
            },
            {"type": "text", "text": "Parse all food diary entries from this PDF into JSON format."}
        ]
    }]

    try:
        response_text = call_claude(messages, system=system_prompt, max_tokens=4096)
        response_text = response_text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1].rsplit("```", 1)[0]

        parsed = json.loads(response_text)
        return jsonify(parsed)
    except json.JSONDecodeError:
        return jsonify({"error": "Failed to parse PDF content"}), 422
    except Exception as e:
        return jsonify({"error": f"PDF parsing failed: {str(e)}"}), 500
