/**
 * @fileoverview Legacy evolutionary test runner (deprecated)
 * This file is kept for reference but should not be used.
 * Use TaskBasedRunner instead for the new Task-based approach.
 * @deprecated
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { TelemetryCapture, TelemetrySession } from "../../telemetry.js";
import { TelemetryPersistence } from "../../telemetryPersistence.js";
import { LayoutMetrics, ComparisonResult } from '../../types.js';
import { SubAgentExecutor, createSubAgentExecutor } from './subAgentExecutor.js';
import { getMcpBridge, McpBridge } from './mcpBridge.js';
import { TestConfig, TestRun, Pattern, GenerationResult } from './types.js';

/**
 * @deprecated Use TaskBasedRunner instead
 * Legacy evolutionary test runner
 */
export class EvolutionaryTestRunner {
  private persistence: TelemetryPersistence;
  private mcpBridge: McpBridge;
  private subAgentExecutor: SubAgentExecutor;
  
  constructor() {
    console.warn('EvolutionaryTestRunner is deprecated. Use TaskBasedRunner for Task-based approach.');
    this.persistence = new TelemetryPersistence({
      baseDir: path.join(os.tmpdir(), 'evolution_tests', 'telemetry')
    });
    
    this.mcpBridge = getMcpBridge();
    this.subAgentExecutor = createSubAgentExecutor();
  }
  
  /**
   * Initialize the test runner
   */
  async initialize(): Promise<void> {
    // Initialize MCP bridge with telemetry enabled
    await this.mcpBridge.initialize(true);
    
    // Ensure output directories exist
    const baseDir = path.join(os.tmpdir(), 'evolution_tests');
    await fs.mkdir(path.join(baseDir, 'documents'), { recursive: true });
    await fs.mkdir(path.join(baseDir, 'telemetry'), { recursive: true });
    await fs.mkdir(path.join(baseDir, 'results'), { recursive: true });
  }
  
