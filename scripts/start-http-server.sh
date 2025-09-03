#!/bin/bash

# InDesign MCP HTTP Server Startup Script
# Starts the MCP server on HTTP with optional ngrok tunneling

set -e

# Default configuration
DEFAULT_PORT=3000
DEFAULT_ENABLE_NGROK=true

# Parse command line arguments
PORT=${MCP_PORT:-$DEFAULT_PORT}
ENABLE_NGROK=${ENABLE_NGROK:-$DEFAULT_ENABLE_NGROK}
NGROK_AUTH_TOKEN=${NGROK_AUTH_TOKEN:-""}

# Show configuration
echo "🚀 Starting InDesign MCP HTTP Server"
echo "   Port: $PORT"
echo "   Ngrok: $ENABLE_NGROK"
if [ -n "$NGROK_AUTH_TOKEN" ]; then
    echo "   Ngrok Auth: ✅ Token provided"
else
    echo "   Ngrok Auth: ⚠️  No token (public tunnel)"
fi
echo

# Check if InDesign is running
echo "🔍 Checking InDesign status..."
if ! pgrep -f "Adobe InDesign" > /dev/null; then
    echo "⚠️  Warning: Adobe InDesign is not running"
    echo "   Please start InDesign with a document open before using MCP tools"
    echo
fi

# Check if ngrok is available (if enabled)
if [ "$ENABLE_NGROK" = "true" ]; then
    if ! command -v ngrok &> /dev/null; then
        echo "❌ Error: ngrok is not installed but ENABLE_NGROK=true"
        echo "   Install ngrok: brew install ngrok"
        echo "   Or disable ngrok: ENABLE_NGROK=false $0"
        exit 1
    fi
fi

# Build the project
echo "🔨 Building project..."
npm run build

# Export environment variables
export MCP_PORT=$PORT
export ENABLE_NGROK=$ENABLE_NGROK
if [ -n "$NGROK_AUTH_TOKEN" ]; then
    export NGROK_AUTH_TOKEN=$NGROK_AUTH_TOKEN
fi

# Start the HTTP server
echo "🌟 Starting HTTP server..."
tsx src/http-server.ts