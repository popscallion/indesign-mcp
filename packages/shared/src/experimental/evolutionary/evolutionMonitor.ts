/**
 * @fileoverview Evolution monitoring and progress tracking
 * Provides real-time insights into the evolutionary process
 */

import { GenerationResult, Pattern, Improvement, ConvergenceState } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Monitors and tracks evolution progress
 */
export class EvolutionMonitor {
  private logDir: string;
  private metricsFile: string;
  private currentGeneration: number = 0;
  private startTime: number = Date.now();
  
  constructor(options: {
    logDir?: string;
    testCase?: string;
  } = {}) {
    this.logDir = options.logDir || path.join(os.tmpdir(), 'evolution_tests', 'monitoring');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.metricsFile = path.join(this.logDir, `evolution-metrics-${options.testCase || 'unknown'}-${timestamp}.json`);
  }
  
  /**
   * Initialize monitoring
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.logDir, { recursive: true });
    await this.writeMetrics([{ initialized: true, startTime: new Date().toISOString() }]);
  }
  
  /**
   * Log generation start
   */
  async logGenerationStart(generation: number): Promise<void> {
    this.currentGeneration = generation;
    console.log(`\n⏱️  Generation ${generation} started at ${new Date().toLocaleTimeString()}`);
  }
  
  /**
   * Log generation completion
   */
  async logGenerationComplete(result: GenerationResult): Promise<void> {
    const duration = result.runs.reduce((sum: number, run) => sum + run.duration, 0);
    
    console.log(`\n📊 Generation ${result.generation} Complete:`);
    console.log(`   Duration: ${(duration / 1000 / 60).toFixed(1)} minutes`);
    console.log(`   Average Score: ${result.averageScore.toFixed(1)}%`);
    console.log(`   Score Range: ${result.worstScore}% - ${result.bestScore}%`);
    console.log(`   Patterns Found: ${result.patterns.length}`);
    
    // Log detailed metrics
    await this.appendMetrics({
      generation: result.generation,
      timestamp: new Date().toISOString(),
      averageScore: result.averageScore,
      bestScore: result.bestScore,
      worstScore: result.worstScore,
      patternCount: result.patterns.length,
      duration: duration,
      agentResults: result.runs.map((run) => ({
        agentId: run.agentId,
        success: run.success,
        score: run.comparisonResult?.score || 0,
        toolCalls: run.telemetry.calls.length,
        errors: run.error ? 1 : 0
      }))
    });
  }
  
  /**
   * Log pattern analysis
   */
  async logPatternAnalysis(patterns: Pattern[]): Promise<void> {
    if (patterns.length === 0) {
      console.log('\n🔍 No significant patterns detected');
      return;
    }
    
    console.log('\n🔍 Pattern Analysis:');
    
    // Group by severity
    const bySeverity = {
      high: patterns.filter(p => p.severity === 'high'),
      medium: patterns.filter(p => p.severity === 'medium'),
      low: patterns.filter(p => p.severity === 'low')
    };
    
    if (bySeverity.high.length > 0) {
      console.log('   High Severity:');
      bySeverity.high.slice(0, 3).forEach(p => {
        console.log(`     - ${p.description} (${p.frequency} occurrences)`);
      });
    }
    
    if (bySeverity.medium.length > 0) {
      console.log('   Medium Severity:');
      bySeverity.medium.slice(0, 2).forEach(p => {
        console.log(`     - ${p.description}`);
      });
    }
  }
  
  /**
   * Log improvement application
   */
  async logImprovementApplication(improvement: Improvement): Promise<void> {
    console.log('\n🔧 Applying Improvement:');
    console.log(`   Tool: ${improvement.tool}`);
    console.log(`   Type: ${improvement.type}`);
    if (improvement.field) {
      console.log(`   Field: ${improvement.field}`);
    }
    console.log(`   Expected Impact: ${(improvement.expectedImpact * 100).toFixed(0)}%`);
  }
  
  /**
   * Log improvement result
   */
  async logImprovementResult(
    improvement: Improvement,
    beforeScore: number,
    afterScore: number,
    success: boolean
  ): Promise<void> {
    const delta = afterScore - beforeScore;
    const emoji = success ? '✅' : '❌';
    const change = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
    
    console.log(`\n${emoji} Improvement Result:`);
    console.log(`   Score Change: ${beforeScore.toFixed(1)}% → ${afterScore.toFixed(1)}% (${change}%)`);
    console.log(`   Status: ${success ? 'Accepted' : 'Reverted'}`);
    
    await this.appendMetrics({
      improvementApplied: {
        generation: this.currentGeneration,
        tool: improvement.tool,
        type: improvement.type,
        beforeScore,
        afterScore,
        delta,
        success,
        timestamp: new Date().toISOString()
      }
    });
  }
  
