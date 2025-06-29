/**
 * @fileoverview Jest tests for telemetry infrastructure
 */

import { expect, describe, it, beforeEach, afterEach, jest } from '@jest/globals';
import * as os from 'os';
import * as path from 'path';
import { TelemetryCapture } from '../../src/tools/telemetry.js';
import { TelemetryPersistence } from '../../src/tools/telemetryPersistence.js';
import { setTelemetryEnabled, wrapToolForTelemetry } from '../../src/tools/index.js';

describe('Telemetry Infrastructure', () => {
  beforeEach(async () => {
    // Reset telemetry state
    setTelemetryEnabled(true);
    TelemetryCapture.reset();
    // Use fake timers for faster tests
    jest.useFakeTimers();
  });

  afterEach(() => {
    setTelemetryEnabled(false);
    TelemetryCapture.reset();
    // Restore real timers
    jest.useRealTimers();
  });

  it('captures tool calls correctly', async () => {
    // Start a session
    const _sessionId = await TelemetryCapture.startSession('test-agent', 0);
    expect(_sessionId).toBeDefined();
    expect(typeof _sessionId).toBe('string');
    
    // Create a mock tool handler
    const mockAddTextTool = async (args: { text: string; position: string }) => {
      // Simulate some work with fake timers
      const promise = new Promise(resolve => setTimeout(resolve, 10));
      jest.runOnlyPendingTimers();
      await promise;
      return {
        content: [{
          type: 'text',
          text: `Added text: ${args.text}`
        }]
      };
    };
    
    // Wrap the tool with telemetry
    const wrappedTool = wrapToolForTelemetry('add_text', mockAddTextTool);
    
    // Call the wrapped tool multiple times
    await wrappedTool({ text: 'Hello World', position: 'start' });
    await wrappedTool({ text: 'Test Text', position: 'end' });
    
    // End session
    const session = await TelemetryCapture.endSession();
    
    // Verify session data
    expect(session).toBeTruthy();
    expect(session?.calls.length).toBe(2);
    expect(session?.agentId).toBe('test-agent');
    expect(session?.generation).toBe(0);
    
    // Verify call details
    const calls = session?.calls || [];
    expect(calls[0].tool).toBe('add_text');
    expect(calls[0].parameters).toEqual({ text: 'Hello World', position: 'start' });
    expect(calls[0].result).toBe('success');
    expect(calls[0].executionTime).toBeGreaterThan(0);
    
    expect(calls[1].tool).toBe('add_text');
    expect(calls[1].parameters).toEqual({ text: 'Test Text', position: 'end' });
    expect(calls[1].result).toBe('success');
  });

  it('handles tool errors correctly', async () => {
    const _sessionId = await TelemetryCapture.startSession('test-agent', 0);
    
    // Create a tool that throws an error
    const errorTool = async () => {
      throw new Error('Simulated error');
    };
    
    const wrappedErrorTool = wrapToolForTelemetry('error_tool', errorTool);
    
    // Call the tool and expect it to throw
    await expect(wrappedErrorTool({})).rejects.toThrow('Simulated error');
    
    const session = await TelemetryCapture.endSession();
    
    // Verify error was captured
    expect(session?.calls.length).toBe(1);
    expect(session?.calls[0].tool).toBe('error_tool');
    expect(session?.calls[0].result).toBe('error');
    expect(session?.calls[0].errorMessage).toBe('Simulated error');
  });

  it('generates telemetry summary correctly', async () => {
    const _sessionId = await TelemetryCapture.startSession('test-agent', 0);
    
    const mockTool = async () => ({ content: [{ type: 'text', text: 'success' }] });
    const wrappedTool = wrapToolForTelemetry('test_tool', mockTool);
    
    // Make multiple calls
    await wrappedTool({});
    await wrappedTool({});
    
    const session = await TelemetryCapture.endSession();
    const summary = TelemetryCapture.getLastSessionSummary(session!);
    
    expect(summary.totalCalls).toBe(2);
    expect(summary.toolUsage).toEqual({ test_tool: 2 });
    expect(summary.errorRate).toBe(0);
    expect(summary.averageExecutionTime).toBeGreaterThanOrEqual(0);
  });

  it('persists and loads sessions', async () => {
    const _sessionId = await TelemetryCapture.startSession('test-agent', 0);
    
    const mockTool = async () => ({ content: [{ type: 'text', text: 'test' }] });
    const wrappedTool = wrapToolForTelemetry('persistence_test', mockTool);
    await wrappedTool({});
    
    const session = await TelemetryCapture.endSession();
    
    // Test persistence
    const persistence = new TelemetryPersistence({
      baseDir: path.join(os.tmpdir(), 'evolution_tests', 'telemetry')
    });
    
    await persistence.saveSession(session!);
    const loadedSession = await persistence.loadSession(session!.id);
    
    expect(loadedSession).toBeTruthy();
    expect(loadedSession?.id).toBe(session?.id);
    expect(loadedSession?.calls.length).toBe(1);
    expect(loadedSession?.calls[0].tool).toBe('persistence_test');
  });

  it('handles disabled telemetry gracefully', async () => {
    // Disable telemetry
    setTelemetryEnabled(false);
    
    const mockTool = async () => ({ content: [{ type: 'text', text: 'works' }] });
    const wrappedTool = wrapToolForTelemetry('disabled_test', mockTool);
    
    const result = await wrappedTool({});
    
    // Tool should work normally
    expect(result).toEqual({ content: [{ type: 'text', text: 'works' }] });
    
    // No telemetry should be captured
    const calls = TelemetryCapture.getCalls();
    expect(calls.length).toBe(0);
  });
});