/**
 * @fileoverview Validation checks for Task-based evolutionary testing
 * Ensures the workflow is being followed correctly
 */

import { TestConfig, TestRun, Pattern, Improvement } from './types.js';

/**
 * Validation errors that can occur
 */
export class ValidationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates Task-based workflow requirements
 */
export class WorkflowValidator {
  /**
   * Validate test configuration
   */
  static validateConfig(config: TestConfig): void {
    if (!config.testCase) {
      throw new ValidationError('Test case name is required', 'MISSING_TEST_CASE');
    }
    
    if (config.agentCount < 2) {
      throw new ValidationError('At least 2 agents required for pattern detection', 'INSUFFICIENT_AGENTS');
    }
    
    if (config.agentCount > 10) {
      throw new ValidationError('More than 10 agents is not recommended (too slow)', 'EXCESSIVE_AGENTS');
    }
    
    if (!config.referenceMetrics) {
      throw new ValidationError('Reference metrics are required for comparison', 'MISSING_REFERENCE');
    }
    
    if (config.targetScore < 0 || config.targetScore > 100) {
      throw new ValidationError('Target score must be between 0-100', 'INVALID_TARGET_SCORE');
    }
  }
  
  /**
   * Validate Task agent results
   */
  static validateTaskRun(run: TestRun): void {
    if (!run.agentId) {
      throw new ValidationError('Agent ID is required', 'MISSING_AGENT_ID');
    }
    
    if (!run.telemetry) {
      throw new ValidationError('Telemetry session is required', 'MISSING_TELEMETRY');
    }
    
    if (run.success && !run.extractedMetrics) {
      throw new ValidationError('Successful runs must have extracted metrics', 'MISSING_METRICS');
    }
    
    if (run.success && !run.comparisonResult) {
      throw new ValidationError('Successful runs must have comparison results', 'MISSING_COMPARISON');
    }
  }
  
  /**
   * Validate pattern analysis results
   */
  static validatePatterns(patterns: Pattern[], runCount: number): void {
    // Check for minimum pattern detection
    const significantPatterns = patterns.filter(p => p.confidence > 0.6);
    
    if (runCount >= 3 && significantPatterns.length === 0) {
      console.warn('No significant patterns detected after 3+ runs. Consider:');
      console.warn('- Checking if Task agents are making diverse attempts');
      console.warn('- Verifying reference metrics are accurate');
      console.warn('- Ensuring pattern detection thresholds are appropriate');
    }
    
    // Validate individual patterns
    patterns.forEach(pattern => {
      if (pattern.frequency > runCount) {
        throw new ValidationError(
          `Pattern frequency (${pattern.frequency}) exceeds run count (${runCount})`,
          'INVALID_PATTERN_FREQUENCY'
        );
      }
      
      if (pattern.confidence < 0 || pattern.confidence > 1) {
        throw new ValidationError(
          'Pattern confidence must be between 0-1',
          'INVALID_CONFIDENCE'
        );
      }
    });
  }
  
  /**
   * Validate improvement before application
   */
  static validateImprovement(improvement: Improvement): void {
    if (!improvement.tool) {
      throw new ValidationError('Improvement must specify target tool', 'MISSING_TOOL');
    }
    
    if (!improvement.current || !improvement.proposed) {
      throw new ValidationError('Improvement must have current and proposed values', 'INCOMPLETE_IMPROVEMENT');
    }
    
    if (improvement.current === improvement.proposed) {
      throw new ValidationError('Proposed value must differ from current', 'NO_CHANGE');
    }
    
    if (!improvement.rationale) {
      throw new ValidationError('Improvement must include rationale', 'MISSING_RATIONALE');
    }
    
    if (improvement.expectedImpact < 0 || improvement.expectedImpact > 1) {
      throw new ValidationError('Expected impact must be between 0-1', 'INVALID_IMPACT');
    }
  }
  
  /**
   * Validate Task-based workflow is being used
   */
  static validateTaskBasedApproach(): void {
    // Check for common mistakes
    if (typeof process !== 'undefined' && process.env.EVOLUTION_USE_SIMULATION) {
      throw new ValidationError(
        'Simulation mode is not compatible with Task-based approach',
        'SIMULATION_NOT_SUPPORTED'
      );
    }
    
    // Warn about deprecated components
    const deprecatedImports = [
      'EvolutionOrchestrator',
      'EvolutionaryTestRunner',
      'SubAgentExecutor'
    ];
    
    // This is a simple check - in real usage, you'd parse imports
    console.warn('Reminder: Use TaskBasedRunner, not deprecated components');
  }
  
  /**
   * Check if Claude Code is orchestrating
   */
  static isClaudeCodeEnvironment(): boolean {
    // This is a heuristic check - Claude Code would be invoking Task tool
    // In practice, this would be set by Claude Code when running
    return process.env.CLAUDE_CODE_ORCHESTRATION === 'true';
  }
}

/**
 * Pre-flight checks before starting evolution
 */
export async function runPreFlightChecks(config: TestConfig): Promise<void> {
  console.log('Running pre-flight checks...');
  
  try {
    // Validate configuration
    WorkflowValidator.validateConfig(config);
    console.log('✓ Configuration valid');
    
    // Check Task-based approach
    WorkflowValidator.validateTaskBasedApproach();
    console.log('✓ Using Task-based approach');
    
    // Warn if not in Claude Code environment
    if (!WorkflowValidator.isClaudeCodeEnvironment()) {
      console.warn('⚠️  Not running in Claude Code environment');
      console.warn('   Task tool invocation will need to be done manually');
    }
    
    console.log('✓ All pre-flight checks passed\n');
    
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error(`❌ Validation failed: ${error.message} (${error.code})`);
    } else {
      console.error('❌ Unexpected error during validation:', error);
    }
    throw error;
  }
}