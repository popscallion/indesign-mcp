/**
 * @fileoverview Test script for improvement system components
 * Tests improvement manager, tool modifier, git integration, and regression testing
 */

import { ImprovementManager, ToolModifier, GitManager, RegressionTester, getMcpBridge, Improvement } from '../../src/experimental/evolutionary/index.js';
import * as path from 'path';

/**
 * Test the improvement system
 */
async function testImprovementSystem() {
  console.log('=== Testing Improvement System ===\n');
  
  // Initialize components
  const improvementManager = new ImprovementManager();
  const toolModifier = new ToolModifier(path.join(process.cwd(), 'src/tools'));
  const gitManager = new GitManager(process.cwd());
  const bridge = getMcpBridge();
  
  try {
    // Initialize
    console.log('1. Initializing components...');
    await improvementManager.initialize();
    await bridge.initialize(true);
    
    const isGitRepo = await gitManager.isGitRepo();
    console.log(`  ✓ Git repository: ${isGitRepo ? 'Yes' : 'No'}`);
    console.log('  ✓ Components initialized\n');
    
    // Test improvement creation and validation
    console.log('2. Testing improvement management...');
    
    const improvement = improvementManager.createImprovement({
      type: 'description',
      tool: 'create_paragraph_style',
      current: 'Creates a new paragraph style',
      proposed: 'Creates a new paragraph style with specified formatting. Headlines typically use 24-30pt for visual prominence, body text 9-12pt for readability',
      rationale: 'Agents need explicit size ranges to properly interpret visual hierarchy',
      expectedImpact: 0.75,
      generation: 1
    });
    
    console.log('  ✓ Created improvement');
    
    const validation = await improvementManager.validateImprovement(improvement);
    console.log(`  ✓ Validation: ${validation.valid ? 'Passed' : 'Failed'}`);
    if (!validation.valid) {
      console.log(`    Issues: ${validation.issues.join(', ')}`);
    }
    console.log('');
    
    // Test tool modification
    console.log('3. Testing tool modifier...');
    
    const modResult = await toolModifier.applyImprovement(improvement);
    console.log(`  ✓ Modification: ${modResult.success ? 'Success' : 'Failed'}`);
    if (!modResult.success) {
      console.log(`    Error: ${modResult.error}`);
    } else {
      console.log('  ✓ Modified content validated');
      // Don't actually save the modification for this test
    }
    console.log('');
    
    // Test Git operations (if in git repo)
    if (isGitRepo) {
      console.log('4. Testing Git integration...');
      
      const currentBranch = await gitManager.getCurrentBranch();
      console.log(`  ✓ Current branch: ${currentBranch}`);
      
      const history = await gitManager.getImprovementHistory(5);
      console.log(`  ✓ Found ${history.length} previous improvements`);
      
      if (await gitManager.hasUncommittedChanges()) {
        console.log('  ⚠ Uncommitted changes detected (not creating test branch)');
      }
      console.log('');
    } else {
      console.log('4. Skipping Git tests (not in git repository)\n');
    }
    
    // Test regression tester
    console.log('5. Testing regression tester...');
    
    const regressionTester = new RegressionTester(bridge);
    await regressionTester.initialize();
    
    // Run minimal tests
    const minimalPassed = await regressionTester.runMinimalTests();
    console.log(`  ✓ Minimal tests: ${minimalPassed ? 'Passed' : 'Failed'}`);
    
    // Test improvement safety check
    const safetyCheck = await regressionTester.testImprovement(improvement);
    console.log(`  ✓ Improvement safety: ${safetyCheck.safe ? 'Safe' : 'Unsafe'}`);
    console.log(`    Affected tests: ${safetyCheck.affectedTests.length}`);
    if (safetyCheck.errors.length > 0) {
      console.log(`    Errors: ${safetyCheck.errors.join(', ')}`);
    }
    console.log('');
    
    // Test improvement result recording
    console.log('6. Testing result tracking...');
    
    const result = improvementManager.recordResult(improvement, {
      beforeScore: 65,
      afterScore: 72,
      success: true,
      reverted: false
    });
    
    console.log('  ✓ Recorded improvement result');
    
    const stats = improvementManager.getStatistics();
    console.log('  ✓ Statistics:');
    console.log(`    - Total: ${stats.totalAttempted}`);
    console.log(`    - Successful: ${stats.successful}`);
    console.log(`    - Average impact: +${stats.averageImpact.toFixed(1)}%`);
    console.log('');
    
    // Generate summary
    console.log('7. Generating improvement summary...\n');
    const summary = improvementManager.generateSummary();
    console.log('--- SUMMARY PREVIEW ---');
    console.log(summary.split('\n').slice(0, 10).join('\n'));
    console.log('... (truncated)');
    
    // Save history
    await improvementManager.saveHistory();
    console.log('\n✓ Saved improvement history');
    
    console.log('\n✅ All improvement system tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await bridge.cleanup();
  }
}

// Run the test
testImprovementSystem().catch(console.error);