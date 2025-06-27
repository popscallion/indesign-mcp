# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# InDesign MCP Server

## 🎯 Project Overview
Building an **AI-driven InDesign automation platform** using TypeScript MCP (Model Context Protocol) server that bridges LLMs with Adobe InDesign via ExtendScript.

**Current State**: Production-ready TypeScript MCP with 36 working tools + foundational resources/prompts
**Goal**: Complete agentic workflow platform for two MVP scenarios:
1. **Copy-Design** – Recreate reference page layouts from images
2. **Add-Content** – Flow new text into existing documents while preserving design

## 📌 Current Development Focus
All core functionality is complete. Current challenge: **Improving LLM Decision-Making**

### Primary Challenge
**LLM Tool Usage Optimization**: While all MCP tools execute successfully, LLMs often make poor strategic decisions about which tools to use, when to use them, and with what parameters. This results in layouts that diverge from reference images despite technical success.

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
npm start           # Run MCP server (uses tsx)
npm run dev         # Development mode with watch

# Testing and validation
npm test            # Run unit tests with Jest
npm run lint        # Run ESLint on TypeScript files
npm run lint:fix    # Auto-fix ESLint issues

# Validation
npm run build && npm start    # Validate compilation and server startup

# Evolutionary Testing (Task-based)
npx tsx src/experimental/evolutionary/example-task-workflow.ts  # See example workflow
# Actual testing is done interactively using Claude Code's Task tool
```

## 📋 Git Workflow

### Current Setup
- **Repository**: `indesign-mcp` on GitHub
- **Main Branch**: `main` (35 working tools)
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

### Testing Requirements
- Test each tool with empty document and complex document
- Verify no regressions in existing 35 tools
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

### ✅ Completed (36 tools)
- **Text Tools** (4): add_text, update_text, remove_text, get_document_text
- **Style Tools** (8): paragraph/character style management, text selection
- **Layout Tools** (3): text frame positioning, creation, and info
- **Page Tools** (4): page management, dimensions
- **Special Tools** (4): layers, tables, special characters, status
- **Threading/Flow Tools** (7): text threading, overset resolution, flow management, close_document
- **Export/Import Tools** (6): document export, save, import content, place files, preview
- **Transform Tools** (3): object transformation, duplication, alignment

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
```bash
npm run build && npm start
# Ensure InDesign is running with a document open
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
- `utility/` - Threading, flow management (6 tools)
- `export/` - Document export/import (6 tools) 
- `transform/` - Object transformation (3 tools)

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

### Key Components
- **Telemetry**: Captures all tool calls with parameters
- **SubAgents**: Uses Task tool to run real Claude instances
- **Pattern Analysis**: Identifies common failure patterns
- **Claude Code Analysis**: Direct pattern interpretation and improvement generation

### Usage
See `EVOLUTIONARY-TEST-PROGRESS.md` for detailed implementation status and `src/experimental/evolutionary/README-TASK-BASED.md` for the complete usage guide.

This guide provides Claude Code with essential project context for continuing InDesign MCP development efficiently.