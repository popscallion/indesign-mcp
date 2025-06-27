/**
 * @fileoverview Pattern presentation system for Claude analysis
 * Formats pattern data into structured reports for improvement generation
 */

import { Pattern, PatternAnalysis, PatternStatistics, ContextualInfo, TestRun } from './types.js';
import { ToolCall } from '../../tools/telemetry.js';
import { StatisticalAnalysis } from './statisticalAnalysis.js';

/**
 * Presents pattern analysis results in a format optimized for Claude's analysis
 */
export class PatternPresenter {
  private readonly maxReportLength = 15000; // Approximate character limit for reports
  
  /**
   * Create a comprehensive pattern report for Claude
   */
  async presentToClaudeForAnalysis(
    runs: TestRun[],
    patterns: Pattern[],
    referenceImage: string,
    taskDescription: string
  ): Promise<PatternAnalysis> {
    // Group and sort patterns by significance
    const groupedPatterns = StatisticalAnalysis.groupPatterns(patterns);
    const sortedPatterns = this.sortPatternsBySignificance(patterns, runs.length);
    
    // Generate statistics
    const statistics = this.generateStatistics(sortedPatterns, runs);
    
    // Extract contextual information
    const contextualInfo = this.extractContextualInfo(runs, referenceImage, taskDescription);
    
    // Calculate average score from runs
    const scores = runs.map(r => r.comparisonResult?.score || 0);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    return {
      patterns: sortedPatterns,
      statistics,
      contextualInfo,
      testCase: taskDescription,
      totalRuns: runs.length,
      averageScore
    };
  }
  
  /**
   * Generate formatted report for Claude
   */
  generateReport(analysis: PatternAnalysis): string {
    const report: string[] = [];
    
    report.push('# Pattern Analysis Report\n');
    
    // Context section
    report.push('## Context');
    report.push(`- Task: ${analysis.contextualInfo.taskDescription}`);
    report.push(`- Reference: ${analysis.contextualInfo.referenceImage}`);
    report.push(`- Document Type: ${analysis.contextualInfo.documentType || 'Unknown'}`);
    report.push('');
    
    // Summary statistics
    report.push('## Summary');
    report.push(`- Total Patterns Detected: ${analysis.patterns.length}`);
    report.push(`- High Severity: ${analysis.patterns.filter(p => p.severity === 'high').length}`);
    report.push(`- Medium Severity: ${analysis.patterns.filter(p => p.severity === 'medium').length}`);
    report.push(`- Low Severity: ${analysis.patterns.filter(p => p.severity === 'low').length}`);
    report.push('');
    
    // Common failure points
    if (analysis.contextualInfo.commonFailurePoints.length > 0) {
      report.push('## Common Failure Points');
      analysis.contextualInfo.commonFailurePoints.forEach(point => {
        report.push(`- ${point}`);
      });
      report.push('');
    }
    
    // Detailed patterns
    report.push('## Detailed Pattern Analysis\n');
    
    // Group patterns by type
    const patternsByType = new Map<string, Pattern[]>();
    analysis.patterns.forEach(pattern => {
      if (!patternsByType.has(pattern.type)) {
        patternsByType.set(pattern.type, []);
      }
      patternsByType.get(pattern.type)!.push(pattern);
    });
    
    // Report each pattern type
    patternsByType.forEach((patterns, type) => {
      report.push(`### ${this.formatPatternType(type)}\n`);
      
      patterns.forEach((pattern, index) => {
        report.push(`#### Pattern ${index + 1}: ${pattern.description}`);
        report.push(`- **Frequency**: ${pattern.frequency} occurrences`);
        report.push(`- **Confidence**: ${(pattern.confidence * 100).toFixed(1)}%`);
        report.push(`- **Severity**: ${pattern.severity}`);
        
        // Add specific examples
        if (pattern.examples.length > 0) {
          report.push('- **Examples**:');
          pattern.examples.slice(0, 3).forEach(example => {
            report.push(`  - Agent ${example.agentId}: ${example.context}`);
          });
        }
        
        report.push('');
      });
    });
    
    // Statistical summary
    report.push('## Statistical Summary\n');
    analysis.statistics.forEach(stat => {
      report.push(`### ${stat.pattern}`);
      report.push(`- Frequency: ${stat.frequency}`);
      report.push(`- Average Deviation: ${stat.averageDeviation.toFixed(1)}%`);
      if (stat.examples.length > 0) {
        report.push('- Examples:');
        stat.examples.forEach(ex => report.push(`  - ${ex}`));
      }
      report.push('');
    });
    
    const fullReport = report.join('\n');
    
    // Truncate if too long
    if (fullReport.length > this.maxReportLength) {
      const truncated = fullReport.substring(0, this.maxReportLength);
      const lastNewline = truncated.lastIndexOf('\n');
      return truncated.substring(0, lastNewline) + '\n\n[Report truncated for length...]';
    }
    
    return fullReport;
  }
  
