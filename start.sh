#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "▶  Stopping anything on port 8000..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

echo "▶  Activating virtual environment..."
source .venv/bin/activate

echo "▶  Starting server..."
python run.py &
SERVER_PID=$!

echo "▶  Waiting for server to be ready..."
for i in $(seq 1 20); do
  if curl -s http://localhost:8000/api/stats/summary > /dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo ""
echo "✅  Traffic Insight BD is running at http://localhost:8000"
echo "    PID: $SERVER_PID  |  Press Ctrl+C to stop"
echo ""

# Open browser automatically
open http://localhost:8000 2>/dev/null || xdg-open http://localhost:8000 2>/dev/null || true

# Keep script alive so Ctrl+C kills the server cleanly
trap "echo ''; echo 'Stopping server...'; kill $SERVER_PID 2>/dev/null; exit 0" INT TERM
wait $SERVER_PID
