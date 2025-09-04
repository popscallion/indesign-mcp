# CLAUDE.md

Development instructions for Claude Code when working with this repository.

## 🎯 Project Overview

**Adobe Creative Suite MCP Server** - AI-driven automation platform for Adobe InDesign and Illustrator using TypeScript MCP (Model Context Protocol) via ExtendScript.

### Current State
- **InDesign**: 52+ production tools, evolutionary testing operational
- **Illustrator**: 44 tools implemented, awaiting real-world testing
- **Architecture**: Multi-app support, HTTP/HTTPS transport, telemetry system

## 📁 Project Structure

```
adobe-mcp/
├── src/
│   ├── index.ts                 # Server entry (multi-app support)
│   ├── extendscript.ts          # AppleScript-ExtendScript bridge
│   ├── tools/                   # InDesign tools (52+)
│   └── illustrator/
│       ├── tools/               # Illustrator tools (44)
│       └── workflows/           # Test workflows (14)
├── src/experimental/
│   ├── evolutionary/            # Testing system
│   └── visual-testing/          # Peekaboo integration
└── dist/                        # Compiled JavaScript
```

## 🚀 Development Commands

```bash
# Build and test
npm run build
npm test

# Run server
npm start                           # InDesign mode
MCP_APP_MODE=illustrator npm start # Illustrator mode

# HTTP with ngrok
npm run start:http

# Test workflows
npx tsx src/illustrator/workflows/runWorkflowTests.ts --all
```

## ⚡ Key Development Patterns

### ExtendScript Requirements
- Use `array.join()` not `+=` for strings
- Convert booleans to strings: `"true"`/`"false"`
- Double-escape newlines: `\\\\n`
- Wrap all code in try/catch

### Tool Registration
```typescript
server.tool(name, schema, wrapToolForTelemetry(name, handler));
```

### Testing Approach
1. Build: `npm run build`
2. Test compilation: `npm test`
3. Run workflows: Mock testing available
4. Real testing: Requires Adobe apps running

## 📋 Active Development Focus

### Immediate Tasks
1. Test Illustrator tools with actual Adobe Illustrator
2. Document any ExtendScript API quirks
3. Fix runtime errors if found

### Known Issues
- Illustrator tools untested with real app
- LLM tool selection needs optimization
- Performance degrades with large documents

## 🔗 Key Files

**Entry Points**:
- `src/index.ts` - Server configuration
- `src/tools/index.ts` - InDesign tool registry
- `src/illustrator/index.ts` - Illustrator tool registry

**Testing**:
- `src/illustrator/workflows/` - Test scenarios
- `src/experimental/evolutionary/` - Testing system

**Documentation**:
- [PROJECT-STATUS.md](PROJECT-STATUS.md) - Current status
- [TESTING-GUIDE.md](TESTING-GUIDE.md) - Testing procedures
- [README.md](README.md) - Setup instructions

## ⚠️ Critical Reminders

1. **Always test with Adobe apps running**
2. **Check MCP_APP_MODE for Illustrator testing**
3. **Use telemetry wrapper for all new tools**
4. **Document ExtendScript quirks when found**
5. **Run evolutionary testing after changes**