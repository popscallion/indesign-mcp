# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎯 Project Overview

**Adobe Creative Suite MCP Server** - An AI-driven automation platform for Adobe InDesign and Illustrator using a TypeScript-based MCP (Model Context Protocol) server that bridges LLMs with Adobe applications via ExtendScript.

### Current State
- **InDesign**: 52+ production-ready tools with a fully operational evolutionary testing system.
- **Illustrator**: 44 tools implemented, awaiting real-world testing and validation.
- **Architecture**: Robust multi-app support, flexible HTTP/HTTPS and stdio transport, and an integrated telemetry system.

### 📌 Current Development Focus: Improving LLM Decision-Making

While the MCP tools are functionally complete and execute successfully, the primary challenge is **optimizing the LLM's strategic decisions**. LLMs often struggle with which tools to use, when, and with what parameters, leading to suboptimal results.

Our active work is focused on:
1.  **Evolutionary Testing**: Using a task-based system to automatically test and improve tool descriptions.
2.  **Pattern Analysis**: Identifying common failure patterns in LLM tool usage.
3.  **Improvement Generation**: Leveraging AI to analyze patterns and propose concrete improvements.

## 📁 Project Structure

```
indesign-mcp/
├── src/
│   ├── index.ts                 # Server entry point (multi-app support)
│   ├── extendscript.ts          # AppleScript-ExtendScript bridge
│   ├── types.ts                 # TypeScript type definitions
│   ├── tools/                   # InDesign tools (10 categories, 52+ tools)
│   └── illustrator/
│       ├── tools/               # Illustrator tools (9 categories, 44 tools)
│       └── workflows/           # Test workflows (14 scenarios)
├── src/experimental/
│   ├── evolutionary/            # Evolutionary testing system
│   └── visual-testing/          # Peekaboo visual testing integration
├── docs/                        # Documentation and API references
└── dist/                        # Compiled JavaScript
```

## 🚀 Development Commands

```bash
# Build and run
npm run build        # Compile TypeScript to dist/
npm start           # Run MCP server (stdio, InDesign mode)
MCP_APP_MODE=illustrator npm start # Run in Illustrator mode

# HTTP/HTTPS development
npm run dev:http    # Dev mode with HTTP + ngrok
npm run dev:https   # Dev mode with HTTPS + ngrok

# Testing and validation
npm test            # Run unit tests with Jest
npm run lint        # Run ESLint on TypeScript files
npm run typecheck   # Type check main code and tests

# Illustrator workflow testing
npx tsx src/illustrator/workflows/runWorkflowTests.ts --all
```

## 🖥️ Claude Desktop Integration

To make all InDesign and Illustrator tools available as native extensions in Claude Desktop:

**1. Build the Server**
```bash
npm run build
```

**2. Configure Claude Desktop**

Edit your `claude_desktop_config.json` file (usually in `~/Library/Application Support/Claude/` on macOS) and add the server configuration:

```json
{
  "mcpServers": {
    "indesign-mcp": {
      "command": "node",
      "args": ["/path/to/your/indesign-mcp/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**3. Prerequisites**
- Adobe InDesign or Illustrator must be running.
- A document should be open for most tools.
- Grant macOS automation permissions when prompted.
- Restart Claude Desktop after any configuration changes.

## ⚡ Core Development Patterns

### Tool Registration
All tools must be registered with the server and wrapped for telemetry.

```typescript
server.tool(name, schema, wrapToolForTelemetry(name, handler));
```

### ExtendScript Template Pattern
Use a `try/catch` block and manual JSON-like string building for reliable results.

```typescript
const extendScript = `
  try {
    if (!app.documents.length) throw new Error("No document open");
    var doc = app.activeDocument;
    // ... your logic ...
    var resultStr = "{\"success\":true}";
    resultStr;
  } catch (e) {
    var errorStr = "{\"success\":false,\"error\":\"" + e.message.replace(/\"/g, '\\ \\ \\'') + "\"}";
    errorStr;
  }
`;
```

## ⚠️ ExtendScript Best Practices & Pitfalls

### Critical Rules
1.  **String Building**: **NEVER** use `+=` for string concatenation in loops. It causes severe performance issues. **ALWAYS** use `array.join()`.
    ```javascript
    // ✅ CORRECT
    var parts = [];
    for (var i = 0; i < items.length; i++) {
      parts.push(items[i]);
    }
    var result = parts.join(",");
    ```
2.  **Booleans**: ExtendScript does not reliably handle TypeScript booleans. **ALWAYS** convert them to string literals: `"true"` or `"false"`.
3.  **JSON**: ExtendScript **lacks native `JSON` support**. You must build JSON-like strings manually or use the provided polyfill.
4.  **Newlines**: When passing strings in template literals, newlines must be double-escaped: `\n`.

### Common Pitfalls & Solutions
-   **`JSON is undefined` Error**: This is expected. Use manual string building or import `JSON2_POLYFILL` from `src/utils/json2-polyfill.js`.
-   **`progressLogger.log is not a function`**: The `progressLogger` can be undefined. Always provide a no-op fallback.
-   **Selection State Issues**: The selection can be empty or invalid. Your script should have fallback logic to get a working object if nothing is selected.
-   **Color Management**: 
    -   **Colors ARE Swatches**: Creating a color via `doc.colors.add()` automatically adds it to the swatches panel. **DO NOT** use `doc.swatches.add()`, which doesn't exist.
    -   **Transparency**: Use the nested `object.transparencySettings.blendingSettings.opacity` property, not a top-level `transparency` property.

## 🧪 Testing & Debugging

### Test Document Setup
Always have these documents ready for testing:
-   An **empty document**.
-   A **simple document** with 1-2 pages and basic content.
-   A **complex document** with multiple pages, threaded text frames, various styles, and placed images.

### Debugging Workflow
1.  **Compile & Type-Check**: Run `npm run build` and `npm run typecheck` first.
2.  **Run the Tool**: Execute the tool from your MCP client.
3.  **Check InDesign**: Visually inspect the result in the application.
4.  **Check Console**: Open InDesign's JavaScript Console (`Window → Utilities → JavaScript Console`) to see errors.
5.  **Add Debug Logs**: Add logging to your ExtendScript to trace execution flow and variable states. Return debug info in the error case for easier troubleshooting.

```javascript
// Example: Add debug checkpoints to your script
var debugSteps = [];
try {
  debugSteps.push("Started operation");
  var doc = app.activeDocument;
  debugSteps.push("Got document: " + doc.name);
  // ...
} catch (e) {
  var debugStr = "Debug: " + debugSteps.join(" | ") + " | Error: " + e.message;
  return debugStr; // Return debug string on failure
}
```

## 🔗 Key Files & Documentation

-   **Entry Points**: `src/index.ts`, `src/tools/index.ts`, `src/illustrator/index.ts`
-   **Testing**: `TESTING-GUIDE.md`, `src/illustrator/workflows/`, `src/experimental/evolutionary/`
-   **Project Status**: `PROJECT-STATUS.md`
-   **Setup**: `README.md`
-   **InDesign API**: The full ExtendScript API documentation is available in the `docs/` directory.

