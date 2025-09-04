/**
 * @fileoverview Legacy evolution orchestrator (for automated approach)
 * 
 * NOTE: This orchestrator was designed for the original automated approach.
 * The current Task-based approach uses Claude Code to orchestrate manually.
 * This file is kept for reference but should not be used directly.
 * 
 * @deprecated Use TaskBasedRunner with Claude Code orchestration instead
 */

import { EvolutionaryTestRunner } from './runner.js';
import { PatternAnalyzer } from './patternAnalyzer.js';
import { PatternPresenter } from './patternPresenter.js';
import { ImprovementManager } from './improvementManager.js';
import { ToolModifier } from './toolModifier.js';
import { GitManager } from './gitManager.js';
import { RegressionTester } from './regressionTester.js';
import { getMcpBridge } from './mcpBridge.js';
import { EvolutionMonitor } from './evolutionMonitor.js';
import { 
  TestConfig, 
  GenerationResult, 
  Improvement, 
  EvolutionConfig,
  EvolutionResult,
  ConvergenceState
} from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * @deprecated Use TaskBasedRunner with Claude Code orchestration
 * Legacy orchestrator for automated evolution (not compatible with Task-based approach)
 */
export class EvolutionOrchestrator {
  private runner: EvolutionaryTestRunner;
  private patternAnalyzer: PatternAnalyzer;
  private patternPresenter: PatternPresenter;
  private improvementManager: ImprovementManager;
  private toolModifier: ToolModifier;
  private gitManager: GitManager;
  private regressionTester: RegressionTester;
  private bridge: ReturnType<typeof getMcpBridge>;
  private monitor: EvolutionMonitor;
  
  // Evolution state
  /**
   * Tracks the generation index (1-based to avoid off-by-one confusion).
   * Starts at 0 and is immediately incremented at the beginning of the main
   * loop so generation 1 is the first actual run.
   */
  private currentGeneration: number = 0;
  private generationHistory: GenerationResult[] = [];
  private scoreHistory: number[] = [];
  private improvementHistory: Improvement[] = [];
  private convergenceState: ConvergenceState = {
    hasConverged: false,
    plateauGenerations: 0,
    bestScore: 0,
    averageImprovement: 0
  };
  
  constructor(private config: EvolutionConfig) {
    console.warn('EvolutionOrchestrator is deprecated. Use TaskBasedRunner for Task-based approach.');
    this.runner = new EvolutionaryTestRunner();
    this.patternAnalyzer = new PatternAnalyzer({
      minFrequency: config.patternMinFrequency || 2,
      confidenceThreshold: config.patternConfidenceThreshold || 0.6
    });
    this.patternPresenter = new PatternPresenter();
    this.improvementManager = new ImprovementManager();
    this.toolModifier = new ToolModifier(config.toolsDir || 'src/tools');
    this.gitManager = new GitManager(config.repoPath || process.cwd());
    this.bridge = getMcpBridge();
    this.regressionTester = new RegressionTester(this.bridge);
    this.monitor = new EvolutionMonitor({
      testCase: config.testCase
    });
  }
  
  /**
   * Initialize all components
   */
  async initialize(): Promise<void> {
    console.log('Initializing Evolution Orchestrator...');
    
    // Initialize components
    await this.runner.initialize();
    await this.improvementManager.initialize();
    await this.bridge.initialize(true); // Enable telemetry
    await this.regressionTester.initialize();
    await this.monitor.initialize();
    
    // Verify Git repository
    if (!await this.gitManager.isGitRepo()) {
      throw new Error('Evolution requires a Git repository for tracking improvements');
    }
    
    // Create evolution branch if needed
    if (this.config.createEvolutionBranch) {
      const branchName = `evolution-${Date.now()}`;
      await this.gitManager.createBranch(branchName);
      console.log(`Created evolution branch: ${branchName}`);
    }
    
    // Load previous history if resuming
    if (this.config.resumeFromGeneration) {
      await this.loadPreviousState();
    }
    
    console.log('✓ Evolution Orchestrator initialized\n');
  }
  
