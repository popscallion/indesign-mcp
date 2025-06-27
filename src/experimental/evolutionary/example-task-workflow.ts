/**
 * @fileoverview Example workflow for Task-based evolutionary testing
 * 
 * IMPORTANT: This file demonstrates the workflow that Claude Code follows.
 * It is NOT meant to be run directly as a script.
 * 
 * Claude Code will:
 * 1. Use the Task tool to spawn real Claude instances
 * 2. Analyze the results using the pattern analysis tools
 * 3. Generate improvements based on observed patterns
 * 4. Apply improvements and test again
 */

import { createTaskBasedRunner, TaskBasedRunner } from './taskBasedRunner.js';
import { PatternAnalyzer } from './patternAnalyzer.js';
import { ClaudeAnalyzer } from './claudeAnalyzer.js';
import { ToolModifier } from './toolModifier.js';
import { ImprovementManager } from './improvementManager.js';
import { GitManager } from './gitManager.js';
import { TestConfig, TestRun, Improvement } from './types.js';

/**
 * Example workflow showing how Claude Code orchestrates evolution
 * 
 * This function demonstrates the steps but CANNOT be run directly because:
 * - Only Claude Code can invoke the Task tool
 * - Pattern analysis requires Claude Code's interpretation
 * - Improvement generation needs Claude's understanding
 * 
 * Use this as a reference for the workflow, not as executable code.
 */
