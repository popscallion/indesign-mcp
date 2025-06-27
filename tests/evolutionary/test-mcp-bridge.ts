/**
 * @fileoverview Test script for MCP Bridge with real tool execution
 */

import { getMcpBridge } from '../../src/experimental/evolutionary/index.js';

async function testMcpBridge() {
  console.log('Testing MCP Bridge with real tools...\n');
  
  const bridge = getMcpBridge();
  
  try {
    // Initialize the bridge
    console.log('1. Initializing MCP Bridge...');
    await bridge.initialize(true); // Enable telemetry
    console.log('✓ Bridge initialized\n');
    
    // Test InDesign status
    console.log('2. Testing InDesign status...');
    await bridge.resetInDesignState();
    console.log('✓ InDesign state checked\n');
    
    // Test layout metrics extraction
    console.log('3. Testing extract_layout_metrics...');
    const metrics = await bridge.extractLayoutMetrics();
    console.log('✓ Extracted metrics:', metrics);
    console.log('');
    
    // Test comparison with dummy reference
    console.log('4. Testing compare_to_reference...');
    const referenceMetrics = {
      frames: [{
        x: 72,
        y: 72,
        width: 400,
        height: 200,
        hasText: true,
        contentLength: 100,
        overflows: false
      }],
      margins: { top: 36, left: 36, bottom: 36, right: 36 },
      columns: 1
    };
    
    const comparison = await bridge.compareToReference(referenceMetrics);
    console.log('✓ Comparison result:');
    console.log('  - Match:', comparison.match);
    console.log('  - Score:', comparison.score + '%');
    console.log('  - Deviations:', comparison.deviations.length);
    console.log('');
    
    // Test document save
    console.log('5. Testing save_document...');
    try {
      await bridge.saveDocumentState('test-bridge-doc');
      console.log('✓ Document saved\n');
    } catch (e: any) {
      console.log('⚠ Save failed (expected if no document open):', e.message);
      console.log('');
    }
    
    // Test cleanup
    console.log('6. Cleaning up...');
    await bridge.cleanup();
    console.log('✓ Bridge cleaned up\n');
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMcpBridge().catch(console.error);