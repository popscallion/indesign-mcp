/**
 * @fileoverview Simple test script to verify telemetry infrastructure
 */

import { TelemetryCapture } from '../../src/tools/telemetry.js';
import { TelemetryPersistence } from '../../src/tools/telemetryPersistence.js';
import { setTelemetryEnabled, wrapToolForTelemetry } from '../../src/tools/index.js';

async function testTelemetry() {
  console.log('Testing telemetry infrastructure...\n');
  
  // Enable telemetry
  setTelemetryEnabled(true);
  
  // Start a session
  const sessionId = TelemetryCapture.startSession('test-agent', 0);
  console.log(`Started session: ${sessionId}`);
  
  // Create a mock tool handler
  const mockAddTextTool = async (args: { text: string; position: string }) => {
    console.log(`Mock tool called with: ${args.text}`);
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      content: [{
        type: 'text',
        text: `Added text: ${args.text}`
      }]
    };
  };
  
  // Wrap the tool with telemetry
  const wrappedTool = wrapToolForTelemetry('add_text', mockAddTextTool);
  
  // Call the tool a few times
  console.log('\nMaking tool calls...');
  
  try {
    await wrappedTool({ text: 'Hello World', position: 'end' });
    await wrappedTool({ text: 'Second line', position: 'end' });
    
    // Simulate an error
    const errorTool = wrapToolForTelemetry('error_test', async () => {
      throw new Error('Simulated error');
    });
    
    try {
      await errorTool({});
    } catch (e) {
      console.log('Caught expected error');
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
  
  // End session
  const session = TelemetryCapture.endSession();
  console.log(`\nEnded session with ${session?.calls.length} calls`);
  
  // Get summary for the ended session
  if (session) {
    const summary = TelemetryCapture.getLastSessionSummary(session);
    console.log('\nTelemetry Summary:');
    console.log(`- Total calls: ${summary.totalCalls}`);
    console.log(`- Tool usage:`, summary.toolUsage);
    console.log(`- Error rate: ${(summary.errorRate * 100).toFixed(1)}%`);
    console.log(`- Average execution time: ${summary.averageExecutionTime.toFixed(0)}ms`);
  }
  
  // Test persistence
  console.log('\nTesting persistence...');
  const persistence = new TelemetryPersistence();
  
  if (session) {
    const savedPath = await persistence.saveSession(session);
    console.log(`Session saved to: ${savedPath}`);
    
    // List sessions
    const sessions = await persistence.listSessions();
    console.log(`\nFound ${sessions.length} saved sessions`);
    
    // Export all data
    const exportPath = '/tmp/evolution_tests/telemetry_export.json';
    await persistence.exportAll(exportPath);
    console.log(`\nExported all telemetry to: ${exportPath}`);
  }
  
  console.log('\nTelemetry test complete!');
}

// Run the test
testTelemetry().catch(console.error);