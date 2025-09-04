# Adobe Creative Suite MCP Server

Production-ready MCP (Model Context Protocol) server for Adobe InDesign and Illustrator automation via ExtendScript. Bridges AI assistants with Adobe applications for comprehensive document manipulation.

## Features

### InDesign Tools (52+ production-ready)
Implements comprehensive InDesign automation across 10 categories:

- **Text Tools** (4): Add, update, remove, and get document text
- **Style Tools** (9): Paragraph/character style management, fonts, text selection
- **Layout Tools** (2): Text frame positioning and creation
- **Page Tools** (4): Page management, dimensions, navigation
- **Special Tools** (4): Layers, tables, special characters, status
- **Utility Tools** (7): Text threading, overset resolution, frame management
- **Export Tools** (6): Document export, save, import, place files, preview
- **Transform Tools** (3): Object transformation, duplication, alignment
- **Composite Tools** (7): High-level workflow automation
- **Analysis Tools** (7): Decision tracking, metrics, layout comparison

### Illustrator Tools (44 implemented, testing in progress)
Comprehensive Illustrator automation across 9 categories:

- **Foundation Layer** (6): Element selection, shapes, measurements, layers, artboards
- **Basic Operations** (9): Transformations, exports, styles, patterns, grids
- **Intermediate Tools** (7): Symbols, advanced paths, swatches, gradients
- **Data Tools** (4): CSV import, data merge, variable text
- **Analysis Tools** (3): Color usage, font metrics, path complexity
- **Generative Tools** (6): Procedural patterns, blend modes, variations
- **Transform Tools** (4): Envelope distortion, alignment, clipping masks
- **Export Tools** (5): Asset extraction, batch export, packaging
- **Integration Tools** (4): Third-party services, cloud storage

## Transport Modes

- **Stdio**: Standard MCP over stdin/stdout (Claude Desktop, local clients)
- **HTTP/HTTPS**: SSE with ngrok tunneling for remote access

## Requirements

- Node.js 18+
- Adobe InDesign (tested with 2025) and/or Adobe Illustrator (CC 2024+)
- macOS (ExtendScript automation via AppleScript)
- **ngrok** (optional, for tunneling): `brew install ngrok`
- **OpenSSL** (optional, for HTTPS certificates): `brew install openssl`

## Quick Start

### Installation
```bash
npm install
npm run build
```

### Stdio Mode (Traditional MCP)
```bash
# Run in InDesign mode (default)
npm start

# Run in Illustrator mode
MCP_APP_MODE=illustrator npm start
```

### HTTP/HTTPS Mode (Web Access)
```bash
# HTTP development with ngrok
npm run dev:http

# HTTPS development with self-signed certs + ngrok
npm run dev:https
```

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

### Environment Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_APP_MODE` | `indesign` | `indesign` or `illustrator` |
| `MCP_PORT` | `3000` | HTTP server port |
| `MCP_HTTPS_PORT` | `3443` | HTTPS server port |
| `ENABLE_HTTPS` | `true` | Enable native HTTPS server |
| `ENABLE_NGROK` | `true` | Enable ngrok tunneling |
| `NGROK_AUTH_TOKEN` | - | Optional: authenticated ngrok tunnels |
| `CORS_ORIGIN` | `*` | CORS policy for web clients |
| `CERT_PATH` | auto-generated | Path to SSL certificate file |
| `KEY_PATH` | auto-generated | Path to SSL private key file |

**⚠️ Important:** Make sure the target Adobe application is running with a document open before using the tools.

## Troubleshooting

### General Issues
- **`EADDRINUSE` Error**: The port is already in use. Stop the existing process or use a different port:
  ```bash
  MCP_PORT=3001 npm start
  ```
- **Permissions Error on macOS**: Ensure you have granted Terminal/your editor Automation permissions for InDesign/Illustrator in `System Settings → Privacy & Security → Automation`.

### ExtendScript Issues
- **`JSON is undefined`**: ExtendScript lacks native JSON support. Use the `JSON2_POLYFILL` or build strings manually. See `CLAUDE.md` for details.
- **Silent Failures**: If a tool call does nothing, check the InDesign/Illustrator JavaScript console for errors (`Window → Utilities → JavaScript Console`).
- **Incorrect Object Selection**: Add debug logging to your ExtendScript to verify that your selection logic is targeting the correct objects.

### HTTPS Certificate Issues
- **Browser Warnings**: If you get security warnings for `https://localhost:3443`, you can either accept the self-signed certificate or install `mkcert` for a trusted local CA.
- **Certificate Regeneration**: To force regenerate certificates, delete the `~/.indesign-mcp/certs/` directory and restart the server.

For more detailed debugging steps, see the `TESTING-GUIDE.md`.

## License

MIT
