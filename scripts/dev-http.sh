#!/bin/bash

# Quick development HTTP server with ngrok
# Usage: ./scripts/dev-http.sh [port]

PORT=${1:-3000}

echo "🚀 Starting InDesign MCP in HTTP mode on port $PORT with ngrok..."

# Set environment variables
export MCP_PORT=$PORT
export ENABLE_NGROK=true

# Build and start
npm run build && tsx src/http-server.ts