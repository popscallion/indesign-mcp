/**
 * @fileoverview Full execution test for evolutionary testing system
 * Tests the complete flow with real MCP tools and sub-agent execution
 */

import { EvolutionaryTestRunner, TestConfig } from '../../src/experimental/evolutionary/index.js';
import { LayoutMetrics } from '../../src/types.js';

// Sample reference metrics for testing
// In production, these would come from analyzing a reference image
const SAMPLE_REFERENCE_METRICS: LayoutMetrics = {
  frames: [
    {
      x: 72,
      y: 72,
      width: 468,
      height: 100,
      hasText: true,
      contentLength: 50,
      overflows: false
    },
    {
      x: 72,
      y: 200,
      width: 468,
      height: 400,
      hasText: true,
      contentLength: 500,
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
      fontFamily: "Helvetica"
    },
    {
      name: "Body",
      fontSize: 12,
      fontFamily: "Helvetica"
    }
  ],
  textRegions: []
};

async function runFullTest() {
  console.log('=== Evolutionary Testing System - Full Execution Test ===\n');
  
  const runner = new EvolutionaryTestRunner();
  
  try {
    // Initialize the runner
    console.log('Initializing test runner...');
    await runner.initialize();
    console.log('✓ Runner initialized\n');
    
    // Test configuration
    const config: TestConfig = {
      testCase: 'sample-layout',
      agentCount: 2, // Just 2 agents for testing
      generation: 1,
      maxGenerations: 5,
      targetScore: 85,
      improvementThreshold: 5,
      referenceMetrics: SAMPLE_REFERENCE_METRICS,
      referenceImage: '/path/to/reference/image.png'
    };
    
    console.log('Test Configuration:');
    console.log(`- Test case: ${config.testCase}`);
    console.log(`- Agents per generation: ${config.agentCount}`);
    console.log(`- Target score: ${config.targetScore}%`);
    console.log(`- Reference has ${config.referenceMetrics.frames.length} frames\n`);
    
    // Note about InDesign requirement
    console.log('⚠️  IMPORTANT: Please ensure:');
    console.log('1. Adobe InDesign is running');
    console.log('2. A document is open (any document)');
    console.log('3. The document will be modified during testing\n');
    
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Run a generation
    console.log('\nStarting generation run...');
    const result = await runner.runGeneration(config);
    
    // Display results
    console.log('\n=== Generation Results ===');
    console.log(`Generation: ${result.generation}`);
    console.log(`Average Score: ${result.averageScore.toFixed(1)}%`);
    console.log(`Best Score: ${result.bestScore}%`);
    console.log(`Worst Score: ${result.worstScore}%`);
    console.log(`Patterns Detected: ${result.patterns.length}`);
    
    console.log('\nAgent Results:');
    result.runs.forEach((run, idx: number) => {
      console.log(`\n${run.agentId}:`);
      console.log(`  - Success: ${run.success}`);
      console.log(`  - Duration: ${(run.duration / 1000).toFixed(1)}s`);
      console.log(`  - Tool calls: ${run.telemetry.calls.length}`);
      
      if (run.comparisonResult) {
        console.log(`  - Score: ${run.comparisonResult.score}%`);
        console.log(`  - Match: ${run.comparisonResult.match}`);
        console.log(`  - Deviations: ${run.comparisonResult.deviations.length}`);
      }
      
      if (run.error) {
        console.log(`  - Error: ${run.error}`);
      }
    });
    
    // Display telemetry summary
    console.log('\n=== Telemetry Summary ===');
    result.runs.forEach(run => {
      if (run.telemetry.calls.length > 0) {
        const toolUsage = run.telemetry.calls.reduce((acc: Record<string, number>, call) => {
          acc[call.tool] = (acc[call.tool] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        console.log(`\n${run.agentId} tool usage:`);
        Object.entries(toolUsage)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .forEach(([tool, count]) => {
            console.log(`  - ${tool}: ${count} calls`);
          });
      }
    });
    
    console.log('\n✅ Full execution test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
console.log('Starting in 3 seconds...\n');
setTimeout(() => {
  runFullTest().catch(console.error);
}, 3000);