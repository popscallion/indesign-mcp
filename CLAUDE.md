# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# InDesign MCP Server

## 🎯 Project Overview
Building an **AI-driven InDesign automation platform** using TypeScript MCP (Model Context Protocol) server that bridges LLMs with Adobe InDesign via ExtendScript.

**Current State**: Production-ready TypeScript MCP with 52+ working tools across 10 categories + telemetry system + evolutionary testing framework
**Goal**: Complete agentic workflow platform for two MVP scenarios:
1. **Copy-Design** – Recreate reference page layouts from images
2. **Add-Content** – Flow new text into existing documents while preserving design

## 📌 Current Development Focus
All core functionality is complete. Current challenge: **Improving LLM Decision-Making**

### Primary Challenge
**LLM Tool Usage Optimization**: While all MCP tools execute successfully, LLMs often make poor strategic decisions about which tools to use, when to use them, and with what parameters. This results in layouts that diverge from reference images despite technical success.

**Important Context**: We use minimal Task agent prompts to expose MCP deficiencies. However, we must acknowledge that:
- Some tasks may be fundamentally impossible without prompt engineering
- The MCP might have inherent limitations that can't be overcome
- Low scores don't necessarily mean the system is broken
- Success might require accepting some level of additional context

The goal is to push the MCP as far as possible while being realistic about constraints.

### Active Work Areas
1. **Evolutionary Testing System** (✅ Complete - Task-based): Built infrastructure using Claude Code's Task tool
2. **Pattern Analysis** (✅ Complete): Algorithms to identify common failure patterns in tool usage
3. **Improvement Generation** (✅ Complete): Claude Code directly analyzes patterns and proposes improvements
4. **Evolution Loop** (✅ Complete): Semi-automated testing with Claude Code orchestration

## 📁 Project Structure
```
indesign-mcp/                    # Main TypeScript MCP project
├── src/
│   ├── index.ts                 # Server entry point
│   ├── extendscript.ts          # AppleScript-ExtendScript bridge
│   ├── types.ts                 # TypeScript type definitions
│   ├── tools/                   # Tool implementations (8 categories)
│   │   ├── telemetry.ts         # Telemetry capture system
│   │   ├── telemetryPersistence.ts  # Telemetry file storage
│   │   └── telemetryServer.ts   # Telemetry-enabled server
│   └── prompts/                 # Strategic workflow prompts
├── src/experimental/
│   └── evolutionary/            # Evolutionary testing system (Task-based)
│       ├── taskBasedRunner.ts   # Task tool integration
│       ├── patternAnalyzer.ts   # Pattern detection
│       ├── claudeAnalyzer.ts    # Claude Code analysis
│       └── example-task-workflow.ts  # Usage example
├── docs/                        # Documentation and API references
│   └── InDesign ExtendScript_API_Adob_InDesign_2025/  # Complete InDesign API docs
├── dist/                        # Compiled JavaScript
└── package.json                 # Dependencies & scripts
```

## Development Commands

```bash
# Build and run
npm run build        # Compile TypeScript to dist/
npm start           # Run MCP server (stdio transport)
npm start:http      # Run MCP server (HTTP transport)
npm run dev         # Development mode with watch (stdio)
npm run dev:http    # Development mode with HTTP + ngrok

# Testing and validation
npm test            # Run unit tests with Jest
npm run lint        # Run ESLint on TypeScript files
npm run lint:fix    # Auto-fix ESLint issues
npm run typecheck   # Type check both main code and tests
npm run build:tests # Compile test TypeScript separately

# Validation workflow
npm run build && npm start    # Validate compilation and server startup

# HTTP Server with ngrok
MCP_PORT=3000 ENABLE_NGROK=true npm run start:http  # Custom port with ngrok
ENABLE_NGROK=false npm run start:http               # Local HTTP only
NGROK_AUTH_TOKEN=your_token npm run start:http     # Authenticated ngrok tunnel

# Evolutionary Testing (Task-based)
npx tsx src/experimental/evolutionary/runEvolutionTest.ts  # Run the test orchestrator
# Actual testing is done interactively using Claude Code's Task tool
```

## 🖥️ Claude Desktop Integration

### Configure as Desktop Extension

To make all 52+ InDesign MCP tools available in Claude Desktop as native extensions:

**Step 1: Build the Server**
```bash
npm run build        # Compile TypeScript to dist/
```

**Step 2: Configure Claude Desktop**

Edit the Claude Desktop configuration file:
```bash
# macOS location
~/Library/Application Support/Claude/claude_desktop_config.json
```

