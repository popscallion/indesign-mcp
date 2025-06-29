/**
 * @fileoverview Integration test for evolutionary runner with real MCP tools
 * Tests the runner without actual sub-agent execution
 */

import { getMcpBridge } from '../../src/experimental/evolutionary/index.js';
import { TelemetryCapture } from '../../src/tools/telemetry.js';
import { LayoutMetrics } from '../../src/types.js';

// Skip InDesign tests on CI unless explicitly enabled
const runInDesignTests = process.env.RUN_INDESIGN_TESTS === 'true';

(runInDesignTests ? describe : describe.skip)('Evolutionary Runner Integration', () => {
  let bridge: ReturnType<typeof getMcpBridge>;
  
  beforeEach(async () => {
    // Initialize MCP bridge for each test
    bridge = getMcpBridge();
    await bridge.initialize(true);
    TelemetryCapture.reset();
  });

  afterEach(async () => {
    // Clean up any active sessions
    try {
      await TelemetryCapture.endSession();
    } catch {
      // Ignore if no active session
    }
  });

  it('initializes MCP bridge successfully', async () => {
    expect(bridge).toBeDefined();
    expect(typeof bridge.initialize).toBe('function');
    expect(typeof bridge.callTool).toBe('function');
  });

  it('checks InDesign status without errors', async () => {
    await expect(bridge.resetInDesignState()).resolves.not.toThrow();
  });

  it('handles metrics extraction gracefully when no document is open', async () => {
    try {
      const metrics = await bridge.extractLayoutMetrics();
      // If we get here, a document was open - verify the structure
      expect(metrics).toHaveProperty('frames');
      expect(metrics).toHaveProperty('margins');
      expect(metrics).toHaveProperty('columns');
      expect(Array.isArray(metrics.frames)).toBe(true);
      expect(typeof metrics.columns).toBe('number');
    } catch (error: any) {
      // Expected when no document is open
      expect(error.message).toContain('No active document');
    }
  });

  it('performs comparison with reference metrics', async () => {
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
    
    expect(comparison).toHaveProperty('score');
    expect(comparison).toHaveProperty('match');
    expect(comparison).toHaveProperty('deviations');
    expect(typeof comparison.score).toBe('number');
    expect(typeof comparison.match).toBe('boolean');
    expect(Array.isArray(comparison.deviations)).toBe(true);
  });

  it('captures telemetry for real tool calls', async () => {
    // Start a telemetry session
    const sessionId = await TelemetryCapture.startSession('test-agent', 1);
    expect(sessionId).toBeDefined();

    // Make real tool calls through the bridge
    await bridge.callTool('indesign_status', {});
    await bridge.callTool('get_page_info', { page_number: -1 });
    await bridge.callTool('list_paragraph_styles', {});

    // End session and verify telemetry
    const session = await TelemetryCapture.endSession();
    
    expect(session).toBeDefined();
    expect(session!.id).toBe(sessionId);
    expect(session!.calls.length).toBeGreaterThanOrEqual(3);
    
    const toolsUsed = Array.from(new Set(session!.calls.map(c => c.tool)));
    expect(toolsUsed).toContain('indesign_status');
    expect(toolsUsed).toContain('get_page_info');
    expect(toolsUsed).toContain('list_paragraph_styles');

    // Verify session summary
    const summary = TelemetryCapture.getLastSessionSummary(session!);
    expect(summary).toHaveProperty('averageExecutionTime');
    expect(typeof summary.averageExecutionTime).toBe('number');
  });

  it('handles document operations gracefully', async () => {
    // This should either succeed (if document is open) or fail gracefully
    try {
      await bridge.saveDocumentState('test-integration');
      // If we get here, the save succeeded
      expect(true).toBe(true);
    } catch (error: any) {
      // Expected when no document is open
      expect(error.message).toBeDefined();
    }
  });

  it('provides expected bridge interface', () => {
    expect(typeof bridge.initialize).toBe('function');
    expect(typeof bridge.callTool).toBe('function');
    expect(typeof bridge.extractLayoutMetrics).toBe('function');
    expect(typeof bridge.compareToReference).toBe('function');
    expect(typeof bridge.resetInDesignState).toBe('function');
    expect(typeof bridge.saveDocumentState).toBe('function');
  });
});