# InDesign MCP Server

TypeScript MCP server for Adobe InDesign automation via ExtendScript.

## Features

24 tools across 6 categories:
- **Text**: Add, update, remove, extract text
- **Styles**: Manage paragraph/character styles  
- **Layout**: Position and create text frames
- **Pages**: Add, remove, inspect pages
- **Special**: Insert characters, manage layers, create tables
- **Utility**: Text threading, overset resolution, frame info

## Requirements

- Node.js 18+
- Adobe InDesign (2023+)
- macOS

## Installation

```bash
npm install
npm run build
```

## Usage

Add to MCP client configuration:

```json
{
  "mcpServers": {
    "indesign": {
      "command": "node",
      "args": ["/path/to/indesign-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

## Development

```bash
npm run dev        # Development mode
npm run build      # Build for production
npm start          # Run built server
```

## License

MIT