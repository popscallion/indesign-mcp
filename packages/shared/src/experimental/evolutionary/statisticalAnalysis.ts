/**
 * @fileoverview Statistical analysis utilities for pattern detection
 * Provides mathematical functions for analyzing pattern significance
 */

import { Pattern, DeviationPattern } from './types.js';

/**
 * Z-score lookup table for confidence intervals
 */
const Z_SCORES = new Map<number, number>([
  [0.90, 1.645],
  [0.95, 1.96],
  [0.99, 2.576]
]);

/**
 * Statistical analysis utilities
 */
export class StatisticalAnalysis {
  
  /**
   * Calculate standard deviation
   */
  static standardDeviation(values: number[], precomputedMean?: number): number {
    if (values.length === 0) return 0;
    
    const mean = precomputedMean ?? this.mean(values);
    const sumSquaredDiffs = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
    const variance = sumSquaredDiffs / values.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Calculate mean
   */
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  /**
   * Calculate median
   */
  static median(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    
    return sorted[mid];
  }
  
  /**
   * Calculate confidence interval
   */
  static confidenceInterval(values: number[], confidence: number = 0.95): {
    lower: number;
    upper: number;
    mean: number;
  } {
    const mean = this.mean(values);
    const stdDev = this.standardDeviation(values, mean); // Pass precomputed mean
    const n = values.length;
    
    // Use lookup table for Z-scores
    const zScore = Z_SCORES.get(confidence) || 1.96;
    
    const marginOfError = zScore * (stdDev / Math.sqrt(n));
    
    return {
      lower: mean - marginOfError,
      upper: mean + marginOfError,
      mean
    };
  }
  
  /**
   * Calculate pattern consistency score
   */
  static calculateConsistency(values: number[]): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return 1;
    
    const mean = this.mean(values);
    const stdDev = this.standardDeviation(values);
    
    // Coefficient of variation (lower is more consistent)
    const cv = mean !== 0 ? stdDev / Math.abs(mean) : 0;
    
    // Convert to 0-1 scale where 1 is most consistent
    return Math.max(0, 1 - cv);
  }
  
  /**
   * Group similar patterns
   */
  static groupPatterns(patterns: Pattern[]): Map<string, Pattern[]> {
    const groups = new Map<string, Pattern[]>();
    
    patterns.forEach(pattern => {
      // Group by type and similarity
      const groupKey = this.getPatternGroupKey(pattern);
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      
      groups.get(groupKey)!.push(pattern);
    });
    
    return groups;
  }
  
  /**
   * Calculate pattern significance
   */
  static calculateSignificance(pattern: Pattern, totalRuns: number): number {
    // Base significance on frequency and confidence
    const frequencyScore = pattern.frequency / totalRuns;
    const confidenceScore = pattern.confidence;
    
    // Weight by severity
    const severityWeight = {
      'high': 1.0,
      'medium': 0.7,
      'low': 0.4
    }[pattern.severity];
    
    return (frequencyScore + confidenceScore) / 2 * severityWeight;
  }
  
  /**
   * Analyze deviation patterns
   */
  static analyzeDeviations(deviations: Array<{
    field: string;
    expected: any;
    actual: any;
    deviation: number;
  }>): DeviationPattern[] {
    const fieldMap = new Map<string, number[]>();
    
    // Group deviations by field
    deviations.forEach(dev => {
      if (!fieldMap.has(dev.field)) {
        fieldMap.set(dev.field, []);
      }
      fieldMap.get(dev.field)!.push(dev.deviation);
    });
    
    // Analyze each field
    const patterns: DeviationPattern[] = [];
    
    fieldMap.forEach((values, field) => {
      const mean = this.mean(values);
      const consistency = this.calculateConsistency(values);
      
      // Determine direction
      const positiveCount = values.filter(v => v > 0).length;
      const negativeCount = values.filter(v => v < 0).length;
      const direction = positiveCount > negativeCount ? 'over' : 
                       negativeCount > positiveCount ? 'under' : 'wrong';
      
      patterns.push({
        attribute: field,
        direction,
        averageDeviation: Math.abs(mean),
        consistency,
        occurrences: values.length
      });
    });
    
    return patterns;
  }
  
  /**
   * Calculate correlation between two sets of values
   */
  static correlation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const meanX = this.mean(x);
    const meanY = this.mean(y);
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    
    for (let i = 0; i < x.length; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }
    
    const denominator = Math.sqrt(denomX * denomY);
    
    return denominator !== 0 ? numerator / denominator : 0;
  }
  
  /**
   * Find outliers using IQR method
   */
  static findOutliers(values: number[]): {
    outliers: number[];
    lowerBound: number;
    upperBound: number;
  } {
    if (values.length < 4) {
      return { outliers: [], lowerBound: 0, upperBound: 0 };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const outliers = values.filter(v => v < lowerBound || v > upperBound);
    
    return { outliers, lowerBound, upperBound };
  }
  
  /**
   * Generate pattern group key for similarity grouping
   */
  private static getPatternGroupKey(pattern: Pattern): string {
    // Group by type and main characteristic
    let key = pattern.type;
    
    switch (pattern.type) {
      case 'tool-sequence': {
        // Extract main tools from description
        const tools = pattern.description.match(/(\w+_\w+)/g);
        if (tools) {
          key += ':' + tools.slice(0, 2).join('-');
        }
        break;
      }
        
      case 'parameter-choice': {
        // Extract tool name
        const toolMatch = pattern.description.match(/for (\w+):/);
        if (toolMatch) {
          key += ':' + toolMatch[1];
        }
        break;
      }
        
      case 'visual-deviation': {
        // Extract attribute
        const attrMatch = pattern.description.match(/in (\w+)/);
        if (attrMatch) {
          key += ':' + attrMatch[1];
        }
        break;
      }
    }
    
    return key;
  }
  
}