  /**
   * Run the complete evolution loop
   */
  async runEvolution(): Promise<EvolutionResult> {
    console.log('=== Starting Evolutionary Improvement Process ===\n');
    console.log(`Configuration:`);
    console.log(`- Test case: ${this.config.testCase}`);
    console.log(`- Agents per generation: ${this.config.agentCount}`);
    console.log(`- Max generations: ${this.config.maxGenerations}`);
    console.log(`- Target score: ${this.config.targetScore}%`);
    console.log(`- Improvement threshold: ${this.config.improvementThreshold}%\n`);
    
    const startTime = Date.now();
    
    try {
      while (!this.shouldStopEvolution()) {
        // Increment generation counter up-front so it is 1-based everywhere
        this.currentGeneration++;

        await this.monitor.logGenerationStart(this.currentGeneration);
        
        // Run generation
        const generationResult = await this.runSingleGeneration();
        
        // Log generation complete
        await this.monitor.logGenerationComplete(generationResult);
        
        // Check for convergence
        this.updateConvergenceState(generationResult);
        await this.monitor.logConvergenceState(this.convergenceState);
        
        // Generate and apply improvements if not converged
        if (!this.convergenceState.hasConverged && 
            generationResult.patterns.length > 0 &&
            this.currentGeneration < this.config.maxGenerations) {
          
          await this.generateAndApplyImprovement(generationResult);
        }
        
        // Save checkpoint
        await this.saveCheckpoint();
      }
      
      // Generate final report
      const evolutionResult = await this.generateFinalReport();
      
      // Log final summary
      await this.monitor.createEvolutionSummary(
        this.scoreHistory[0] || 0,
        this.convergenceState.bestScore,
        this.currentGeneration,
        this.improvementHistory.length,
        Date.now() - startTime
      );
      
      return evolutionResult;
      
    } catch (error) {
      console.error('\n❌ Evolution failed:', error);
      // Save state for debugging
      await this.saveErrorState(error);
      throw error;
    } finally {
      // Always return to main branch even on failure
      try {
        await this.gitManager.checkout('main');
      } catch {
        /* ignore */
      }
      await this.cleanup();
    }
  }
  
  /**
   * Run a single generation
   */
  private async runSingleGeneration(): Promise<GenerationResult> {
    console.log('Running generation...');
    
    const testConfig: TestConfig = {
      testCase: this.config.testCase,
      agentCount: this.config.agentCount,
      generation: this.currentGeneration,
      maxGenerations: this.config.maxGenerations,
      targetScore: this.config.targetScore,
      improvementThreshold: this.config.improvementThreshold,
      referenceMetrics: this.config.referenceMetrics,
      referenceImage: this.config.referenceImage
    };
    
    // Run agents
    const result = await this.runner.runGeneration(testConfig);
    
    // Store results
    this.generationHistory.push(result);
    this.scoreHistory.push(result.averageScore);
    
    // Display results
    console.log(`\nGeneration ${this.currentGeneration} Results:`);
    console.log(`- Average Score: ${result.averageScore.toFixed(1)}%`);
    console.log(`- Best Score: ${result.bestScore}%`);
    console.log(`- Worst Score: ${result.worstScore}%`);
    console.log(`- Patterns Detected: ${result.patterns.length}`);
    
    return result;
  }
  
  /**
   * Generate and apply improvement based on patterns
   */
  private async generateAndApplyImprovement(generationResult: GenerationResult): Promise<void> {
    console.log('\n--- Improvement Generation ---');
    
    // Analyze patterns from this generation
    const patterns = this.patternAnalyzer.analyzePatterns(generationResult.runs);
    
    // Log pattern analysis
    await this.monitor.logPatternAnalysis(patterns);
    
    if (patterns.length === 0) {
      return;
    }
    
    // Present patterns for Claude analysis
    const patternAnalysis = await this.patternPresenter.presentToClaudeForAnalysis(
      generationResult.runs,
      patterns,
      this.config.referenceImage,
      this.config.testCase
    );
    
    // Generate report for Claude
    const patternReport = this.patternPresenter.generateReport(patternAnalysis);
    const improvementContext = this.patternPresenter.generateImprovementContext(patternAnalysis);
    
    console.log('\nPattern Analysis Summary:');
    console.log(`- Total patterns: ${patterns.length}`);
    console.log(`- High severity: ${patterns.filter(p => p.severity === 'high').length}`);
    console.log(`- Most common issue: ${patterns[0]?.description || 'None'}`);
    
    // TODO: This is where Claude would analyze patterns and generate improvement
    // For now, we'll create a placeholder improvement based on the most significant pattern
    const improvement = await this.generateImprovementFromPatterns(patterns, patternAnalysis);
    
    if (!improvement) {
      console.log('No improvement generated');
      return;
    }
    
    // Apply improvement
    await this.applyAndTestImprovement(improvement, generationResult.averageScore);
  }
  
