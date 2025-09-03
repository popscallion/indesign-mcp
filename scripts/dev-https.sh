#!/bin/bash

# Quick development HTTPS server with self-signed certificates and ngrok
# Usage: ./scripts/dev-https.sh [port] [https-port]

HTTP_PORT=${1:-3000}
HTTPS_PORT=${2:-3443}

echo "🔒 Starting InDesign MCP in HTTPS mode..."
echo "   HTTP Port: $HTTP_PORT"
echo "   HTTPS Port: $HTTPS_PORT" 
echo "   Ngrok: Enabled (will tunnel HTTPS)"

# Set environment variables
export MCP_PORT=$HTTP_PORT
export MCP_HTTPS_PORT=$HTTPS_PORT
export ENABLE_HTTPS=true
export ENABLE_NGROK=true

# Build and start
npm run build && tsx src/https-server.ts