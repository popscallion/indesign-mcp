/**
 * @fileoverview Telemetry persistence system for storing and loading telemetry data
 * Handles file-based storage of telemetry sessions for cross-session analysis
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TelemetrySession, TelemetryCapture } from './telemetry.js';

/**
 * Configuration for telemetry persistence
 */
export interface TelemetryPersistenceConfig {
  baseDir: string;
  maxAge?: number; // Maximum age in milliseconds (default: 24 hours)
  autoCleanup?: boolean; // Automatically clean old files (default: true)
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TelemetryPersistenceConfig = {
  baseDir: path.join(os.tmpdir(), 'evolution_tests', 'telemetry'),
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  autoCleanup: true
};

/**
 * Telemetry persistence manager
 */
export class TelemetryPersistence {
  private config: TelemetryPersistenceConfig;
  
  constructor(config: Partial<TelemetryPersistenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Ensure the storage directory exists
   */
  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.baseDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create telemetry directory:', error);
      throw new Error(`Cannot create telemetry directory: ${this.config.baseDir}`);
    }
  }
  
  /**
   * Save a telemetry session to disk
   */
  async saveSession(session: TelemetrySession): Promise<string> {
    await this.ensureDirectory();
    
    const filename = `session_${session.id}.json`;
    const filepath = path.join(this.config.baseDir, filename);
    
    try {
      const data = JSON.stringify(session, null, 2);
      await fs.writeFile(filepath, data, 'utf-8');
      
      console.log(`Telemetry session saved: ${filepath}`);
      return filepath;
    } catch (error) {
      console.error('Failed to save telemetry session:', error);
      throw new Error(`Cannot save telemetry session: ${error}`);
    }
  }
  
  /**
   * Save all current sessions from TelemetryCapture
   */
  async saveAllSessions(): Promise<string[]> {
    const sessions = TelemetryCapture.getAllSessions();
    const savedPaths: string[] = [];
    
    for (const session of sessions) {
      const path = await this.saveSession(session);
      savedPaths.push(path);
    }
    
    return savedPaths;
  }
  
  /**
   * Load a specific telemetry session from disk
   */
  async loadSession(sessionId: string): Promise<TelemetrySession | null> {
    const filename = `session_${sessionId}.json`;
    const filepath = path.join(this.config.baseDir, filename);
    
    try {
      const data = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(data) as TelemetrySession;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null; // File not found
      }
      console.error('Failed to load telemetry session:', error);
      throw new Error(`Cannot load telemetry session: ${error}`);
    }
  }
  
  /**
   * List all available telemetry sessions
   */
  async listSessions(): Promise<{ id: string; path: string; modifiedTime: Date }[]> {
    await this.ensureDirectory();
    
    try {
      const files = await fs.readdir(this.config.baseDir);
      const sessions: { id: string; path: string; modifiedTime: Date }[] = [];
      
      for (const file of files) {
        if (file.startsWith('session_') && file.endsWith('.json')) {
          const filepath = path.join(this.config.baseDir, file);
          const stats = await fs.stat(filepath);
          const id = file.replace(/^session_/, '').replace(/\.json$/, '');
          
          sessions.push({
            id,
            path: filepath,
            modifiedTime: stats.mtime
          });
        }
      }
      
      // Sort by modification time (newest first)
      sessions.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());
      
      return sessions;
    } catch (error) {
      console.error('Failed to list telemetry sessions:', error);
      return [];
    }
  }
  
  /**
   * Load all sessions from disk
   */
  async loadAllSessions(): Promise<TelemetrySession[]> {
    const sessionList = await this.listSessions();
    const sessions: TelemetrySession[] = [];
    
    for (const sessionInfo of sessionList) {
      const session = await this.loadSession(sessionInfo.id);
      if (session) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }
  
  /**
   * Clean up old telemetry files
   */
  async cleanup(): Promise<number> {
    if (!this.config.autoCleanup || !this.config.maxAge) {
      return 0;
    }
    
    const now = Date.now();
    const sessionList = await this.listSessions();
    let deletedCount = 0;
    
    for (const sessionInfo of sessionList) {
      const age = now - sessionInfo.modifiedTime.getTime();
      
      if (age > this.config.maxAge) {
        try {
          await fs.unlink(sessionInfo.path);
          deletedCount++;
          console.log(`Cleaned up old telemetry file: ${sessionInfo.path}`);
        } catch (error) {
          console.error(`Failed to delete old telemetry file: ${sessionInfo.path}`, error);
        }
      }
    }
    
    return deletedCount;
  }
  
  /**
   * Export all telemetry data to a single file
   */
  async exportAll(outputPath: string): Promise<void> {
    const sessions = await this.loadAllSessions();
    
    const exportData = {
      exportDate: new Date().toISOString(),
      sessionCount: sessions.length,
      sessions: sessions,
      summary: this.generateSummary(sessions)
    };
    
    try {
      await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
      console.log(`Exported ${sessions.length} telemetry sessions to: ${outputPath}`);
    } catch (error) {
      console.error('Failed to export telemetry data:', error);
      throw new Error(`Cannot export telemetry data: ${error}`);
    }
  }
  
  /**
   * Generate a summary of all sessions
   */
  private generateSummary(sessions: TelemetrySession[]): any {
    const totalCalls = sessions.reduce((sum, s) => sum + s.calls.length, 0);
    const totalDuration = sessions.reduce((sum, s) => {
      const duration = (s.endTime || s.startTime) - s.startTime;
      return sum + duration;
    }, 0);
    
    // Aggregate tool usage across all sessions
    const toolUsage: Record<string, number> = {};
    const errorsByTool: Record<string, number> = {};
    
    sessions.forEach(session => {
      session.calls.forEach(call => {
        toolUsage[call.tool] = (toolUsage[call.tool] || 0) + 1;
        
        if (call.result === 'error') {
          errorsByTool[call.tool] = (errorsByTool[call.tool] || 0) + 1;
        }
      });
    });
    
    return {
      totalSessions: sessions.length,
      totalCalls,
      totalDuration: Math.round(totalDuration / 1000) + 's',
      averageCallsPerSession: sessions.length > 0 ? Math.round(totalCalls / sessions.length) : 0,
      toolUsage,
      errorsByTool,
      generations: [...new Set(sessions.map(s => s.generation))].sort()
    };
  }
  
  /**
   * Get telemetry for a specific generation
   */
  async getGenerationSessions(generation: number): Promise<TelemetrySession[]> {
    const allSessions = await this.loadAllSessions();
    return allSessions.filter(s => s.generation === generation);
  }
  
  /**
   * Get telemetry for a specific agent across all generations
   */
  async getAgentSessions(agentId: string): Promise<TelemetrySession[]> {
    const allSessions = await this.loadAllSessions();
    return allSessions.filter(s => s.agentId === agentId);
  }
}