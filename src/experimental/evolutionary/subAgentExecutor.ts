/**
 * @fileoverview Legacy sub-agent executor (deprecated)
 * This file is kept for reference but should not be used.
 * Task-based approach uses Claude Code's Task tool directly.
 * @deprecated
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { EventEmitter } from 'events';
import { createInDesignMcpServer } from '../../index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TelemetryCapture, TelemetrySession } from '../../tools/telemetry.js';

/**
 * Sub-agent configuration
 */
export interface SubAgentConfig {
  agentId: string;
  generation: number;
  prompt: string;
  timeoutMs?: number;
  mcpServerPath?: string;
}

/**
 * Sub-agent execution result
 */
export interface SubAgentResult {
  agentId: string;
  success: boolean;
  duration: number;
  error?: string;
  toolCalls?: number;
  telemetry?: TelemetrySession;
}

/**
 * Events emitted during sub-agent execution
 */
interface SubAgentEvents {
  'tool-call': (tool: string, params: any) => void;
  'error': (error: Error) => void;
  'complete': (result: SubAgentResult) => void;
  'log': (message: string) => void;
}

/**
 * @deprecated Use TaskBasedRunner instead
 * Legacy sub-agent executor that simulated agent execution
 */
export class SubAgentExecutor extends EventEmitter {
  private mcpServer: McpServer | null = null;
  private mcpProcess: ChildProcess | null = null;
  private agentProcess: ChildProcess | null = null;
  private lastSession: TelemetrySession | null = null;
  
  constructor() {
    super();
  }
  
  /**
   * Get the last telemetry session
   */
  getLastSession(): TelemetrySession | null {
    return this.lastSession;
  }
  
  /**
   * Execute a sub-agent with the given configuration
   */
  async execute(config: SubAgentConfig): Promise<SubAgentResult> {
    const startTime = Date.now();
    
    // Start telemetry session here, not in startMcpServer
    const sessionId = await TelemetryCapture.startSession(config.agentId, config.generation);
    
    try {
      // Start telemetry-enabled MCP server (without starting another session)
      await this.startMcpServer(config);
      
      // Execute the agent task
      const result = await this.runAgent(config);
      
      // End telemetry session and save it
      const telemetry = await TelemetryCapture.endSession();
      if (telemetry) {
        this.lastSession = telemetry;
      }
      
      return {
        ...result,
        duration: Date.now() - startTime,
        telemetry: telemetry || undefined
      };
    } catch (error) {
      // End telemetry session even on error
      const telemetry = await TelemetryCapture.endSession();
      if (telemetry) {
        this.lastSession = telemetry;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('error', error);
      
      return {
        agentId: config.agentId,
        success: false,
        duration: Date.now() - startTime,
        error: errorMessage,
        telemetry: telemetry || undefined
      };
    } finally {
      // Clean up processes (but don't end session again)
      await this.cleanup();
    }
  }
  
  /**
   * Start the telemetry-enabled MCP server
   */
  private async startMcpServer(config: SubAgentConfig): Promise<void> {
    this.emit('log', `Starting MCP server for ${config.agentId}...`);
    
    // Create telemetry-enabled server programmatically
    this.mcpServer = await createInDesignMcpServer(true);
    
    // Note: Telemetry session is already started in execute() method
    
    // Create transport for MCP communication
    const transport = new StdioServerTransport();
    
    // Connect server to transport
    await this.mcpServer.connect(transport);
    
    this.emit('log', 'MCP server started with telemetry enabled');
  }
  
  /**
   * Run the agent with the given prompt
   */
  private async runAgent(config: SubAgentConfig): Promise<SubAgentResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timeout = config.timeoutMs || 180000; // 3 minutes default
      let timeoutHandle: NodeJS.Timeout;
      let toolCallCount = 0;
      
      // DEPRECATED: This simulation code is no longer used
      // Task-based approach uses Claude Code's Task tool
      this.emit('log', `[DEPRECATED] Simulating agent ${config.agentId}...`);
      
      // Legacy simulation code - not used in Task-based approach
      const simulateToolCalls = async () => {
        // Simulate some tool calls based on typical pattern
        const tools = [
          { name: 'create_document', params: { width: 612, height: 792 } },
          { name: 'create_textframe', params: { x: 72, y: 72, width: 468, height: 648 } },
          { name: 'add_text', params: { text: 'Sample text', position: 'end' } },
          { name: 'create_paragraph_style', params: { style_name: 'Heading', fontSize: 24 } },
          { name: 'apply_paragraph_style', params: { style_name: 'Heading', target_text: 'Sample' } }
        ];
        
        for (const tool of tools) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Simulate execution time
          this.emit('tool-call', tool.name, tool.params);
          toolCallCount++;
        }
      };
      
      // Set timeout
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Agent ${config.agentId} timed out after ${timeout}ms`));
      }, timeout);
      
      // Execute simulation
      simulateToolCalls()
        .then(() => {
          clearTimeout(timeoutHandle);
          resolve({
            agentId: config.agentId,
            success: true,
            duration: Date.now() - startTime,
            toolCalls: toolCallCount
          });
        })
        .catch(error => {
          clearTimeout(timeoutHandle);
          reject(error);
        });
    });
  }
  
  /**
   * Clean up processes and resources
   */
  private async cleanup(): Promise<void> {
    this.emit('log', 'Cleaning up sub-agent resources...');
    
    // Note: Telemetry session is ended in execute() method, not here
    
    // Disconnect MCP server
    if (this.mcpServer) {
      // Server cleanup would happen here
      this.mcpServer = null;
    }
    
    // Kill any running processes
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      this.mcpProcess = null;
    }
    
    if (this.agentProcess) {
      this.agentProcess.kill();
      this.agentProcess = null;
    }
  }
  
  /**
   * Create a standardized agent prompt for layout recreation
   */
  static createLayoutPrompt(referenceImage: string, additionalInstructions?: string): string {
    return `You are tasked with recreating a document layout in InDesign based on a reference image.

Reference image: ${referenceImage}

Your goal is to create a layout that matches the visual design as closely as possible.

Key aspects to focus on:
1. **Text Hierarchy**: Identify different text levels (headings, body text, captions) and their relative sizes
2. **Positioning**: Match the placement of text frames and elements precisely
3. **Typography**: Select appropriate font sizes and styles that match the visual weight
4. **Spacing**: Reproduce margins, indentation, and line spacing accurately

Process:
1. First, examine the reference image carefully
2. Create the document with appropriate dimensions
3. Add text frames at the correct positions
4. Create and apply paragraph styles for consistent formatting
5. Add the text content with proper styling

${additionalInstructions || ''}

Available InDesign MCP tools:
- create_document: Set up the document
- create_textframe: Create text containers
- add_text: Add text content
- create_paragraph_style: Define text formatting
- apply_paragraph_style: Apply formatting to text
- And many more...

Begin by analyzing the reference image, then proceed with recreation.`;
  }
}

/**
 * Factory function to create and configure sub-agent executor
 */
export function createSubAgentExecutor(): SubAgentExecutor {
  console.warn('createSubAgentExecutor is deprecated. Use TaskBasedRunner for Task-based approach.');
  const executor = new SubAgentExecutor();
  
  // Add default logging
  executor.on('log', (message) => {
    console.log(`[SubAgent] ${message}`);
  });
  
  executor.on('tool-call', (tool, params) => {
    console.log(`[SubAgent] Tool call: ${tool}`, params);
  });
  
  executor.on('error', (error) => {
    console.error(`[SubAgent] Error:`, error);
  });
  
  return executor;
}