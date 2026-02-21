# CalTrack — Personal Calorie Tracker

A full-stack nutrition tracking application with AI-powered meal analysis, conversational chat interface, multi-user support, and rich data visualizations.

## Features

### Core Features
- **Goal Setting** — Set daily calorie, macro, and micronutrient targets with preset templates
- **Meal Entry** — Log meals by type (Breakfast, Lunch, Dinner, Snacks) with full nutritional data
- **Time-Range Listing** — Filter and paginate food entries by date range and meal type
- **Nutrition Reports & Graphs** — Weekly calorie trends, macro breakdowns, micronutrient radar charts, and goal vs. actual comparisons

### AI-Powered Features
- **Image Analysis** — Upload a food photo or nutrition label → AI auto-extracts all nutritional info
- **Conversational Chat** — Natural language interface for logging meals, checking goals, and getting advice
- **PDF Import** — Upload a food diary PDF → AI parses and bulk-imports all entries

### Bonus Features
- **Multi-User Support** — Signup/login with JWT authentication; each user has private data
- **Bulk Import** — Import up to 500 entries at once from a parsed PDF

---

## Architecture

```
calorie-tracker/
├── backend/              # Flask REST API
│   ├── app.py            # Application factory & entry point
│   ├── database.py       # SQLite initialization & connection
│   ├── auth.py           # Password hashing & JWT utilities
│   ├── requirements.txt
│   └── routes/
│       ├── auth_routes.py    # POST /api/auth/signup, /login
│       ├── goals_routes.py   # GET/PUT /api/goals
│       ├── entries_routes.py # CRUD /api/entries + bulk import
│       ├── reports_routes.py # GET /api/reports/*
│       └── ai_routes.py      # POST /api/ai/analyze-image, /chat, /parse-pdf
│
└── frontend/             # React SPA
    └── src/
        ├── App.js              # Root + navigation
        ├── api/client.js       # Centralized API client
        ├── utils/AuthContext.js # Authentication state
        └── components/
            ├── UI.js           # Reusable component library
            ├── AuthPage.js     # Login / Sign up
            ├── Dashboard.js    # Today's summary + charts
            ├── MealLog.js      # CRUD meal entries
            ├── Reports.js      # Analytics & graphs
            ├── Goals.js        # Goal management
            ├── AIScanner.js    # Image/PDF upload & analysis
            └── ChatInterface.js # Conversational AI
```

### Design Decisions
- **SQLite** — Zero-config, file-based DB perfect for single-server deployments. Schema managed in `database.py` with raw SQL for clarity and control.
- **Flask Blueprints** — Each feature domain (auth, goals, entries, reports, ai) is a separate Blueprint for modularity.
- **Custom JWT** — Implemented with `hmac` + `hashlib` to avoid external dependencies. Tokens expire after 7 days.
- **Password hashing** — SHA-256 with random salt (no bcrypt dependency required).
- **No ORM** — SQLite with row_factory for dict-like access keeps the code transparent and portable.
- **Pagination** — All list endpoints accept `page` + `per_page` params with metadata in response.

---

## Setup & Running

### Prerequisites
- Python 3.10+ 
- Node.js 18+
- An Anthropic API key (for AI features)

### Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export ANTHROPIC_API_KEY=your_key_here      # Required for AI features
export SECRET_KEY=your-secret-key           # JWT signing key (change in production!)
export DB_PATH=calorie_tracker.db           # SQLite file path (default)
export PORT=8000                            # Server port (default: 8000)

