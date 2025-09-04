/**
 * @fileoverview Pattern analysis engine for evolutionary testing
 * Detects recurring patterns in agent behavior across multiple runs
 */

import { Pattern, PatternExample, DeviationPattern, TestRun } from './types.js';
import { TelemetrySession } from "../../telemetry.js";

/**
 * Analyzes patterns across multiple test runs to identify systematic issues
 */
export class PatternAnalyzer {
  private readonly minFrequency: number;
  private readonly confidenceThreshold: number;
  
  constructor(options: {
    minFrequency?: number;
    confidenceThreshold?: number;
  } = {}) {
    this.minFrequency = options.minFrequency || 2;
    this.confidenceThreshold = options.confidenceThreshold || 0.6;
  }
  
  /**
   * Analyze patterns across all runs
   */
  analyzePatterns(runs: TestRun[]): Pattern[] {
    const patterns: Pattern[] = [];
    
    // Guard against empty runs
    if (!runs || runs.length === 0) {
      console.log('No runs available for pattern analysis');
      return patterns;
    }
    
    // Skip if insufficient data
    if (runs.length < this.minFrequency) {
      console.log(`Insufficient runs (${runs.length}) for pattern analysis`);
      return patterns;
    }
    
    // Check if we have telemetry data
    const hasTelemetry = runs.some(r => r.telemetry && r.telemetry.calls && r.telemetry.calls.length > 0);
    
    if (hasTelemetry) {
      console.log('✓ Telemetry data available - performing full pattern analysis');
      // Analyze tool-based patterns
      patterns.push(...this.findToolSequencePatterns(runs));
      patterns.push(...this.findParameterChoicePatterns(runs));
      patterns.push(...this.findErrorPatterns(runs));
      patterns.push(...this.findMissingToolPatterns(runs));
      patterns.push(...this.findRedundantCallPatterns(runs));
    } else {
      console.log('⚠️  No telemetry data - analyzing layout deviations only');
    }
    
    // Always analyze visual deviations (doesn't require telemetry)
    patterns.push(...this.findVisualDeviationPatterns(runs));
    
    // Filter by minimum frequency and confidence
    return patterns.filter(p => 
      p.frequency >= this.minFrequency && 
      p.confidence >= this.confidenceThreshold
    );
  }
  
  /**
   * Find patterns in tool call sequences
   */
  private findToolSequencePatterns(runs: TestRun[]): Pattern[] {
    const patterns: Pattern[] = [];
    const sequenceMap = new Map<string, PatternExample[]>();
    
    // Skip if no telemetry
    const runsWithTelemetry = runs.filter(r => r.telemetry?.calls?.length > 0);
    if (runsWithTelemetry.length === 0) {
      return patterns;
    }
    
    // Optimization: Only track sequences that appear at least twice
    const frequentSequences = new Map<string, number>();
    
    // First pass: Count sequences to identify frequent ones
    runsWithTelemetry.forEach(run => {
      const toolSequence = this.extractToolSequence(run.telemetry);
      const seenInThisRun = new Set<string>();
      
      // Use sliding window for better performance
      for (let length = 2; length <= Math.min(4, toolSequence.length); length++) {
        for (let i = 0; i <= toolSequence.length - length; i++) {
          const subsequence = toolSequence.slice(i, i + length);
          const key = subsequence.join(' → ');
          
          // Only count once per run to avoid inflating frequencies
          if (!seenInThisRun.has(key)) {
            seenInThisRun.add(key);
            frequentSequences.set(key, (frequentSequences.get(key) || 0) + 1);
          }
        }
      }
    });
    
    // Second pass: Only collect examples for frequent sequences
    runs.forEach(run => {
      const toolSequence = this.extractToolSequence(run.telemetry);
      
      for (let length = 2; length <= Math.min(4, toolSequence.length); length++) {
        for (let i = 0; i <= toolSequence.length - length; i++) {
          const subsequence = toolSequence.slice(i, i + length);
          const key = subsequence.join(' → ');
          
          // Only process if sequence is frequent
          if ((frequentSequences.get(key) || 0) >= this.minFrequency) {
            if (!sequenceMap.has(key)) {
              sequenceMap.set(key, []);
            }
            
            sequenceMap.get(key)!.push({
              agentId: run.agentId,
              toolCalls: run.telemetry.calls.slice(i, i + length),
              context: `Tools ${i + 1}-${i + length} of ${toolSequence.length}`
            });
          }
        }
      }
    });
    
    // Identify frequent sequences
    sequenceMap.forEach((examples, sequence) => {
      if (examples.length >= this.minFrequency) {
        const frequency = examples.length / runs.length;
        
        // Check if this sequence correlates with failures
        const failureCorrelation = this.calculateFailureCorrelation(examples, runs);
        
        if (failureCorrelation > 0.5) {
          patterns.push({
            type: 'tool-sequence',
            frequency: examples.length,
            description: `Problematic tool sequence: ${sequence}`,
            examples,
            confidence: failureCorrelation,
            severity: failureCorrelation > 0.8 ? 'high' : 'medium'
          });
        }
      }
    });
    
    return patterns;
  }
  
