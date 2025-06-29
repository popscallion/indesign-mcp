/**
 * @fileoverview Integration test for the complete evolution loop
 * Tests the full evolutionary improvement process
 */

import { EvolutionOrchestrator, EvolutionConfig } from '../../src/experimental/evolutionary/index.js';
import { LayoutMetrics } from '../../src/types.js';

/**
 * Sample reference metrics for testing
 * This represents a simple two-column academic paper layout
 */
const BOOK_PAGE_METRICS: LayoutMetrics = {
  frames: [
    {
      x: 72,
      y: 72,
      width: 234,
      height: 40,
      hasText: true,
      contentLength: 30,
      overflows: false
    },
    {
      x: 72,
      y: 120,
      width: 234,
      height: 300,
      hasText: true,
      contentLength: 800,
      overflows: false
    },
    {
      x: 324,
      y: 72,
      width: 234,
      height: 348,
      hasText: true,
      contentLength: 850,
      overflows: false
    }
  ],
  margins: {
    top: 72,
    left: 72,
    bottom: 72,
    right: 72
  },
  columns: 2,
  styles: [
    {
      name: "Chapter Title",
      fontSize: 26,
      fontFamily: "Minion Pro"
    },
    {
      name: "Body Text",
      fontSize: 11,
      fontFamily: "Minion Pro"
    },
    {
      name: "Footnote",
      fontSize: 9,
      fontFamily: "Minion Pro"
    }
  ],
  textRegions: []
};

/**
 * Run the evolution loop test
 */
async function runEvolutionLoopTest() {
  console.log('=== Evolution Loop Integration Test ===\n');
  
  // Evolution configuration
  const config: EvolutionConfig = {
    // Test configuration
    testCase: 'book-page-recreation',
    agentCount: 3, // 3 agents per generation for robust patterns
    generation: 1,
    maxGenerations: 5, // Limit for testing
    targetScore: 85, // Target 85% accuracy
    improvementThreshold: 3, // Accept improvements with 3%+ gain
    referenceMetrics: BOOK_PAGE_METRICS,
    referenceImage: '/path/to/book-page-reference.png',
    
    // Evolution configuration
    createEvolutionBranch: true,
    toolsDir: 'src/tools',
    repoPath: process.cwd(),
    patternMinFrequency: 2,
    patternConfidenceThreshold: 0.6
  };
  
  console.log('Configuration:');
  console.log(`- Test case: ${config.testCase}`);
  console.log(`- Agents per generation: ${config.agentCount}`);
  console.log(`- Max generations: ${config.maxGenerations}`);
  console.log(`- Target score: ${config.targetScore}%`);
  console.log(`- Improvement threshold: ${config.improvementThreshold}%`);
  console.log('');
  
  // Important notices
  console.log('⚠️  REQUIREMENTS:');
  console.log('1. Adobe InDesign must be running');
  console.log('2. A document should be open');
  console.log('3. This is a Git repository');
  console.log('4. Evolution will create branches and commits');
  console.log('5. This test will take approximately 15-30 minutes');
  console.log('');
  
  console.log('Press Ctrl+C to cancel, or wait 10 seconds to continue...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Create orchestrator
  const orchestrator = new EvolutionOrchestrator(config);
  
  try {
    // Initialize
    console.log('\nInitializing evolution orchestrator...');
    await orchestrator.initialize();
    
    // Run evolution
    console.log('\nStarting evolution process...\n');
    const result = await orchestrator.runEvolution();
    
    // Display results
    console.log('\n=== Evolution Results ===');
    console.log(`Start Score: ${result.startScore.toFixed(1)}%`);
    console.log(`Final Score: ${result.finalScore.toFixed(1)}%`);
    console.log(`Improvement: ${(result.finalScore - result.startScore).toFixed(1)}%`);
    console.log(`Generations Run: ${result.generationsRun}`);
    console.log(`Improvements Applied: ${result.improvementsApplied}`);
    console.log(`Improvements Successful: ${result.improvementsSuccessful}`);
    console.log(`Convergence Achieved: ${result.convergenceAchieved ? 'Yes' : 'No'}`);
    console.log(`Total Duration: ${(result.totalDuration / 1000 / 60).toFixed(1)} minutes`);
    
    // Score progression
    console.log('\nScore Progression:');
    result.scoreHistory.forEach((score: number, i: number) => {
      const bar = '█'.repeat(Math.round(score / 2));
      console.log(`  Gen ${i + 1}: ${bar} ${score.toFixed(1)}%`);
    });
    
    console.log('\n✅ Evolution loop test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Evolution test failed:', error);
    process.exit(1);
  }
}

/**
 * Minimal test for quick validation
 */
async function runMinimalEvolutionTest() {
  console.log('=== Minimal Evolution Test (2 generations, 2 agents) ===\n');
  
  const config: EvolutionConfig = {
    testCase: 'minimal-test',
    agentCount: 2,
    generation: 1,
    maxGenerations: 2,
    targetScore: 90,
    improvementThreshold: 2,
    referenceMetrics: BOOK_PAGE_METRICS,
    referenceImage: '/path/to/reference.png',
    createEvolutionBranch: false // Don't create branch for minimal test
  };
  
  const orchestrator = new EvolutionOrchestrator(config);
  
  try {
    await orchestrator.initialize();
    const result = await orchestrator.runEvolution();
    
    console.log(`\nMinimal test complete: ${result.startScore.toFixed(1)}% → ${result.finalScore.toFixed(1)}%`);
    console.log(`Duration: ${(result.totalDuration / 1000 / 60).toFixed(1)} minutes`);
    
  } catch (error) {
    console.error('Minimal test failed:', error);
    process.exit(1);
  }
}

// Determine which test to run
const args = process.argv.slice(2);
const isMinimal = args.includes('--minimal');

if (isMinimal) {
  console.log('Running minimal evolution test...\n');
  runMinimalEvolutionTest().catch(console.error);
} else {
  console.log('Running full evolution loop test...\n');
  console.log('Tip: Use --minimal flag for a quick 2-generation test\n');
  runEvolutionLoopTest().catch(console.error);
}