export async function exampleEvolutionWorkflow() {
  console.log('=== Task-Based Evolutionary Testing Example ===\n');
  
  // Initialize components
  const runner = createTaskBasedRunner();
  const patternAnalyzer = new PatternAnalyzer();
  const claudeAnalyzer = new ClaudeAnalyzer();
  const toolModifier = new ToolModifier();
  const improvementManager = new ImprovementManager();
  const gitManager = new GitManager();
  
  await runner.initialize();
  
  // Configuration
  const config: TestConfig = {
    testCase: 'academic-book-page',
    agentCount: 3,
    generation: 1,
    maxGenerations: 5,
    targetScore: 85,
    improvementThreshold: 5,
    referenceMetrics: {
      // This would be loaded from a reference file
      frames: [],
      margins: { top: 36, left: 50.4, bottom: 36, right: 50.4 },
      columns: 1,
      styles: [],
      textRegions: []
    },
    referenceImage: 'tests/decision-analysis/reference-images/book-page.jpg',
    referenceDescription: `Academic book page with:
    - 5.125" x 7.75" document
    - Clear heading at top
    - Body text in professional typography
    - Consistent paragraph spacing`
  };
  
  // === GENERATION 1 ===
  console.log('\n=== Generation 1: Initial Baseline ===\n');
  
  await runner.prepareGeneration(1);
  
  // Step 1: Claude Code would create prompts for Task agents
  const runs: TestRun[] = [];
  
  for (let i = 0; i < config.agentCount; i++) {
    const agentId = `agent-${i + 1}`;
    
    // Create prompt
    const prompt = runner.createTaskPrompt(config, agentId);
    
    console.log(`\n--- Launching ${agentId} ---`);
    console.log('Claude Code would now use Task tool with this minimal prompt:');
    console.log('```');
    console.log(prompt);
    console.log('```');
    
    // ACTUAL CLAUDE CODE WORKFLOW:
    // 1. Claude Code invokes: Task("Recreate InDesign layout", prompt)
    // 2. Task agent (separate Claude instance) attempts the layout
    // 3. Task agent has full access to InDesign MCP tools
    // 4. When Task completes, Claude Code continues here
    
    console.log('\n[Claude Code would invoke Task tool here]');
    console.log('[Waiting for Task agent to complete layout recreation...]');
    console.log('[Task completed - document has been modified]');
    
    // After Task completes, collect metrics (not telemetry)
    const telemetry = await runner.collectTaskTelemetry(agentId);
    
    if (telemetry) {
      // Process the results
      const run = await runner.processTaskResult(agentId, telemetry, config);
      runs.push(run);
    }
    
    // Reset for next agent
    if (i < config.agentCount - 1) {
      await runner.resetInDesignState();
    }
  }
  
  // Collect generation results
  const gen1Results = await runner.collectGenerationResults(runs);
  runner.displayGenerationSummary(gen1Results);
  
  // Step 2: Analyze patterns
  console.log('\n--- Pattern Analysis ---');
  const patterns = patternAnalyzer.analyzePatterns(runs);
  console.log(`Found ${patterns.length} patterns`);
  
  // Step 3: Claude Code analyzes the patterns
  const analysisReport = await claudeAnalyzer.formatPatternAnalysis(
    runs,
    patterns,
    config.referenceImage,
    config.testCase
  );
  
  console.log('\n--- Pattern Report for Claude Code ---');
  console.log(analysisReport);
  
  // Step 4: Claude Code would generate improvement
  console.log('\n--- Claude Code Analysis ---');
  console.log('Based on the patterns, Claude Code would analyze and suggest:');
  console.log('');
  console.log('Example improvement (Claude Code would generate this):');
  
  const improvement: Improvement = {
    tool: 'create_paragraph_style',
    type: 'description',
    field: 'font_size',
    current: 'Font size in points',
    proposed: 'Font size in points (typical ranges: headlines 18-30pt, body text 9-12pt, captions 7-9pt)',
    rationale: 'All agents underestimated font sizes by 20-30%. Adding typical ranges will help agents choose appropriate sizes.',
    expectedImpact: 0.7,
    generation: 1
  };
  
  console.log(`
Tool: ${improvement.tool}
Field: ${improvement.field}
Current: "${improvement.current}"
Proposed: "${improvement.proposed}"
Rationale: ${improvement.rationale}
Expected Impact: ${(improvement.expectedImpact * 100).toFixed(0)}%
`);
  
  // Step 5: Apply improvement
  console.log('\n--- Applying Improvement ---');
  console.log('Claude Code would apply this improvement to the tool...');
  
  // In real usage:
  // await toolModifier.applyImprovement(improvement);
  // await gitManager.commitImprovement(improvement, { ... });
  
  // === GENERATION 2 ===
  console.log('\n\n=== Generation 2: Testing Improvement ===\n');
  
  await runner.prepareGeneration(2);
  
  console.log('Claude Code would now run 3 more Task agents to test the improvement...');
  console.log('[Task executions would happen here]');
  
  // Simulate improved results
  console.log('\n📊 Generation 2 Summary:');
  console.log('- Average Score: 67.3% (↑ from 45.2%)');
  console.log('- Improvement: +22.1%');
  console.log('- Status: ✅ Improvement successful!');
  
  // === CONTINUE EVOLUTION ===
  console.log('\n--- Next Steps ---');
  console.log('Claude Code would continue this process:');
  console.log('1. Analyze new patterns from Generation 2');
  console.log('2. Generate next improvement');
  console.log('3. Test with Generation 3');
  console.log('4. Repeat until target score (85%) is reached');
  
  console.log('\n=== Example Complete ===');
}

/**
 * Instructions for Claude Code to run evolution
 */
export const CLAUDE_CODE_INSTRUCTIONS = `
To run evolutionary testing:

1. Initialize the system:
   const runner = createTaskBasedRunner();
   await runner.initialize();

2. For each agent, use Task tool:
   const prompt = runner.createTaskPrompt(config, agentId);
   // Use Task tool with this prompt

3. After Task completes:
   const telemetry = await runner.collectTaskTelemetry(agentId);
   const run = await runner.processTaskResult(agentId, telemetry, config);

4. Analyze patterns:
   const patterns = patternAnalyzer.analyzePatterns(runs);
   const report = await claudeAnalyzer.formatPatternAnalysis(...);

5. Generate and apply improvements based on the patterns

6. Test improvements with new generation

Remember:
- Run agents sequentially (InDesign constraint)
- Reset state between agents
- Save telemetry for each run
- Focus on most impactful improvements
`;