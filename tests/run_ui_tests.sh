#!/bin/bash
# ─── Traffic Insight BD — UI Test Runner ──────────────────────────
# Run all Robot Framework UI tests against a running server.
#
# Usage:
#   ./tests/run_ui_tests.sh              # all tests
#   ./tests/run_ui_tests.sh --include smoke   # only smoke tests
#
# Prerequisites:
#   1. Server running on http://localhost:8000
#   2. pip install robotframework robotframework-browser robotframework-requests
#   3. rfbrowser init

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_DIR="$SCRIPT_DIR/ui"
RESULTS_DIR="$PROJECT_DIR/tests/results"

mkdir -p "$RESULTS_DIR"

echo "═══════════════════════════════════════════════════════"
echo "  Traffic Insight BD — Robot Framework UI Tests"
echo "═══════════════════════════════════════════════════════"
echo ""

# Check server is running
if ! curl -s -o /dev/null -w "" http://localhost:8000/api/overview 2>/dev/null; then
    echo "ERROR: Server is not running on http://localhost:8000"
    echo "Start with: cd $PROJECT_DIR && python run.py"
    exit 1
fi

echo "✓ Server is running"
echo ""

cd "$PROJECT_DIR"
python -m robot \
    --outputdir "$RESULTS_DIR" \
    --loglevel DEBUG \
    --consolecolors on \
    "$@" \
    "$TEST_DIR"
