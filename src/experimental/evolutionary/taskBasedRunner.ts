/**
 * @fileoverview Task-based runner for evolutionary testing
 * Uses Claude Code's Task tool to spawn real Task agents
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { TelemetryCapture, TelemetrySession } from '../../tools/telemetry.js';
import { TelemetryPersistence } from '../../tools/telemetryPersistence.js';
import { LayoutMetrics, ComparisonResult } from '../../types.js';
import { getMcpBridge, McpBridge } from './mcpBridge.js';
import { TestConfig, TestRun, GenerationResult } from './types.js';
import { getConfig, loadConfigFromEnv, EvolutionTestConfig } from './config.js';

/**
 * Simplified runner that works with Claude Code's Task tool
 */
export class TaskBasedRunner {
  private persistence: TelemetryPersistence;
  private mcpBridge: McpBridge;
  private currentGeneration: number = 0;
  private config: EvolutionTestConfig;
  
  constructor(configOverrides?: Partial<EvolutionTestConfig>) {
    // Load configuration with env overrides
    const envConfig = loadConfigFromEnv();
    this.config = getConfig({ ...envConfig, ...configOverrides });
    
    this.persistence = new TelemetryPersistence({
      baseDir: this.config.paths.telemetryDir
    });
    this.mcpBridge = getMcpBridge();
  }
  
  /**
   * Initialize the runner
   */
  async initialize(): Promise<void> {
    // Initialize MCP bridge with telemetry enabled
    await this.mcpBridge.initialize(true);
    
    // Ensure output directories exist
    await fs.mkdir(this.config.paths.documentsDir, { recursive: true });
    await fs.mkdir(this.config.paths.telemetryDir, { recursive: true });
    await fs.mkdir(this.config.paths.resultsDir, { recursive: true });
    
    console.log('✓ Task-based runner initialized');
  }
  
  /**
   * Prepare for a new generation
   */
  async prepareGeneration(generation: number): Promise<void> {
    this.currentGeneration = generation;
    console.log(`\n=== Preparing Generation ${generation} ===`);
  }
  
  /**
   * Generate a unique session ID for Task agent coherence
   */
  generateSessionId(agentId: string, generation: number): string {
    return `${Date.now()}-${agentId}-gen${generation}`;
  }
  
  /**
   * Create prompt for Task tool
   * 
   * DESIGN DECISION: Minimal prompt to test MCP usability
   * We intentionally avoid:
   * - Telling agents they're being tested (Hawthorne effect)
   * - Providing detailed specifications (masks MCP deficiencies)
   * - Listing process steps (pre-solves the problem)
   * - Excessive hand-holding (prevents natural discovery)
   * 
   * This minimal approach reveals true MCP usability issues.
   */
  createTaskPrompt(config: TestConfig, agentId: string, sessionId: string): string {
    // Set session ID in environment for Task agent coherence
    process.env.EVOLUTION_SESSION_ID = sessionId;
    
    // Internal tracking (not shown to agent)
    const metadata = {
      agentId,
      generation: config.generation,
      testCase: config.testCase,
      sessionId
    };
    console.log(`Creating prompt for ${agentId} (Gen ${config.generation}, Session: ${sessionId})`);
    
    // Minimal prompt - just the task
    let prompt = 'Recreate this academic book page layout in InDesign using the available MCP tools.\n\n';
    
    // Add reference - either image path or basic description
    if (config.referenceImage) {
      prompt += `Reference: ${config.referenceImage}`;
    } else if (config.referenceDescription) {
      prompt += `Reference: ${config.referenceDescription}`;
    } else {
      // Fallback minimal description
      prompt += 'Reference: A typical academic book page with a heading and body text.';
    }
    
    return prompt;
  }
  
