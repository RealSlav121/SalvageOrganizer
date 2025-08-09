#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Stopping SalvageOrganizer servers..."

# Stop backend
if [ -f "$SCRIPT_DIR/logs/backend.pid" ]; then
    BACKEND_PID=$(cat "$SCRIPT_DIR/logs/backend.pid")
    if ps -p $BACKEND_PID > /dev/null; then
        echo "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
    fi
    rm -f "$SCRIPT_DIR/logs/backend.pid"
fi

# Stop frontend
if [ -f "$SCRIPT_DIR/logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$SCRIPT_DIR/logs/frontend.pid")
    if ps -p $FRONTEND_PID > /dev/null; then
        echo "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
    fi
    rm -f "$SCRIPT_DIR/logs/frontend.pid"
fi

# Make sure all processes are stopped
pkill -f "node server.js" || true
pkill -f "http-server frontend" || true

echo "All SalvageOrganizer servers have been stopped."
echo "You can safely close this window."

# Keep the terminal open briefly
sleep 3
