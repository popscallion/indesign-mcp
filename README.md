# Adobe Creative Suite MCP Server

Production-ready MCP (Model Context Protocol) server enabling AI assistants to automate Adobe InDesign and Illustrator via ExtendScript.

## 🎯 What is This?

A bridge between AI language models (like Claude) and Adobe Creative Suite applications. It allows AI assistants to:
- Create and modify documents programmatically
- Apply professional typography and layout
- Generate data visualizations
- Automate repetitive design tasks
- Export to multiple formats

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** 
- **Adobe InDesign** (2025) or **Adobe Illustrator** (CC 2024+)
- **macOS** (required for AppleScript-ExtendScript bridge)
- **pnpm** package manager (`npm install -g pnpm`)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/adobe-mcp-server.git
cd adobe-mcp-server

# Install dependencies
pnpm install

# Build all packages
pnpm run build
```

### Running the Server

#### Option 1: Standard MCP (for Claude Desktop)
```bash
# InDesign server
pnpm --filter indesign-server start

# Illustrator server
pnpm --filter illustrator-server start
```

#### Option 2: HTTP/HTTPS Mode (for web access)
```bash
# Navigate to shared package
cd packages/shared

# InDesign HTTP server
MCP_APP_MODE=indesign npx tsx src/http-server.ts

# Illustrator HTTP server
MCP_APP_MODE=illustrator npx tsx src/http-server.ts
```

## 📦 Project Structure

```
adobe-mcp-server/
├── packages/
│   ├── shared/              # Shared utilities, ExtendScript bridge, telemetry
│   ├── indesign-server/     # InDesign tools (52+ production-ready)
│   └── illustrator-server/  # Illustrator tools (44 implemented)
├── workflows/               # Illustrator workflow tests
├── tests/                   # Test suites
└── CLAUDE.md               # Development instructions for Claude Code
```

## 🛠️ Available Tools

### InDesign (52+ tools across 10 categories)
- **Text**: Add, update, remove, get document text
- **Styles**: Paragraph/character styles, fonts, formatting
- **Layout**: Text frames, positioning, threading
- **Pages**: Management, dimensions, navigation
- **Export**: PDF, PNG, IDML, package for print
- **Transform**: Object manipulation, alignment
- **Analysis**: Metrics, comparisons, decision tracking

### Illustrator (44 tools across 9 categories)
- **Foundation**: Selection, shapes, artboards, layers
- **Operations**: Transformations, exports, styles, patterns
- **Data**: CSV import, data merge, variable text
- **Generative**: Procedural patterns, variations
- **Export**: Asset extraction, batch export
- **Integration**: Third-party services, cloud storage

## 🔧 Claude Desktop Integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "indesign-mcp": {
      "command": "node",
      "args": ["/path/to/adobe-mcp-server/packages/indesign-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    },
    "illustrator-mcp": {
      "command": "node",
      "args": ["/path/to/adobe-mcp-server/packages/illustrator-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run linting
pnpm run lint

# Test Illustrator workflows (mock mode)
npx tsx workflows/runWorkflowTests.ts --all

# Type checking
pnpm run typecheck
```

## 🚨 Troubleshooting

### Common Issues

**"No document open" error**
- Ensure Adobe application is running with a document open before using tools

**Permission denied on macOS**
- Grant Terminal/IDE automation permissions in System Settings → Privacy & Security → Automation

**Port already in use**
- Change port: `MCP_PORT=3001 npm start`

**ExtendScript errors**
- Check Adobe's JavaScript Console: Window → Utilities → JavaScript Console
- ExtendScript lacks native JSON - use provided polyfills

### Debug Mode

Add debug logging to ExtendScript:
```javascript
var debugSteps = [];
try {
  debugSteps.push("Started operation");
  var doc = app.activeDocument;
  debugSteps.push("Got document: " + doc.name);
  // ... your code ...
} catch (e) {
  return "Debug: " + debugSteps.join(" | ") + " | Error: " + e.message;
}
```

## 📊 Performance Targets

- **Simple operations**: < 1 second
- **Complex operations**: < 3 seconds
- **Batch operations**: < 10 seconds
- **Build time**: ~3.5 seconds
- **Test execution**: < 1 second per test

## 🔐 Security & Best Practices

- Never commit API keys or credentials
- ExtendScript runs with full application permissions
- Validate all user inputs before ExtendScript execution
- Use the telemetry system to track tool usage
- Follow the patterns in CLAUDE.md for development

## 📚 Documentation

- **[PROJECT-STATUS.md](./PROJECT-STATUS.md)** - Current status and roadmap
- **[CLAUDE.md](./CLAUDE.md)** - Development guide for AI assistants
- **Archives**:
  - Testing guides and handoff instructions available in ARCHIVE-* files
  - Historical progress and requirements documentation

## 🤝 Contributing

This project uses a monorepo structure with pnpm workspaces. When contributing:

1. Follow existing ExtendScript patterns
2. Add tests for new tools
3. Update tool descriptions for LLM clarity
4. Test with real Adobe applications
5. Document any API quirks

## 📄 License

MIT

---

**Note**: This project requires Adobe Creative Suite applications and macOS. It's designed for professional automation workflows and AI-assisted design tasks.