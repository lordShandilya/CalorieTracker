"""
Seed script - creates a demo user with sample data for testing.
Run: python3 seed_demo.py
"""
import sys
sys.path.insert(0, '.')
from database import init_db, get_db
from auth import hash_password
from datetime import date, timedelta
import random

init_db()

conn = get_db()

# Create demo user
try:
    cursor = conn.execute(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        ("demo", "demo@example.com", hash_password("demo123"))
    )
    user_id = cursor.lastrowid

    conn.execute(
        "INSERT INTO goals (user_id, daily_calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg) VALUES (?, 2000, 150, 250, 65, 25, 2300)",
        (user_id,)
    )
    conn.commit()
    print(f"Created demo user (id={user_id}): username=demo, password=demo123")
except Exception as e:
    print(f"Demo user may already exist: {e}")
    user = conn.execute("SELECT id FROM users WHERE username='demo'").fetchone()
    user_id = user["id"] if user else None

if not user_id:
    conn.close()
    sys.exit()

# Sample meal data
MEALS = [
    ("Oatmeal with Berries", "breakfast", 100, "g", 350, 12, 60, 6, 8, 15, 180),
    ("Grilled Chicken Breast", "lunch", 200, "g", 330, 62, 0, 7, 0, 0, 140),
    ("Brown Rice", "lunch", 150, "g", 165, 4, 34, 1, 2, 0, 5),
    ("Greek Yogurt", "snacks", 200, "g", 180, 20, 9, 5, 0, 12, 80),
    ("Salmon Fillet", "dinner", 180, "g", 360, 50, 0, 18, 0, 0, 220),
    ("Broccoli", "dinner", 200, "g", 70, 6, 14, 1, 5, 6, 66),
    ("Banana", "snacks", 120, "g", 105, 1, 27, 0, 3, 14, 1),
    ("Whole Wheat Bread", "breakfast", 60, "g", 160, 6, 30, 2, 4, 4, 280),
    ("Almonds", "snacks", 30, "g", 173, 6, 6, 15, 4, 1, 1),
    ("Pasta", "dinner", 200, "g", 310, 10, 62, 2, 4, 3, 10),
]

today = date.today()
for i in range(7):
    day = str(today - timedelta(days=i))
    # Pick 4-6 random meals for this day
    day_meals = random.sample(MEALS, k=random.randint(4, 6))
    for name, meal_type, qty, unit, cal, pro, carb, fat, fiber, sugar, sodium in day_meals:
        conn.execute("""
            INSERT INTO food_entries 
            (user_id, food_name, meal_type, quantity, quantity_unit, entry_date, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, name, meal_type, qty, unit, day, cal, pro, carb, fat, fiber, sugar, sodium))

conn.commit()
conn.close()
print(f"Added 7 days of sample meal data for user 'demo'")
print("Login with: username=demo, password=demo123")