  /**
   * Generate improvement from patterns (placeholder for Claude integration)
   */
  private async generateImprovementFromPatterns(patterns: any[], analysis: any): Promise<Improvement | null> {
    // TODO: This is where Claude would analyze and generate improvements
    // For now, create a simple improvement based on the most common pattern
    
    const highSeverityPatterns = patterns.filter(p => p.severity === 'high');
    if (highSeverityPatterns.length === 0) {
      return null;
    }
    
    const pattern = highSeverityPatterns[0];
    
    // Create improvement based on pattern type
    const improvement: Partial<Improvement> = {
      generation: this.currentGeneration,
      expectedImpact: pattern.confidence
    };
    
    switch (pattern.type) {
      case 'parameter-choice': {
        // Extract tool and parameter from pattern
        const match = pattern.description.match(/Common parameter choice for (\w+): (\w+)=/);
        if (match) {
          improvement.type = 'parameter';
          improvement.tool = match[1];
          improvement.field = match[2];
          improvement.current = 'Current parameter description';
          improvement.proposed = 'Improved parameter description with better guidance';
          improvement.rationale = `Pattern analysis shows ${pattern.frequency} agents made suboptimal choices for this parameter`;
        }
        break; }
        
      case 'visual-deviation': {
        // Extract attribute from pattern
        const attrMatch = pattern.description.match(/deviation in (\w+)/);
        if (attrMatch) {
          improvement.type = 'description';
          improvement.tool = 'create_paragraph_style'; // Common tool for text styling
          improvement.current = 'Current tool description';
          improvement.proposed = `Enhanced description with explicit guidance for ${attrMatch[1]}`;
          improvement.rationale = `Consistent ${attrMatch[1]} deviations detected across ${pattern.frequency} agents`;
        }
        break; }
        
      default:
        return null;
    }
    
    if (!improvement.tool || !improvement.type) {
      return null;
    }
    
    return this.improvementManager.createImprovement(improvement as Improvement);
  }
  
  /**
   * Apply improvement and test impact
   */
  private async applyAndTestImprovement(improvement: Improvement, baselineScore: number): Promise<void> {
    await this.monitor.logImprovementApplication(improvement);
    
    try {
      // Create improvement branch
      const branchName = `improvement-gen${this.currentGeneration}`;
      await this.gitManager.createBranch(branchName);
      
      // Apply improvement
      const modResult = await this.toolModifier.applyImprovement(improvement);
      if (!modResult.success) {
        throw new Error(`Failed to apply improvement: ${modResult.error}`);
      }
      
      // Find the tool file and save modification
      const toolFile = await this.findToolFile(improvement.tool);
      if (toolFile && modResult.modifiedContent) {
        await this.toolModifier.saveModification(toolFile, modResult.modifiedContent);
      }
      
      // Run regression tests
      console.log('\nRunning regression tests...');
      const regressionResult = await this.regressionTester.testImprovement(improvement);
      
      if (!regressionResult.safe) {
        console.log('❌ Improvement failed regression tests');
        await this.revertImprovement(branchName);
        return;
      }
      
      // Test improvement with new generation
      console.log('\nTesting improvement impact...');
      const testResult = await this.testImprovement();
      
      const improvementDelta = testResult.averageScore - baselineScore;
      console.log(`Score change: ${baselineScore.toFixed(1)}% → ${testResult.averageScore.toFixed(1)}% (${improvementDelta > 0 ? '+' : ''}${improvementDelta.toFixed(1)}%)`);
      
      // Decide whether to keep improvement
      const success = improvementDelta >= this.config.improvementThreshold;
      
      // Log result
      await this.monitor.logImprovementResult(
        improvement,
        baselineScore,
        testResult.averageScore,
        success
      );
      
      if (success) {
        // Commit improvement
        await this.gitManager.commitImprovement(improvement, {
          beforeScore: baselineScore,
          afterScore: testResult.averageScore,
          generation: this.currentGeneration
        });
        
        // Record success
        this.improvementManager.recordResult(improvement, {
          beforeScore: baselineScore,
          afterScore: testResult.averageScore,
          success: true,
          reverted: false
        });
        
        this.improvementHistory.push(improvement);
        
      } else {
        await this.revertImprovement(branchName);
        
        // Record failure
        this.improvementManager.recordResult(improvement, {
          beforeScore: baselineScore,
          afterScore: testResult.averageScore,
          success: false,
          reverted: true
        });
      }
      
    } catch (error) {
      console.error('Error applying improvement:', error);
      // Ensure we're back on main branch
      await this.gitManager.checkout('main');
    }
  }
  
