#!/bin/bash

echo "🎨 Testing Illustrator MCP Tools"
echo "================================"
echo ""
echo "Starting server in Illustrator mode..."
echo ""

# Start the server in background
MCP_APP_MODE=illustrator npm start &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo ""
echo "Server started with PID: $SERVER_PID"
echo ""
echo "You can now:"
echo "1. Use Claude Desktop (if configured)"
echo "2. Run workflow tests: npx tsx src/illustrator/workflows/runWorkflowTests.ts --all"
echo "3. Check server logs above for any errors"
echo ""
echo "Press Ctrl+C to stop the server"

# Wait for interrupt
wait $SERVER_PID