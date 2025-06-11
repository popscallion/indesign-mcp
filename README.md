# InDesign MCP Server

An experimental MCP (Model Context Protocol) server for Adobe InDesign automation via ExtendScript. This is a work-in-progress proof of concept that allows AI assistants to interact with InDesign documents.

## Features

Currently implements 32 tools across 8 categories:

- **Text Operations**: Add, update, remove, and extract text content
- **Style Management**: Create and apply paragraph/character styles
- **Layout Control**: Position and create text frames
- **Page Management**: Add, remove, and inspect pages
- **Document Operations**: Export, save, import content, place files
- **Object Transformation**: Transform, duplicate, and align objects
- **Special Features**: Insert characters, manage layers, create tables
- **Utility Functions**: Text threading, overset resolution, frame inspection

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