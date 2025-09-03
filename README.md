# InDesign MCP Server

An experimental MCP (Model Context Protocol) server for Adobe InDesign automation via ExtendScript. This server provides AI assistants with comprehensive InDesign document manipulation capabilities through both traditional stdio transport and modern HTTP/HTTPS endpoints with automatic ngrok tunneling.

## Features

Currently implements 69 tools across 11 categories:

- **Text Operations** (4): Add, update, remove, and extract text content
- **Style Management** (10): Create and apply paragraph/character/object styles with enhanced selection criteria
- **Layout Control** (4): Position and create text frames, alternate layouts for responsive design
- **Page Management** (4): Add, remove, inspect pages, get dimensions  
- **Special Features** (4): Insert characters, manage layers, create tables, status
- **Utility Tools** (17): Text threading, overset resolution, data merge setup, flow management, asset management, master pages, bulk operations
- **Document Operations** (7): Export, save, import content, place files, batch export by layout, preview generation
- **Object Transformation** (3): Transform, duplicate, and align objects
- **Composite Tools** (7): High-level workflow automation and layout operations
- **Analysis Tools** (7): Decision tracking, metrics extraction, and layout comparison
- **Color Management** (6): Create and manage color swatches, themes, object styles, and color groups

## Transport Modes

### 1. **Stdio Transport** (Traditional MCP)
- Standard MCP over stdin/stdout for local client integration
- Perfect for Claude Desktop, MCP clients, and local development

### 2. **HTTP/HTTPS Transport** (Web Access)  
- Server-Sent Events (SSE) over HTTP/HTTPS for web clients
- Native HTTPS support with self-signed certificates
- Automatic HTTPS tunneling via ngrok for remote access
- CORS support for browser-based applications
- Multi-session support with session isolation

## Requirements

- Node.js 18+
- Adobe InDesign (tested with 2025 v20.3.1)
- macOS (ExtendScript automation via AppleScript)
- **ngrok** (for tunneling): `brew install ngrok`
- **OpenSSL** (for HTTPS certificates): `brew install openssl`

## Quick Start

### Installation
```bash
npm install
npm run build
```

### Stdio Mode (Traditional MCP)
```bash
npm start                    # Default stdio transport
```

### HTTP Mode (Web Access)
```bash
npm run dev:http            # HTTP development with ngrok
npm run start:http          # Production HTTP server
```

### HTTPS Mode (Secure Web Access)
```bash
npm run dev:https           # HTTPS with self-signed certs + ngrok
npm run start:https         # Production HTTPS server  
```

## Usage

### Stdio Transport (MCP Clients)

Add to your MCP client configuration (Claude Desktop, etc.):

```json
{
  "mcpServers": {
    "indesign": {
      "command": "node",
      "args": ["/path/to/indesign-mcp/dist/index.js"]
    }
  }
}
```

### HTTP/HTTPS Transport (Web Access)

The server provides these endpoints (available on both HTTP and HTTPS when enabled):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mcp` | GET | Establish SSE connection for MCP communication |
| `/mcp/message` | POST | Send JSON-RPC messages with session routing |
| `/health` | GET | Server status and active session count |
| `/info` | GET | API documentation and usage information |
| `/ssl-info` | GET | SSL certificate information (HTTPS only) |

**Example Usage:**

**HTTP Mode:**
```bash
# Quick HTTP development with ngrok
npm run dev:http
# Output: Server running at https://abc123.ngrok.app

# Custom port and settings
MCP_PORT=4000 ENABLE_NGROK=true npm run start:http

# Local HTTP only (no ngrok)
ENABLE_NGROK=false npm run start:http
# Access at: http://localhost:4000/mcp
```

**HTTPS Mode:**
```bash
# Quick HTTPS development with self-signed certs + ngrok
npm run dev:https
# Output: HTTPS server at https://xyz789.ngrok.app
#         Local HTTPS at https://localhost:3443/mcp

# Production HTTPS with custom certificates
CERT_PATH=/path/to/server.crt KEY_PATH=/path/to/server.key npm run start:https

# Local HTTPS only (no ngrok)
ENABLE_NGROK=false npm run start:https
# Access at: https://localhost:3443/mcp
```

### Environment Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PORT` | `3000` | HTTP server port |
| `MCP_HTTPS_PORT` | `3443` | HTTPS server port |
| `ENABLE_HTTPS` | `true` | Enable native HTTPS server |
| `ENABLE_NGROK` | `true` | Enable ngrok tunneling |
| `NGROK_AUTH_TOKEN` | - | Optional: authenticated ngrok tunnels |
| `CORS_ORIGIN` | `*` | CORS policy for web clients |
| `FORCE_HTTPS_REDIRECT` | `false` | Redirect HTTP to HTTPS |
| `CERT_PATH` | auto-generated | Path to SSL certificate file |
| `KEY_PATH` | auto-generated | Path to SSL private key file |

**⚠️ Important:** Make sure InDesign is running with a document open before using the tools.

## Development

### Build and Run Commands

