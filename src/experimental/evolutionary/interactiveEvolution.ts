/**
 * @fileoverview Interactive evolution controller for Claude Code
 * 
 * This module provides a stateful, step-by-step interface for running
 * evolutionary tests without blocking bash processes. Claude Code can
 * import this module directly and call methods interactively.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { TaskBasedRunner } from './taskBasedRunner.js';
import { PatternAnalyzer } from './patternAnalyzer.js';
import { ClaudeAnalyzer } from './claudeAnalyzer.js';
import { ToolModifier } from './toolModifier.js';
import { GitManager } from './gitManager.js';
import { loadReferenceMetrics, getReferenceImagePath } from './metricsLoader.js';
import { TestConfig, TestRun, GenerationResult, Improvement, Pattern } from './types.js';
import { TelemetryCapture } from '../../tools/telemetry.js';

/**
 * State that can be persisted between sessions
 */
interface EvolutionState {
  generation: number;
  completedAgents: string[];
  runs: TestRun[];
  improvements: Improvement[];
  startTime: number;
  config: TestConfig;
  currentAgentIndex: number;
}

/**
 * Interactive evolution controller for Claude Code
 * 
 * Usage:
 * ```typescript
 * const evolution = new InteractiveEvolution();
 * await evolution.initialize('book-page');
 * 
 * // Start generation
 * await evolution.startGeneration();
 * 
 * // For each agent
 * const { prompt, sessionId } = await evolution.getNextAgentPrompt();
 * // Claude Code runs Task tool here
 * await evolution.processAgentCompletion(sessionId);
 * 
 * // Analyze results
 * const { patterns, report } = await evolution.analyzeGeneration();
 * ```
 */
export class InteractiveEvolution {
  private runner: TaskBasedRunner;
  private patternAnalyzer: PatternAnalyzer;
  private claudeAnalyzer: ClaudeAnalyzer;
  private toolModifier: ToolModifier;
  private gitManager: GitManager;
  
  private currentGeneration: number = 1;
  private currentAgentIndex: number = 0;
  private runs: TestRun[] = [];
  private config: TestConfig | null = null;
  private startTime: number = Date.now();
  private improvements: Improvement[] = [];
  
  constructor() {
    this.runner = new TaskBasedRunner();
    this.patternAnalyzer = new PatternAnalyzer();
    this.claudeAnalyzer = new ClaudeAnalyzer();
    this.toolModifier = new ToolModifier();
    this.gitManager = new GitManager();
  }
  
  /**
   * Initialize the evolution system
   */
  async initialize(testCase: string = 'book-page', agentCount: number = 3): Promise<void> {
    console.log('🧬 Initializing Interactive Evolution System...\n');
    
    // Initialize runner
    await this.runner.initialize();
    
    // Load reference data
    console.log(`Loading reference data for test case: ${testCase}`);
    const referenceMetrics = await loadReferenceMetrics(testCase);
    const referenceImage = await getReferenceImagePath(testCase);
    
    // Create configuration
    this.config = {
      testCase,
      agentCount,
      generation: 1,
      maxGenerations: 10,
      targetScore: 85,
      improvementThreshold: 5,
      referenceMetrics,
      referenceImage,
      referenceDescription: 'Academic book page with heading and body text'
    };
    
    // Clean up old telemetry
    await TelemetryCapture.cleanupOldTelemetry(7 * 24 * 60 * 60 * 1000); // 7 days
    
    console.log('✅ Evolution system initialized');
    console.log(`📄 Test case: ${testCase}`);
    console.log(`🎯 Target score: ${this.config.targetScore}%`);
    console.log(`👥 Agents per generation: ${agentCount}\n`);
  }
  
  /**
   * Start a new generation
   */
  async startGeneration(): Promise<void> {
    if (!this.config) {
      throw new Error('Evolution system not initialized. Call initialize() first.');
    }
    
    console.log(`\n🔄 Starting Generation ${this.currentGeneration}`);
    console.log('━'.repeat(50));
    
    // Reset for new generation
    this.currentAgentIndex = 0;
    this.runs = [];
    
    // Prepare runner
    await this.runner.prepareGeneration(this.currentGeneration);
    
    // Pre-flight checks
    console.log('\n🔍 Running pre-flight checks...');
    
    try {
      // Verify document can be reset
      await this.runner.resetInDesignState();
      console.log('✓ Document reset working');
      
      // Verify reference image exists
      await fs.access(this.config.referenceImage, fs.constants.R_OK);
      console.log('✓ Reference image found');
      
      console.log('✓ All pre-flight checks passed\n');
    } catch (error) {
      console.error('❌ Pre-flight check failed:', error);
      throw error;
    }
  }
  
