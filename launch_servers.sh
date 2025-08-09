#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Function to start a process in the background
start_process() {
    local name=$1
    local cmd=$2
    local log_file="$SCRIPT_DIR/logs/${name}.log"
    
    echo "Starting $name..."
    nohup bash -c "cd \"$SCRIPT_DIR\" && $cmd" >> "$log_file" 2>&1 &
    echo $! > "$SCRIPT_DIR/logs/${name}.pid"
    echo "$name started (PID: $(cat "$SCRIPT_DIR/logs/${name}.pid"))"
}

# Stop any running instances
pkill -f "node server.js"
pkill -f "http-server frontend"

# Start backend
start_process "backend" "cd backend && npm run dev"

# Start frontend
start_process "frontend" "npx http-server frontend -p 3000 -o"

# Open the frontend in the default browser
open "http://localhost:3000"

echo ""
echo "========================================"
echo "SalvageOrganizer is now running!"
echo "- Frontend: http://localhost:3000"
echo "- Backend:  http://localhost:5002"
echo "- Logs:     $SCRIPT_DIR/logs/"
echo ""
echo "To stop the servers, run: pkill -f 'node|http-server'"
echo "========================================"