# Start the server
python app.py
```

The API will be available at `http://localhost:8000/api`.

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Optional: set API URL (defaults to http://localhost:8000/api)
echo "REACT_APP_API_URL=http://localhost:8000/api" > .env

# Start development server
npm start
```

The app will open at `http://localhost:3000`.

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Authenticate & get token |

All other endpoints require `Authorization: Bearer <token>` header.

### Goals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/goals` | Get current user's goals |
| PUT | `/api/goals` | Update goals |

### Food Entries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entries` | List entries (paginated, filterable) |
| POST | `/api/entries` | Create single entry |
| GET | `/api/entries/:id` | Get single entry |
| PUT | `/api/entries/:id` | Update entry |
| DELETE | `/api/entries/:id` | Delete entry |
| POST | `/api/entries/bulk` | Bulk create entries |

**Query params for GET /api/entries:**
- `start_date` / `end_date` — Date range filter (YYYY-MM-DD)
- `meal_type` — Filter by meal type (`breakfast`, `lunch`, `dinner`, `snacks`)
- `page` — Page number (default: 1)
- `per_page` — Items per page (default: 20, max: 100)

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/daily` | Per-day nutritional totals + meal breakdown |
| GET | `/api/reports/weekly` | Weekly aggregates |
| GET | `/api/reports/goal-comparison` | Actuals vs. goals |
| GET | `/api/reports/micronutrients` | Micronutrient summary |

**Shared query params:** `period` (week/month), `start_date`, `end_date`

### AI Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/analyze-image` | Upload food/label image → get nutrition data |
| POST | `/api/ai/chat` | Send chat message, get AI response |
| GET | `/api/ai/chat/history` | Get paginated chat history |
| POST | `/api/ai/parse-pdf` | Upload food diary PDF → extract entries |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | **Required for AI features** |
| `SECRET_KEY` | `dev-secret-key-change-in-production` | JWT signing key |
| `DB_PATH` | `calorie_tracker.db` | SQLite database file path |
| `PORT` | `8000` | Backend server port |
| `FLASK_DEBUG` | `0` | Set to `1` for debug mode |

---

## Data Model

### `users`
- `id`, `username`, `email`, `password_hash`, `created_at`

### `goals`
- `id`, `user_id`, `daily_calories`, `protein_g`, `carbs_g`, `fat_g`, `weight_goal_kg`, `fiber_g`, `sodium_mg`, `sugar_g`, `updated_at`

### `food_entries`
- `id`, `user_id`, `meal_type`, `food_name`, `quantity`, `quantity_unit`, `entry_date`
- Macros: `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `sugar_g`
- Micros: `sodium_mg`, `vitamin_c_mg`, `vitamin_d_iu`, `calcium_mg`, `iron_mg`
- `notes`, `created_at`

### `chat_messages`
- `id`, `user_id`, `role` (user/assistant), `content`, `created_at`

---

## Running Tests

```bash
cd backend
python -c "
from database import init_db; init_db()
from app import create_app
app = create_app()
with app.test_client() as c:
    # Signup
    r = c.post('/api/auth/signup', json={
        'username': 'demo', 'email': 'demo@test.com', 'password': 'demo123'
    })
    token = r.get_json()['token']
    headers = {'Authorization': f'Bearer {token}'}
    
    # Create entry
    c.post('/api/entries', json={
        'food_name': 'Apple', 'meal_type': 'snacks',
        'quantity': 182, 'entry_date': '2026-02-20',
        'calories': 95, 'carbs_g': 25, 'fiber_g': 4.4
    }, headers=headers)
    
    # List entries
    r = c.get('/api/entries', headers=headers)
    print('Test passed:', len(r.get_json()['items']), 'entries')
"
```

---

## Security Notes

- All endpoints (except auth) require a valid JWT token
- User data is fully isolated — queries always filter by `user_id`
- Passwords are salted and hashed with SHA-256
- Input validation on all endpoints with descriptive error messages
- File upload size limits enforced (images: 10MB, PDFs: 20MB)

---

## Assumptions

1. The app is designed for single-server deployment with SQLite; for horizontal scaling, switch to PostgreSQL and use connection pooling.
2. AI features require a valid `ANTHROPIC_API_KEY`. Without it, image analysis and chat will return error responses, but all other features work normally.
3. A single user-facing origin (`http://localhost:3000`) is allowed for CORS. Update `app.py` for production domains.
4. Nutritional values entered manually are trusted as-is; AI-extracted values carry a confidence indicator.
5. The frontend is a single-page React app without a build step for development (uses CRA dev server).
