/**
 * @fileoverview Main test runner for evolutionary testing system
 * This script orchestrates the complete test workflow
 */

import { TaskBasedRunner } from './taskBasedRunner.js';
import { PatternAnalyzer } from './patternAnalyzer.js';
import { ClaudeAnalyzer } from './claudeAnalyzer.js';
import { loadReferenceMetrics, getReferenceImagePath } from './metricsLoader.js';
import { TestConfig, TestRun, GenerationResult } from './types.js';
import { TelemetryCapture } from '../../tools/telemetry.js';
import * as fs from 'fs/promises';

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
    
    // 4. Prepare for generation
    await runner.prepareGeneration(generation);
    
    // 5. Clean up old telemetry files
    console.log('3. Cleaning up old telemetry files...');
    await TelemetryCapture.cleanupOldTelemetry(7 * 24 * 60 * 60 * 1000); // 7 days
    console.log('✓ Telemetry cleanup complete\n');
    
    // 6. Run Task agents
    console.log(`4. Running ${agentCount} Task agents...`);
    const runs: TestRun[] = [];
    
    for (let i = 0; i < agentCount; i++) {
      const agentId = `agent-${i + 1}`;
      
      // Generate session ID for coherence
      const sessionId = runner.generateSessionId(agentId, generation);
      
      // Create Task prompt
      const prompt = runner.createTaskPrompt(config, agentId, sessionId);
      
      console.log(`\n--- Ready to launch ${agentId} ---`);
      console.log(`Session ID: ${sessionId}`);
      console.log('Task prompt:');
      console.log('```');
      console.log(prompt);
      console.log('```');
      
      // IMPORTANT: This is where Claude Code uses the Task tool
      console.log('\n[Claude Code should now invoke Task tool with the above prompt]');
      console.log('[Waiting for Task agent to complete...]');
      
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
    
    // 7. Collect generation results
    console.log('\n5. Analyzing generation results...');
    const generationResult = await runner.collectGenerationResults(runs);
    runner.displayGenerationSummary(generationResult);
    
    // 8. Analyze patterns
    console.log('\n6. Analyzing patterns...');
    const patternAnalyzer = new PatternAnalyzer();
    const patterns = patternAnalyzer.analyzePatterns(runs);
    console.log(`Found ${patterns.length} patterns\n`);
    
    // 9. Generate analysis report
    console.log('7. Generating analysis report...');
    const claudeAnalyzer = new ClaudeAnalyzer();
    const report = await claudeAnalyzer.formatPatternAnalysis(
      runs,
      patterns,
      referenceImage,
      testCase
    );
    
    // 10. Save report
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