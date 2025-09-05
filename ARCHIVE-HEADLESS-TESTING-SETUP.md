# Headless Server Setup for Visual Testing with Peekaboo

## Overview

This guide explains how to set up and run the InDesign MCP server on a headless macOS server with Peekaboo visual testing capabilities.

## Prerequisites

- **macOS server** (InDesign requirement)
- **Adobe InDesign** installed and licensed
- **Node.js 18+** 
- **VNC server** or Screen Sharing for maintaining active desktop session
- **Ngrok account** (optional, for public URL access)

## Architecture

```
Headless macOS Server
├── InDesign (via VNC/Screen Sharing)
├── InDesign MCP Server (HTTP mode)
├── Peekaboo CLI (for visual analysis)
└── Remote Access (ngrok tunnel)
```

## Installation Steps

### 1. Enable Screen Sharing (macOS)

```bash
# Enable Screen Sharing via command line
sudo defaults write /var/db/launchd.db/com.apple.launchd/overrides.plist com.apple.screensharing -dict Disabled -bool false

# Or enable via System Preferences:
# System Preferences → Sharing → Screen Sharing ✓
```

### 2. Install InDesign MCP Server

```bash
# Clone repository
git clone https://github.com/your-org/indesign-mcp.git
cd indesign-mcp

# Install dependencies
npm install

# Build the server
npm run build
```

### 3. Install Peekaboo

```bash
# Install Peekaboo MCP globally
npm install -g @steipete/peekaboo-mcp

# Verify installation
peekaboo --version
```

### 4. Configure Environment Variables

Create a `.env` file or export these variables:

```bash
# Peekaboo Configuration
export PEEKABOO_AI_PROVIDER=anthropic
export PEEKABOO_AI_MODEL=claude-3-5-sonnet
export PEEKABOO_AI_KEY=your-api-key

# Enable visual testing
export ENABLE_VISUAL_TESTING=true

# Ngrok (optional)
export NGROK_AUTH_TOKEN=your-ngrok-token
```

## Running the Server

### Option 1: VNC Session (Recommended)

1. **Connect via VNC** to maintain active desktop:
```bash
# From local machine
vnc://your-server-ip:5900
```

2. **Start InDesign** and open a document

3. **Start MCP server** in HTTP mode:
```bash
cd indesign-mcp
npm run start:http
```

The server will output an ngrok URL like: `https://xyz123.ngrok.app/mcp`

### Option 2: SSH with Screen/Tmux

1. **SSH to server**:
```bash
ssh user@your-server-ip
```

2. **Start screen session**:
```bash
screen -S indesign-mcp
```

3. **Launch InDesign** (requires active desktop):
```bash
open -a "Adobe InDesign 2025"
```

4. **Start MCP server**:
```bash
cd indesign-mcp
npm run start:http
```

5. **Detach screen**: `Ctrl-A D`

## Testing Visual Capabilities

### 1. Quick Test

```bash
# Test that Peekaboo is working
peekaboo image --analyze "What do you see?" --app "Adobe InDesign"

# Test MCP server health
curl https://your-ngrok-url.ngrok.app/health
```

### 2. Run Evolution Test with Visual Testing

```bash
# Enable visual testing
export ENABLE_VISUAL_TESTING=true

# Run evolutionary test
npx tsx src/experimental/evolutionary/runEvolutionTest.ts
```

### 3. Manual Visual Test

```javascript
// test-visual.js
import { createPeekabooAnalyzer } from './dist/experimental/visual-testing/peekabooAnalyzer.js';
import { getMcpBridge } from './dist/experimental/evolutionary/mcpBridge.js';

async function testVisual() {
  const bridge = getMcpBridge();
  await bridge.initialize();
  await bridge.enableVisualTesting();
  
  // Create some content
  await bridge.callTool('add_text', {
    text: 'Test Heading',
    position: { x: 100, y: 100 }
  });
  
  // Compare with visual analysis
  const result = await bridge.compareWithVisualAnalysis(
    referenceMetrics,
    'tests/reference-images/sample.png'
  );
  
  console.log('Visual similarity:', result.visualSimilarity);
}

testVisual();
```

## Troubleshooting

### "No active desktop" error

InDesign requires an active desktop session to run ExtendScript. Solutions:
1. Use VNC instead of SSH
2. Keep a VNC session connected
3. Use a virtual display (experimental)

### Peekaboo not found

```bash
# Check installation
which peekaboo

# Reinstall if needed
npm install -g @steipete/peekaboo-mcp
```

### InDesign not responding

```bash
# Check if InDesign is running
ps aux | grep InDesign

# Force quit if hung
killall "Adobe InDesign 2025"
```

### Ngrok tunnel expires

Free ngrok tunnels expire after 2 hours. For persistent tunnels:
1. Create ngrok account
2. Get auth token
3. Set `NGROK_AUTH_TOKEN` environment variable

## Performance Optimization

### 1. Preview Quality Settings

```javascript
// For faster testing, use lower DPI
quality: 'preview'  // 72 DPI - fastest
quality: 'medium'   // 150 DPI - balanced
quality: 'high'     // 300 DPI - most accurate
```

### 2. Caching

The `preview_document` tool caches previews for 5 minutes. Reuse previews when possible.

### 3. Batch Processing

Process multiple layouts in sequence to amortize InDesign startup time:

```bash
for file in layouts/*.json; do
  npm run test:layout -- "$file"
done
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Visual Testing

on: [push, pull_request]

jobs:
  test:
    runs-on: macos-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        npm install
        npm install -g @steipete/peekaboo-mcp
    
    - name: Build MCP server
      run: npm run build
    
    - name: Run visual tests
      env:
        ENABLE_VISUAL_TESTING: true
        PEEKABOO_AI_PROVIDER: anthropic
        PEEKABOO_AI_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      run: npm run test:visual
```

## Security Considerations

1. **API Keys**: Store securely, never commit to repository
2. **VNC Access**: Use strong passwords and consider VPN
3. **Ngrok URLs**: Treat as sensitive, rotate regularly
4. **InDesign Documents**: Clear sensitive data after tests

## Next Steps

1. Test the setup with sample layouts
2. Configure CI/CD pipeline
3. Set up monitoring and alerts
4. Document team-specific workflows