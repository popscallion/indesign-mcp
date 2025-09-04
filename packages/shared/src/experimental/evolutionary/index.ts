/**
 * @fileoverview Main exports for evolutionary testing system
 * 
 * Task-based approach (current):
 * - TaskBasedRunner: Main runner for Claude Code orchestration
 * - PatternAnalyzer: Analyzes patterns in Task agent results
 * - ClaudeAnalyzer: Formats patterns for Claude Code analysis
 * 
 * Legacy components (deprecated):
 * - EvolutionOrchestrator: Automated orchestration (not Task-compatible)
 * - EvolutionaryTestRunner: Simulated agents (replaced by Task agents)
 */

export * from './types.js';

// Task-based approach (recommended)
export { TaskBasedRunner, createTaskBasedRunner } from './taskBasedRunner.js';
export { ClaudeAnalyzer } from './claudeAnalyzer.js';

// Legacy components (deprecated)
export { EvolutionOrchestrator } from './evolutionOrchestrator.js';
export { EvolutionaryTestRunner } from './runner.js';
export { PatternAnalyzer } from './patternAnalyzer.js';
export { PatternPresenter } from './patternPresenter.js';
export { ImprovementManager } from './improvementManager.js';
export { ToolModifier } from './toolModifier.js';
export { GitManager } from './gitManager.js';
export { RegressionTester } from './regressionTester.js';
export { EvolutionMonitor } from './evolutionMonitor.js';
export { getMcpBridge, McpBridge } from './mcpBridge.js';

// Legacy sub-agent executor (deprecated)
export { SubAgentExecutor, createSubAgentExecutor } from './subAgentExecutor.js';
export { TelemetryPersistence } from "../../telemetryPersistence.js";
export { StatisticalAnalysis } from './statisticalAnalysis.js';

// Configuration
export { getConfig, loadConfigFromEnv, DEFAULT_CONFIG } from './config.js';
export type { EvolutionTestConfig } from './config.js';