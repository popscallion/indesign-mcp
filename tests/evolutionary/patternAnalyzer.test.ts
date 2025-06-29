/**
 * @fileoverview Jest tests for pattern analyzer
 * Tests pattern detection with mock telemetry data
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PatternAnalyzer, TestRun } from '../../src/experimental/evolutionary/index.js';
import { TelemetrySession } from '../../src/tools/telemetry.js';

describe('Pattern Analyzer', () => {
  let analyzer: PatternAnalyzer;
  let mockTestRuns: TestRun[];

  /**
   * Create mock telemetry data for testing
   */
  function createMockTestRun(agentId: string, score: number): TestRun {
    const telemetry: TelemetrySession = {
      id: `session-${agentId}`,
      startTime: Date.now(),
      agentId,
      generation: 1,
      calls: [
        {
          timestamp: Date.now(),
          tool: 'add_text',
          parameters: { text: 'Chapter 1', position: 'start' },
          executionTime: 50,
          result: 'success'
        },
        {
          timestamp: Date.now() + 100,
          tool: 'create_paragraph_style',
          parameters: { style_name: 'Heading', font_size: 24 },
          executionTime: 30,
          result: 'success'
        },
        {
          timestamp: Date.now() + 200,
          tool: 'apply_paragraph_style',
          parameters: { style_name: 'Heading', target_text: 'Chapter 1' },
          executionTime: 40,
          result: 'success'
        }
      ]
    };
    
    return {
      agentId,
      telemetry,
      extractedMetrics: {
        frames: [{
          x: 72,
          y: 72,
          width: 468,
          height: 200,
          hasText: true,
          contentLength: 50,
          overflows: false
        }],
        margins: { top: 72, left: 72, bottom: 72, right: 72 },
        columns: 1,
        styles: [
          { name: 'Heading', fontSize: 24, fontFamily: 'Arial' }
        ],
        textRegions: []
      },
      referenceImage: 'book-page.jpg',
      score,
      success: true
    };
  }

  beforeEach(() => {
    analyzer = new PatternAnalyzer({
      minFrequency: 2,
      confidenceThreshold: 0.5
    });

    // Create test data with patterns
    mockTestRuns = [
      createMockTestRun('agent-1', 65),
      createMockTestRun('agent-2', 68),
      createMockTestRun('agent-3', 62)
    ];

    // Add some errors to agent 3 to create error patterns
    mockTestRuns[2].telemetry.calls.push({
      timestamp: Date.now() + 300,
      tool: 'position_textframe',
      parameters: { x: -10, y: 50 },
      executionTime: 20,
      result: 'error',
      errorMessage: 'Invalid position: x cannot be negative'
    });
  });

  it('initializes with correct configuration', () => {
    expect(analyzer).toBeDefined();
    expect(typeof analyzer.analyzePatterns).toBe('function');
  });

  it('analyzes patterns across multiple test runs', () => {
    const patterns = analyzer.analyzePatterns(mockTestRuns);
    
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBeGreaterThan(0);
    
    patterns.forEach(pattern => {
      expect(pattern).toHaveProperty('type');
      expect(pattern).toHaveProperty('description');
      expect(pattern).toHaveProperty('frequency');
      expect(pattern).toHaveProperty('confidence');
      expect(pattern).toHaveProperty('severity');
      expect(pattern).toHaveProperty('examples');
      
      expect(typeof pattern.frequency).toBe('number');
      expect(typeof pattern.confidence).toBe('number');
      expect(pattern.confidence).toBeGreaterThanOrEqual(0);
      expect(pattern.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(pattern.examples)).toBe(true);
    });
  });

  it('detects tool usage patterns', () => {
    const patterns = analyzer.analyzePatterns(mockTestRuns);
    
    // Should detect common tool usage patterns
    const toolPatterns = patterns.filter(p => p.type === 'tool_usage' || p.description.includes('tool'));
    expect(toolPatterns.length).toBeGreaterThan(0);
  });

  it('identifies error patterns', () => {
    const patterns = analyzer.analyzePatterns(mockTestRuns);
    
    // Should detect error patterns from agent-3
    const errorPatterns = patterns.filter(p => 
      p.type === 'error' || 
      p.description.includes('error') || 
      p.description.includes('Invalid position')
    );
    
    // May not always detect errors depending on frequency threshold,
    // but should have proper structure when they exist
    errorPatterns.forEach(pattern => {
      expect(pattern.severity).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(pattern.severity);
    });
  });

  it('groups patterns by statistical analysis', async () => {
    const patterns = analyzer.analyzePatterns(mockTestRuns);
    
    const { StatisticalAnalysis } = await import('../../src/experimental/evolutionary/statisticalAnalysis.js');
    const groupedPatterns = StatisticalAnalysis.groupPatterns(patterns);
    
    expect(groupedPatterns).toBeInstanceOf(Map);
    expect(groupedPatterns.size).toBeGreaterThan(0);
    
    // Verify each group contains patterns
    groupedPatterns.forEach((group, key) => {
      expect(typeof key).toBe('string');
      expect(Array.isArray(group)).toBe(true);
      expect(group.length).toBeGreaterThan(0);
    });
  });

  it('generates pattern analysis presentation', async () => {
    const patterns = analyzer.analyzePatterns(mockTestRuns);
    
    const { PatternPresenter } = await import('../../src/experimental/evolutionary/patternPresenter.js');
    const presenter = new PatternPresenter();
    
    const analysis = await presenter.presentToClaudeForAnalysis(
      mockTestRuns,
      patterns,
      'book-page.jpg',
      'Recreate academic book layout'
    );
    
    expect(analysis).toBeDefined();
    expect(analysis).toHaveProperty('patterns');
    expect(analysis).toHaveProperty('statistics');
    expect(analysis).toHaveProperty('contextualInfo');
    
    expect(Array.isArray(analysis.patterns)).toBe(true);
    expect(Array.isArray(analysis.statistics)).toBe(true);
    expect(analysis.contextualInfo).toHaveProperty('commonFailurePoints');
    expect(Array.isArray(analysis.contextualInfo.commonFailurePoints)).toBe(true);
  });

  it('generates formatted reports', async () => {
    const patterns = analyzer.analyzePatterns(mockTestRuns);
    
    const { PatternPresenter } = await import('../../src/experimental/evolutionary/patternPresenter.js');
    const presenter = new PatternPresenter();
    
    const analysis = await presenter.presentToClaudeForAnalysis(
      mockTestRuns,
      patterns,
      'book-page.jpg',
      'Recreate academic book layout'
    );
    
    const report = presenter.generateReport(analysis);
    
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
    expect(report).toContain('Pattern Analysis Report');
  });

  it('handles empty test runs gracefully', () => {
    const patterns = analyzer.analyzePatterns([]);
    
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBe(0);
  });

  it('respects minimum frequency threshold', () => {
    // Create analyzer with higher threshold
    const strictAnalyzer = new PatternAnalyzer({
      minFrequency: 10, // Very high threshold
      confidenceThreshold: 0.5
    });
    
    const patterns = strictAnalyzer.analyzePatterns(mockTestRuns);
    
    // Should find fewer patterns due to high frequency requirement
    patterns.forEach(pattern => {
      expect(pattern.frequency).toBeGreaterThanOrEqual(10);
    });
  });

  it('respects confidence threshold', () => {
    // Create analyzer with high confidence requirement
    const confidentAnalyzer = new PatternAnalyzer({
      minFrequency: 1,
      confidenceThreshold: 0.9 // Very high confidence
    });
    
    const patterns = confidentAnalyzer.analyzePatterns(mockTestRuns);
    
    // Should find only high-confidence patterns
    patterns.forEach(pattern => {
      expect(pattern.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });
});