  /**
   * Test improvement with mini-generation
   */
  private async testImprovement(): Promise<GenerationResult> {
    // Run smaller test with fewer agents for speed
    const testConfig: TestConfig = {
      ...this.config,
      agentCount: Math.min(2, this.config.agentCount),
      generation: this.currentGeneration
    };
    
    return await this.runner.runGeneration(testConfig);
  }
  
  /**
   * Revert unsuccessful improvement
   */
  private async revertImprovement(branchName: string): Promise<void> {
    await this.gitManager.checkout('main');
    // Branch will be kept for history
  }
  
  /**
   * Update convergence state
   */
  private updateConvergenceState(result: GenerationResult): void {
    const currentScore = result.averageScore;
    
    // Update best score
    if (currentScore > this.convergenceState.bestScore) {
      this.convergenceState.bestScore = currentScore;
    }
    
    // Check if we've plateaued
    if (this.scoreHistory.length >= 3) {
      const recent = this.scoreHistory.slice(-3);
      const variance = this.calculateVariance(recent);
      
      if (variance < 1.0) { // Less than 1% variance
        this.convergenceState.plateauGenerations++;
      } else {
        this.convergenceState.plateauGenerations = 0;
        this.convergenceState.averageImprovement = 0;
      }
    }
    
    // Calculate average improvement
    if (this.scoreHistory.length >= 2) {
      const improvements = [];
      for (let i = 1; i < this.scoreHistory.length; i++) {
        improvements.push(this.scoreHistory[i] - this.scoreHistory[i - 1]);
      }
      if (improvements.length > 0) {
        this.convergenceState.averageImprovement = 
          improvements.reduce((a, b) => a + b, 0) / improvements.length;
      }
    }
    
    // Check convergence conditions
    this.convergenceState.hasConverged = 
      currentScore >= this.config.targetScore ||
      this.convergenceState.plateauGenerations >= 3;
  }
  
  /**
   * Check if evolution should stop
   */
  private shouldStopEvolution(): boolean {
    return (
      this.currentGeneration >= this.config.maxGenerations ||
      this.convergenceState.hasConverged ||
      this.convergenceState.bestScore >= this.config.targetScore
    );
  }
  
  /**
   * Save checkpoint for resumption
   */
  private async saveCheckpoint(): Promise<void> {
    const checkpoint = {
      generation: this.currentGeneration,
      scoreHistory: this.scoreHistory,
      improvementHistory: this.improvementHistory,
      convergenceState: this.convergenceState,
      timestamp: new Date().toISOString()
    };
    
    const checkpointPath = path.join(
      os.tmpdir(),
      'evolution_tests',
      'checkpoints',
      `checkpoint-gen${this.currentGeneration}.json`
    );
    
    await fs.mkdir(path.dirname(checkpointPath), { recursive: true });
    await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
  }
  
