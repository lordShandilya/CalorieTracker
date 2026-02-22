import base64
import json
import os
from flask import Blueprint, request, jsonify, g
from database import get_db
from auth import require_auth
from google import genai
from google.genai import types

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")

# Initialize the Gemini Client
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
client = genai.Client(api_key=GEMINI_API_KEY)

def _build_gemini_contents(messages: list) -> list:
    """
    Convert internal message history format to Gemini Content objects.
    
    Internal format:  [{"role": "user"|"assistant", "content": "..."}]
    Gemini format:    [types.Content(role="user"|"model", parts=[...])]
    
    Two differences from OpenAI/Anthropic conventions:
      - "assistant" must be renamed to "model"
      - "content" string must become parts=[types.Part.from_text(...)]
    """
    ROLE_MAP = {"assistant": "model", "user": "user"}

    gemini_contents = []
    for msg in messages:
        role = ROLE_MAP.get(msg.get("role", "user"), "user")
        content = msg.get("content", "")

        # content can be a plain string (chat) or a list of parts (image/PDF)
        if isinstance(content, list):
            parts = []
            for part in content:
                if part.get("type") == "text":
                    parts.append(types.Part.from_text(text=part["text"]))
                elif part.get("type") in ("image", "document"):
                    src = part.get("source", {})
                    parts.append(types.Part.from_bytes(
                        data=base64.b64decode(src["data"]),
                        mime_type=src.get("media_type", "application/octet-stream"),
                    ))
        else:
            parts = [types.Part.from_text(text=str(content))]

        gemini_contents.append(types.Content(role=role, parts=parts))

    return gemini_contents

def call_gemini(contents: list, system: str = "", max_tokens: int = 2048) -> str:
    """Call Gemini API using the official google-genai SDK."""
    model_id = "gemini-3-flash-preview"
    
    try:
        # Configuration including system instructions and token limits
        config = types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_tokens,
            temperature=0.2, # Lower temperature for stable JSON extraction
        )

        response = client.models.generate_content(
            model=model_id,
            contents=contents,
            config=config
        )

        if not response.text:
            raise Exception("Empty response from Gemini API")
            
        return response.text

    except Exception as e:
        raise Exception(f"Gemini SDK Error: {str(e)}")


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
    contents = _build_gemini_contents(messages)
    response_text = call_gemini(contents, system=system_prompt, max_tokens=1024)

    try:
        response_text = call_gemini(messages, system=system_prompt, max_tokens=1024)
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

MEAL LOGGING INSTRUCTIONS:
When a user wants to log a meal, you MUST include a machine-readable block at the very end of your
response using this exact format — no markdown fences, no extra whitespace around the tags:

<<MEAL_DATA>>{{"food_name": "...", "meal_type": "breakfast|lunch|dinner|snacks", "quantity": 1, "quantity_unit": "serving", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}}<</MEAL_DATA>>

Rules:
- The <<MEAL_DATA>>...</<</MEAL_DATA>> block must appear only once, at the very end of the message.
- Never show the block inline, never wrap it in markdown code fences.
- The app will silently extract and hide this block from the user — they will only see your conversational text above it.
- If the user is NOT logging a meal, do not include a <<MEAL_DATA>> block at all.

Be conversational, encouraging, and helpful. Keep responses concise."""

        raw_messages = history + [{"role": "user", "content": user_message}]
        contents = _build_gemini_contents(raw_messages)
        response_text = call_gemini(contents, system=system_prompt, max_tokens=600)

        # Extract structured meal data from the sentinel tags and strip from visible text
        meal_data = None
        MEAL_START = "<<MEAL_DATA>>"
        MEAL_END = "<</MEAL_DATA>>"
        if MEAL_START in response_text and MEAL_END in response_text:
            try:
                start_idx = response_text.index(MEAL_START) + len(MEAL_START)
                end_idx = response_text.index(MEAL_END)
                meal_json = response_text[start_idx:end_idx].strip()
                meal_data = json.loads(meal_json)
                # Remove the entire sentinel block (including surrounding whitespace/newlines)
                full_block = response_text[response_text.index(MEAL_START):end_idx + len(MEAL_END)]
                response_text = response_text.replace(full_block, "").rstrip()
            except (ValueError, json.JSONDecodeError):
                pass  # Malformed block — ignore it, show text as-is

        # Save messages to DB (store the cleaned text, not the raw sentinel)
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?)",
            (g.user_id, "user", user_message)
        )
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?)",
            (g.user_id, "assistant", response_text)
        )
        conn.commit()

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
    contents = _build_gemini_contents(messages)
    response_text = call_gemini(contents, system=system_prompt, max_tokens=1024)

    try:
        response_text = call_gemini(messages, system=system_prompt, max_tokens=4096)
        response_text = response_text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1].rsplit("```", 1)[0]

        parsed = json.loads(response_text)
        return jsonify(parsed)
    except json.JSONDecodeError:
        return jsonify({"error": "Failed to parse PDF content"}), 422
    except Exception as e:
        return jsonify({"error": f"PDF parsing failed: {str(e)}"}), 500