  /**
   * Get the next agent prompt
   */
  async getNextAgentPrompt(): Promise<{
    prompt: string;
    sessionId: string;
    agentId: string;
    isLastAgent: boolean;
  }> {
    if (!this.config) {
      throw new Error('Evolution system not initialized');
    }
    
    if (this.currentAgentIndex >= this.config.agentCount) {
      throw new Error('All agents for this generation have been completed');
    }
    
    const agentId = `agent-${this.currentAgentIndex + 1}`;
    const sessionId = this.runner.generateSessionId(agentId, this.currentGeneration);
    
    // Update config with current generation
    const config = { ...this.config, generation: this.currentGeneration };
    
    // Validate telemetry health before creating prompt
    const healthCheck = await this.runner.validateTelemetryHealth();
    if (!healthCheck.healthy) {
      console.warn(`📊 Telemetry health issues detected for ${agentId}:`);
      healthCheck.issues.forEach(issue => console.warn(`   ${issue}`));
    }
    
    // Create prompt
    const prompt = this.runner.createTaskPrompt(config, agentId, sessionId);
    
    console.log(`\n📋 Agent ${this.currentAgentIndex + 1} of ${this.config.agentCount}`);
    console.log(`🆔 Session ID: ${sessionId}`);
    console.log(`⏱️  You have 5 minutes to run this Task agent\n`);
    
    return {
      prompt,
      sessionId,
      agentId,
      isLastAgent: this.currentAgentIndex === this.config.agentCount - 1
    };
  }
  
