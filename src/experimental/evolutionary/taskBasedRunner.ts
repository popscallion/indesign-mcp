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
    
    // Also set additional telemetry environment variables for robustness
    process.env.TELEMETRY_SESSION_ID = sessionId;
    process.env.TELEMETRY_AGENT_ID = agentId;
    process.env.TELEMETRY_GENERATION = config.generation.toString();
    
    // Enhanced environment variable visibility (O3's suggestion)
    console.log(`\n🔧 Environment Configuration for ${agentId}:`);
    console.log(`   🔗 EVOLUTION_SESSION_ID: ${process.env.EVOLUTION_SESSION_ID}`);
    console.log(`   📊 TELEMETRY_SESSION_ID: ${process.env.TELEMETRY_SESSION_ID}`);
    console.log(`   👤 TELEMETRY_AGENT_ID: ${process.env.TELEMETRY_AGENT_ID}`);
    console.log(`   🧬 TELEMETRY_GENERATION: ${process.env.TELEMETRY_GENERATION}`);
    console.log(`   ⚙️  TELEMETRY_ENABLED: ${process.env.TELEMETRY_ENABLED || 'false'}`);
    console.log(`   ⏱️  TELEMETRY_WAIT_TIMEOUT: ${this.config.timing.telemetryWaitTimeoutMs}ms`);
    
    // Validate critical environment setup
    if (!process.env.EVOLUTION_SESSION_ID) {
      console.warn(`⚠️  WARNING: EVOLUTION_SESSION_ID not set - telemetry collection may fail`);
    }
    if (process.env.EVOLUTION_SESSION_ID !== sessionId) {
      console.warn(`⚠️  WARNING: Session ID mismatch! Environment: ${process.env.EVOLUTION_SESSION_ID}, Expected: ${sessionId}`);
    }
    
    // Internal tracking (not shown to agent)
    const metadata = {
      agentId,
      generation: config.generation,
      testCase: config.testCase,
      sessionId
    };
    console.log(`Creating prompt for ${agentId} (Gen ${config.generation}, Session: ${sessionId})`);
    
    // Make session ID prominent
    let prompt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `SESSION ID: ${sessionId}\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    prompt += 'CONTEXT: The InDesign document has been cleared and is ready for your layout.\n\n';
    
    prompt += 'TASK: Recreate this academic book page layout in InDesign using the available MCP tools.\n\n';
    
    // Add reference
    if (config.referenceImage) {
      prompt += `Reference Image: ${config.referenceImage}\n\n`;
    } else if (config.referenceDescription) {
      prompt += `Reference: ${config.referenceDescription}\n\n`;
    } else {
      // Fallback minimal description
      prompt += 'Reference: A typical academic book page with a heading and body text.\n\n';
    }
    
    // Make telemetry instruction unmissable
    prompt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    prompt += '⚠️  CRITICAL SETUP: Before any layout work, call this tool:\n';
    prompt += '   set_environment_variable {name: "TELEMETRY_ENABLED", value: "true"}\n';
    prompt += '   Then when you complete the layout, you MUST call:\n';
    prompt += '   telemetry_end_session\n';
    prompt += 'This enables telemetry capture and saves your work!\n';
    prompt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    
    // Prompt self-check validation (O3's suggestion)
    const hasSetEnvVar = prompt.includes('set_environment_variable');
    const hasTelemetryEnd = prompt.includes('telemetry_end_session');
    const hasSessionId = prompt.includes(sessionId);
    
    console.log(`📋 Prompt validation for ${agentId}:`);
    console.log(`   ✓ Contains set_environment_variable: ${hasSetEnvVar}`);
    console.log(`   ✓ Contains telemetry_end_session: ${hasTelemetryEnd}`);
    console.log(`   ✓ Contains session ID: ${hasSessionId}`);
    
    if (!hasSetEnvVar || !hasTelemetryEnd) {
      console.warn(`⚠️  PROMPT VALIDATION FAILED: Missing critical telemetry instructions!`);
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
    const timeout = this.config.timing.telemetryWaitTimeoutMs;
    const completed = await TelemetryCapture.waitForSessionComplete(sessionId, timeout);
    
    if (!completed) {
      console.warn(`⚠️  Session completion sentinel not found for ${sessionId}`);
      // Continue anyway - agent might have crashed
    }
    
    // Read telemetry from file
    const session = await TelemetryCapture.readSessionFromFile(sessionId);
    
    if (!session) {
      console.warn(`⚠️  No telemetry data found for ${sessionId}`);
      console.log('📊 Creating enhanced fallback telemetry from document state...');
      
      // Extract what we can from the document
      try {
        const metrics = await this.extractLayoutMetrics();
        const hasContent = metrics.frames.some(f => f.hasText && f.contentLength > 0);
        const totalText = metrics.frames.reduce((sum, f) => sum + f.contentLength, 0);
        const hasStyles = metrics.styles && metrics.styles.length > 0;
        
        // Create more detailed synthetic session based on document analysis
        const fallbackCalls: any[] = [];
        
        if (hasContent) {
          // Infer likely tool usage from document state
          if (metrics.frames.length > 0) {
            fallbackCalls.push({
              timestamp: Date.now() - 150000,
              tool: 'create_textframe',
              parameters: { 
                inferred: true,
                note: `Inferred from ${metrics.frames.length} text frames found` 
              },
              executionTime: 1000,
              result: 'success'
            });
          }
          
          if (totalText > 0) {
            fallbackCalls.push({
              timestamp: Date.now() - 120000,
              tool: 'add_text',
              parameters: { 
                inferred: true,
                note: `Inferred from ${totalText} characters of text content` 
              },
              executionTime: 500,
              result: 'success'
            });
          }
          
          if (hasStyles) {
            fallbackCalls.push({
              timestamp: Date.now() - 90000,
              tool: 'create_paragraph_style',
              parameters: { 
                inferred: true,
                note: `Inferred from ${metrics.styles?.length || 0} paragraph styles` 
              },
              executionTime: 300,
              result: 'success'
            });
          }
          
          // Always end with telemetry session end (since document has content)
          fallbackCalls.push({
            timestamp: Date.now() - 30000,
            tool: 'telemetry_end_session',
            parameters: { 
              inferred: true,
              note: 'Inferred completion based on document content' 
            },
            executionTime: 100,
            result: 'success'
          });
        } else {
          // No content suggests agent failed early or crashed
          console.warn(`📊 No document content found - agent ${agentId} likely crashed or failed`);
          fallbackCalls.push({
            timestamp: Date.now() - 60000,
            tool: 'agent_failure_detected',
            parameters: { 
              inferred: true,
              note: 'No document content suggests agent crash or early failure',
              sessionId,
              agentId 
            },
            executionTime: 0,
            result: 'error',
            errorMessage: 'Agent produced no document content'
          });
        }
        
        return {
          id: sessionId,
          startTime: Date.now() - 180000,
          endTime: Date.now(),
          agentId,
          generation: this.currentGeneration,
          calls: fallbackCalls
        };
      } catch (error) {
        console.error('📊 Failed to create fallback telemetry:', error);
        // Return minimal error session
        return {
          id: sessionId,
          startTime: Date.now() - 180000,
          endTime: Date.now(),
          agentId,
          generation: this.currentGeneration,
          calls: [{
            timestamp: Date.now(),
            tool: 'fallback_telemetry_failed',
            parameters: { 
              error: error instanceof Error ? error.message : String(error),
              sessionId,
              agentId 
            },
            executionTime: 0,
            result: 'error',
            errorMessage: 'Could not analyze document state for fallback telemetry'
          }]
        };
      }
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