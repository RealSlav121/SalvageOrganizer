#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Stop any running instances
"$SCRIPT_DIR/Stop Servers.command"

# Start backend in background
nohup bash -c "cd '$SCRIPT_DIR/backend' && npm run dev" >> "$SCRIPT_DIR/logs/backend.log" 2>&1 &
echo $! > "$SCRIPT_DIR/logs/backend.pid"

# Start frontend in background
nohup npx http-server "$SCRIPT_DIR/frontend" -p 3000 -a 192.168.1.118 >> "$SCRIPT_DIR/logs/frontend.log" 2>&1 &
echo $! > "$SCRIPT_DIR/logs/frontend.pid"

# Open the frontend in the default browser
open "http://192.168.1.118:3000"

echo ""
echo "========================================"
echo "🚀 SalvageOrganizer is now running in the background!"
echo "- Frontend: http://192.168.1.118:3000"
echo "- Backend:  http://192.168.1.118:5002"
echo "- Logs:     $SCRIPT_DIR/logs/"
echo ""
echo "To stop the servers, run the 'Stop Servers' app."
echo "========================================"

# Close the terminal window after a short delay
sleep 3
osascript -e 'tell application "Terminal" to close first window' & exit
