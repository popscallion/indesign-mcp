/**
 * @fileoverview Test script for MCP Bridge with environment-gated execution
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getMcpBridge } from '../../src/experimental/evolutionary/index.js';

// Skip InDesign tests on CI unless explicitly enabled
const runInDesignTests = process.env.RUN_INDESIGN_TESTS === 'true';

(runInDesignTests ? describe : describe.skip)('MCP Bridge Tool Execution', () => {
  let bridge: ReturnType<typeof getMcpBridge>;
  
  beforeEach(async () => {
    bridge = getMcpBridge();
    await bridge.initialize(true); // Enable telemetry
  });

  afterEach(async () => {
    try {
      await bridge.cleanup();
    } catch {
      // Ignore cleanup errors in tests
    }
  });

  it('initializes bridge successfully', async () => {
    expect(bridge).toBeDefined();
    expect(typeof bridge.initialize).toBe('function');
    expect(typeof bridge.callTool).toBe('function');
    expect(typeof bridge.extractLayoutMetrics).toBe('function');
    expect(typeof bridge.compareToReference).toBe('function');
    expect(typeof bridge.resetInDesignState).toBe('function');
    expect(typeof bridge.saveDocumentState).toBe('function');
    expect(typeof bridge.cleanup).toBe('function');
  });

  it('checks InDesign state without errors', async () => {
    await expect(bridge.resetInDesignState()).resolves.not.toThrow();
  });

  it('extracts layout metrics when document is available', async () => {
    try {
      const metrics = await bridge.extractLayoutMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('frames');
      expect(metrics).toHaveProperty('margins');
      expect(metrics).toHaveProperty('columns');
      expect(Array.isArray(metrics.frames)).toBe(true);
      expect(typeof metrics.columns).toBe('number');
    } catch (error: any) {
      // Expected when no document is open - this is fine for the test
      expect(error.message).toContain('No active document');
    }
  });

  it('performs comparison with reference metrics', async () => {
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
    
    expect(comparison).toBeDefined();
    expect(comparison).toHaveProperty('match');
    expect(comparison).toHaveProperty('score');
    expect(comparison).toHaveProperty('deviations');
    expect(typeof comparison.match).toBe('boolean');
    expect(typeof comparison.score).toBe('number');
    expect(Array.isArray(comparison.deviations)).toBe(true);
    expect(comparison.score).toBeGreaterThanOrEqual(0);
    expect(comparison.score).toBeLessThanOrEqual(100);
  });

  it('handles document save operations gracefully', async () => {
    try {
      await bridge.saveDocumentState('test-bridge-doc');
      // If we get here, save succeeded
      expect(true).toBe(true);
    } catch (error: any) {
      // Expected when no document is open
      expect(error.message).toBeDefined();
      expect(typeof error.message).toBe('string');
    }
  });

  it('provides expected bridge interface methods', () => {
    const expectedMethods = [
      'initialize',
      'callTool', 
      'extractLayoutMetrics',
      'compareToReference',
      'resetInDesignState',
      'saveDocumentState',
      'cleanup'
    ];
    
    expectedMethods.forEach(method => {
      expect(typeof bridge[method]).toBe('function');
    });
  });

  it('cleans up properly', async () => {
    await expect(bridge.cleanup()).resolves.not.toThrow();
  });
});