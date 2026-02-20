"""
Personal Calorie Tracker - Flask Backend
Main application entry point.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify
from database import init_db
from routes.auth_routes import auth_bp
from routes.goals_routes import goals_bp
from routes.entries_routes import entries_bp
from routes.reports_routes import reports_bp
from routes.ai_routes import ai_bp


def create_app() -> Flask:
    """Application factory."""
    app = Flask(__name__)

    # CORS headers for frontend communication
    @app.after_request
    def add_cors_headers(response):
        origin = "http://localhost:3000"
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        return response

    @app.before_request
    def handle_preflight():
        from flask import request
        if request.method == "OPTIONS":
            return "", 204

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(goals_bp)
    app.register_blueprint(entries_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(ai_bp)

    # Health check
    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "version": "1.0.0"})

    # Generic error handlers
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "Internal server error"}), 500

    return app


if __name__ == "__main__":
    # Initialize database
    init_db()
    print("Database initialized.")

    app = create_app()
    port = int(os.environ.get("PORT", 8000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    print(f"Starting server on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
