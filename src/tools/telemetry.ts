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
  private static pendingWrites: number = 0;
  private static readonly FLUSH_THRESHOLD = 10; // Flush after 10 pending writes (reduced for shorter Task sessions)
  
  /**
   * Initialize telemetry directory
   */
  static async initializeTelemetryDir(): Promise<void> {
    if (this.telemetryDir) {
      // Already initialized, verify it still exists
      try {
        await fs.access(this.telemetryDir, fs.constants.W_OK);
        return;
      } catch (error) {
        console.warn(`📊 Telemetry directory no longer accessible: ${this.telemetryDir}, reinitializing...`);
      }
    }

    try {
      // Try to get config from evolutionary test system
      const config = getConfig();
      this.telemetryDir = config.paths.telemetryDir;
      console.log(`📊 Using evolutionary test telemetry directory: ${this.telemetryDir}`);
    } catch (error) {
      // Fallback to multiple possible locations
      const fallbackDirs = [
        '/tmp/evolution_tests/telemetry',
        path.join(process.cwd(), 'telemetry'),
        path.join(process.cwd(), 'tmp', 'telemetry')
      ];
      
      for (const dir of fallbackDirs) {
        try {
          await fs.mkdir(dir, { recursive: true });
          await fs.access(dir, fs.constants.W_OK);
          this.telemetryDir = dir;
          console.warn(`📊 Using fallback telemetry directory: ${this.telemetryDir}`);
          break;
        } catch (fallbackError) {
          console.warn(`📊 Failed to create/access directory ${dir}: ${fallbackError}`);
        }
      }
      
      if (!this.telemetryDir) {
        throw new Error('Could not initialize any telemetry directory');
      }
    }
    
    // Ensure directory exists and is writable
    await fs.mkdir(this.telemetryDir, { recursive: true });
    await fs.access(this.telemetryDir, fs.constants.W_OK);
    console.log(`📊 Telemetry directory initialized: ${this.telemetryDir}`);
  }
  
  /**
   * Get or set session ID from environment (for Task agent coherence)
   */
  static getOrCreateSessionId(agentId: string, generation: number): string {
    // Check multiple environment variable sources for robustness
    const sessionId = process.env.EVOLUTION_SESSION_ID || 
                     process.env.TELEMETRY_SESSION_ID ||
                     process.env.SESSION_ID;
    
    if (sessionId) {
      console.log(`📊 Found session ID in environment: ${sessionId}`);
      
      // Auto-start session if evolution context detected and no active session
      if (!this.currentSession && !this.inSession) {
        console.log(`📊 Evolution context detected - auto-starting telemetry session`);
        // Don't await here to avoid blocking, but trigger the session start
        this.startSession(agentId, generation).catch(error => {
          console.error(`📊 Failed to auto-start telemetry session: ${error}`);
        });
      }
      
      return sessionId;
    }
    
    // If no environment session ID, try to get from existing session
    if (this.currentSession) {
      console.log(`📊 Using existing session ID: ${this.currentSession.id}`);
      return this.currentSession.id;
    }
    
    // Otherwise create a new one
    const newSessionId = `${Date.now()}-${agentId}-gen${generation}`;
    console.log(`📊 Generated new session ID: ${newSessionId}`);
    return newSessionId;
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
    
    // Increment pending writes counter
    this.pendingWrites++;
    
    // Queue the write to avoid race conditions
    this.fileWriteQueue = this.fileWriteQueue.then(async () => {
      try {
        // Verify directory exists before write
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        
        // Add detailed logging for debugging
        console.log(`📊 Writing telemetry call: ${call.tool} to ${filePath}`);
        
        await this.writeWithRetry(filePath, JSON.stringify(call) + '\n');
        this.pendingWrites--;
        
        console.log(`📊 Successfully wrote telemetry call for ${sessionId} (${this.pendingWrites} pending)`);
      } catch (error) {
        console.error(`📊 Failed to persist telemetry after retries: ${error}`);
        console.error(`📊 File path: ${filePath}, Session: ${sessionId}, Tool: ${call.tool}`);
        this.pendingWrites--;
      }
    });
    
    // Check if we need to flush the queue
    if (this.pendingWrites >= this.FLUSH_THRESHOLD) {
      console.log(`📊 Reaching flush threshold (${this.pendingWrites}), flushing write queue...`);
      await this.flushWriteQueue();
    }
    
    return this.fileWriteQueue;
  }
  
  /**
   * Flush the write queue to ensure all pending writes complete
   */
  private static async flushWriteQueue(): Promise<void> {
    console.log(`Flushing telemetry write queue (${this.pendingWrites} pending writes)...`);
    await this.fileWriteQueue;
    console.log('Telemetry write queue flushed');
  }
  
  /**
   * Write to file with retry logic
   */
  private static async writeWithRetry(
    filePath: string, 
    data: string, 
    maxRetries: number = 5
  ): Promise<void> {
    const delays = [100, 200, 500, 1000, 2000]; // Exponential backoff in ms
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Verify parent directory exists before each attempt
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        
        // Use exclusive write check to prevent corruption
        try {
          await fs.access(filePath, fs.constants.F_OK);
          // File exists, append normally
          await fs.appendFile(filePath, data, 'utf8');
        } catch (accessError) {
          // File doesn't exist, create it
          await fs.writeFile(filePath, data, 'utf8');
        }
        
        return; // Success
      } catch (error: any) {
        lastError = error;
        const isRetryable = error.code === 'ENOENT' || 
                          error.code === 'EBUSY' || 
                          error.code === 'EACCES' ||
                          error.code === 'EMFILE' ||  // Too many open files
                          error.code === 'EAGAIN';    // Resource temporarily unavailable
        
        if (!isRetryable || attempt === maxRetries) {
          // Not retryable or out of retries
          console.error(`📊 Telemetry write failed permanently after ${attempt + 1} attempts: ${error.code} - ${error.message}`);
          throw error;
        }
        
        // Wait before retry
        const delay = delays[attempt] || 2000;
        console.warn(`📊 Telemetry write failed (${error.code}), attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Should never reach here, but just in case
    throw lastError || new Error('Write failed for unknown reason');
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
    
    try {
      await this.writeWithRetry(filePath, JSON.stringify(sentinel) + '\n');
    } catch (error) {
      console.error(`Failed to write session completion sentinel after retries: ${error}`);
      throw error; // Re-throw as this is critical for session completion
    }
  }
  
  /**
   * Start a new telemetry session
   */
  static async startSession(agentId: string, generation: number): Promise<string> {
    if (this.inSession) {
      console.warn('📊 Warning: Attempted to start session while another is active. Ending previous session.');
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
    
    console.log(`📊 Started telemetry session: ${sessionId} for ${agentId} (Generation ${generation})`);
    console.log(`📊 Telemetry directory: ${this.telemetryDir}`);
    
    return sessionId;
  }
  
  /**
   * End the current telemetry session
   */
  static async endSession(): Promise<TelemetrySession | null> {
    if (!this.currentSession || !this.inSession) {
      console.warn('📊 Attempted to end session but no active session found');
      return null;
    }
    
    this.currentSession.endTime = Date.now();
    this.currentSession.calls = [...this.calls];
    const session = this.currentSession;
    
    const duration = (session.endTime || Date.now()) - session.startTime;
    console.log(`📊 Ending telemetry session: ${session.id}`);
    console.log(`📊 Session duration: ${Math.round(duration / 1000)}s, Calls captured: ${session.calls.length}`);
    
    // Write session completion sentinel
    try {
      await this.writeSessionComplete(session.id);
      console.log(`📊 Session completion sentinel written for ${session.id}`);
    } catch (error) {
      console.error(`📊 Failed to write session completion sentinel: ${error}`);
      throw error;
    }
    
    // Flush any pending writes
    await this.flushWriteQueue();
    
    // Reset for next session
    this.currentSession = null;
    this.calls = [];
    this.inSession = false;
    
    console.log(`📊 Session ${session.id} ended successfully`);
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
  static async capture(toolName: string, params: any, result: { success: boolean; error?: string; executionTime: number; data?: any }): Promise<void> {
    const call: ToolCall = {
      timestamp: Date.now(),
      tool: toolName,
      parameters: this.sanitizeParams(params),
      executionTime: result.executionTime,
      result: result.success ? 'success' : 'error',
      errorMessage: result.error
    };
    
    // Sanitize result data if present
    if (result.data) {
      (call as any).resultData = this.sanitizeParams(result.data);
    }
    
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
  static async waitForSessionComplete(sessionId: string, timeout: number = 300000): Promise<boolean> {
    if (!this.telemetryDir) {
      await this.initializeTelemetryDir();
    }
    
    // Make timeout configurable via environment
    const configuredTimeout = parseInt(process.env.TELEMETRY_WAIT_TIMEOUT || timeout.toString());
    const progressInterval = parseInt(process.env.TELEMETRY_PROGRESS_INTERVAL || '15000'); // 15s default
    const checkInterval = parseInt(process.env.TELEMETRY_CHECK_INTERVAL || '500'); // 0.5s default
    
    console.log(`📊 Waiting for session completion: ${sessionId} (timeout: ${configuredTimeout}ms)`);
    
    const filePath = path.join(this.telemetryDir!, `${sessionId}.jsonl`);
    const startTime = Date.now();
    let lastProgressTime = startTime;
    let lastFileSize = 0;
    let noActivityCount = 0;
    
    while (Date.now() - startTime < configuredTimeout) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        
        // Check for session completion sentinel
        if (content.includes('"type":"session-complete"')) {
          console.log(`📊 Session completion sentinel found for ${sessionId}`);
          return true;
        }
        
        // Track file activity to detect stuck agents
        const currentSize = content.length;
        if (currentSize === lastFileSize) {
          noActivityCount++;
        } else {
          noActivityCount = 0;
          lastFileSize = currentSize;
        }
        
        // If no activity for 60 checks (30s), warn but continue
        if (noActivityCount >= 60) {
          console.warn(`📊 No telemetry activity for ${sessionId} in 30s, agent may be stuck`);
          noActivityCount = 0; // Reset to avoid spam
        }
        
      } catch (e) {
        // File might not exist yet
        if ((e as any).code !== 'ENOENT') {
          console.warn(`📊 Error reading telemetry file for ${sessionId}: ${e}`);
        }
      }
      
      // Show progress at configurable intervals
      if (Date.now() - lastProgressTime > progressInterval) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const remaining = Math.round((configuredTimeout - (Date.now() - startTime)) / 1000);
        console.log(`📊 Waiting for ${sessionId} telemetry... (${elapsed}s elapsed, ${remaining}s remaining)`);
        lastProgressTime = Date.now();
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    console.warn(`📊 Timeout waiting for session completion: ${sessionId} after ${configuredTimeout}ms`);
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
   * Get telemetry system health status for debugging
   */
  static getHealthStatus(): {
    systemStatus: string;
    telemetryDir: string | null;
    currentSession: any;
    pendingWrites: number;
    sessionsCount: number;
    callsCount: number;
    environment: Record<string, string | undefined>;
  } {
    return {
      systemStatus: this.inSession ? 'active' : 'idle',
      telemetryDir: this.telemetryDir,
      currentSession: this.currentSession ? {
        id: this.currentSession.id,
        agentId: this.currentSession.agentId,
        generation: this.currentSession.generation,
        callsCount: this.currentSession.calls.length,
        startTime: new Date(this.currentSession.startTime).toISOString()
      } : null,
      pendingWrites: this.pendingWrites,
      sessionsCount: this.sessions.size,
      callsCount: this.calls.length,
      environment: {
        EVOLUTION_SESSION_ID: process.env.EVOLUTION_SESSION_ID,
        TELEMETRY_SESSION_ID: process.env.TELEMETRY_SESSION_ID,
        TELEMETRY_AGENT_ID: process.env.TELEMETRY_AGENT_ID,
        TELEMETRY_GENERATION: process.env.TELEMETRY_GENERATION,
        TELEMETRY_WAIT_TIMEOUT: process.env.TELEMETRY_WAIT_TIMEOUT,
        TELEMETRY_PROGRESS_INTERVAL: process.env.TELEMETRY_PROGRESS_INTERVAL,
        TELEMETRY_CHECK_INTERVAL: process.env.TELEMETRY_CHECK_INTERVAL
      }
    };
  }

  /**
   * Debug method to log current telemetry state
   */
  static logDebugInfo(): void {
    const health = this.getHealthStatus();
    console.log('📊 === Telemetry Debug Info ===');
    console.log(`📊 System Status: ${health.systemStatus}`);
    console.log(`📊 Telemetry Directory: ${health.telemetryDir}`);
    console.log(`📊 Current Session: ${health.currentSession ? 
      `${health.currentSession.id} (${health.currentSession.callsCount} calls)` : 'None'}`);
    console.log(`📊 Pending Writes: ${health.pendingWrites}`);
    console.log(`📊 Total Sessions: ${health.sessionsCount}`);
    console.log(`📊 Current Calls: ${health.callsCount}`);
    console.log(`📊 Environment Variables:`);
    Object.entries(health.environment).forEach(([key, value]) => {
      if (value) console.log(`   ${key}=${value}`);
    });
    console.log('📊 === End Debug Info ===');
  }

  /**
   * Flush all pending operations and log status
   */
  static async flushAndDebug(): Promise<void> {
    console.log('📊 Flushing telemetry operations...');
    await this.flushWriteQueue();
    this.logDebugInfo();
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