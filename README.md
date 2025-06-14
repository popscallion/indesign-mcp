# InDesign MCP Server

An experimental MCP (Model Context Protocol) server for Adobe InDesign automation via ExtendScript. This is a work-in-progress proof of concept that allows AI assistants to interact with InDesign documents.

## Features

Currently implements 34 tools across 8 categories:

- **Text Operations** (4): Add, update, remove, and extract text content
- **Style Management** (7): Create and apply paragraph/character styles, text selection
- **Layout Control** (2): Position and create text frames with enhanced workflow guidance
- **Page Management** (3): Add, remove, inspect pages, get dimensions  
- **Document Operations** (5): Export, save, import content, place files
- **Object Transformation** (3): Transform, duplicate, and align objects
- **Special Features** (4): Insert characters, manage layers, create tables, status
- **Threading/Flow Tools** (6): Text threading, overset resolution, flow management, frame bounds inspection, property copying

## Requirements

- Node.js 18+
- Adobe InDesign (tested with 2025 v20.3.1)
- macOS (ExtendScript automation via AppleScript)

## Setup

```bash
npm install
npm run build
npm start
```

## Usage

Add to your MCP client configuration:

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

Make sure InDesign is running with a document open before using the tools.

## Development

```bash
npm run build      # Compile TypeScript
npm start          # Run the server
npm run dev        # Development mode (if available)
```

## Status

This is an experimental project. Some tools may have limitations or edge cases. Contributions and feedback welcome.

## License

MIT