  /**
   * Sort patterns by significance
   */
  private sortPatternsBySignificance(patterns: Pattern[], totalRuns: number): Pattern[] {
    return patterns.sort((a, b) => {
      const sigA = StatisticalAnalysis.calculateSignificance(a, totalRuns);
      const sigB = StatisticalAnalysis.calculateSignificance(b, totalRuns);
      return sigB - sigA;
    });
  }
  
  /**
   * Generate pattern statistics
   */
  private generateStatistics(patterns: Pattern[], runs: TestRun[]): PatternStatistics[] {
    const stats: PatternStatistics[] = [];
    
    patterns.forEach(pattern => {
      // Calculate frequency string
      const frequency = `${pattern.frequency}/${runs.length} agents`;
      
      // Calculate average deviation for this pattern
      let averageDeviation = 0;
      if (pattern.type === 'visual-deviation') {
        // Extract deviation from description
        const match = pattern.description.match(/avg: ([\d.]+)%/);
        if (match) {
          averageDeviation = parseFloat(match[1]);
        }
      }
      
      // Format examples
      const examples = this.formatPatternExamples(pattern);
      
      stats.push({
        pattern: pattern.description,
        frequency,
        averageDeviation,
        examples
      });
    });
    
    return stats;
  }
  
  /**
   * Extract contextual information
   */
  private extractContextualInfo(
    runs: TestRun[],
    referenceImage: string,
    taskDescription: string
  ): ContextualInfo {
    const commonFailurePoints: string[] = [];
    
    // Analyze common issues across runs
    const allDeviations = runs
      .filter(r => r.comparisonResult?.deviations)
      .flatMap(r => r.comparisonResult!.deviations);
    
    // Group deviations by type
    const deviationTypes = new Map<string, number>();
    allDeviations.forEach(dev => {
      const count = deviationTypes.get(dev.field) || 0;
      deviationTypes.set(dev.field, count + 1);
    });
    
    // Find most common failure points
    Array.from(deviationTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([field, count]) => {
        const percentage = (count / runs.length * 100).toFixed(0);
        commonFailurePoints.push(`${field} issues in ${percentage}% of runs`);
      });
    
    // Detect document type from tool usage
    const documentType = this.detectDocumentType(runs);
    
    return {
      referenceImage,
      taskDescription,
      commonFailurePoints,
      documentType
    };
  }
  
