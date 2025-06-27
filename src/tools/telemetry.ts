/**
 * @fileoverview Telemetry capture system for evolutionary testing
 * Captures all tool calls, parameters, and results for analysis
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getConfig } from '../experimental/evolutionary/config.js';

/**
 * Tool call telemetry data structure
 */
export interface ToolCall {
  timestamp: number;
  tool: string;
  parameters: Record<string, any>;
  executionTime: number;
  result: 'success' | 'error';
  errorMessage?: string;
  // Additional metadata for analysis
  agentId?: string;
  generation?: number;
  sessionId?: string;
}

/**
 * Telemetry session information
 */
export interface TelemetrySession {
  id: string;
  startTime: number;
  endTime?: number;
  agentId: string;
  generation: number;
  calls: ToolCall[];
}

/**
 * Telemetry capture and management system
 */
export class TelemetryCapture {
  private static calls: ToolCall[] = [];
  private static currentSession: TelemetrySession | null = null;
  private static sessions: Map<string, TelemetrySession> = new Map();
  private static inSession: boolean = false;
  
  // File-based telemetry
  private static telemetryDir: string | null = null;
  private static fileWriteQueue: Promise<void> = Promise.resolve();
  
  /**
   * Initialize telemetry directory
   */
  static async initializeTelemetryDir(): Promise<void> {
    const config = getConfig();
    this.telemetryDir = config.paths.telemetryDir;
    
    // Ensure directory exists
    await fs.mkdir(this.telemetryDir, { recursive: true });
  }
  
  /**
   * Get or set session ID from environment (for Task agent coherence)
   */
  static getOrCreateSessionId(agentId: string, generation: number): string {
    // Check if session ID was passed via environment
    if (process.env.EVOLUTION_SESSION_ID) {
      return process.env.EVOLUTION_SESSION_ID;
    }
    
    // Otherwise create a new one
    return `${Date.now()}-${agentId}-gen${generation}`;
  }
  
  /**
   * Persist a tool call to file (JSONL format)
   */
  private static async persistCall(call: ToolCall): Promise<void> {
    if (!this.telemetryDir) {
      await this.initializeTelemetryDir();
    }
    
    const sessionId = call.sessionId || 'no-session';
    const filePath = path.join(this.telemetryDir!, `${sessionId}.jsonl`);
    
    // Queue the write to avoid race conditions
    this.fileWriteQueue = this.fileWriteQueue.then(async () => {
      try {
        await fs.appendFile(filePath, JSON.stringify(call) + '\n', 'utf8');
      } catch (error) {
        console.error(`Failed to persist telemetry: ${error}`);
      }
    });
    
    return this.fileWriteQueue;
  }
  
  /**
   * Write session completion sentinel
   */
  static async writeSessionComplete(sessionId: string): Promise<void> {
    if (!this.telemetryDir) {
      await this.initializeTelemetryDir();
    }
    
    const filePath = path.join(this.telemetryDir!, `${sessionId}.jsonl`);
    const sentinel = {
      type: 'session-complete',
      timestamp: Date.now(),
      sessionId
    };
    
    await fs.appendFile(filePath, JSON.stringify(sentinel) + '\n', 'utf8');
  }
  
  /**
   * Start a new telemetry session
   */
  static async startSession(agentId: string, generation: number): Promise<string> {
    if (this.inSession) {
      console.warn('Warning: Attempted to start session while another is active. Ending previous session.');
      await this.endSession();
    }
    
    // Use coherent session ID (from env or generate)
    const sessionId = this.getOrCreateSessionId(agentId, generation);
    
    this.currentSession = {
      id: sessionId,
      startTime: Date.now(),
      agentId,
      generation,
      calls: []
    };
    this.sessions.set(sessionId, this.currentSession);
    this.calls = [];
    this.inSession = true;
    
    // Initialize telemetry directory if needed
    await this.initializeTelemetryDir();
    
    return sessionId;
  }
  
  /**
   * End the current telemetry session
   */
  static async endSession(): Promise<TelemetrySession | null> {
    if (!this.currentSession || !this.inSession) return null;
    
    this.currentSession.endTime = Date.now();
    this.currentSession.calls = [...this.calls];
    const session = this.currentSession;
    
    // Write session completion sentinel
    await this.writeSessionComplete(session.id);
    
    // Reset for next session
    this.currentSession = null;
    this.calls = [];
    this.inSession = false;
    
    return session;
  }
  
