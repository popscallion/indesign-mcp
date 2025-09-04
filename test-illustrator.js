#!/usr/bin/env node

// Quick test script for Illustrator MCP tools
const { spawn } = require('child_process');

// Test 1: Check document status
console.log('Testing Illustrator connection...\n');

const testCommands = [
  {
    name: 'read_illustrator_document',
    args: {}
  },
  {
    name: 'create_shape_primitive',
    args: {
      shapeType: 'rectangle',
      width: 100,
      height: 100,
      position: { x: 200, y: 200 },
      fillColor: { r: 255, g: 0, b: 0 }
    }
  },
  {
    name: 'select_elements',
    args: {
      selectionType: 'all'
    }
  }
];

async function testTool(toolName, args) {
  return new Promise((resolve) => {
    const message = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      },
      id: Date.now()
    };

    console.log(`\n📋 Testing: ${toolName}`);
    console.log('Request:', JSON.stringify(args, null, 2));
    
    // Start the MCP server process
    const mcp = spawn('npx', ['tsx', 'dist/index.js'], {
      env: { ...process.env, MCP_APP_MODE: 'illustrator' }
    });

    let response = '';

    mcp.stdout.on('data', (data) => {
      response += data.toString();
      // Look for complete JSON response
      if (response.includes('"result"') && response.includes('}')) {
        try {
          const lines = response.split('\n');
          for (const line of lines) {
            if (line.includes('"result"')) {
              const result = JSON.parse(line);
              console.log('✅ Success:', result.result?.content?.[0]?.text || 'Tool executed');
              mcp.kill();
              resolve(true);
              return;
            }
          }
        } catch (e) {
          // Continue accumulating
        }
      }
    });

    mcp.stderr.on('data', (data) => {
      console.error('❌ Error:', data.toString());
    });

    // Send the request
    mcp.stdin.write(JSON.stringify(message) + '\n');

    // Timeout after 5 seconds
    setTimeout(() => {
      console.log('⏱️ Timeout - no response');
      mcp.kill();
      resolve(false);
    }, 5000);
  });
}

async function runTests() {
  console.log('🎨 Illustrator MCP Tool Testing');
  console.log('================================\n');
  console.log('Make sure:');
  console.log('1. Adobe Illustrator is running');
  console.log('2. You have a document open (or create a new one)');
  console.log('3. The MCP server is NOT already running\n');
  
  console.log('Press Ctrl+C to stop at any time.\n');

  for (const test of testCommands) {
    await testTool(test.name, test.args);
    // Wait a bit between tests
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n✅ Basic tests complete!');
  console.log('If you saw errors, check that Illustrator is running and has a document open.');
}

runTests().catch(console.error);