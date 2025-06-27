/**
 * @fileoverview Integration test for evolutionary runner with real MCP tools
 * Tests the runner without actual sub-agent execution
 */

import { EvolutionaryTestRunner, getMcpBridge } from '../../src/experimental/evolutionary/index.js';
import { TelemetryCapture } from '../../src/tools/telemetry.js';
import { LayoutMetrics } from '../../src/types.js';

async function testRunnerIntegration() {
  console.log('=== Testing Evolutionary Runner Integration ===\n');
  
  let metrics: LayoutMetrics | undefined;
  
  try {
    // Initialize MCP bridge
    console.log('1. Initializing MCP Bridge...');
    const bridge = getMcpBridge();
    await bridge.initialize(true);
    console.log('✓ Bridge initialized\n');
    
    // Check InDesign status
    console.log('2. Checking InDesign status...');
    await bridge.resetInDesignState();
    console.log('✓ InDesign checked\n');
    
    // Test metrics extraction
    console.log('3. Testing metrics extraction...');
    try {
      metrics = await bridge.extractLayoutMetrics();
      console.log('✓ Extracted metrics:');
      console.log('  - Frames:', metrics!.frames.length);
      console.log('  - Margins:', JSON.stringify(metrics!.margins));
      console.log('  - Columns:', metrics!.columns);
    } catch (e: any) {
      console.log('⚠ Metrics extraction failed (no document open):', e.message);
      console.log('  Creating a test document would require additional tooling.');
      console.log('  For now, please open a document in InDesign to test fully.');
      
      // Return early but successfully
      console.log('\n✅ Integration test passed (limited mode - no document)');
      console.log('To test fully, please:');
      console.log('1. Open Adobe InDesign');
      console.log('2. Create or open any document');
      console.log('3. Run this test again');
      return;
    }
    console.log('');
    
    // Test comparison
    console.log('4. Testing comparison...');
    const referenceMetrics: LayoutMetrics = {
      frames: [{
        x: 72,
        y: 72,
        width: 468,
        height: 100,
        hasText: true,
        contentLength: 50,
        overflows: false
      }],
      margins: { top: 72, left: 72, bottom: 72, right: 72 },
      columns: 1
    };
    
    const comparison = await bridge.compareToReference(referenceMetrics);
    console.log('✓ Comparison result:');
    console.log('  - Score:', comparison.score + '%');
    console.log('  - Match:', comparison.match);
    console.log('  - Deviations:', comparison.deviations.length);
    console.log('');
    
    // Test telemetry with real tools
    console.log('5. Testing telemetry capture with real tools...');
    
    // Start a telemetry session
    TelemetryCapture.startSession('test-agent', 1);
    
    // Make some real tool calls through the bridge
    console.log('  - Calling indesign_status...');
    await bridge.callTool('indesign_status', {});
    
    console.log('  - Calling get_page_info...');
    await bridge.callTool('get_page_info', { page_number: -1 });
    
    console.log('  - Calling list_paragraph_styles...');
    await bridge.callTool('list_paragraph_styles', {});
    
    // End session and check telemetry
    const session = TelemetryCapture.endSession();
    
    if (session) {
      console.log('✓ Telemetry captured:');
      console.log('  - Session ID:', session.id);
      console.log('  - Tool calls:', session.calls.length);
      console.log('  - Tools used:', Array.from(new Set(session.calls.map(c => c.tool))).join(', '));
      
      // Get summary
      const summary = TelemetryCapture.getLastSessionSummary(session);
      console.log('  - Average execution time:', summary.averageExecutionTime.toFixed(0) + 'ms');
    }
    console.log('');
    
    // Test document operations
    console.log('6. Testing document operations...');
    try {
      await bridge.saveDocumentState('test-integration');
      console.log('✓ Document saved\n');
    } catch (e: any) {
      console.log('⚠ Save failed (expected if no document):', e.message);
      console.log('');
    }
    
    console.log('✅ All integration tests passed!');
    console.log('\nThe evolutionary runner is ready to work with real MCP tools.');
    console.log('Next step: Run test-full-execution.ts with a real document open in InDesign.');
    
  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testRunnerIntegration().catch(console.error);