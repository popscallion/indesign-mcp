/**
 * @fileoverview Test/example for Task-based evolutionary workflow
 * 
 * This file demonstrates how to set up the Task-based system.
 * It CANNOT run the full evolution because only Claude Code can invoke Task tool.
 * Use this to verify the system initializes correctly.
 */

import { createTaskBasedRunner } from './taskBasedRunner.js';
import { PatternAnalyzer } from './patternAnalyzer.js';
import { ClaudeAnalyzer } from './claudeAnalyzer.js';
import { ToolModifier } from './toolModifier.js';
import { TestConfig, TestRun, Pattern } from './types.js';
import { LayoutMetrics } from '../../types.js';

/**
 * Reference metrics for book page layout
 */
const BOOK_PAGE_REFERENCE: LayoutMetrics = {
  frames: [
    {
      x: 72,
      y: 72,
      width: 468,
      height: 40,
      hasText: true,
      contentLength: 50,
      overflows: false
    },
    {
      x: 72,
      y: 130,
      width: 468,
      height: 590,
      hasText: true,
      contentLength: 1200,
      overflows: false
    }
  ],
  margins: {
    top: 72,
    left: 72,
    bottom: 72,
    right: 72
  },
  columns: 1,
  styles: [
    {
      name: "Heading",
      fontSize: 24,
      fontFamily: "Minion Pro"
    },
    {
      name: "Body",
      fontSize: 11,
      fontFamily: "Minion Pro"
    }
  ],
  textRegions: []
};

/**
 * Test initialization and setup
 */
async function testTaskBasedSetup() {
  console.log('=== Task-Based Evolutionary Testing Setup ===\n');
  
  try {
    // Initialize components
    console.log('1. Initializing Task-based runner...');
    const runner = createTaskBasedRunner();
    await runner.initialize();
    console.log('✓ Runner initialized\n');
    
    // Create pattern analyzer
    console.log('2. Creating pattern analyzer...');
    const patternAnalyzer = new PatternAnalyzer();
    console.log('✓ Pattern analyzer ready\n');
    
    // Create Claude analyzer
    console.log('3. Creating Claude analyzer...');
    const claudeAnalyzer = new ClaudeAnalyzer();
    console.log('✓ Claude analyzer ready\n');
    
    // Create tool modifier
    console.log('4. Creating tool modifier...');
    const toolModifier = new ToolModifier();
    console.log('✓ Tool modifier ready\n');
    
    // Test configuration
    const config: TestConfig = {
      testCase: 'book-page-test',
      agentCount: 3,
      generation: 1,
      maxGenerations: 5,
      targetScore: 85,
      improvementThreshold: 5,
      referenceMetrics: BOOK_PAGE_REFERENCE,
      referenceImage: 'tests/decision-analysis/reference-images/book-page.jpg',
      referenceDescription: 'Academic book page with heading and body text'
    };
    
    // Generate example prompt
    console.log('5. Generating example Task prompt...');
    const sessionId = runner.generateSessionId('test-agent-1', 1);
    const examplePrompt = runner.createTaskPrompt(config, 'test-agent-1', sessionId);
    console.log('✓ Task prompt generated\n');
    
    console.log('Example Task Prompt:');
    console.log('---');
    console.log(examplePrompt);
    console.log('---\n');
    console.log('Note: This minimal prompt intentionally avoids hand-holding to test MCP usability\n');
    
    // Simulate what would happen after Task completion
    console.log('6. Testing post-Task workflow...');
    console.log('   (This simulates what happens after Claude Code runs Task tool)\n');
    
    // Create mock run data
    const mockRun: TestRun = {
      agentId: 'test-agent-1',
      telemetry: {
        id: 'test-session-1',
        startTime: Date.now() - 60000,
        endTime: Date.now(),
        agentId: 'test-agent-1',
        generation: 1,
        calls: []
      },
      extractedMetrics: {
        frames: [
          {
            x: 72,
            y: 72,
            width: 468,
            height: 35, // Slightly wrong
            hasText: true,
            contentLength: 45,
            overflows: false
          }
        ],
        margins: { top: 72, left: 72, bottom: 72, right: 72 },
        columns: 1,
        styles: [],
        textRegions: []
      },
      comparisonResult: {
        match: false,
        score: 75,
        deviations: [
          { field: 'frame_height', expected: 40, actual: 35, deviation: 12.5, type: 'frame' }
        ]
      },
      duration: 60000,
      success: true
    };
    
    // Test pattern analysis
    console.log('7. Testing pattern analysis...');
    const patterns = patternAnalyzer.analyzePatterns([mockRun]);
    console.log(`✓ Found ${patterns.length} patterns\n`);
    
    // Test report generation
    console.log('8. Testing report generation...');
    const report = await claudeAnalyzer.formatPatternAnalysis(
      [mockRun],
      patterns,
      config.referenceImage,
      config.testCase
    );
    console.log('✓ Report generated\n');
    
    console.log('Report Preview (first 300 chars):');
    console.log('---');
    console.log(report.substring(0, 300) + '...');
    console.log('---\n');
    
    console.log('✅ All components initialized successfully!\n');
    
    console.log('Next Steps for Claude Code:');
    console.log('1. Use Task tool to run actual agents');
    console.log('2. Collect metrics after each Task completes');
    console.log('3. Analyze patterns across multiple runs');
    console.log('4. Generate and apply improvements');
    console.log('5. Test improvements with new Task agents\n');
    
    console.log('See README-CLAUDE-CODE-WORKFLOW.md for detailed instructions.');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the test if called directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
  testTaskBasedSetup().catch(console.error);
}

export { testTaskBasedSetup };