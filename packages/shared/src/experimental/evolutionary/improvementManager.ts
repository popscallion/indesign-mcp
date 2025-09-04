/**
 * @fileoverview Improvement management system for evolutionary testing
 * Tracks, validates, and manages improvements to MCP tool definitions
 */

import { Improvement, ImprovementResult, ImprovementType } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Manages improvements to MCP tool definitions
 */
export class ImprovementManager {
  private improvements: Improvement[] = [];
  private results: ImprovementResult[] = [];
  private baseDir: string;
  
  constructor(options: {
    baseDir?: string;
  } = {}) {
    this.baseDir = options.baseDir || path.join(os.tmpdir(), 'evolution_tests', 'improvements');
  }
  
  /**
   * Initialize the improvement manager
   */
  async initialize(): Promise<void> {
    try {
      // Ensure directories exist
      await fs.mkdir(this.baseDir, { recursive: true });
      await fs.mkdir(path.join(this.baseDir, 'history'), { recursive: true });
      await fs.mkdir(path.join(this.baseDir, 'backups'), { recursive: true });
    } catch (error) {
      console.error('Failed to initialize improvement manager directories:', error);
      throw new Error(`Failed to create directories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Create a new improvement
   */
  createImprovement(params: {
    type: ImprovementType;
    tool: string;
    field?: string;
    current: string;
    proposed: string;
    rationale: string;
    expectedImpact: number;
    generation: number;
  }): Improvement {
    const improvement: Improvement = {
      id: `imp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: params.type,
      tool: params.tool,
      field: params.field,
      current: params.current,
      proposed: params.proposed,
      rationale: params.rationale,
      expectedImpact: params.expectedImpact,
      generation: params.generation
    };
    
    this.improvements.push(improvement);
    return improvement;
  }
  
  /**
   * Validate an improvement before applying
   */
  async validateImprovement(improvement: Improvement): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Basic validation
    if (!improvement.tool) {
      issues.push('Tool name is required');
    }
    
    if (!improvement.proposed || improvement.proposed.trim() === '') {
      issues.push('Proposed change cannot be empty');
    }
    
    if (improvement.current === improvement.proposed) {
      issues.push('Proposed change is identical to current');
    }
    
    if (improvement.expectedImpact < 0 || improvement.expectedImpact > 1) {
      issues.push('Expected impact must be between 0 and 1');
    }
    
    // Type-specific validation
    switch (improvement.type) {
      case 'parameter':
        if (!improvement.field) {
          issues.push('Parameter improvements require a field name');
        }
        break;
        
      case 'example':
        // Validate example format
        if (!improvement.proposed.includes('//') && !improvement.proposed.includes('/*')) {
          issues.push('Examples should include explanatory comments');
        }
        break;
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  /**
   * Record the result of applying an improvement
   */
  recordResult(improvement: Improvement, result: {
    beforeScore: number;
    afterScore: number;
    success: boolean;
    reverted: boolean;
    error?: string;
  }): ImprovementResult {
    const improvementResult: ImprovementResult = {
      improvement,
      ...result
    };
    
    this.results.push(improvementResult);
    return improvementResult;
  }
  
  /**
   * Get improvement history
   */
  getHistory(): ImprovementResult[] {
    return [...this.results];
  }
  
  /**
   * Get successful improvements
   */
  getSuccessfulImprovements(): ImprovementResult[] {
    return this.results.filter(r => r.success && !r.reverted);
  }
  
  /**
   * Calculate improvement statistics
   */
  getStatistics(): {
    totalAttempted: number;
    successful: number;
    reverted: number;
    failed: number;
    averageImpact: number;
    byType: Record<ImprovementType, number>;
  } {
    const stats = {
      totalAttempted: this.results.length,
      successful: 0,
      reverted: 0,
      failed: 0,
      averageImpact: 0,
      byType: {} as Record<ImprovementType, number>
    };
    
    let totalImpact = 0;
    let impactCount = 0;
    
    this.results.forEach(result => {
      if (result.success && !result.reverted) {
        stats.successful++;
        const impact = result.afterScore - result.beforeScore;
        totalImpact += impact;
        impactCount++;
      } else if (result.reverted) {
        stats.reverted++;
      } else {
        stats.failed++;
      }
      
      // Count by type
      const type = result.improvement.type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });
    
    stats.averageImpact = impactCount > 0 ? totalImpact / impactCount : 0;
    
    return stats;
  }
  
  /**
   * Save improvement history to disk
   */
  async saveHistory(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `improvement-history-${timestamp}.json`;
    const filepath = path.join(this.baseDir, 'history', filename);
    
    const data = {
      timestamp,
      improvements: this.improvements,
      results: this.results,
      statistics: this.getStatistics()
    };
    
    try {
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
      console.log(`Saved improvement history to: ${filepath}`);
    } catch (error) {
      console.error('Failed to save improvement history:', error);
      throw new Error(`Failed to write history file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Load previous improvement history
   */
  async loadHistory(filename?: string): Promise<void> {
    const historyDir = path.join(this.baseDir, 'history');
    
    try {
      if (!filename) {
        // Load most recent
        const files = await fs.readdir(historyDir);
        const historyFiles = files
          .filter(f => f.startsWith('improvement-history-'))
          .sort()
          .reverse();
        
        if (historyFiles.length === 0) {
          console.log('No improvement history found');
          return;
        }
        
        filename = historyFiles[0];
      }
      
      const filepath = path.join(historyDir, filename);
      const content = await fs.readFile(filepath, 'utf-8');
      const data = JSON.parse(content);
      
      this.improvements = data.improvements || [];
      this.results = data.results || [];
      
      console.log(`Loaded improvement history from: ${filepath}`);
      console.log(`  - ${this.improvements.length} improvements`);
      console.log(`  - ${this.results.length} results`);
    } catch (error) {
      console.error('Failed to load improvement history:', error);
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.log('History directory or file does not exist');
      } else {
        throw new Error(`Failed to load history: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  /**
   * Create a backup of a file before modifying it
   */
  async createBackup(filepath: string): Promise<string> {
    const filename = path.basename(filepath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${filename}.${timestamp}.backup`;
    const backupPath = path.join(this.baseDir, 'backups', backupName);
    
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      await fs.writeFile(backupPath, content);
      return backupPath;
    } catch (error) {
      console.error(`Failed to create backup of ${filepath}:`, error);
      throw error;
    }
  }
  
  /**
   * Restore a file from backup
   */
  async restoreFromBackup(originalPath: string, backupPath: string): Promise<void> {
    try {
      const content = await fs.readFile(backupPath, 'utf-8');
      await fs.writeFile(originalPath, content);
      console.log(`Restored ${originalPath} from backup`);
    } catch (error) {
      console.error(`Failed to restore from backup:`, error);
      throw error;
    }
  }
  
  /**
   * Generate improvement summary for reporting
   */
  generateSummary(): string {
    const stats = this.getStatistics();
    const summary: string[] = [];
    
    summary.push('# Improvement Summary\n');
    
    summary.push('## Statistics');
    summary.push(`- Total Attempted: ${stats.totalAttempted}`);
    summary.push(`- Successful: ${stats.successful} (${(stats.successful / stats.totalAttempted * 100).toFixed(1)}%)`);
    summary.push(`- Reverted: ${stats.reverted}`);
    summary.push(`- Failed: ${stats.failed}`);
    summary.push(`- Average Score Impact: ${stats.averageImpact > 0 ? '+' : ''}${stats.averageImpact.toFixed(1)}%`);
    summary.push('');
    
    summary.push('## By Type');
    Object.entries(stats.byType).forEach(([type, count]) => {
      summary.push(`- ${type}: ${count}`);
    });
    summary.push('');
    
    // Top successful improvements
    const successful = this.getSuccessfulImprovements()
      .sort((a, b) => (b.afterScore - b.beforeScore) - (a.afterScore - a.beforeScore))
      .slice(0, 5);
    
    if (successful.length > 0) {
      summary.push('## Top Improvements');
      successful.forEach((result, index) => {
        const impact = result.afterScore - result.beforeScore;
        summary.push(`${index + 1}. ${result.improvement.tool} (${result.improvement.type})`);
        summary.push(`   - Impact: +${impact.toFixed(1)}%`);
        summary.push(`   - ${result.improvement.rationale}`);
        summary.push('');
      });
    }
    
    // Failed improvements
    const failed = this.results
      .filter(r => !r.success || r.reverted)
      .slice(0, 3);
    
    if (failed.length > 0) {
      summary.push('## Failed/Reverted Improvements');
      failed.forEach(result => {
        summary.push(`- ${result.improvement.tool} (${result.improvement.type})`);
        if (result.error) {
          summary.push(`  - Error: ${result.error}`);
        } else if (result.reverted) {
          summary.push(`  - Reverted: No improvement detected`);
        }
      });
    }
    
    return summary.join('\n');
  }
  
  /**
   * Find similar past improvements
   */
  findSimilarImprovements(improvement: Improvement): ImprovementResult[] {
    return this.results.filter(result => {
      const imp = result.improvement;
      return imp.tool === improvement.tool && 
             imp.type === improvement.type &&
             imp.field === improvement.field;
    });
  }
  
  /**
   * Check if an improvement has been tried before
   */
  hasBeenTried(improvement: Improvement): boolean {
    return this.improvements.some(imp => 
      imp.tool === improvement.tool &&
      imp.type === improvement.type &&
      imp.field === improvement.field &&
      imp.proposed === improvement.proposed
    );
  }
}