// src/illustrator/workflows/types.ts

/**
 * Types for Illustrator workflow testing
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Mock MCP Server interface for testing workflows
 * Extends the real McpServer with a callTool method for simulation
 */
export interface MockMcpServer extends McpServer {
  /**
   * Mock method to simulate tool calls during testing
   * @param toolName - Name of the tool to call
   * @param args - Arguments to pass to the tool
   * @returns Promise with mock tool result
   */
  callTool(toolName: string, args: any): Promise<{
    success: boolean;
    result: {
      content: Array<{
        type: string;
        text: string;
      }>;
    };
  }>;
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  category: string;
  name: string;
  success: boolean;
  steps: string[];
  duration: number;
  error?: string;
}

/**
 * Base workflow configuration
 */
export interface BaseWorkflowConfig {
  width?: number;
  height?: number;
}

/**
 * Logo workflow specific configuration
 */
export interface LogoWorkflowConfig extends BaseWorkflowConfig {
  targetWidth: number;
  targetHeight: number;
  colorScheme: "monochrome" | "complementary" | "triadic" | "custom";
  style: "flat" | "gradient" | "3d" | "outline";
}

/**
 * Pattern workflow specific configuration
 */
export interface PatternWorkflowConfig extends BaseWorkflowConfig {
  patternType: "geometric" | "organic" | "abstract" | "textile";
  colorCount: number;
  tileSize: number;
  complexity: "simple" | "moderate" | "complex";
}

/**
 * Chart configuration for data visualization
 */
export interface ChartConfig {
  chartType: "bar" | "pie" | "line" | "scatter" | "bubble";
  width: number;
  height: number;
  colorScheme: "sequential" | "diverging" | "categorical";
  showLabels: boolean;
  showLegend: boolean;
}

/**
 * Typography effects configuration
 */
export interface TypographyConfig {
  effectType: "vintage" | "modern" | "grunge" | "neon" | "3d";
  fontSize: number;
  fontFamily: string;
  primaryColor: { r: number; g: number; b: number };
  secondaryColor?: { r: number; g: number; b: number };
}

/**
 * Data point for charts
 */
export interface DataPoint {
  label: string;
  value: number;
  category?: string;
  size?: number;
}

/**
 * Workflow function signature
 */
export type WorkflowFunction = (
  server: MockMcpServer,
  config?: any
) => Promise<{ success: boolean; steps: string[] }>;

/**
 * Workflow metadata
 */
export interface WorkflowMetadata {
  name: string;
  function: WorkflowFunction;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  toolsUsed: string[];
}

/**
 * Workflow categories registry
 */
export type WorkflowCategories = {
  [categoryName: string]: WorkflowMetadata[];
};