```bash
# Build
npm run build              # Compile TypeScript
npm run typecheck          # Type check main code and tests

# Stdio Transport
npm start                  # Run stdio server  
npm run dev                # Development mode with watch

# HTTP Transport  
npm run start:http         # Run HTTP server
npm run dev:http          # Development HTTP server with ngrok
npm run dev:http 4000     # Custom port with ngrok

# HTTPS Transport
npm run start:https        # Run HTTPS server with self-signed certs
npm run dev:https         # Development HTTPS server with ngrok
npm run dev:https 3000 3443  # Custom HTTP and HTTPS ports

# Testing and Linting
npm test                   # Run unit tests with Jest
npm run lint              # Run ESLint 
npm run lint:fix          # Auto-fix ESLint issues
```

### HTTP Server Development

**Quick Start:**
```bash
npm run dev:http
# Starts server with ngrok tunnel
# Output: https://abc123.ngrok.app/mcp
```

**Advanced Configuration:**
```bash
# Production setup
export MCP_PORT=3000
export NGROK_AUTH_TOKEN=your_ngrok_token  
export CORS_ORIGIN="https://yourdomain.com"
npm run start:http

# Local development only
ENABLE_NGROK=false npm run start:http
# Access at: http://localhost:3000/mcp
```

**Health Monitoring:**
```bash
curl http://localhost:3000/health
# Returns: {"status":"healthy","activeSessions":0}

# HTTPS health check (accepts self-signed certs)
curl -k https://localhost:3443/health

# SSL certificate information
curl -k https://localhost:3443/ssl-info
```

### HTTPS Certificate Management

**Self-Signed Certificates (Default):**
The server automatically generates self-signed SSL certificates on first run:
- Certificates stored in: `~/.indesign-mcp/certs/`
- Valid for: localhost, *.localhost, 127.0.0.1, *.ngrok.app, *.ngrok.io
- Validity: 365 days from generation

**Custom Certificates:**
```bash
# Use your own SSL certificates
export CERT_PATH=/path/to/your/server.crt
export KEY_PATH=/path/to/your/server.key
npm run start:https
```

**Certificate Regeneration:**
```bash
# Remove existing certificates to force regeneration
rm ~/.indesign-mcp/certs/server.*
npm run start:https  # Will generate new certificates
```

## Fixing Browser Certificate Warnings

### Option 1: Use Trusted Certificates (Recommended)

**Install mkcert for browser-trusted certificates:**
```bash
# Install mkcert and setup trusted CA
brew install mkcert
mkcert -install  # Requires admin password

# Remove existing certificates and restart server
rm -rf ~/.indesign-mcp/certs/
npm run dev:https
```

After this setup, your browser will show **no security warnings** when visiting `https://localhost:3443`.

### Option 2: Accept Self-Signed Certificate

If you prefer not to install mkcert, you can accept the self-signed certificate:

**Chrome/Safari/Edge:**
1. Visit `https://localhost:3443`
2. Click **"Advanced"** 
3. Click **"Proceed to localhost (unsafe)"**
4. The certificate will be remembered for this session

**Firefox:**
1. Visit `https://localhost:3443`
2. Click **"Advanced"**
3. Click **"Accept the Risk and Continue"**

### Option 3: Use HTTP Instead

If you don't need HTTPS, use HTTP mode:
```bash
npm run dev:http  # Uses HTTP with ngrok (still provides HTTPS via tunnel)
```

### Troubleshooting Certificate Issues

**Certificate regeneration:**
```bash
# Force regenerate certificates
rm -rf ~/.indesign-mcp/certs/
npm run start:https

# Check certificate status
curl -k https://localhost:3443/ssl-info
```

**mkcert issues:**
```bash
# Reinstall mkcert CA
mkcert -uninstall
mkcert -install

# Verify mkcert installation
mkcert -version
mkcert localhost 127.0.0.1  # Test certificate generation
```

## Important Gotchas & Known Issues

### ExtendScript Color Management
- **Colors ARE Swatches**: In InDesign, `doc.colors.add()` automatically creates swatches. Never use `doc.swatches.add()` (doesn't exist).
- **Transparency Property**: Use `objectStyle.transparencySettings.blendingSettings.opacity = 100 - percentage` instead of `objectStyle.transparency`.
- **Swatch Updates**: Modify swatch properties directly (`swatch.colorValue = [r,g,b]`) rather than creating intermediate color objects.

### JSON Support
- **ExtendScript Limitation**: Adobe's ExtendScript lacks native JSON support. All color tools include a JSON2 polyfill automatically.
- **Manual JSON Construction**: For new tools, either include the JSON2 polyfill or use manual string building with `array.join()`.

### Error Handling Patterns
- **False Negatives**: Some tools may report errors while actually succeeding (especially color operations). Always verify results in InDesign UI.
- **Silent Failures**: Add comprehensive debugging with object counts and detailed error messages for bulk operations.
- **Logger Dependencies**: Composite tools use a mock logger to prevent `logger.log is not a function` errors.

### Testing Best Practices
- **Document State**: Always test with both empty documents and complex multi-page documents.
- **Version Compatibility**: Tested with InDesign 2025 v20.5.0.48. Earlier versions may have different API behaviors.
- **Object Selection**: Use debugging output to verify object selection logic in bulk operations.

## Status

This project provides comprehensive InDesign automation with 65 production-ready tools across 11 categories. All core functionality is stable and extensively tested. Recent fixes address ExtendScript compatibility issues and improve error reporting. Some advanced tools may have edge cases with complex documents. Contributions and feedback welcome.

## License

MIT