  /**
   * Run a complete generation of agents
   */
  async runGeneration(config: TestConfig): Promise<GenerationResult> {
    console.log(`\n=== Running Generation ${config.generation} ===`);
    console.log(`Agents: ${config.agentCount}, Target Score: ${config.targetScore}%`);
    
    const runs: TestRun[] = [];
    
    // Run agents sequentially (InDesign constraint)
    for (let i = 0; i < config.agentCount; i++) {
      const agentId = `agent-${i + 1}`;
      console.log(`\nRunning ${agentId}...`);
      
      try {
        // Reset InDesign state before each agent
        await this.resetInDesignState();
        
        // Run single agent
        const run = await this.runSingleAgent(agentId, config);
        runs.push(run);
        
        // Save telemetry immediately
        if (run.telemetry) {
          await this.persistence.saveSession(run.telemetry);
        }
        
        // Save document state for debugging
        if (run.success) {
          await this.saveDocumentState(
            `gen_${config.generation}_${agentId}`
          );
        }
        
        if (run.success) {
          console.log(`${agentId} completed: Score ${run.comparisonResult?.score || 0}%`);
        } else {
          console.log(`${agentId} failed: ${run.error}`);
        }
      } catch (error) {
        console.error(`${agentId} unexpected error:`, error);
        
        // This should rarely happen since runSingleAgent catches errors
        const telemetry = await TelemetryCapture.endSession() || { 
          id: `failed-${agentId}-${Date.now()}`, 
          startTime: Date.now(), 
          agentId, 
          generation: config.generation, 
          calls: [] 
        };
        
        runs.push({
          agentId,
          telemetry,
          duration: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Analyze patterns across all runs
    const patterns = await this.analyzePatterns(runs);
    
    // Calculate scores
    const scores = runs
      .filter(r => r.comparisonResult)
      .map(r => r.comparisonResult!.score);
    
    const result: GenerationResult = {
      generation: config.generation,
      runs,
      patterns,
      averageScore: scores.length > 0 ? 
        scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      bestScore: scores.length > 0 ? Math.max(...scores) : 0,
      worstScore: scores.length > 0 ? Math.min(...scores) : 0
    };
    
    // Save generation summary
    await this.saveGenerationSummary(result);
    
    return result;
  }
  
  /**
   * Run a single agent with telemetry capture
   */
  private async runSingleAgent(agentId: string, config: TestConfig): Promise<TestRun> {
    const startTime = Date.now();
    
    try {
      // Create the task prompt
      const prompt = this.createAgentPrompt(config);
      
      // Execute agent - telemetry session is managed by the executor
      const executionResult = await this.simulateAgentExecution(prompt, config, agentId);
      
      // Extract layout metrics
      const extractedMetrics = await this.extractLayoutMetrics();
      
      // Compare to reference
      const comparisonResult = await this.compareToReference(
        config.referenceMetrics
      );
      
      return {
        agentId,
        telemetry: executionResult.telemetry,
        extractedMetrics,
        comparisonResult,
        duration: Date.now() - startTime,
        success: true
      };
    } catch (error) {
      // Get the telemetry session from the executor if available
      const telemetry = this.subAgentExecutor.getLastSession() || {
        id: `failed-${agentId}-${Date.now()}`,
        startTime,
        agentId,
        generation: config.generation,
        calls: [],
        endTime: Date.now()
      };
      
      // Return error result instead of throwing
      return {
        agentId,
        telemetry,
        extractedMetrics: undefined,
        comparisonResult: undefined,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Create the prompt for sub-agents
   */
  private createAgentPrompt(config: TestConfig): string {
    return `You are tasked with recreating a document layout in InDesign based on a reference image.

Reference image: ${config.referenceImage}

Instructions:
1. Examine the reference image carefully
2. Create a layout that matches the visual design as closely as possible
3. Pay attention to:
   - Text sizes and visual hierarchy
   - Alignment and positioning
   - Font styles and variations
   - Spacing and indentation

Available tools:
- add_text: Add text to the document
- create_paragraph_style: Create paragraph styles with specific formatting
- apply_paragraph_style: Apply styles to text
- create_textframe: Create text frames at specific positions
- And all other InDesign MCP tools

Begin by examining the image, then use InDesign MCP tools to recreate the layout.`;
  }
  
  /**
   * Execute agent via sub-agent executor
   */
  private async simulateAgentExecution(prompt: string, config: TestConfig, agentId: string): Promise<{ telemetry: TelemetrySession }> {
    // Execute through sub-agent system
    const result = await this.subAgentExecutor.execute({
      agentId,
      generation: config.generation,
      prompt,
      timeoutMs: 180000 // 3 minutes
    });
    
    if (!result.success) {
      throw new Error(`Agent execution failed: ${result.error}`);
    }
    
    // Return the telemetry session from the executor
    return {
      telemetry: result.telemetry!
    };
  }
  
  /**
   * Reset InDesign to clean state
   */
  private async resetInDesignState(): Promise<void> {
    await this.mcpBridge.resetInDesignState();
  }
  
  /**
   * Save document state for debugging
   */
  private async saveDocumentState(filename: string): Promise<void> {
    await this.mcpBridge.saveDocumentState(filename);
  }
  
  /**
   * Extract layout metrics from current document
   */
  private async extractLayoutMetrics(): Promise<LayoutMetrics> {
    return await this.mcpBridge.extractLayoutMetrics();
  }
  
  /**
   * Compare to reference metrics
   */
  private async compareToReference(
    reference: LayoutMetrics
  ): Promise<ComparisonResult> {
    return await this.mcpBridge.compareToReference(reference);
  }
  
  /**
   * Analyze patterns across multiple runs
   */
  private async analyzePatterns(runs: TestRun[]): Promise<Pattern[]> {
    // This will be implemented in Phase 3
    console.log('Analyzing patterns across runs...');
    
    return [];
  }
  
  /**
   * Save generation summary for later analysis
   */
  private async saveGenerationSummary(result: GenerationResult): Promise<void> {
    const summaryPath = path.join(
      os.tmpdir(), 
      'evolution_tests', 
      `generation_${result.generation}_summary.json`
    );
    
    // Would save the summary to disk
    console.log(`Saving generation summary to: ${summaryPath}`);
  }
  
  /**
   * Calculate average score from runs
   */
  calculateAverageScore(runs: TestRun[]): number {
    const scores = runs
      .filter(r => r.comparisonResult)
      .map(r => r.comparisonResult!.score);
    
    return scores.length > 0 ? 
      scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }
}