/**
 * @fileoverview Test script to verify telemetry session ownership changes
 */

import { createSubAgentExecutor } from '../../src/experimental/evolutionary/index.js';
import { TelemetryCapture } from '../../src/tools/telemetry.js';
import { setTelemetryEnabled } from '../../src/tools/index.js';

async function testSessionOwnership() {
  console.log('Testing session ownership...\n');
  
  // Enable telemetry
  setTelemetryEnabled(true);
  
  // Create executor
  const executor = createSubAgentExecutor();
  
  // Verify no session is active
  console.log('Initial state - active session:', TelemetryCapture.getAllSessions().length);
  
  // Execute a mock agent
  console.log('\nExecuting agent...');
  const result = await executor.execute({
    agentId: 'test-agent-1',
    generation: 1,
    prompt: 'Test prompt',
    timeoutMs: 5000
  });
  
  console.log('\nExecution result:');
  console.log('- Success:', result.success);
  console.log('- Duration:', result.duration + 'ms');
  console.log('- Has telemetry:', !!result.telemetry);
  
  if (result.telemetry) {
    console.log('- Telemetry session ID:', result.telemetry.id);
    console.log('- Tool calls:', result.telemetry.calls.length);
    
    // Get summary
    const summary = TelemetryCapture.getLastSessionSummary(result.telemetry);
    console.log('\nTelemetry summary:');
    console.log('- Total calls:', summary.totalCalls);
    console.log('- Tool usage:', summary.toolUsage);
  }
  
  // Verify no active session after execution
  const activeSessions = TelemetryCapture.getAllSessions();
  console.log('\nAfter execution - stored sessions:', activeSessions.length);
  
  // Test error case
  console.log('\n--- Testing error case ---');
  
  const errorExecutor = createSubAgentExecutor();
  
  // Override to simulate error
  errorExecutor.on('log', (msg) => {
    if (msg.includes('Executing agent')) {
      throw new Error('Simulated agent error');
    }
  });
  
  try {
    const errorResult = await errorExecutor.execute({
      agentId: 'error-agent',
      generation: 1,
      prompt: 'Error test',
      timeoutMs: 1000
    });
    
    console.log('\nError case result:');
    console.log('- Success:', errorResult.success);
    console.log('- Error:', errorResult.error);
    console.log('- Has telemetry:', !!errorResult.telemetry);
    
    if (errorResult.telemetry) {
      console.log('- Session ended properly:', !!errorResult.telemetry.endTime);
    }
  } catch (e) {
    console.log('Caught error:', e);
  }
  
  console.log('\nSession ownership test complete!');
}

// Run the test
testSessionOwnership().catch(console.error);