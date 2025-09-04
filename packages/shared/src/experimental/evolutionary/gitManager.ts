/**
 * @fileoverview Git integration for improvement tracking
 * Manages commits, branches, and rollbacks for evolutionary improvements
 */

import { Improvement } from './types.js';
import { spawn } from 'child_process';

/**
 * Manages Git operations for improvement tracking
 */
export class GitManager {
  private repoPath: string;
  private branchPrefix: string;
  
  constructor(repoPath: string = '.', branchPrefix: string = 'evolution') {
    this.repoPath = repoPath;
    this.branchPrefix = branchPrefix;
  }
  
  /**
   * Execute a git command with timeout
   */
  private async git(args: string[], timeout: number = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd: this.repoPath
      });
      
      let stdout = '';
      let stderr = '';
      let killed = false;
      
      // Set timeout
      const timer = setTimeout(() => {
        killed = true;
        git.kill('SIGTERM');
        reject(new Error(`Git command timed out after ${timeout}ms: git ${args.join(' ')}`));
      }, timeout);
      
      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      git.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      
      git.on('close', (code) => {
        clearTimeout(timer);
        
        if (killed) {
          return; // Already rejected due to timeout
        }
        
        if (code !== 0) {
          reject(new Error(`Git command failed with code ${code}: ${stderr || stdout}`));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }
  
  /**
   * Check if we're in a git repository
   */
  async isGitRepo(): Promise<boolean> {
    try {
      await this.git(['rev-parse', '--git-dir']);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    return await this.git(['rev-parse', '--abbrev-ref', 'HEAD']);
  }
  
  /**
   * Create a new branch
   */
  async createBranch(branchName: string): Promise<void> {
    await this.git(['checkout', '-b', branchName]);
    console.log(`Created branch: ${branchName}`);
  }
  
  /**
   * Checkout an existing branch
   */
  async checkout(branchName: string): Promise<void> {
    await this.git(['checkout', branchName]);
    console.log(`Checked out branch: ${branchName}`);
  }
  
  /**
   * Create a new branch for improvements
   */
  async createImprovementBranch(generation: number): Promise<string> {
    const timestamp = new Date().toISOString().substring(0, 19).replace(/[:-]/g, '');
    const branchName = `${this.branchPrefix}/gen-${generation}-${timestamp}`;
    
    await this.git(['checkout', '-b', branchName]);
    console.log(`Created improvement branch: ${branchName}`);
    
    return branchName;
  }
  
  /**
   * Commit an improvement with files
   */
  async commitImprovement(improvement: Improvement, files: string[]): Promise<string>;
  
  /**
   * Commit an improvement with metadata
   */
  async commitImprovement(improvement: Improvement, metadata: {
    beforeScore: number;
    afterScore: number;
    generation: number;
  }): Promise<string>;
  
  /**
   * Commit an improvement (implementation)
   */
  async commitImprovement(improvement: Improvement, filesOrMetadata: string[] | {
    beforeScore: number;
    afterScore: number;
    generation: number;
  }): Promise<string> {
    // If it's metadata, stage all changed files
    if (!Array.isArray(filesOrMetadata)) {
      await this.git(['add', '-A']);
    } else {
      // Stage specific files
      for (const file of filesOrMetadata) {
        await this.git(['add', file]);
      }
    }
    
    // Create commit message
    const message = this.createCommitMessage(improvement, !Array.isArray(filesOrMetadata) ? filesOrMetadata : undefined);
    
    // Commit
    await this.git(['commit', '-m', message]);
    
    // Get commit hash
    const hash = await this.git(['rev-parse', 'HEAD']);
    console.log(`Committed improvement: ${hash.substring(0, 7)}`);
    
    return hash;
  }
  
  /**
   * Create a structured commit message
   */
  private createCommitMessage(improvement: Improvement, metadata?: {
    beforeScore: number;
    afterScore: number;
    generation: number;
  }): string {
    const lines: string[] = [];
    
    // Subject line
    lines.push(`[Evolution] ${improvement.type}: ${improvement.tool}`);
    lines.push('');
    
    // Body
    lines.push(`Generation: ${improvement.generation}`);
    lines.push(`Expected Impact: ${(improvement.expectedImpact * 100).toFixed(0)}%`);
    
    if (metadata) {
      lines.push(`Actual Impact: ${metadata.beforeScore.toFixed(1)}% → ${metadata.afterScore.toFixed(1)}% (+${(metadata.afterScore - metadata.beforeScore).toFixed(1)}%)`);
    }
    
    lines.push('');
    
    lines.push('Rationale:');
    lines.push(improvement.rationale);
    lines.push('');
    
    lines.push('Changes:');
    lines.push(`- Current: ${improvement.current}`);
    lines.push(`- Proposed: ${improvement.proposed}`);
    
    if (improvement.field) {
      lines.push(`- Field: ${improvement.field}`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Revert the last commit
   */
  async revertLastCommit(): Promise<void> {
    await this.git(['reset', '--hard', 'HEAD~1']);
    console.log('Reverted last commit');
  }
  
  /**
   * Revert to a specific commit
   */
  async revertToCommit(commitHash: string): Promise<void> {
    await this.git(['reset', '--hard', commitHash]);
    console.log(`Reverted to commit: ${commitHash}`);
  }
  
  /**
   * Create a tag for a successful generation
   */
  async tagGeneration(generation: number, score: number): Promise<void> {
    const tagName = `evolution-gen-${generation}-score-${Math.round(score)}`;
    const message = `Generation ${generation} achieved ${score.toFixed(1)}% score`;
    
    await this.git(['tag', '-a', tagName, '-m', message]);
    console.log(`Tagged generation: ${tagName}`);
  }
  
  /**
   * Merge improvement branch to main
   */
  async mergeImprovements(branchName: string, targetBranch: string = 'main'): Promise<void> {
    // Checkout target branch
    await this.git(['checkout', targetBranch]);
    
    // Merge improvement branch
    await this.git(['merge', '--no-ff', branchName, '-m', `Merge evolutionary improvements from ${branchName}`]);
    
    console.log(`Merged ${branchName} into ${targetBranch}`);
  }
  
  /**
   * Get commit history for improvements
   */
  async getImprovementHistory(limit: number = 20): Promise<Array<{
    hash: string;
    date: string;
    message: string;
  }>> {
    const format = '%H|%ai|%s';
    const output = await this.git([
      'log',
      `--grep=\\[Evolution\\]`,
      `--format=${format}`,
      `-n${limit}`
    ]);
    
    if (!output) {
      return [];
    }
    
    return output.split('\n').map(line => {
      const [hash, date, message] = line.split('|');
      return { hash, date, message };
    });
  }
  
  /**
   * Check if there are uncommitted changes
   */
  async hasUncommittedChanges(): Promise<boolean> {
    try {
      const status = await this.git(['status', '--porcelain']);
      return status.length > 0;
    } catch {
      return false;
    }
  }
  
  /**
   * Stash uncommitted changes
   */
  async stashChanges(message: string = 'Evolution test stash'): Promise<void> {
    if (await this.hasUncommittedChanges()) {
      await this.git(['stash', 'push', '-m', message]);
      console.log('Stashed uncommitted changes');
    }
  }
  
  /**
   * Pop stashed changes
   */
  async popStash(): Promise<void> {
    try {
      await this.git(['stash', 'pop']);
      console.log('Restored stashed changes');
    } catch (error) {
      // Stash might be empty
      console.log('No stashed changes to restore');
    }
  }
  
  /**
   * Get diff for a specific commit
   */
  async getCommitDiff(commitHash: string): Promise<string> {
    return await this.git(['show', '--no-color', commitHash]);
  }
  
  /**
   * Create a backup branch before starting evolution
   */
  async createBackupBranch(): Promise<string> {
    const timestamp = new Date().toISOString().substring(0, 19).replace(/[:-]/g, '');
    const backupName = `backup/pre-evolution-${timestamp}`;
    
    const currentBranch = await this.getCurrentBranch();
    await this.git(['branch', backupName]);
    
    console.log(`Created backup branch: ${backupName} from ${currentBranch}`);
    return backupName;
  }
  
  /**
   * Clean up old evolution branches
   */
  async cleanupOldBranches(keepDays: number = 7): Promise<void> {
    const branches = await this.git(['branch', '-r']);
    const evolutionBranches = branches
      .split('\n')
      .filter(b => b.includes(this.branchPrefix))
      .map(b => b.trim());
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    
    for (const branch of evolutionBranches) {
      try {
        // Get last commit date
        const dateStr = await this.git(['log', '-1', '--format=%ai', branch]);
        const branchDate = new Date(dateStr);
        
        if (branchDate < cutoffDate) {
          // Delete old branch
          await this.git(['branch', '-D', branch.replace('origin/', '')]);
          console.log(`Deleted old branch: ${branch}`);
        }
      } catch {
        // Branch might not exist locally
      }
    }
  }
  
  /**
   * Generate improvement report from git history
   */
  async generateGitReport(): Promise<string> {
    const history = await this.getImprovementHistory(50);
    const report: string[] = [];
    
    report.push('# Evolution Git History\n');
    report.push(`Total improvements committed: ${history.length}\n`);
    
    // Group by generation
    const byGeneration = new Map<number, typeof history>();
    
    history.forEach(commit => {
      const genMatch = commit.message.match(/Generation: (\d+)/);
      if (genMatch) {
        const gen = parseInt(genMatch[1]);
        if (!byGeneration.has(gen)) {
          byGeneration.set(gen, []);
        }
        byGeneration.get(gen)!.push(commit);
      }
    });
    
    // Report by generation
    Array.from(byGeneration.entries())
      .sort((a, b) => b[0] - a[0])
      .forEach(([gen, commits]) => {
        report.push(`## Generation ${gen}`);
        report.push(`Commits: ${commits.length}\n`);
        
        commits.forEach(commit => {
          report.push(`- ${commit.date.substring(0, 10)} - ${commit.message}`);
          report.push(`  Hash: ${commit.hash.substring(0, 7)}`);
        });
        report.push('');
      });
    
    return report.join('\n');
  }
}