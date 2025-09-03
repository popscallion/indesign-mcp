#!/bin/bash

# HTTPS Setup Script for InDesign MCP Server
# Installs mkcert and sets up trusted local certificates

set -e

echo "🔐 InDesign MCP HTTPS Setup"
echo "=========================="

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "📦 Installing mkcert for trusted local certificates..."
    if command -v brew &> /dev/null; then
        brew install mkcert
    else
        echo "❌ Error: Homebrew not found. Please install Homebrew first:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
else
    echo "✅ mkcert is already installed"
fi

# Install mkcert root CA
echo "🔑 Setting up mkcert root CA..."
if mkcert -install; then
    echo "✅ mkcert root CA installed successfully"
    echo "   Your browser will now trust locally-generated certificates"
else
    echo "⚠️  mkcert CA installation failed, but continuing..."
fi

# Remove existing certificates to force regeneration with mkcert
CERT_DIR="$HOME/.indesign-mcp/certs"
if [ -d "$CERT_DIR" ]; then
    echo "🧹 Removing existing certificates to regenerate with mkcert..."
    rm -f "$CERT_DIR/server.key" "$CERT_DIR/server.crt"
fi

echo ""
echo "🎉 HTTPS setup complete!"
echo ""
echo "Next steps:"
echo "1. Run: npm run dev:https"
echo "2. Visit: https://localhost:3443"
echo "3. You should see NO browser security warnings!"
echo ""
echo "If you still see warnings, try:"
echo "• Restart your browser completely"
echo "• Clear browser cache and cookies for localhost"
echo "• Run: mkcert -uninstall && mkcert -install"