  /**
   * Find patterns in parameter choices
   */
  private findParameterChoicePatterns(runs: TestRun[]): Pattern[] {
    const patterns: Pattern[] = [];
    const parameterMap = new Map<string, Map<string, PatternExample[]>>();
    
    // Collect parameter choices by tool
    runs.forEach(run => {
      run.telemetry.calls.forEach(call => {
        if (!parameterMap.has(call.tool)) {
          parameterMap.set(call.tool, new Map());
        }
        
        const toolParams = parameterMap.get(call.tool)!;
        
        // Analyze each parameter
        Object.entries(call.parameters).forEach(([param, value]) => {
          const key = `${param}=${JSON.stringify(value)}`;
          
          if (!toolParams.has(key)) {
            toolParams.set(key, []);
          }
          
          toolParams.get(key)!.push({
            agentId: run.agentId,
            toolCalls: [call],
            context: `Parameter choice for ${call.tool}`
          });
        });
      });
    });
    
    // Find consistent parameter choices
    parameterMap.forEach((paramChoices, tool) => {
      paramChoices.forEach((examples, paramValue) => {
        if (examples.length >= this.minFrequency) {
          const frequency = examples.length / runs.length;
          
          // Check if this parameter choice leads to issues
          const scores = examples.map(ex => {
            const run = runs.find(r => r.agentId === ex.agentId);
            return run?.comparisonResult?.score || 0;
          });
          
          const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
          
          // If average score is low, this parameter choice might be problematic
          if (avgScore < 70) {
            patterns.push({
              type: 'parameter-choice',
              frequency: examples.length,
              description: `Common parameter choice for ${tool}: ${paramValue}`,
              examples,
              confidence: 1 - (avgScore / 100),
              severity: avgScore < 50 ? 'high' : 'medium'
            });
          }
        }
      });
    });
    
    return patterns;
  }
  
  /**
   * Find error patterns
   */
  private findErrorPatterns(runs: TestRun[]): Pattern[] {
    const patterns: Pattern[] = [];
    const errorMap = new Map<string, PatternExample[]>();
    
    runs.forEach(run => {
      run.telemetry.calls
        .filter(call => call.result === 'error')
        .forEach(call => {
          const errorKey = `${call.tool}:${call.errorMessage || 'unknown'}`;
          
          if (!errorMap.has(errorKey)) {
            errorMap.set(errorKey, []);
          }
          
          errorMap.get(errorKey)!.push({
            agentId: run.agentId,
            toolCalls: [call],
            context: `Error in ${call.tool}`
          });
        });
    });
    
    // Create patterns for frequent errors
    errorMap.forEach((examples, errorKey) => {
      if (examples.length >= this.minFrequency) {
        const [tool, error] = errorKey.split(':');
        
        patterns.push({
          type: 'error-pattern',
          frequency: examples.length,
          description: `Repeated error in ${tool}: ${error}`,
          examples,
          confidence: 1.0, // Errors are definitive
          severity: 'high'
        });
      }
    });
    
    return patterns;
  }
  
  /**
   * Find visual deviation patterns
   */
  private findVisualDeviationPatterns(runs: TestRun[]): Pattern[] {
    const patterns: Pattern[] = [];
    const deviationMap = new Map<string, {
      pattern: DeviationPattern;
      examples: PatternExample[];
    }>();
    
    runs.forEach(run => {
      if (run.comparisonResult?.deviations) {
        run.comparisonResult.deviations.forEach(dev => {
          const key = `${dev.type}-${dev.field}`;
          
          if (!deviationMap.has(key)) {
            deviationMap.set(key, {
              pattern: {
                attribute: dev.field,
                direction: this.determineDirection(dev),
                averageDeviation: 0,
                consistency: 0,
                occurrences: 0
              },
              examples: []
            });
          }
          
          const entry = deviationMap.get(key)!;
          entry.pattern.occurrences++;
          
          // Update running average
          entry.pattern.averageDeviation = 
            (entry.pattern.averageDeviation * (entry.pattern.occurrences - 1) + dev.deviation) / 
            entry.pattern.occurrences;
          
          // Collect example
          entry.examples.push({
            agentId: run.agentId,
            toolCalls: [],
            context: `${dev.field}: expected ${dev.expected}, actual ${dev.actual}`,
            deviation: dev.deviation
          });
        });
      }
    });
    
    // Convert to patterns
    deviationMap.forEach((entry, key) => {
      if (entry.pattern.occurrences >= this.minFrequency) {
        const frequency = entry.pattern.occurrences / runs.length;
        
        patterns.push({
          type: 'visual-deviation',
          frequency: entry.pattern.occurrences,
          description: `Consistent ${entry.pattern.direction} deviation in ${entry.pattern.attribute} (avg: ${entry.pattern.averageDeviation.toFixed(1)}%)`,
          examples: entry.examples.slice(0, 5), // Keep top 5 examples
          confidence: frequency,
          severity: entry.pattern.averageDeviation > 20 ? 'high' : 'medium'
        });
      }
    });
    
    return patterns;
  }
  
