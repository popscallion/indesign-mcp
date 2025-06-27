/**
 * @fileoverview Pattern presentation for Claude Code analysis
 * Formats pattern data for direct analysis by Claude Code
 */

import { Pattern, PatternAnalysis, Improvement, TestRun } from './types.js';
import { PatternPresenter } from './patternPresenter.js';

/**
 * Formats pattern data for Claude Code's direct analysis
 * No API integration - just clear presentation of patterns
 */
export class ClaudeAnalyzer {
  private presenter: PatternPresenter;
  
  constructor() {
    this.presenter = new PatternPresenter();
  }
  
  /**
   * Format pattern analysis for Claude Code's review
   * Returns a clear, structured report for analysis
   */
  async formatPatternAnalysis(
    runs: TestRun[],
    patterns: Pattern[],
    referenceImage: string,
    taskDescription: string
  ): Promise<string> {
    // Get pattern analysis
    const analysis = await this.presenter.presentToClaudeForAnalysis(
      runs,
      patterns,
      referenceImage,
      taskDescription
    );
    
    // Generate comprehensive report
    const report = this.presenter.generateReport(analysis);
    const improvementContext = this.presenter.generateImprovementContext(analysis);
    
    // Format for display
    return this.formatForDisplay(report, improvementContext, analysis);
  }
  
  /**
   * Format patterns for clear display
   */
  private formatForDisplay(
    report: string,
    improvementContext: string,
    analysis: PatternAnalysis
  ): string {
    return `# Pattern Analysis Report

## Overview
- Test Case: ${analysis.testCase}
- Agents Analyzed: ${analysis.totalRuns}
- Average Score: ${analysis.averageScore.toFixed(1)}%
- Patterns Detected: ${analysis.patterns.length}

## Pattern Analysis
${report}

## Context for Improvements
${improvementContext}

## Key Findings

### Most Common Issues:
${this.formatTopIssues(analysis.patterns)}

### Suggested Focus Areas:
${this.formatFocusAreas(analysis)}

## Next Steps
Based on these patterns, you (Claude Code) should:
1. Analyze which patterns are most impactful
2. Generate specific tool description improvements
3. Apply improvements to the MCP tools
4. Test with new agents to measure impact`;
  }
  
  /**
   * Format top issues for clarity
   */
  private formatTopIssues(patterns: Pattern[]): string {
    const sorted = [...patterns].sort((a, b) => b.frequency - a.frequency);
    const top5 = sorted.slice(0, 5);
    
    return top5.map((p, i) => 
      `${i + 1}. **${p.description}** (${p.frequency} occurrences, ${p.severity} severity)`
    ).join('\n');
  }
  
  /**
   * Suggest focus areas based on patterns
   */
  private formatFocusAreas(analysis: PatternAnalysis): string {
    const areas: string[] = [];
    
    // Check for font size issues
    const fontPatterns = analysis.patterns.filter(p => 
      p.description.toLowerCase().includes('font') || 
      p.description.toLowerCase().includes('size')
    );
    if (fontPatterns.length > 0) {
      areas.push('- **Typography**: Add explicit size ranges and visual hierarchy guidance');
    }
    
    // Check for positioning issues
    const positionPatterns = analysis.patterns.filter(p => 
      p.description.toLowerCase().includes('position') || 
      p.description.toLowerCase().includes('align')
    );
    if (positionPatterns.length > 0) {
      areas.push('- **Positioning**: Clarify coordinate systems and alignment references');
    }
    
    // Check for missing tools
    const missingPatterns = analysis.patterns.filter(p => p.type === 'missing-tool');
    if (missingPatterns.length > 0) {
      areas.push('- **Tool Discovery**: Emphasize when specific tools should be used');
    }
    
    return areas.join('\n') || '- No specific focus areas identified';
  }
  
  /**
   * Create an improvement object structure for Claude Code
   * This is a template that Claude Code can fill in
   */
  createImprovementTemplate(): Improvement {
    return {
      tool: '[tool_name]',
      type: 'description',
      field: '[optional_field]',
      current: '[current_text]',
      proposed: '[proposed_text]',
      rationale: '[why_this_improvement]',
      expectedImpact: 0.5,
      generation: 0
    };
  }
}