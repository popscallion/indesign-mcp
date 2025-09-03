// src/illustrator/index.ts

/**
 * @fileoverview Central registry for all Illustrator MCP tools
 * Organizes tool registration into logical categories for systematic implementation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGeometryTools } from "./tools/geometry/index.js";
import { registerTransformTools } from "./tools/transform/index.js";
import { registerExportTools } from "./tools/export/index.js";
// import { registerDataTools } from "./tools/data/index.js";
// import { registerStyleTools } from "./tools/style/index.js";
// import { registerAnalysisTools } from "./tools/analysis/index.js";
// import { registerGenerativeTools } from "./tools/generative/index.js";

/**
 * Registers all Illustrator tools with the MCP server
 * Following phased implementation approach
 */
export async function registerAllIllustratorTools(server: McpServer): Promise<void> {
  try {
    // Phase 1: Foundation Layer (Low complexity, no dependencies)
    await registerGeometryTools(server);
    
    // Phase 2: Basic Operations (Depends on foundation)
    await registerTransformTools(server);
    await registerExportTools(server);
    // await registerStyleTools(server);
    
    // Phase 3: Intermediate Tools
    // Additional export tools will go here
    
    // Phase 4: Advanced Features
    // await registerDataTools(server);
    
    // Phase 5: AI/Generative Tools
    // await registerAnalysisTools(server);
    // await registerGenerativeTools(server);
    
    console.error("Illustrator MCP Tools registered successfully");
  } catch (error) {
    console.error("Failed to register Illustrator tools:", error);
    throw error;
  }
}

/**
 * Get list of available Illustrator tools
 */
export function getIllustratorToolList(): string[] {
  // This will be populated as tools are implemented
  return [
    // Foundation Layer
    'select_elements',
    'measure_relationships',
    'organize_layers',
    'manage_artboards',
    'create_shape_primitive',
    'read_illustrator_document',
    // Basic Operations
    'apply_transformation',
    'extract_layer_assets',
    'batch_export_layouts',
    // More tools will be added as implemented...
  ];
}