  /**
   * Load previous evolution state
   */
  private async loadPreviousState(): Promise<void> {
    if (!this.config.resumeFromGeneration && this.config.resumeFromGeneration !== 0) {
      return;
    }

    const checkpointPath = path.join(
      os.tmpdir(),
      'evolution_tests',
      'checkpoints',
      `checkpoint-gen${this.config.resumeFromGeneration}.json`
    );

    try {
      const data = await fs.readFile(checkpointPath, 'utf-8');
      const state = JSON.parse(data);
      this.currentGeneration = state.generation || 0;
      this.scoreHistory = state.scoreHistory || [];
      this.improvementHistory = state.improvementHistory || [];
      this.convergenceState = state.convergenceState || this.convergenceState;
      console.log(`✓ Resumed evolution from generation ${this.currentGeneration}`);
    } catch {
      console.warn(`⚠️  No checkpoint found for generation ${this.config.resumeFromGeneration}; starting fresh.`);
    }
  }
  
  /**
   * Save error state for debugging
   */
  private async saveErrorState(error: any): Promise<void> {
    const errorState = {
      generation: this.currentGeneration,
      error: error.message || String(error),
      stack: error.stack,
      scoreHistory: this.scoreHistory,
      timestamp: new Date().toISOString()
    };
    
    const errorPath = path.join(
      os.tmpdir(),
      'evolution_tests',
      'errors',
      `error-gen${this.currentGeneration}.json`
    );
    
    await fs.mkdir(path.dirname(errorPath), { recursive: true });
    await fs.writeFile(errorPath, JSON.stringify(errorState, null, 2));
  }
  
  /**
   * Generate final evolution report
   */
  private async generateFinalReport(): Promise<EvolutionResult> {
    const duration = this.generationHistory.reduce((sum, gen) => {
      return sum + gen.runs.reduce((s, r) => s + r.duration, 0);
    }, 0);
    
    const successfulImprovements = this.improvementManager.getSuccessfulImprovements().length;
    
    const report: EvolutionResult = {
      startScore: this.scoreHistory[0] || 0,
      finalScore: this.convergenceState.bestScore,
      generationsRun: this.currentGeneration,
      improvementsApplied: this.improvementHistory.length,
      improvementsSuccessful: successfulImprovements,
      totalDuration: duration,
      convergenceAchieved: this.convergenceState.hasConverged,
      scoreHistory: this.scoreHistory,
      generationResults: this.generationHistory
    };
    
    // Save final report
    const reportPath = path.join(
      os.tmpdir(),
      'evolution_tests',
      'reports',
      `evolution-report-${Date.now()}.json`
    );
    
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Also save improvement summary
    const summary = this.improvementManager.generateSummary();
    const summaryPath = reportPath.replace('.json', '-improvements.md');
    await fs.writeFile(summaryPath, summary);
    
    // Generate progress report
    const progressReport = await this.monitor.generateProgressReport(
      this.scoreHistory,
      this.improvementHistory
    );
    const progressPath = reportPath.replace('.json', '-progress.md');
    await fs.writeFile(progressPath, progressReport);
    
    console.log(`\nReports saved to:`);
    console.log(`- ${reportPath}`);
    console.log(`- ${summaryPath}`);
    console.log(`- ${progressPath}`);
    
    return report;
  }
  
  /**
   * Find tool file path
   */
  private async findToolFile(toolName: string): Promise<string | null> {
    const toolsRoot = this.config.toolsDir || 'src/tools';

    // Dynamically import fast-glob; show clear message if missing (e.g. production install)
    let fg: typeof import('fast-glob');
    try {
      const mod = await import('fast-glob');
      fg = (mod as any).default ?? mod;
    } catch {
      throw new Error(
        'fast-glob is required for EvolutionOrchestrator. ' +
        'Install it with `npm install --save-dev fast-glob`.'
      );
    }

    const pattern = path.join(toolsRoot, '**', '*.ts').replace(/\\/g, '/');
    const files: string[] = await fg(pattern, { absolute: true });

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        if (content.includes(`'${toolName}'`) || content.includes(`"${toolName}"`)) {
          return file;
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  }
  
  /**
   * Calculate variance of scores
   */
  private calculateVariance(scores: number[]): number {
    if (scores.length === 0) return 0;
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const squaredDiffs = scores.map(s => Math.pow(s - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / scores.length;
  }
  
  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    await this.bridge.cleanup();
    await this.improvementManager.saveHistory();
  }
}