  /**
   * Process agent completion
   */
  async processAgentCompletion(sessionId: string): Promise<{
    score: number;
    summary: string;
  }> {
    if (!this.config) {
      throw new Error('Evolution system not initialized');
    }
    
    const agentId = `agent-${this.currentAgentIndex + 1}`;
    console.log(`\n⏳ Processing ${agentId} results...`);
    
    try {
      // Collect telemetry
      const telemetry = await this.runner.collectTaskTelemetry(agentId, sessionId);
      
      if (!telemetry) {
        console.warn('⚠️  No telemetry found, using fallback');
      }
      
      // Process results
      const config = { ...this.config, generation: this.currentGeneration };
      const run = await this.runner.processTaskResult(agentId, telemetry!, config);
      this.runs.push(run);
      
      const score = run.comparisonResult?.score || 0;
      const toolCalls = telemetry?.calls.length || 0;
      
      console.log(`\n✅ ${agentId} Complete`);
      console.log(`📊 Score: ${score}%`);
      console.log(`🔧 Tool calls: ${toolCalls}`);
      
      // Reset for next agent (unless this was the last one)
      if (this.currentAgentIndex < this.config.agentCount - 1) {
        console.log('\n🔄 Resetting document for next agent...');
        await this.runner.resetInDesignState();
      }
      
      // Increment agent index
      this.currentAgentIndex++;
      
      return {
        score,
        summary: `${agentId}: ${score}% accuracy, ${toolCalls} tool calls`
      };
      
    } catch (error) {
      console.error(`❌ Error processing ${agentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Analyze the current generation
   */
  async analyzeGeneration(): Promise<{
    patterns: Pattern[];
    report: string;
    averageScore: number;
    bestScore: number;
    worstScore: number;
  }> {
    if (this.runs.length === 0) {
      throw new Error('No runs to analyze. Complete some agents first.');
    }
    
    console.log('\n🔬 Analyzing Generation Results...');
    
    // Collect generation results
    const generationResult = await this.runner.collectGenerationResults(this.runs);
    
    // Display summary
    this.runner.displayGenerationSummary(generationResult);
    
    // Analyze patterns
    console.log('\n🔍 Detecting Patterns...');
    const patterns = this.patternAnalyzer.analyzePatterns(this.runs);
    console.log(`Found ${patterns.length} patterns`);
    
    // Generate analysis report
    console.log('\n📝 Generating Analysis Report...');
    const report = await this.claudeAnalyzer.formatPatternAnalysis(
      this.runs,
      patterns,
      this.config!.referenceImage,
      this.config!.testCase
    );
    
    // Save report
    const reportPath = path.join(
      '/tmp/evolution_tests/results',
      `gen${this.currentGeneration}-analysis.md`
    );
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, report, 'utf-8');
    console.log(`📄 Report saved to: ${reportPath}`);
    
    return {
      patterns,
      report,
      averageScore: generationResult.averageScore,
      bestScore: generationResult.bestScore,
      worstScore: generationResult.worstScore
    };
  }
  
  /**
   * Get improvement suggestions based on patterns
   */
  async suggestImprovements(): Promise<Improvement[]> {
    if (this.runs.length === 0) {
      throw new Error('No runs to analyze. Complete a generation first.');
    }
    
    console.log('\n💡 Generating Improvement Suggestions...\n');
    
    // This is where Claude Code would analyze the patterns and suggest improvements
    // For now, we'll return an example structure
    const exampleImprovements: Improvement[] = [
      {
        tool: 'create_paragraph_style',
        type: 'description',
        field: 'font_size',
        current: 'Font size in points',
        proposed: 'Font size in points (headlines typically 18-30pt, body text 9-12pt, captions 7-9pt)',
        rationale: 'Agents consistently underestimate font sizes by 20-30%',
        expectedImpact: 0.7,
        generation: this.currentGeneration
      }
    ];
    
    console.log('📋 Suggested improvements:');
    exampleImprovements.forEach((imp, i) => {
      console.log(`\n${i + 1}. ${imp.tool} - ${imp.field}`);
      console.log(`   Current: "${imp.current}"`);
      console.log(`   Proposed: "${imp.proposed}"`);
      console.log(`   Rationale: ${imp.rationale}`);
      console.log(`   Expected Impact: ${(imp.expectedImpact * 100).toFixed(0)}%`);
    });
    
    return exampleImprovements;
  }
  
  /**
   * Apply an improvement
   */
  async applyImprovement(improvement: Improvement): Promise<void> {
    console.log(`\n🔧 Applying improvement to ${improvement.tool}...`);
    
    try {
      await this.toolModifier.applyImprovement(improvement);
      this.improvements.push(improvement);
      console.log('✅ Improvement applied successfully');
      
      // Optionally commit
      console.log('\n💾 Ready to commit this improvement');
      console.log('Use git commands to commit the change with appropriate message');
      
    } catch (error) {
      console.error('❌ Failed to apply improvement:', error);
      throw error;
    }
  }
  
  /**
   * Move to next generation
   */
  async nextGeneration(): Promise<void> {
    this.currentGeneration++;
    console.log(`\n📈 Advancing to Generation ${this.currentGeneration}`);
  }
  
  /**
   * Get current progress
   */
  async getProgress(): Promise<string> {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000 / 60);
    
    let progress = `\n📊 Evolution Progress\n`;
    progress += `${'━'.repeat(30)}\n`;
    progress += `Generation: ${this.currentGeneration}\n`;
    progress += `Agents completed: ${this.currentAgentIndex} / ${this.config?.agentCount || 0}\n`;
    progress += `Time elapsed: ${elapsed} minutes\n`;
    
    if (this.runs.length > 0) {
      const scores = this.runs.map(r => r.comparisonResult?.score || 0);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      progress += `Average score: ${avgScore.toFixed(1)}%\n`;
    }
    
    progress += `Improvements applied: ${this.improvements.length}\n`;
    
    return progress;
  }
  
  /**
   * Save progress to file
   */
  async saveProgress(filename: string): Promise<void> {
    const state: EvolutionState = {
      generation: this.currentGeneration,
      completedAgents: this.runs.map(r => r.agentId),
      runs: this.runs,
      improvements: this.improvements,
      startTime: this.startTime,
      config: this.config!,
      currentAgentIndex: this.currentAgentIndex
    };
    
    const filepath = path.join(path.join(os.tmpdir(), 'evolution_tests'), filename);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(state, null, 2), 'utf-8');
    
    console.log(`\n💾 Progress saved to: ${filepath}`);
  }
  
  /**
   * Load progress from file
   */
  async loadProgress(filename: string): Promise<void> {
    const filepath = path.join(path.join(os.tmpdir(), 'evolution_tests'), filename);
    
    try {
      const data = await fs.readFile(filepath, 'utf-8');
      const state: EvolutionState = JSON.parse(data);
      
      // Restore state
      this.currentGeneration = state.generation;
      this.runs = state.runs;
      this.improvements = state.improvements;
      this.startTime = state.startTime;
      this.config = state.config;
      this.currentAgentIndex = state.currentAgentIndex;
      
      // Re-initialize components
      await this.runner.initialize();
      
      console.log(`\n📂 Progress loaded from: ${filepath}`);
      console.log(await this.getProgress());
      
    } catch (error) {
      console.error('❌ Failed to load progress:', error);
      throw error;
    }
  }
  
  /**
   * Generate a checklist for the current state
   */
  generateChecklist(): string {
    const checklist = [];
    
    checklist.push('## Evolution Test Checklist');
    checklist.push(`### Generation ${this.currentGeneration}`);
    checklist.push('');
    
    if (!this.config) {
      checklist.push('- [ ] Initialize evolution system');
      return checklist.join('\n');
    }
    
    checklist.push('- [x] Evolution system initialized');
    
    if (this.currentAgentIndex === 0) {
      checklist.push('- [ ] Start generation');
    } else {
      checklist.push('- [x] Generation started');
    }
    
    // Agent checklist
    for (let i = 0; i < this.config.agentCount; i++) {
      const completed = i < this.currentAgentIndex;
      const current = i === this.currentAgentIndex;
      const prefix = completed ? '[x]' : '[ ]';
      const suffix = current ? ' ← Current' : '';
      checklist.push(`- ${prefix} Run agent-${i + 1}${suffix}`);
    }
    
    // Post-agent tasks
    if (this.currentAgentIndex >= this.config.agentCount) {
      checklist.push('- [x] All agents completed');
      checklist.push('- [ ] Analyze patterns');
      checklist.push('- [ ] Review improvement suggestions');
      checklist.push('- [ ] Apply selected improvement');
      checklist.push('- [ ] Commit changes');
      checklist.push('- [ ] Start next generation');
    }
    
    return checklist.join('\n');
  }
}

/**
 * Export convenience function
 */
export function createInteractiveEvolution(): InteractiveEvolution {
  return new InteractiveEvolution();
}