  /**
   * Handle post-Task telemetry collection
   * 
   * With file-based telemetry, Task agents write to JSONL files
   * that we can read after completion.
   */
  async collectTaskTelemetry(agentId: string, sessionId: string): Promise<TelemetrySession | null> {
    console.log(`\nCollecting telemetry for ${agentId} (Session: ${sessionId})...`);
    
    // Wait for session completion sentinel
    const { TelemetryCapture } = await import('../../tools/telemetry.js');
    const completed = await TelemetryCapture.waitForSessionComplete(sessionId, 30000);
    
    if (!completed) {
      console.warn(`⚠️  Session completion sentinel not found for ${sessionId}`);
      // Continue anyway - agent might have crashed
    }
    
    // Read telemetry from file
    const session = await TelemetryCapture.readSessionFromFile(sessionId);
    
    if (!session) {
      console.warn(`⚠️  No telemetry data found for ${sessionId}`);
      // Create synthetic session as fallback
      return {
        id: sessionId,
        startTime: Date.now(),
        endTime: Date.now(),
        agentId,
        generation: this.currentGeneration,
        calls: []
      };
    }
    
    console.log(`✓ Task session loaded: ${session.calls.length} tool calls captured`);
    
    // Also save to persistence for consistency
    await this.persistence.saveSession(session);
    
    return session;
  }
  
  /**
   * Extract layout metrics after Task completion
   * 
   * NOTE: This assumes the Task agent has made changes to the InDesign document
   * that we can now measure. The document state persists between Task and this call.
   */
  async extractLayoutMetrics(): Promise<LayoutMetrics> {
    console.log('Extracting layout metrics from InDesign document...');
    return await this.mcpBridge.extractLayoutMetrics();
  }
  
  /**
   * Compare to reference metrics
   */
  async compareToReference(
    currentMetrics: LayoutMetrics,
    referenceMetrics: LayoutMetrics
  ): Promise<ComparisonResult> {
    console.log('Comparing to reference layout...');
    return await this.mcpBridge.compareToReference(referenceMetrics);
  }
  
  /**
   * Reset InDesign state between agents
   */
  async resetInDesignState(): Promise<void> {
    console.log('Resetting InDesign state...');
    await this.mcpBridge.checkInDesignState();
    
    // Clear document content
    await this.mcpBridge.resetDocument();
    
    console.log('✓ Ready for next agent');
  }
  
  /**
   * Save document state for debugging
   */
  async saveDocumentState(filename: string): Promise<void> {
    const filePath = path.join(this.config.paths.documentsDir, `${filename}.indd`);
    
    try {
      await this.mcpBridge.callTool('save_document', {
        filePath,
        copy: true // Save as copy to not change current document
      });
      console.log(`✓ Document saved: ${filename}.indd`);
    } catch (error) {
      console.warn('Failed to save document:', error);
    }
  }
  
  /**
   * Process a completed Task run
   */
  async processTaskResult(
    agentId: string,
    telemetry: TelemetrySession,
    config: TestConfig
  ): Promise<TestRun> {
    console.log(`\nProcessing results for ${agentId}...`);
    
    // Extract metrics
    const metrics = await this.extractLayoutMetrics();
    
    // Compare to reference
    const comparison = await this.compareToReference(metrics, config.referenceMetrics);
    
    // Save document state
    await this.saveDocumentState(`gen_${config.generation}_${agentId}`);
    
    const run: TestRun = {
      agentId,
      telemetry,
      success: true,
      extractedMetrics: metrics,
      comparisonResult: comparison,
      duration: (telemetry.endTime || Date.now()) - telemetry.startTime,
      generation: config.generation
    };
    
    console.log(`✓ ${agentId} score: ${comparison.score}%`);
    
    return run;
  }
  
  /**
   * Collect all results for a generation
   */
  async collectGenerationResults(runs: TestRun[]): Promise<GenerationResult> {
    const scores = runs.map(r => r.comparisonResult?.score || 0);
    
    return {
      generation: this.currentGeneration,
      runs,
      patterns: [], // Will be analyzed by Claude Code
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      bestScore: Math.max(...scores),
      worstScore: Math.min(...scores)
    };
  }
  
  /**
   * Display generation summary
   */
  displayGenerationSummary(result: GenerationResult): void {
    console.log('\n📊 Generation Summary:');
    console.log(`- Average Score: ${result.averageScore.toFixed(1)}%`);
    console.log(`- Best Score: ${result.bestScore}%`);
    console.log(`- Worst Score: ${result.worstScore}%`);
    console.log(`- Runs Completed: ${result.runs.length}`);
  }
  
  /**
   * Get telemetry data for pattern analysis
   */
  async loadTelemetryForAnalysis(): Promise<TelemetrySession[]> {
    const allSessions = await this.persistence.loadAllSessions();
    // Return most recent 10 sessions
    return allSessions.slice(0, 10);
  }
}

/**
 * Create a task-based runner instance
 */
export function createTaskBasedRunner(): TaskBasedRunner {
  return new TaskBasedRunner();
}