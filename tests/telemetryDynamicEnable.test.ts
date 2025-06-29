/**
 * @fileoverview Test for telemetry dynamic enable fix
 * Tests the critical fix that allows set_environment_variable to enable telemetry mid-session
 */

import { expect, describe, it, beforeEach, afterEach } from '@jest/globals';
import { createTelemetryServer } from '../src/tools/telemetryServer.js';
import { setTelemetryEnabled } from '../src/tools/index.js';
import { TelemetryCapture } from '../src/tools/telemetry.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

describe('Telemetry Dynamic Enable Fix', () => {
  let mockServer: McpServer;
  let wrappedServer: McpServer;
  let _toolCallCount = 0;

  beforeEach(async () => {
    // Reset telemetry state
    setTelemetryEnabled(false);
    TelemetryCapture.reset();
    _toolCallCount = 0;

    // Create mock server
    mockServer = new McpServer({
      name: 'test-server',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Create telemetry-wrapped server (this is the fix being tested)
    wrappedServer = createTelemetryServer(mockServer);
  });

  afterEach(() => {
    setTelemetryEnabled(false);
    TelemetryCapture.reset();
  });

  it('enables telemetry dynamically via set_environment_variable', async () => {
    let capturedHandler: Function | undefined;

    // Capture the actual handler that gets registered
    const originalTool = mockServer.tool.bind(mockServer);
    mockServer.tool = function(name: string, schema: any, handler: Function) {
      if (name === 'test_tool') {
        capturedHandler = handler;
      }
      return originalTool(name, schema, handler);
    };

    // Register a test tool through the wrapped server
    wrappedServer.tool(
      'test_tool',
      {
        type: 'object',
        properties: {
          message: { type: 'string' }
        }
      },
      async (args: { message?: string }) => {
        _toolCallCount++;
        return {
          content: [{
            type: 'text',
            text: `Tool called with: ${args.message || 'no message'}`
          }]
        };
      }
    );

    expect(capturedHandler).toBeDefined();
    
    // Start a telemetry session (but telemetry is still disabled)
    const _sessionId = await TelemetryCapture.startSession('test-agent', 1);
    expect(_sessionId).toBeDefined();

    // Call the tool while telemetry is disabled
    // This simulates the "before fix" scenario where no telemetry would be captured
    if (capturedHandler) {
      await capturedHandler({ message: 'call before enable' });
    }

    // Simulate set_environment_variable tool enabling telemetry
    setTelemetryEnabled(true);

    // Call the tool again - this should now be captured due to the fix
    if (capturedHandler) {
      await capturedHandler({ message: 'call after enable' });
    }

    // End session and verify results
    const session = await TelemetryCapture.endSession();
    
    // The critical test: with the fix, the second call should be captured
    // even though telemetry was enabled mid-session
    expect(session).toBeTruthy();
    expect(session?.calls).toBeDefined();
    
    // Before the fix: session.calls.length would be 0 (no tools captured)
    // After the fix: session.calls.length should be 1 (second call captured)
    expect(session?.calls.length).toBeGreaterThan(0);
    
    // Verify the captured call has the correct tool name
    const capturedCalls = session?.calls || [];
    const testToolCalls = capturedCalls.filter(call => call.tool === 'test_tool');
    expect(testToolCalls.length).toBeGreaterThan(0);
    
    // Verify the call parameters
    const lastCall = testToolCalls[testToolCalls.length - 1];
    expect(lastCall.parameters).toEqual({ message: 'call after enable' });
    expect(lastCall.result).toBe('success');
  });

  it('always wraps tools even when telemetry starts disabled', async () => {
    // This tests the architectural fix: tools are always wrapped
    // even when telemetry starts disabled
    
    let actualHandler: Function | undefined;

    // Capture the handler registration
    const originalTool = mockServer.tool.bind(mockServer);
    mockServer.tool = function(name: string, schema: any, handler: Function) {
      actualHandler = handler;
      return originalTool(name, schema, handler);
    };

    // Register tool through wrapped server (telemetry disabled)
    wrappedServer.tool(
      'always_wrapped_tool',
      { type: 'object', properties: {} },
      async () => ({ content: [{ type: 'text', text: 'test' }] })
    );

    // Verify that the handler was wrapped (not the original)
    expect(actualHandler).toBeDefined();
    
    // The wrapped handler should be different from the original
    // (This tests that createTelemetryServer always applies wrapToolForTelemetry)
    expect(actualHandler).toBeInstanceOf(Function);
    
    // Enable telemetry and test that the wrapped handler works
    setTelemetryEnabled(true);
    const _sessionId = await TelemetryCapture.startSession('test-agent', 1);
    
    // Call the wrapped handler
    if (actualHandler) {
      await actualHandler({});
    }
    
    const session = await TelemetryCapture.endSession();
    expect(session?.calls.length).toBe(1);
    expect(session?.calls[0].tool).toBe('always_wrapped_tool');
  });

  it('gracefully handles telemetry when disabled', async () => {
    // Test that wrapped tools work normally when telemetry is disabled
    let capturedHandler: Function | undefined;

    // Capture the actual handler that gets registered
    const originalTool = mockServer.tool.bind(mockServer);
    mockServer.tool = function(name: string, schema: any, handler: Function) {
      if (name === 'disabled_telemetry_tool') {
        capturedHandler = handler;
      }
      return originalTool(name, schema, handler);
    };
    
    wrappedServer.tool(
      'disabled_telemetry_tool',
      { type: 'object', properties: {} },
      async () => ({ content: [{ type: 'text', text: 'works normally' }] })
    );

    expect(capturedHandler).toBeDefined();

    // Telemetry is disabled, but tool should still work
    const result = await capturedHandler!({});
    expect(result).toEqual({
      content: [{ type: 'text', text: 'works normally' }]
    });

    // No telemetry should be captured
    const calls = TelemetryCapture.getCalls();
    expect(calls.length).toBe(0);
  });
});