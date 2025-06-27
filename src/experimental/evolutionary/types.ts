/**
 * @fileoverview Type definitions for evolutionary testing system
 */

import { LayoutMetrics, ComparisonResult } from '../../types.js';
import { ToolCall, TelemetrySession } from '../../tools/telemetry.js';

/**
 * Improvement types that can be applied to MCP tools
 */
export type ImprovementType = 'description' | 'parameter' | 'example' | 'constraint';

/**
 * Proposed improvement for a tool
 */
export interface Improvement {
  id?: string;
  type: ImprovementType;
  tool: string;
  field?: string;
  current: string;
  proposed: string;
  rationale: string;
  expectedImpact: number; // 0-1
  generation: number;
}

/**
 * Result of applying an improvement
 */
export interface ImprovementResult {
  improvement: Improvement;
  beforeScore: number;
  afterScore: number;
  success: boolean;
  reverted: boolean;
  error?: string;
}

/**
 * Pattern analysis result
 */
export interface PatternAnalysis {
  patterns: Pattern[];
  statistics: PatternStatistics[];
  contextualInfo: ContextualInfo;
  testCase: string;
  totalRuns: number;
  averageScore: number;
}

/**
 * Pattern with detailed statistics
 */
export interface Pattern {
  type: PatternType;
  frequency: number;
  description: string;
  examples: PatternExample[];
  confidence: number;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Types of patterns that can be detected
 */
export type PatternType = 
  | 'tool-sequence'      // Patterns in tool call ordering
  | 'parameter-choice'   // Systematic parameter selections
  | 'error-pattern'      // Repeated errors
  | 'visual-deviation'   // Consistent visual mismatches
  | 'missing-tool'       // Tools that should be used but aren't
  | 'redundant-call';    // Unnecessary repeated calls

/**
 * Example of a pattern occurrence
 */
export interface PatternExample {
  agentId: string;
  toolCalls: ToolCall[];
  context: string;
  deviation?: number;
}

/**
 * Statistical summary of patterns
 */
export interface PatternStatistics {
  pattern: string;
  frequency: string; // e.g., "3/3 agents"
  averageDeviation: number;
  examples: string[]; // Formatted examples
}

/**
 * Contextual information for pattern analysis
 */
export interface ContextualInfo {
  referenceImage: string;
  taskDescription: string;
  commonFailurePoints: string[];
  documentType?: string;
}

/**
 * Deviation pattern analysis
 */
export interface DeviationPattern {
  attribute: string; // e.g., "fontSize", "alignment"
  direction: 'over' | 'under' | 'wrong';
  averageDeviation: number;
  consistency: number; // 0-1, how consistent is this error
  occurrences: number;
}

/**
 * Evolution cycle result
 */
export interface EvolutionCycle {
  generation: number;
  beforeScore: number;
  afterScore: number;
  improvement: Improvement;
  patterns: Pattern[];
  success: boolean;
  duration: number;
}

/**
 * Complete evolution history
 */
export interface EvolutionHistory {
  testCase: string;
  startTime: Date;
  endTime?: Date;
  initialScore: number;
  finalScore: number;
  cycles: EvolutionCycle[];
  totalImprovements: number;
  successfulImprovements: number;
  revertedImprovements: number;
}

/**
 * Test configuration for evolutionary runs
 */
export interface TestConfig {
  testCase: string;
  agentCount: number;
  generation: number;
  maxGenerations: number;
  targetScore: number;
  improvementThreshold: number;
  referenceMetrics: LayoutMetrics;
  referenceImage: string;
  referenceDescription?: string;
}

/**
 * Result from a single agent run
 */
export interface TestRun {
  agentId: string;
  telemetry: TelemetrySession;
  extractedMetrics?: LayoutMetrics;
  comparisonResult?: ComparisonResult;
  duration: number;
  success: boolean;
  error?: string;
  generation?: number;
}

/**
 * Result from a complete generation
 */
export interface GenerationResult {
  generation: number;
  runs: TestRun[];
  patterns: Pattern[];
  averageScore: number;
  bestScore: number;
  worstScore: number;
}

/**
 * Configuration for evolution orchestrator
 */
export interface EvolutionConfig extends TestConfig {
  createEvolutionBranch?: boolean;
  resumeFromGeneration?: number;
  toolsDir?: string;
  repoPath?: string;
  patternMinFrequency?: number;
  patternConfidenceThreshold?: number;
}

/**
 * Result of complete evolution run
 */
export interface EvolutionResult {
  startScore: number;
  finalScore: number;
  generationsRun: number;
  improvementsApplied: number;
  improvementsSuccessful: number;
  totalDuration: number;
  convergenceAchieved: boolean;
  scoreHistory: number[];
  generationResults: GenerationResult[];
}

/**
 * Convergence state tracking
 */
export interface ConvergenceState {
  hasConverged: boolean;
  plateauGenerations: number;
  bestScore: number;
  averageImprovement: number;
}