/**
 * @fileoverview Test script for pattern analyzer
 * Tests pattern detection with mock telemetry data
 */

import { PatternAnalyzer, TestRun } from '../../src/experimental/evolutionary/index.js';
import { TelemetrySession } from '../../src/tools/telemetry.js';

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
        height: 648,
        hasText: true,
        contentLength: 500,
        overflows: false
      }],
      margins: { top: 72, left: 72, bottom: 72, right: 72 },
      columns: 1
    },
    comparisonResult: {
      match: score > 85,
      score,
      deviations: [
        {
          type: 'visual',
          field: 'fontSize',
          expected: 26,
          actual: 24,
          deviation: -7.7
        },
        {
          type: 'layout',
          field: 'alignment',
          expected: 'left',
          actual: 'center',
          deviation: 100
        }
      ]
    },
    duration: 5000,
    success: true
  };
}

/**
 * Test pattern analyzer
 */
async function testPatternAnalyzer() {
  console.log('=== Testing Pattern Analyzer ===\n');
  
  // Create test data with patterns
  const runs: TestRun[] = [
    createMockTestRun('agent-1', 65),
    createMockTestRun('agent-2', 68),
    createMockTestRun('agent-3', 62)
  ];
  
  // Add some errors to agent 3
  runs[2].telemetry.calls.push({
    timestamp: Date.now() + 300,
    tool: 'position_textframe',
    parameters: { x: -10, y: 50 },
    executionTime: 20,
    result: 'error',
    errorMessage: 'Invalid position: x cannot be negative'
  });
  
  // Initialize analyzer
  const analyzer = new PatternAnalyzer({
    minFrequency: 2,
    confidenceThreshold: 0.5
  });
  
  console.log('1. Analyzing patterns across 3 test runs...');
  const patterns = analyzer.analyzePatterns(runs);
  
  console.log(`\n✓ Found ${patterns.length} patterns\n`);
  
  // Display patterns
  console.log('2. Pattern Details:\n');
  
  patterns.forEach((pattern: any, index: number) => {
    console.log(`Pattern ${index + 1}:`);
    console.log(`  Type: ${pattern.type}`);
    console.log(`  Description: ${pattern.description}`);
    console.log(`  Frequency: ${pattern.frequency} occurrences`);
    console.log(`  Confidence: ${(pattern.confidence * 100).toFixed(1)}%`);
    console.log(`  Severity: ${pattern.severity}`);
    console.log(`  Examples: ${pattern.examples.length} agents affected`);
    console.log('');
  });
  
  // Test pattern grouping
  console.log('3. Testing Statistical Analysis...');
  
  const { StatisticalAnalysis } = await import('../../src/experimental/evolutionary/statisticalAnalysis.js');
  
  const groupedPatterns = StatisticalAnalysis.groupPatterns(patterns);
  console.log(`\n✓ Grouped patterns into ${groupedPatterns.size} categories`);
  
  groupedPatterns.forEach((group: any, key: any) => {
    console.log(`  - ${key}: ${group.length} patterns`);
  });
  
  // Test pattern presentation
  console.log('\n4. Testing Pattern Presenter...');
  
  const { PatternPresenter } = await import('../../src/experimental/evolutionary/patternPresenter.js');
  const presenter = new PatternPresenter();
  
  const analysis = await presenter.presentToClaudeForAnalysis(
    runs,
    patterns,
    'book-page.jpg',
    'Recreate academic book layout'
  );
  
  console.log(`\n✓ Generated pattern analysis:`);
  console.log(`  - Patterns: ${analysis.patterns.length}`);
  console.log(`  - Statistics: ${analysis.statistics.length}`);
  console.log(`  - Common failures: ${analysis.contextualInfo.commonFailurePoints.length}`);
  
  // Generate report
  console.log('\n5. Generating formatted report...\n');
  const report = presenter.generateReport(analysis);
  console.log('--- REPORT PREVIEW ---');
  console.log(report.split('\n').slice(0, 20).join('\n'));
  console.log('... (truncated)');
  
  console.log('\n✅ Pattern analyzer test completed successfully!');
}

// Run the test
testPatternAnalyzer().catch(console.error);