  /**
   * Get the current session without ending it
   */
  static getCurrentSession(): TelemetrySession | null {
    if (!this.currentSession || !this.inSession) return null;
    
    // Return a copy with current calls
    return {
      ...this.currentSession,
      calls: [...this.calls],
      endTime: Date.now() // Temporary endTime
    };
  }
  
  /**
   * Get summary for the last ended session
   */
  static getLastSessionSummary(session: TelemetrySession): {
    totalCalls: number;
    toolUsage: Record<string, number>;
    errorRate: number;
    averageExecutionTime: number;
    errorPatterns: Array<{ tool: string; error: string; count: number }>;
  } {
    const toolUsage: Record<string, number> = {};
    const errorPatterns: Map<string, number> = new Map();
    let totalTime = 0;
    let errorCount = 0;
    
    session.calls.forEach(call => {
      // Count tool usage
      toolUsage[call.tool] = (toolUsage[call.tool] || 0) + 1;
      
      // Track execution time
      totalTime += call.executionTime;
      
      // Track errors
      if (call.result === 'error') {
        errorCount++;
        if (call.errorMessage) {
          const key = `${call.tool}:${call.errorMessage}`;
          errorPatterns.set(key, (errorPatterns.get(key) || 0) + 1);
        }
      }
    });
    
    // Format error patterns
    const errorPatternsArray = Array.from(errorPatterns.entries())
      .map(([key, count]) => {
        const [tool, error] = key.split(':');
        return { tool, error, count };
      })
      .sort((a, b) => b.count - a.count);
    
    return {
      totalCalls: session.calls.length,
      toolUsage,
      errorRate: session.calls.length > 0 ? errorCount / session.calls.length : 0,
      averageExecutionTime: session.calls.length > 0 ? totalTime / session.calls.length : 0,
      errorPatterns: errorPatternsArray
    };
  }
  
  /**
   * Capture a tool call
   */
  static async capture(toolName: string, params: any, result: { success: boolean; error?: string; executionTime: number }): Promise<void> {
    const call: ToolCall = {
      timestamp: Date.now(),
      tool: toolName,
      parameters: this.sanitizeParams(params),
      executionTime: result.executionTime,
      result: result.success ? 'success' : 'error',
      errorMessage: result.error
    };
    
    // Add session metadata if available
    if (this.currentSession) {
      call.agentId = this.currentSession.agentId;
      call.generation = this.currentSession.generation;
      call.sessionId = this.currentSession.id;
    }
    
    this.calls.push(call);
    
    // Persist to file immediately
    await this.persistCall(call);
  }
  
  /**
   * Get all captured calls for current session
   */
  static getCalls(): ToolCall[] {
    return [...this.calls];
  }
  
  /**
   * Get a specific session
   */
  static getSession(sessionId: string): TelemetrySession | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Get all sessions
   */
  static getAllSessions(): TelemetrySession[] {
    return Array.from(this.sessions.values());
  }
  
  /**
   * Reset telemetry (clear current session data)
   */
  static reset() {
    this.calls = [];
    this.currentSession = null;
    this.inSession = false;
    // Note: We intentionally don't clear sessions Map to preserve historical data
    // Use clearAllSessions() to remove all historical data
  }
  
  /**
   * Clear all sessions (for testing)
   */
  static clearAllSessions() {
    this.sessions.clear();
    this.reset();
  }
  
  /**
   * Get telemetry summary for analysis
   */
  static getSummary(): {
    totalCalls: number;
    toolUsage: Record<string, number>;
    errorRate: number;
    averageExecutionTime: number;
    errorPatterns: Array<{ tool: string; error: string; count: number }>;
  } {
    const toolUsage: Record<string, number> = {};
    const errorPatterns: Map<string, number> = new Map();
    let totalTime = 0;
    let errorCount = 0;
    
    this.calls.forEach(call => {
      // Count tool usage
      toolUsage[call.tool] = (toolUsage[call.tool] || 0) + 1;
      
      // Track execution time
      totalTime += call.executionTime;
      
      // Track errors
      if (call.result === 'error') {
        errorCount++;
        if (call.errorMessage) {
          const key = `${call.tool}:${call.errorMessage}`;
          errorPatterns.set(key, (errorPatterns.get(key) || 0) + 1);
        }
      }
    });
    
    // Format error patterns
    const errorPatternsArray = Array.from(errorPatterns.entries())
      .map(([key, count]) => {
        const [tool, error] = key.split(':');
        return { tool, error, count };
      })
      .sort((a, b) => b.count - a.count);
    
    return {
      totalCalls: this.calls.length,
      toolUsage,
      errorRate: this.calls.length > 0 ? errorCount / this.calls.length : 0,
      averageExecutionTime: this.calls.length > 0 ? totalTime / this.calls.length : 0,
      errorPatterns: errorPatternsArray
    };
  }
  
