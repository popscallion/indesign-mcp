/**
 * @fileoverview Configuration for evolutionary testing system
 * Centralizes all configurable values
 */

import * as path from 'path';
import * as os from 'os';

/**
 * Evolutionary testing configuration
 */
export interface EvolutionTestConfig {
  // Directory paths
  paths: {
    baseDir: string;
    telemetryDir: string;
    documentsDir: string;
    resultsDir: string;
  };
  
  // Timing configuration
  timing: {
    defaultTimeoutMs: number;
    taskAgentTimeoutMs: number;
    delayBetweenAgentsMs: number;
  };
  
  // Pattern detection thresholds
  patterns: {
    minFrequency: number;
    confidenceThreshold: number;
    minExamplesForPattern: number;
  };
  
  // Evolution parameters
  evolution: {
    defaultAgentCount: number;
    defaultMaxGenerations: number;
    defaultTargetScore: number;
    defaultImprovementThreshold: number;
    plateauGenerationsForConvergence: number;
  };
  
  // Git configuration
  git: {
    defaultBranchPrefix: string;
    commitMessagePrefix: string;
  };
  
  // Telemetry configuration
  telemetry: {
    maxSessionsToKeep: number;
    cleanupIntervalHours: number;
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: EvolutionTestConfig = {
  paths: {
    baseDir: path.join(os.tmpdir(), 'evolution_tests'),
    telemetryDir: path.join(os.tmpdir(), 'evolution_tests', 'telemetry'),
    documentsDir: path.join(os.tmpdir(), 'evolution_tests', 'documents'),
    resultsDir: path.join(os.tmpdir(), 'evolution_tests', 'results')
  },
  
  timing: {
    defaultTimeoutMs: 120000, // 2 minutes
    taskAgentTimeoutMs: 180000, // 3 minutes for Task agents
    delayBetweenAgentsMs: 5000 // 5 seconds between agents
  },
  
  patterns: {
    minFrequency: 2, // Pattern must occur at least twice
    confidenceThreshold: 0.6, // 60% confidence minimum
    minExamplesForPattern: 2
  },
  
  evolution: {
    defaultAgentCount: 3,
    defaultMaxGenerations: 10,
    defaultTargetScore: 85,
    defaultImprovementThreshold: 5,
    plateauGenerationsForConvergence: 3
  },
  
  git: {
    defaultBranchPrefix: 'evolution/',
    commitMessagePrefix: '[Evolution]'
  },
  
  telemetry: {
    maxSessionsToKeep: 100,
    cleanupIntervalHours: 24
  }
};

/**
 * Get configuration with optional overrides
 */
export function getConfig(overrides?: Partial<EvolutionTestConfig>): EvolutionTestConfig {
  if (!overrides) {
    return DEFAULT_CONFIG;
  }
  
  return {
    paths: { ...DEFAULT_CONFIG.paths, ...overrides.paths },
    timing: { ...DEFAULT_CONFIG.timing, ...overrides.timing },
    patterns: { ...DEFAULT_CONFIG.patterns, ...overrides.patterns },
    evolution: { ...DEFAULT_CONFIG.evolution, ...overrides.evolution },
    git: { ...DEFAULT_CONFIG.git, ...overrides.git },
    telemetry: { ...DEFAULT_CONFIG.telemetry, ...overrides.telemetry }
  };
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): Partial<EvolutionTestConfig> {
  const config: Partial<EvolutionTestConfig> = {};
  
  // Check for base directory override
  if (process.env.EVOLUTION_TEST_DIR) {
    const baseDir = process.env.EVOLUTION_TEST_DIR;
    config.paths = {
      baseDir,
      telemetryDir: path.join(baseDir, 'telemetry'),
      documentsDir: path.join(baseDir, 'documents'),
      resultsDir: path.join(baseDir, 'results')
    };
  }
  
  // Check for timing overrides
  if (process.env.EVOLUTION_TIMEOUT_MS) {
    if (!config.timing) {
      config.timing = { ...DEFAULT_CONFIG.timing };
    }
    config.timing.defaultTimeoutMs = parseInt(process.env.EVOLUTION_TIMEOUT_MS, 10);
  }
  
  // Check for agent count override
  if (process.env.EVOLUTION_AGENT_COUNT) {
    if (!config.evolution) {
      config.evolution = { ...DEFAULT_CONFIG.evolution };
    }
    config.evolution.defaultAgentCount = parseInt(process.env.EVOLUTION_AGENT_COUNT, 10);
  }
  
  return config;
}