"""
Database configuration and initialization using SQLite with raw SQL via sqlite3.
We use sqlite3 directly for simplicity and zero external dependencies.
"""

import sqlite3
import os

DB_PATH = os.environ.get("DB_PATH", "calorie_tracker.db")


def get_db():
    """Get a database connection with row factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Initialize all database tables."""
    conn = get_db()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Goals table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            daily_calories REAL,
            protein_g REAL,
            carbs_g REAL,
            fat_g REAL,
            weight_goal_kg REAL,
            fiber_g REAL,
            sodium_mg REAL,
            sugar_g REAL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Food entries table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS food_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast','lunch','dinner','snacks')),
            food_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            quantity_unit TEXT DEFAULT 'g',
            entry_date DATE NOT NULL,
            calories REAL DEFAULT 0,
            protein_g REAL DEFAULT 0,
            carbs_g REAL DEFAULT 0,
            fat_g REAL DEFAULT 0,
            fiber_g REAL DEFAULT 0,
            sugar_g REAL DEFAULT 0,
            sodium_mg REAL DEFAULT 0,
            vitamin_c_mg REAL DEFAULT 0,
            vitamin_d_iu REAL DEFAULT 0,
            calcium_mg REAL DEFAULT 0,
            iron_mg REAL DEFAULT 0,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Chat messages table (for conversational interface)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user','assistant')),
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()