  /**
   * Read telemetry from file (JSONL format)
   */
  static async readSessionFromFile(sessionId: string): Promise<TelemetrySession | null> {
    if (!this.telemetryDir) {
      await this.initializeTelemetryDir();
    }
    
    const filePath = path.join(this.telemetryDir!, `${sessionId}.jsonl`);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n');
      
      const calls: ToolCall[] = [];
      let sessionComplete = false;
      let startTime: number | null = null;
      let endTime: number | null = null;
      let agentId = '';
      let generation = 0;
      
      for (const line of lines) {
        if (!line) continue;
        
        try {
          const data = JSON.parse(line);
          
          if (data.type === 'session-complete') {
            sessionComplete = true;
            endTime = data.timestamp;
          } else {
            // It's a tool call
            calls.push(data);
            
            if (!startTime) {
              startTime = data.timestamp;
              agentId = data.agentId || '';
              generation = data.generation || 0;
            }
            endTime = data.timestamp;
          }
        } catch (e) {
          console.warn(`Failed to parse telemetry line: ${line}`);
        }
      }
      
      if (calls.length === 0) {
        return null;
      }
      
      return {
        id: sessionId,
        startTime: startTime || Date.now(),
        endTime: endTime || Date.now(),
        agentId,
        generation,
        calls
      };
    } catch (error) {
      // File doesn't exist or other error
      return null;
    }
  }
  
  /**
   * Wait for session completion sentinel
   */
  static async waitForSessionComplete(sessionId: string, timeout: number = 30000): Promise<boolean> {
    if (!this.telemetryDir) {
      await this.initializeTelemetryDir();
    }
    
    const filePath = path.join(this.telemetryDir!, `${sessionId}.jsonl`);
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        if (content.includes('"type":"session-complete"')) {
          return true;
        }
      } catch (e) {
        // File might not exist yet
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return false;
  }
  
  /**
   * Export telemetry data as JSON
   */
  static export(): string {
    return JSON.stringify({
      currentSession: this.currentSession,
      allSessions: Array.from(this.sessions.values()),
      timestamp: new Date().toISOString()
    }, null, 2);
  }
  
  /**
   * Import telemetry data from JSON
   */
  static import(data: string): void {
    try {
      const parsed = JSON.parse(data);
      
      // Restore sessions
      if (parsed.allSessions) {
        this.sessions.clear();
        parsed.allSessions.forEach((session: TelemetrySession) => {
          this.sessions.set(session.id, session);
        });
      }
      
      // Don't restore current session to avoid conflicts
      this.currentSession = null;
      this.calls = [];
    } catch (error) {
      console.error('Failed to import telemetry data:', error);
      throw new Error('Invalid telemetry data format');
    }
  }
  
  /**
   * Sanitize parameters to avoid storing sensitive or large data
   */
  private static sanitizeParams(params: any): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.length > 1000) {
        // Truncate long strings
        sanitized[key] = value.substring(0, 100) + '... [truncated]';
      } else if (typeof value === 'object' && value !== null) {
        // Deep copy objects but limit depth
        sanitized[key] = this.sanitizeObject(value, 3);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  /**
   * Sanitize nested objects with depth limit
   */
  private static sanitizeObject(obj: any, maxDepth: number, currentDepth: number = 0): any {
    if (currentDepth >= maxDepth) {
      return '[object]';
    }
    
    if (Array.isArray(obj)) {
      return obj.slice(0, 10).map(item => 
        typeof item === 'object' ? this.sanitizeObject(item, maxDepth, currentDepth + 1) : item
      );
    }
    
    const result: Record<string, any> = {};
    const entries = Object.entries(obj).slice(0, 20); // Limit number of properties
    
    for (const [key, value] of entries) {
      if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeObject(value, maxDepth, currentDepth + 1);
      } else if (typeof value === 'string' && value.length > 1000) {
        result[key] = value.substring(0, 100) + '... [truncated]';
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Clean up old telemetry files
   */
  static async cleanupOldTelemetry(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.telemetryDir) {
      await this.initializeTelemetryDir();
    }
    
    try {
      const files = await fs.readdir(this.telemetryDir!);
      const now = Date.now();
      
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        
        const filePath = path.join(this.telemetryDir!, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAgeMs) {
          await fs.unlink(filePath);
          console.log(`Cleaned up old telemetry file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup telemetry files:', error);
    }
  }
}