  /**
   * Log convergence state
   */
  async logConvergenceState(state: ConvergenceState): Promise<void> {
    if (state.hasConverged) {
      console.log('\n🎯 Convergence Achieved!');
      console.log(`   Best Score: ${state.bestScore.toFixed(1)}%`);
      console.log(`   Average Improvement: ${state.averageImprovement.toFixed(2)}% per generation`);
    } else if (state.plateauGenerations > 0) {
      console.log(`\n⚠️  Score plateau detected (${state.plateauGenerations} generations)`);
    }
  }
  
  /**
   * Generate progress visualization
   */
  async generateProgressReport(
    scoreHistory: number[],
    improvementHistory: Improvement[]
  ): Promise<string> {
    const report: string[] = [];
    
    report.push('# Evolution Progress Report\n');
    report.push(`Generated: ${new Date().toLocaleString()}\n`);
    
    // Score progression
    report.push('## Score Progression');
    report.push('```');
    
    // Simple ASCII chart
    const maxScore = Math.max(...scoreHistory);
    const minScore = Math.min(...scoreHistory);
    const range = maxScore - minScore || 1;
    const height = 10;
    
    for (let i = height; i >= 0; i--) {
      const threshold = minScore + (range * i / height);
      let line = `${threshold.toFixed(0).padStart(3)}% |`;
      
      scoreHistory.forEach((score, gen) => {
        if (score >= threshold) {
          line += ' * ';
        } else {
          line += '   ';
        }
      });
      
      report.push(line);
    }
    
    report.push('     +' + '---'.repeat(scoreHistory.length));
    report.push('      ' + scoreHistory.map((_, i) => `G${i + 1} `).join(''));
    report.push('```\n');
    
    // Improvement summary
    report.push('## Improvements Applied');
    report.push(`Total: ${improvementHistory.length}`);
    
    const byType = improvementHistory.reduce((acc, imp) => {
      acc[imp.type] = (acc[imp.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(byType).forEach(([type, count]) => {
      report.push(`- ${type}: ${count}`);
    });
    
    // Recent improvements
    if (improvementHistory.length > 0) {
      report.push('\n### Recent Improvements');
      improvementHistory.slice(-5).forEach(imp => {
        report.push(`- Gen ${imp.generation}: ${imp.tool} (${imp.type})`);
      });
    }
    
    // Performance metrics
    const duration = Date.now() - this.startTime;
    report.push('\n## Performance Metrics');
    report.push(`- Total Duration: ${(duration / 1000 / 60).toFixed(1)} minutes`);
    report.push(`- Generations: ${scoreHistory.length}`);
    report.push(`- Avg Time/Generation: ${scoreHistory.length > 0 ? (duration / scoreHistory.length / 1000 / 60).toFixed(1) : '0'} minutes`);
    
    const fullReport = report.join('\n');
    
    // Save report
    const reportPath = path.join(this.logDir, `progress-report-gen${scoreHistory.length}.md`);
    await fs.writeFile(reportPath, fullReport);
    
    return fullReport;
  }
  
  /**
   * Create evolution summary
   */
  async createEvolutionSummary(
    startScore: number,
    finalScore: number,
    generations: number,
    improvements: number,
    duration: number
  ): Promise<void> {
    const improvement = finalScore - startScore;
    const improvementRate = generations > 0 ? improvement / generations : 0;
    
    console.log('\n' + '='.repeat(60));
    console.log('📈 EVOLUTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Initial Score: ${startScore.toFixed(1)}%`);
    console.log(`Final Score: ${finalScore.toFixed(1)}%`);
    console.log(`Total Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);
    console.log(`Generations Run: ${generations}`);
    console.log(`Improvements Applied: ${improvements}`);
    console.log(`Average Improvement/Generation: ${improvementRate.toFixed(2)}%`);
    console.log(`Total Duration: ${(duration / 1000 / 60).toFixed(1)} minutes`);
    console.log('='.repeat(60) + '\n');
    
    // Save summary
    const summary = {
      startScore,
      finalScore,
      improvement,
      improvementRate,
      generations,
      improvements,
      duration,
      timestamp: new Date().toISOString()
    };
    
    await this.appendMetrics({ evolutionSummary: summary });
  }
  
  /**
   * Write the full metrics array to disk.
   */
  private async writeMetrics(entries: any[]): Promise<void> {
    await fs.writeFile(this.metricsFile, JSON.stringify(entries, null, 2));
  }
  
  /**
   * Append a single metrics entry (array-based schema).
   */
  private async appendMetrics(entry: any): Promise<void> {
    let all: any[] = [];
    try {
      const existing = await fs.readFile(this.metricsFile, 'utf-8');
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed)) {
        all = parsed;
      } else if (parsed) {
        all = [parsed];
      }
    } catch {
      /* file missing or invalid – start fresh */
    }
    all.push(entry);
    await this.writeMetrics(all);
  }
}