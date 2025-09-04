// src/illustrator/index.ts

/**
 * @fileoverview Central registry for all Illustrator MCP tools
 * Organizes tool registration into logical categories for systematic implementation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGeometryTools } from "./tools/geometry/index.js";
import { registerTransformTools } from "./tools/transform/index.js";
import { registerExportTools } from "./tools/export/index.js";
import { registerStyleTools } from "./tools/style/index.js";
import { registerGenerativeTools } from "./tools/generative/index.js";
import { registerSymbolTools } from "./tools/symbol/index.js";
import { registerDataTools } from "./tools/data/index.js";
import { registerAnalysisTools } from "./tools/analysis/index.js";
import { registerIntegrationTools } from "./tools/integration/index.js";

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
    await registerStyleTools(server);
    await registerGenerativeTools(server);
    await registerSymbolTools(server);
    
    // Phase 3: Intermediate Tools (Complete)
    
    // Phase 4: Advanced Features
    await registerDataTools(server);
    
    // Phase 5: AI/Analysis Tools
    await registerAnalysisTools(server);
    
    // Phase 6: Integration & Third-Party Tools
    await registerIntegrationTools(server);
    
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
    'configure_export_presets',
    'generate_color_variations',
    'create_graphic_style',
    'create_text_on_path',
    'create_grid_layout',
    'create_pattern_fill',
    // Intermediate Tools
    'snap_to_grid',
    'create_symbol',
    'place_symbol_instances',
    'bulk_style_application',
    'create_advanced_path',
    'manage_swatches_colors',
    'apply_gradient_mapping',
    // More tools will be added as implemented...
  ];
}