Add this configuration:
```json
{
  "mcpServers": {
    "indesign-mcp": {
      "command": "node",
      "args": ["/Users/l/Dev/indesign-mcp/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Step 3: Prerequisites & Usage**
- Adobe InDesign must be running on macOS
- Document should be open in InDesign (for most tools)
- Grant macOS automation permissions when prompted
- Restart Claude Desktop after configuration changes

**Alternative Configurations:**

Development mode with live reloading:
```json
{
  "mcpServers": {
    "indesign-mcp-dev": {
      "command": "npx",
      "args": ["tsx", "watch", "/Users/l/Dev/indesign-mcp/src/index.ts"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

**Available Tool Categories in Claude Desktop:**
- **Text Tools (4)**: add_text, update_text, remove_text, get_document_text
- **Style Tools (9)**: paragraph/character style management, fonts, text selection
- **Layout Tools (2)**: text frame positioning and creation
- **Page Tools (4)**: page management, dimensions, navigation
- **Special Tools (4)**: layers, tables, special characters, status
- **Utility Tools (7)**: text threading, overset resolution, frame management
- **Export Tools (6)**: document export, save, import, place files, preview
- **Transform Tools (3)**: object transformation, duplication, alignment
- **Composite Tools (7)**: high-level workflow automation
- **Analysis Tools (7)**: decision tracking, metrics, layout comparison

Once configured, all tools become available as native Claude Desktop extensions through natural conversation.

## 📋 Git Workflow

### Current Setup
- **Repository**: `indesign-mcp` on GitHub
- **Main Branch**: `main` (52 working tools)
- **Development**: Feature branches for tier implementation

### Branch Strategy
```bash
# Create feature branch for new implementation
git checkout -b tier1-export-import
git commit -m "Start Tier 1: Document Export/Import implementation"

# Regular commits during development
git add .
git commit -m "Implement [tool1, tool2, tool3] - Tier 1 batch 1"

# Merge when tier is complete
git checkout main
git merge tier1-export-import
git push origin main
```

### Commit Conventions
- **Feature**: `"Implement [tool_names] - Tier X batch Y"`
- **Fix**: `"Fix threading tool error handling"`
- **Refactor**: `"Refactor ExtendScript template generation"`
- **Test**: `"Add integration tests for export tools"`

## Architecture Overview

This MCP server bridges AI assistants with Adobe InDesign via **ExtendScript automation through AppleScript**. Key architectural components:

### Core Flow
1. **MCP Tool Call** → TypeScript handler in `src/tools/*/index.ts`
2. **ExtendScript Generation** → Template literals create JSX code
3. **AppleScript Execution** → `src/extendscript.ts` runs JSX via AppleScript
4. **InDesign Processing** → ExtendScript manipulates document
5. **Result Return** → JSON response back through MCP

### Critical Technical Constraints

**ExtendScript Stability Requirements**:
- **String Building**: Use `array.join()`, never `+=` concatenation
- **Boolean Conversion**: TypeScript `true`/`false` → ExtendScript `"true"`/`"false"` strings
- **Newline Escaping**: Use `\\\\n` in template literals (double-escaped)
- **Error Handling**: Wrap all ExtendScript in try/catch blocks

**TypeScript MCP Patterns**:
- **Tool Registration**: `server.tool(name, description, schema, handler)`
- **Type Safety**: All parameters defined in `src/types.ts` interfaces
- **Async Execution**: All handlers use `async/await` with proper error handling

**Telemetry Architecture**:
- **Always-Wrapped Tools**: All tools are pre-wrapped with telemetry capability
- **Runtime Control**: Telemetry can be dynamically enabled/disabled via `set_environment_variable`
- **Zero Overhead**: When disabled, telemetry wrapper adds only one boolean check per tool call
- **File-Based Capture**: Telemetry writes to JSONL files for evolutionary testing analysis

### Testing Requirements
- Test each tool with empty document and complex document
- Verify no regressions in existing 52 tools
- Integration testing for cross-tool workflows

## 🧪 Testing Strategy

### Integration Testing (Primary Focus)
**Manual Test Protocol** (after each 3-tool batch):
1. **Tool Functionality**: Each new tool with valid parameters
2. **Error Handling**: Invalid parameters, empty documents
3. **Regression Check**: Quick test of 3-4 existing tools
4. **Cross-Tool Flow**: Test tools that work together

### Test Document Requirements
Keep these test documents ready:
- **Empty document**: New InDesign file
- **Simple content**: 1-2 pages with text and basic formatting
- **Complex document**: Multi-page with threading, styles, images

### Error Threshold Guidelines

**Continue Debugging When**:
- Single tool fails but others in batch work
- ExtendScript syntax errors (fixable patterns)
- Type errors caught by TypeScript compiler
- Parameter validation issues

**Stop and Ask When**:
- Multiple tools in same batch fail with similar errors
- Server won't start/compile after changes
- Fundamental architecture questions arise
- ExtendScript execution consistently times out
- Breaking changes affect existing tools

**Time-Based Threshold**:
- Single tool debugging: 15 minutes max
- Batch-level issues: 30 minutes max
- Architecture problems: Stop immediately

### InDesign Version
- **Target**: Latest InDesign version (currently running locally)
- **Compatibility**: Focus on current version, expand later if needed

## 📊 Implementation Status

### ✅ Completed (52+ tools across 10 categories)
- **Text Tools** (4): add_text, update_text, remove_text, get_document_text
- **Style Tools** (7): paragraph/character style management, text selection
- **Layout Tools** (2): text frame positioning, creation, and info
- **Page Tools** (3): page management, dimensions
- **Special Tools** (4): layers, tables, special characters, status
- **Utility Tools** (7): text threading, overset resolution, flow management, close_document
- **Export Tools** (6): document export, save, import content, place files, preview
- **Transform Tools** (3): object transformation, duplication, alignment
- **Composite Tools** (7): high-level workflow automation and layout operations
- **Analysis Tools** (7): decision tracking, metrics extraction, and layout comparison

### 🎯 Current Priority: LLM Decision-Making Optimization
1. **Automated testing loops**: Reduce manual validation overhead
2. **Decision pattern analysis**: Identify common LLM mistakes in tool usage
3. **Enhanced validation rules**: Catch layout problems before they cascade
4. **Prompt refinement**: Guide LLMs toward better strategic decisions

### Future Enhancements
Focus areas for potential expansion:
1. **Advanced Text Operations**: find/replace, spell check, typography
2. **Image Management**: image processing, effects, color management
3. **Print Production**: color separation, preflighting, packaging

### 📋 Documentation Guide
- **InDesign API Reference** (`docs/InDesign ExtendScript_API_Adob_InDesign_2025/`): Complete Adobe InDesign 2025 ExtendScript API documentation for method signatures, parameters, and examples

## ⚡ Quick Reference

### Start Development Session

**Stdio Transport (Traditional MCP)**:
```bash
npm run build && npm start
# Ensure InDesign is running with a document open
```

**HTTP Transport with Ngrok (Web Access)**:
```bash
npm run build && npm run start:http
# Automatically creates HTTPS tunnel via ngrok
# Outputs: https://xyz123.ngrok.app/mcp
```

### Before Implementing New Tools
1. Read both documentation files for context
2. Review existing tool patterns in `src/tools/*/index.ts`
3. Create feature branch
4. Implement in 3-tool batches
5. Test thoroughly before committing

### Key Files to Understand

**Core Infrastructure**:
- `src/index.ts` - MCP server entry point and configuration
- `src/tools/index.ts` - Central tool registration (8 categories)
- `src/prompts/index.ts` - Strategic workflow prompts for intelligent automation
- `src/extendscript.ts` - AppleScript→ExtendScript bridge with app detection
- `src/types.ts` - TypeScript interfaces for all tool parameters

**Tool Implementation Pattern** (examine for new tools):
- `src/tools/text/index.ts` - Complete tool category example with 4 tools
- `src/tools/export/index.ts` - Recent Tier 1 implementation patterns

**Tool Categories** (organized in `src/tools/`):
- `text/` - Core text manipulation (4 tools)
- `styles/` - Character/paragraph styles (7 tools) 
- `layout/` - Text frame positioning (2 tools)
- `pages/` - Page management (3 tools)
- `special/` - Layers, tables, special chars (4 tools)
- `utility/` - Threading, flow management (7 tools)
- `export/` - Document export/import (6 tools) 
- `transform/` - Object transformation (3 tools)
- `composite/` - High-level workflow tools (7 tools)
- `analysis/` - Decision tracking and metrics (7 tools)

## 🔄 Development Cycle
1. **Plan**: Select 3 tools from priority list
2. **Implement**: Follow TypeScript patterns, 15-20 min
3. **Test**: Build, restart server, validate tools, 10 min
4. **Commit**: Document working state
5. **Repeat**: Move to next 3 tools

## 🧬 Evolutionary Testing System

### Overview
The evolutionary testing system automatically improves MCP tool descriptions based on empirical observation of LLM behavior. It runs multiple agents, captures telemetry, analyzes patterns, and evolves better tool descriptions.

### Current Status
- **Phase 1-5**: ✅ Complete
- **Architecture**: Simplified Task-based approach using Claude Code
- **Cost**: Zero API costs - uses Task tool only
- **O3 Fixes**: ✅ All critical issues resolved (config fallback, document safety, telemetry robustness)
- **Telemetry Architecture**: ✅ Fixed dynamic enable/disable capability with always-wrapped tools

### Quick Start Guides
For running the evolutionary testing system:
- **Quick Start Guide**: `EVOLUTIONARY-TEST-QUICKSTART.md` - Comprehensive step-by-step instructions
- **Checklist**: `EVOLUTIONARY-TEST-CHECKLIST.md` - Concise reference for quick execution

### Key Components
- **Telemetry**: Captures all tool calls with parameters (now with retry logic and queue management)
- **SubAgents**: Uses Task tool to run real Claude instances
- **Pattern Analysis**: Identifies common failure patterns
- **Claude Code Analysis**: Direct pattern interpretation and improvement generation

### Usage
1. Start with the quick start guide for practical instructions
2. Use the checklist for rapid execution
3. See `EVOLUTIONARY-TEST-PROGRESS.md` for implementation details
4. Reference `src/experimental/evolutionary/README-TASK-BASED.md` for conceptual overview

### **⚠️ Critical Operational Requirements**
- **Timeout Configuration**: Use `timeout 7m` for evolution commands (default 2min is insufficient)
- **Single Instance Rule**: Create ONE evolution instance, never multiple competing `node -e` processes
- **Never Skip processAgentCompletion()**: Contains document reset logic and fallback telemetry
- **Environment Variables**: `TELEMETRY_WAIT_TIMEOUT` configures telemetry collection timeout (default 5min)

### **Quick Troubleshooting**
- Command timeout after 2min → Use `timeout 7m node -e "..."`
- No telemetry found → System has fallback, still call `processAgentCompletion()`
- Document contamination → Indicates `processAgentCompletion()` was skipped

**Note on Minimal Prompts**: Task agents receive only "Recreate this academic book page layout in InDesign using the available MCP tools" plus a reference. This intentionally minimal approach:
- Avoids telling agents they're being tested (Hawthorne effect)
- Exposes true MCP usability issues without masking them
- Tests natural tool discovery without hand-holding
- Reveals where the MCP needs improvement

## 🌐 HTTP Server & Ngrok Integration

### Overview
The InDesign MCP server supports two transport modes:

1. **Stdio Transport** (default): Traditional MCP over stdin/stdout for local clients
2. **HTTP Transport**: Server-Sent Events (SSE) over HTTP with automatic ngrok tunneling

### HTTP Server Features
- **SSE Transport**: Real-time bidirectional communication over HTTP
- **Automatic Ngrok Integration**: Instant HTTPS public URLs for remote access
- **CORS Support**: Cross-origin requests for web clients
- **Health Monitoring**: Built-in health check and status endpoints
- **Session Management**: Multi-client support with session isolation
- **Environment Configuration**: Port and ngrok settings via environment variables

### HTTP Endpoints
```
GET  /mcp          # Establish SSE connection for MCP communication
POST /mcp/message  # Send JSON-RPC messages to MCP server
GET  /health       # Server health check and active session count
GET  /info         # API documentation and usage information
```

### Usage Examples

**Quick Development (with ngrok)**:
```bash
npm run dev:http                    # Starts on port 3000 with ngrok
npm run dev:http 4000              # Custom port with ngrok
```

**Production Configuration**:
```bash
# Environment variables
export MCP_PORT=3000                # Server port (default: 3000)
export ENABLE_NGROK=true           # Enable ngrok tunneling (default: true)
export NGROK_AUTH_TOKEN=your_token # Optional: authenticated tunnels
export CORS_ORIGIN="*"             # CORS policy (default: *)

npm run start:http
```

**Local Development (no ngrok)**:
```bash
ENABLE_NGROK=false npm run start:http
# Access at: http://localhost:3000/mcp
```

### Client Integration
The HTTP server uses SSE transport which requires:

1. **Connection**: GET request to `/mcp` establishes SSE stream
2. **Messaging**: POST requests to `/mcp/message?session=<id>` send messages  
3. **Session ID**: Returned in SSE connection, used for message routing

### Ngrok Configuration
- **Public Tunnels**: Work without authentication (rate limited)
- **Authenticated Tunnels**: Set `NGROK_AUTH_TOKEN` for higher limits
- **Custom Domains**: Configure via ngrok account settings
- **Tunnel URLs**: Automatically logged to console on startup

### Security Considerations
- CORS headers configurable via `CORS_ORIGIN` environment variable
- Session-based message routing prevents cross-session data leakage
- Ngrok tunnels are temporary and expire when server stops
- Use authenticated ngrok tokens for production workloads

This guide provides Claude Code with essential project context for continuing InDesign MCP development efficiently.