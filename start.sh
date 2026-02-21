#!/bin/bash
# CalTrack - Quick start script
# Starts both backend and frontend servers

set -e

echo "🥗 Starting CalTrack..."

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

# Backend setup
echo "📦 Setting up backend..."
cd backend
pip install -r requirements.txt -q

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  Warning: ANTHROPIC_API_KEY not set. AI features will not work."
fi

if [ -z "$SECRET_KEY" ]; then
    export SECRET_KEY=$(python3 -c "import os; print(os.urandom(32).hex())")
    echo "🔑 Generated random SECRET_KEY for this session"
fi

# Start backend in background
echo "🚀 Starting backend on http://localhost:8000..."
python3 app.py &
BACKEND_PID=$!

cd ..

# Frontend setup
echo "📦 Setting up frontend..."
cd frontend
npm install -q

# Start frontend
echo "🚀 Starting frontend on http://localhost:3000..."
npm start &
FRONTEND_PID=$!

echo ""
echo "✅ CalTrack is starting up!"
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services."

# Cleanup on exit
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