  /**
   * Find tools that should be used but aren't
   */
  private findMissingToolPatterns(runs: TestRun[]): Pattern[] {
    const patterns: Pattern[] = [];
    
    // Define expected tools for common scenarios
    const expectedTools = {
      'text-hierarchy': ['create_paragraph_style', 'apply_paragraph_style'],
      'layout-structure': ['create_textframe', 'position_textframe'],
      'font-styling': ['create_character_style', 'apply_character_style']
    };
    
    // Check each scenario
    Object.entries(expectedTools).forEach(([scenario, tools]) => {
      const examples: PatternExample[] = [];
      
      runs.forEach(run => {
        const usedTools = new Set(run.telemetry.calls.map(c => c.tool));
        const missingTools = tools.filter(tool => !usedTools.has(tool));
        
        if (missingTools.length > 0) {
          examples.push({
            agentId: run.agentId,
            toolCalls: [],
            context: `Missing tools: ${missingTools.join(', ')}`
          });
        }
      });
      
      if (examples.length >= this.minFrequency) {
        patterns.push({
          type: 'missing-tool',
          frequency: examples.length,
          description: `Missing expected tools for ${scenario}: ${tools.join(', ')}`,
          examples: examples.slice(0, 5), // Keep top 5 examples
          confidence: examples.length / runs.length,
          severity: 'medium'
        });
      }
    });
    
    return patterns;
  }
  
  /**
   * Find redundant/repeated tool calls
   */
  private findRedundantCallPatterns(runs: TestRun[]): Pattern[] {
    const patterns: Pattern[] = [];
    const redundancyMap = new Map<string, PatternExample[]>();
    
    runs.forEach(run => {
      const toolCounts = new Map<string, number>();
      
      run.telemetry.calls.forEach(call => {
        const count = toolCounts.get(call.tool) || 0;
        toolCounts.set(call.tool, count + 1);
      });
      
      // Look for tools called more than necessary
      toolCounts.forEach((count, tool) => {
        if (count > 3) { // Arbitrary threshold
          const key = `${tool}-${count}x`;
          
          if (!redundancyMap.has(key)) {
            redundancyMap.set(key, []);
          }
          
          redundancyMap.get(key)!.push({
            agentId: run.agentId,
            toolCalls: run.telemetry.calls.filter(c => c.tool === tool),
            context: `Called ${count} times`
          });
        }
      });
    });
    
    // Create patterns for frequent redundancies
    redundancyMap.forEach((examples, key) => {
      if (examples.length >= this.minFrequency) {
        const [tool, countStr] = key.split('-');
        
        patterns.push({
          type: 'redundant-call',
          frequency: examples.length,
          description: `Tool ${tool} called excessively (${countStr})`,
          examples,
          confidence: examples.length / runs.length,
          severity: 'low'
        });
      }
    });
    
    return patterns;
  }
  
  /**
   * Extract tool sequence from telemetry
   */
  private extractToolSequence(telemetry: TelemetrySession): string[] {
    return telemetry.calls.map(call => call.tool);
  }
  
  /**
   * Calculate correlation between pattern and failures
   */
  private calculateFailureCorrelation(examples: PatternExample[], runs: TestRun[]): number {
    const scores = examples.map(ex => {
      const run = runs.find(r => r.agentId === ex.agentId);
      return run?.comparisonResult?.score || 0;
    });
    
    if (scores.length === 0) return 0;
    
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // Calculate variance to account for consistency
    const variance = scores.reduce((sum, score) => {
      return sum + Math.pow(score - avgScore, 2);
    }, 0) / scores.length;
    
    const stdDev = Math.sqrt(variance);
    
    // If scores are highly variable, reduce confidence
    const consistencyFactor = stdDev > 20 ? 0.7 : 1.0;
    
    // Convert score to failure correlation (lower score = higher correlation)
    // Apply consistency factor to avoid false positives from mixed results
    return (1 - (avgScore / 100)) * consistencyFactor;
  }
  
  /**
   * Determine deviation direction
   */
  private determineDirection(deviation: any, tolerance: number = 0.05): 'over' | 'under' | 'wrong' {
    if (typeof deviation.expected === 'number' && typeof deviation.actual === 'number') {
      const percentDiff = Math.abs(deviation.actual - deviation.expected) / deviation.expected;
      
      // If within tolerance, consider it correct (not a deviation)
      if (percentDiff <= tolerance) {
        return 'wrong'; // Will be filtered out by other logic
      }
      
      return deviation.actual > deviation.expected ? 'over' : 'under';
    }
    return 'wrong';
  }
}