  /**
   * Format pattern examples for readability
   */
  private formatPatternExamples(pattern: Pattern): string[] {
    const examples: string[] = [];
    
    pattern.examples.slice(0, 3).forEach(example => {
      switch (pattern.type) {
        case 'tool-sequence': {
          const tools = example.toolCalls.map(c => c.tool).join(' → ');
          examples.push(`${example.agentId}: ${tools}`);
          break;
        }
          
        case 'parameter-choice': {
          const call = example.toolCalls[0];
          const params = JSON.stringify(call.parameters);
          examples.push(`${example.agentId}: ${call.tool}(${params})`);
          break;
        }
          
        case 'error-pattern': {
          const error = example.toolCalls[0];
          examples.push(`${example.agentId}: ${error.tool} - ${error.errorMessage}`);
          break;
        }
          
        case 'visual-deviation':
          if (example.deviation !== undefined) {
            examples.push(`${example.agentId}: ${example.deviation}% deviation`);
          }
          break;
          
        default:
          examples.push(`${example.agentId}: ${example.context}`);
      }
    });
    
    return examples;
  }
  
  /**
   * Detect document type from tool usage patterns
   */
  private detectDocumentType(runs: TestRun[]): string {
    const toolFrequency = new Map<string, number>();
    
    runs.forEach(run => {
      run.telemetry.calls.forEach((call: ToolCall) => {
        const count = toolFrequency.get(call.tool) || 0;
        toolFrequency.set(call.tool, count + 1);
      });
    });
    
    // Heuristic detection based on tool usage
    if (toolFrequency.has('create_table')) {
      return 'Data/Report Document';
    } else if (toolFrequency.get('create_paragraph_style') || 0 > 3) {
      return 'Text-Heavy Document';
    } else if (toolFrequency.has('place_file')) {
      return 'Image-Based Layout';
    } else {
      return 'General Layout';
    }
  }
  
  /**
   * Format pattern type for display
   */
  private formatPatternType(type: string): string {
    const typeMap: Record<string, string> = {
      'tool-sequence': 'Tool Sequence Patterns',
      'parameter-choice': 'Parameter Choice Patterns',
      'error-pattern': 'Error Patterns',
      'visual-deviation': 'Visual Deviation Patterns',
      'missing-tool': 'Missing Tool Patterns',
      'redundant-call': 'Redundant Call Patterns'
    };
    
    return typeMap[type] || type;
  }
  
  /**
   * Generate improvement suggestions based on patterns
   */
  generateImprovementContext(analysis: PatternAnalysis): string {
    const context: string[] = [];
    
    context.push('Based on the pattern analysis, here are the key areas for improvement:\n');
    
    // High-severity patterns first
    const highSeverity = analysis.patterns.filter(p => p.severity === 'high');
    if (highSeverity.length > 0) {
      context.push('## Critical Issues (High Severity)\n');
      highSeverity.forEach(pattern => {
        context.push(`- **${pattern.description}**`);
        context.push(`  - Occurs in ${pattern.frequency} runs`);
        context.push(`  - Confidence: ${(pattern.confidence * 100).toFixed(0)}%`);
        
        // Suggest specific improvements based on pattern type
        const suggestion = this.suggestImprovement(pattern);
        if (suggestion) {
          context.push(`  - Suggested improvement: ${suggestion}`);
        }
        context.push('');
      });
    }
    
    // Medium severity patterns
    const mediumSeverity = analysis.patterns.filter(p => p.severity === 'medium');
    if (mediumSeverity.length > 0) {
      context.push('## Important Issues (Medium Severity)\n');
      mediumSeverity.slice(0, 5).forEach(pattern => {
        context.push(`- ${pattern.description}`);
      });
      context.push('');
    }
    
    return context.join('\n');
  }
  
  /**
   * Suggest improvement based on pattern type
   */
  private suggestImprovement(pattern: Pattern): string | null {
    switch (pattern.type) {
      case 'parameter-choice':
        return 'Update parameter description or add validation/guidance';
        
      case 'visual-deviation':
        return 'Add explicit size/positioning hints to tool descriptions';
        
      case 'missing-tool':
        return 'Add examples showing when to use these tools';
        
      case 'tool-sequence':
        return 'Document proper tool ordering in descriptions';
        
      case 'error-pattern':
        return 'Improve error messages or parameter validation';
        
      case 'redundant-call':
        return 'Clarify when multiple calls are necessary';
        
      default:
        return null;
    }
  }
}