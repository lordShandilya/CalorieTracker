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
client = genai.Client(api_key="AIzaSyATpL3WcwN9KRDffQOnX_QB46tD2EbqVTU")

def call_gemini(contents: list, system_instruction: str = "", max_tokens: int = 2048) -> str:
    """Call Gemini API using the official google-genai SDK."""
    model_id = "gemini-3-flash-preview"
    
    try:
        # Configuration including system instructions and token limits
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
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
    if "image" not in request.files:
        return jsonify({"error": "image file required"}), 400

    file = request.files["image"]
    content_type = file.content_type or "image/jpeg"
    image_data = file.read()

    system_prompt = """You are a nutrition extraction assistant. Extract nutritional info and return it as valid JSON ONLY.
    Structure: { "food_name": "str", "quantity": num, "quantity_unit": "str", "calories": num, "protein_g": num, 
    "carbs_g": num, "fat_g": num, "fiber_g": num, "sugar_g": num, "sodium_mg": num, "confidence": "high|medium|low" }"""

    # SDK uses a list of parts; images are passed as bytes + mime_type
    contents = [
        types.Part.from_bytes(data=image_data, mime_type=content_type),
        "Analyze this food image or nutrition label and extract the info as JSON."
    ]

    try:
        response_text = call_gemini(contents, system_instruction=system_prompt)
        
        # Clean Markdown formatting if present
        if "```" in response_text:
            response_text = response_text.split("```")[1].replace("json", "").strip()
            
        return jsonify(json.loads(response_text))
    except Exception as e:
        return jsonify({"error": f"Image analysis failed: {str(e)}"}), 500


@ai_bp.route("/chat", methods=["POST"])
@require_auth
def chat():
    data = request.get_json()
    if not data or not data.get("message"):
        return jsonify({"error": "message required"}), 400

    user_message = data["message"].strip()
    conn = get_db()
    try:
        # History Retrieval
        rows = conn.execute(
            "SELECT role, content FROM chat_messages WHERE user_id=? ORDER BY created_at DESC LIMIT 10",
            (g.user_id,)
        ).fetchall()
        
        # Format history for the SDK
        history_for_sdk = []
        for h in reversed(rows):
            role = "model" if h["role"] == "assistant" else "user"
            history_for_sdk.append(types.Content(role=role, parts=[types.Part.from_text(text=h["content"])]))

        # Add the current user message
        history_for_sdk.append(types.Content(role="user", parts=[types.Part.from_text(text=user_message)]))

        system_prompt = f"You are a nutrition assistant for {g.username}. Use JSON blocks for meals: ```json_meal ... ```"

        response_text = call_gemini(history_for_sdk, system_instruction=system_prompt)

        # Database logging
        conn.execute("INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'user', ?)", (g.user_id, user_message))
        conn.execute("INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'assistant', ?)", (g.user_id, response_text))
        conn.commit()

        # Extract meal suggestion if available
        meal_data = None
        if "```json_meal" in response_text:
            try:
                meal_json = response_text.split("```json_meal")[1].split("```")[0].strip()
                meal_data = json.loads(meal_json)
            except: pass

        return jsonify({"response": response_text, "meal_suggestion": meal_data})
    finally:
        conn.close()


@ai_bp.route("/parse-pdf", methods=["POST"])
@require_auth
def parse_pdf():
    if "pdf" not in request.files:
        return jsonify({"error": "pdf file required"}), 400

    file = request.files["pdf"]
    pdf_data = file.read()

    system_prompt = "Extract food entries from PDF to JSON. Exact structure: { 'entries': [...], 'summary': 'str' }"
    
    # SDK handling for PDF
    contents = [
        types.Part.from_bytes(data=pdf_data, mime_type="application/pdf"),
        "Parse all food diary entries from this PDF into JSON format."
    ]

    try:
        response_text = call_gemini(contents, system_instruction=system_prompt)
        
        if "```" in response_text:
            response_text = response_text.split("```")[1].replace("json", "").strip()
            
        return jsonify(json.loads(response_text))
    except Exception as e:
        return jsonify({"error": f"PDF parsing failed: {str(e)}"}), 500