/**
 * @fileoverview Main test runner for evolutionary testing system
 * This script orchestrates the complete test workflow
 */

import { TaskBasedRunner } from './taskBasedRunner.js';
import { PatternAnalyzer } from './patternAnalyzer.js';
import { ClaudeAnalyzer } from './claudeAnalyzer.js';
import { loadReferenceMetrics, getReferenceImagePath } from './metricsLoader.js';
import { TestConfig, TestRun, GenerationResult } from './types.js';
import { TelemetryCapture } from "../../telemetry.js";
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

/**
 * Run a complete evolutionary test cycle
 * 
 * This is the main entry point for Claude Code to orchestrate testing.
 * It sets up all necessary components and provides hooks for Task agents.
 */
export async function runEvolutionTest(options: {
  testCase?: string;
  agentCount?: number;
  generation?: number;
} = {}) {
  console.log('=== Starting Evolution Test ===\n');
  
  const testCase = options.testCase || 'book-page';
  const agentCount = options.agentCount || 3;
  const generation = options.generation || 1;
  
  try {
    // 1. Initialize runner with telemetry enabled
    console.log('1. Initializing Task-based runner...');
    const runner = new TaskBasedRunner();
    await runner.initialize();
    console.log('✓ Runner initialized with telemetry\n');
    
    // 2. Load reference metrics and image path
    console.log('2. Loading reference data...');
    const referenceMetrics = await loadReferenceMetrics(testCase);
    const referenceImage = await getReferenceImagePath(testCase);
    console.log(`✓ Loaded metrics for ${testCase}`);
    console.log(`✓ Reference image: ${referenceImage}\n`);
    
    // 3. Create test configuration
    const config: TestConfig = {
      testCase,
      agentCount,
      generation,
      maxGenerations: 5,
      targetScore: 85,
      improvementThreshold: 5,
      referenceMetrics,
      referenceImage,
      referenceDescription: 'Academic book page with heading and body text'
    };
    
    // 4. Pre-flight checks
    console.log('3. Running pre-flight checks...');
    
    // 4.1. Verify document can be reset
    try {
      await runner.resetInDesignState();
      console.log('✓ Document reset working');
    } catch (error) {
      console.error('❌ Document reset failed:', error);
      throw new Error('Cannot proceed - document reset is broken');
    }
    
    // 4.2. Verify telemetry directory
    const telemetryDir = path.join(os.tmpdir(), 'evolution_tests', 'telemetry');
    try {
      await fs.access(telemetryDir, fs.constants.W_OK);
      console.log('✓ Telemetry directory writable');
    } catch {
      console.error('❌ Telemetry directory not writable');
      throw new Error('Cannot proceed - telemetry directory issues');
    }
    
    // 4.3. Verify reference image exists
    try {
      await fs.access(referenceImage, fs.constants.R_OK);
      console.log('✓ Reference image found');
    } catch {
      console.error('❌ Reference image not found:', referenceImage);
      throw new Error('Cannot proceed - missing reference image');
    }
    
    console.log('✓ All pre-flight checks passed\n');
    
    // 5. Prepare for generation
    await runner.prepareGeneration(generation);
    
    // 6. Clean up old telemetry files
    console.log('4. Cleaning up old telemetry files...');
    await TelemetryCapture.cleanupOldTelemetry(7 * 24 * 60 * 60 * 1000); // 7 days
    console.log('✓ Telemetry cleanup complete\n');
    
    // 7. Run Task agents
    console.log(`5. Running ${agentCount} Task agents...`);
    const runs: TestRun[] = [];
    
    for (let i = 0; i < agentCount; i++) {
      const agentId = `agent-${i + 1}`;
      
      // Generate session ID for coherence
      const sessionId = runner.generateSessionId(agentId, generation);
      
      // Create Task prompt
      const prompt = runner.createTaskPrompt(config, agentId, sessionId);
      
      // Make the prompt REALLY visible
      console.log('\n\n');
      console.log('█████████████████████████████████████████████████████████████');
      console.log('█                                                           █');
      console.log('█  🚨 AGENT PROMPT READY - IMMEDIATE ACTION REQUIRED! 🚨    █');
      console.log('█                                                           █');
      console.log('█████████████████████████████████████████████████████████████');
      console.log(`\n--- Ready to launch ${agentId} ---`);
      console.log(`Session ID: ${sessionId}`);
      console.log('\n▼ COPY THIS ENTIRE PROMPT ▼\n');
      console.log('─'.repeat(60));
      console.log(prompt);
      console.log('─'.repeat(60));
      console.log('\n▲ END OF PROMPT ▲\n');
      console.log('⏰ You have 5 MINUTES to run the Task agent!');
      console.log('Use: Task("Recreate InDesign layout", <paste prompt above>)\n');
      
      // After Task completes, collect results
      console.log('\n[Task completed - collecting results]');
      
      // Collect telemetry
      const telemetry = await runner.collectTaskTelemetry(agentId, sessionId);
      
      if (telemetry) {
        // Process results
        const run = await runner.processTaskResult(agentId, telemetry, config);
        runs.push(run);
        
        // Show quick summary
        console.log(`\n${agentId} Summary:`);
        console.log(`- Score: ${run.comparisonResult?.score || 0}%`);
        console.log(`- Tool calls: ${telemetry.calls.length}`);
        console.log(`- Duration: ${(run.duration / 1000).toFixed(1)}s`);
      }
      
      // Reset for next agent
      if (i < agentCount - 1) {
        console.log('\nResetting document for next agent...');
        await runner.resetInDesignState();
      }
    }
    
    // 8. Collect generation results
    console.log('\n6. Analyzing generation results...');
    const generationResult = await runner.collectGenerationResults(runs);
    runner.displayGenerationSummary(generationResult);
    
    // 9. Analyze patterns
    console.log('\n7. Analyzing patterns...');
    const patternAnalyzer = new PatternAnalyzer();
    const patterns = patternAnalyzer.analyzePatterns(runs);
    console.log(`Found ${patterns.length} patterns\n`);
    
    // 10. Generate analysis report
    console.log('8. Generating analysis report...');
    const claudeAnalyzer = new ClaudeAnalyzer();
    const report = await claudeAnalyzer.formatPatternAnalysis(
      runs,
      patterns,
      referenceImage,
      testCase
    );
    
    // 11. Save report
    const reportPath = `${runner['config'].paths.resultsDir}/gen${generation}-analysis.md`;
    await fs.writeFile(reportPath, report, 'utf-8');
    console.log(`✓ Report saved to: ${reportPath}\n`);
    
    // Display report preview
    console.log('=== Pattern Analysis Report Preview ===');
    console.log(report.substring(0, 500) + '...\n');
    
    console.log('=== Test Complete ===\n');
    
    console.log('Next Steps:');
    console.log('1. Review the pattern analysis report');
    console.log('2. Identify the most impactful improvement');
    console.log('3. Apply the improvement to the MCP tools');
    console.log('4. Run another generation to test the improvement');
    
    return {
      success: true,
      generationResult,
      patterns,
      reportPath
    };
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Entry point for direct execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  runEvolutionTest()
    .then(result => {
      console.log('\nTest result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}