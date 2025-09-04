// src/illustrator/workflows/index.ts

/**
 * Illustrator Workflow Test Suite
 * Central registry and runner for all Illustrator MCP workflow tests
 */

import { MockMcpServer, WorkflowResult, WorkflowMetadata, WorkflowCategories } from "./types.js";

// Import all workflow modules
import {
  createTechLogo,
  createMinimalistLogo,
  createSymbolBasedLogo
} from "./logoRecreation.js";

import {
  createGeometricPattern,
  createOrganicPattern,
  createTextilePattern,
  createAbstractPattern
} from "./patternDesign.js";

import {
  createBarChart,
  createPieChart,
  createInfographic
} from "./dataVisualization.js";

import {
  createVintageTypography,
  createNeonText,
  create3DText,
  createKineticTypography
} from "./typographyEffects.js";

/**
 * Workflow metadata for categorization and testing
 */
export const WORKFLOW_CATEGORIES: WorkflowCategories = {
  "Logo Design": [
    {
      name: "Tech Company Logo",
      function: createTechLogo,
      description: "Geometric hexagon logo with gradients and text",
      difficulty: "beginner",
      toolsUsed: ["create_shape_primitive", "generate_color_variations", "apply_gradient_mapping", "create_text_on_path"]
    },
    {
      name: "Minimalist Logo",
      function: createMinimalistLogo,
      description: "Circular text path with center icon",
      difficulty: "beginner",
      toolsUsed: ["create_shape_primitive", "create_text_on_path", "apply_transformation"]
    },
    {
      name: "Symbol-Based Logo",
      function: createSymbolBasedLogo,
      description: "Complex logo using symbols and blend modes",
      difficulty: "advanced",
      toolsUsed: ["create_advanced_path", "create_symbol", "place_symbol_instances", "apply_blend_modes_batch"]
    }
  ],
  "Pattern Design": [
    {
      name: "Geometric Pattern",
      function: createGeometricPattern,
      description: "Grid-based repeating pattern with color harmony",
      difficulty: "intermediate",
      toolsUsed: ["create_grid_layout", "generate_color_variations", "bulk_style_application", "create_pattern_fill"]
    },
    {
      name: "Organic Pattern",
      function: createOrganicPattern,
      description: "Voronoi pattern with natural colors",
      difficulty: "intermediate",
      toolsUsed: ["create_procedural_patterns", "manage_swatches_colors", "apply_gradient_mapping"]
    },
    {
      name: "Textile Pattern",
      function: createTextilePattern,
      description: "Woven textile pattern with interlacing",
      difficulty: "advanced",
      toolsUsed: ["create_grid_layout", "create_pattern_fill", "apply_blend_modes_batch"]
    },
    {
      name: "Abstract Pattern",
      function: createAbstractPattern,
      description: "Fractal and maze combination pattern",
      difficulty: "advanced",
      toolsUsed: ["create_procedural_patterns", "generate_color_variations", "create_advanced_path"]
    }
  ],
  "Data Visualization": [
    {
      name: "Bar Chart",
      function: createBarChart,
      description: "Quarterly revenue bar chart with labels",
      difficulty: "intermediate",
      toolsUsed: ["create_shape_primitive", "create_text_on_path", "create_advanced_path"]
    },
    {
      name: "Pie Chart",
      function: createPieChart,
      description: "Market share pie chart with legend",
      difficulty: "intermediate",
      toolsUsed: ["create_advanced_path", "generate_color_variations", "create_text_on_path"]
    },
    {
      name: "Infographic",
      function: createInfographic,
      description: "Data-driven growth infographic",
      difficulty: "advanced",
      toolsUsed: ["import_csv_data", "create_data_merge_template", "execute_data_merge", "update_variable_text"]
    }
  ],
  "Typography Effects": [
    {
      name: "Vintage Typography",
      function: createVintageTypography,
      description: "Vintage poster with curved text and ornaments",
      difficulty: "intermediate",
      toolsUsed: ["create_text_on_path", "create_advanced_path", "apply_envelope_distortion"]
    },
    {
      name: "Neon Text",
      function: createNeonText,
      description: "Glowing neon text effect with reflection",
      difficulty: "intermediate",
      toolsUsed: ["create_text_on_path", "create_graphic_style", "apply_transformation", "apply_gradient_mapping"]
    },
    {
      name: "3D Text",
      function: create3DText,
      description: "Layered 3D text with perspective",
      difficulty: "advanced",
      toolsUsed: ["create_text_on_path", "apply_transformation", "apply_envelope_distortion", "bulk_style_application"]
    },
    {
      name: "Kinetic Typography",
      function: createKineticTypography,
      description: "Animation frames with spiral text",
      difficulty: "advanced",
      toolsUsed: ["manage_artboards", "create_text_on_path", "apply_transformation", "create_advanced_path"]
    }
  ]
};

// WorkflowResult is now imported from types.ts

/**
 * Run a specific workflow by name
 */
export async function runWorkflow(
  server: MockMcpServer,
  category: string,
  workflowName: string
): Promise<WorkflowResult> {
  const startTime = Date.now();
  
  const categoryWorkflows = WORKFLOW_CATEGORIES[category as keyof typeof WORKFLOW_CATEGORIES];
  if (!categoryWorkflows) {
    throw new Error(`Category '${category}' not found`);
  }
  
  const workflow = categoryWorkflows.find((w: WorkflowMetadata) => w.name === workflowName);
  if (!workflow) {
    throw new Error(`Workflow '${workflowName}' not found in category '${category}'`);
  }
  
  try {
    console.log(`\n🎨 Running workflow: ${workflow.name}`);
    console.log(`📝 Description: ${workflow.description}`);
    console.log(`🎯 Difficulty: ${workflow.difficulty}`);
    console.log(`🔧 Tools used: ${workflow.toolsUsed.join(", ")}`);
    console.log("─".repeat(60));
    
    const result = await workflow.function(server);
    
    const duration = Date.now() - startTime;
    
    return {
      category,
      name: workflow.name,
      success: result.success,
      steps: result.steps,
      duration,
      error: result.success ? undefined : result.steps[result.steps.length - 1]
    };
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    return {
      category,
      name: workflow.name,
      success: false,
      steps: [`Error: ${error.message}`],
      duration,
      error: error.message
    };
  }
}

/**
 * Run all workflows in a category
 */
export async function runCategoryWorkflows(
  server: MockMcpServer,
  category: string
): Promise<WorkflowResult[]> {
  const categoryWorkflows = WORKFLOW_CATEGORIES[category as keyof typeof WORKFLOW_CATEGORIES];
  if (!categoryWorkflows) {
    throw new Error(`Category '${category}' not found`);
  }
  
  const results: WorkflowResult[] = [];
  
  console.log(`\n🚀 Running all workflows in category: ${category}`);
  console.log("═".repeat(60));
  
  for (const workflow of categoryWorkflows) {
    const result = await runWorkflow(server, category, workflow.name);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${result.name} - Success (${result.duration}ms)`);
    } else {
      console.log(`❌ ${result.name} - Failed: ${result.error}`);
    }
  }
  
  return results;
}

/**
 * Run all workflows across all categories
 */
export async function runAllWorkflows(
  server: MockMcpServer
): Promise<Map<string, WorkflowResult[]>> {
  const allResults = new Map<string, WorkflowResult[]>();
  
  console.log("\n🎯 Running Complete Illustrator Workflow Test Suite");
  console.log("═".repeat(60));
  
  for (const category of Object.keys(WORKFLOW_CATEGORIES)) {
    const results = await runCategoryWorkflows(server, category);
    allResults.set(category, results);
  }
  
  // Print summary
  console.log("\n" + "═".repeat(60));
  console.log("📊 WORKFLOW TEST SUMMARY");
  console.log("═".repeat(60));
  
  let totalWorkflows = 0;
  let successfulWorkflows = 0;
  
  for (const [category, results] of allResults) {
    const successful = results.filter(r => r.success).length;
    totalWorkflows += results.length;
    successfulWorkflows += successful;
    
    console.log(`\n${category}:`);
    console.log(`  ✅ Successful: ${successful}/${results.length}`);
    console.log(`  ❌ Failed: ${results.length - successful}/${results.length}`);
    
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    console.log(`  ⏱️  Average duration: ${Math.round(avgDuration)}ms`);
  }
  
  console.log("\n" + "─".repeat(60));
  console.log(`Overall Success Rate: ${successfulWorkflows}/${totalWorkflows} (${Math.round(successfulWorkflows/totalWorkflows * 100)}%)`);
  console.log("═".repeat(60));
  
  return allResults;
}

/**
 * Get workflow statistics
 */
export function getWorkflowStats(): {
  totalWorkflows: number;
  byCategory: Map<string, number>;
  byDifficulty: Map<string, number>;
  uniqueToolsUsed: Set<string>;
} {
  const stats = {
    totalWorkflows: 0,
    byCategory: new Map<string, number>(),
    byDifficulty: new Map<string, number>(),
    uniqueToolsUsed: new Set<string>()
  };
  
  for (const [category, workflows] of Object.entries(WORKFLOW_CATEGORIES)) {
    stats.byCategory.set(category, workflows.length);
    stats.totalWorkflows += workflows.length;
    
    for (const workflow of workflows) {
      // Count by difficulty
      const currentCount = stats.byDifficulty.get(workflow.difficulty) || 0;
      stats.byDifficulty.set(workflow.difficulty, currentCount + 1);
      
      // Collect unique tools
      for (const tool of workflow.toolsUsed) {
        stats.uniqueToolsUsed.add(tool);
      }
    }
  }
  
  return stats;
}

/**
 * Export workflow definitions for documentation
 */
export function exportWorkflowDocumentation(): string {
  let doc = "# Illustrator MCP Workflow Documentation\n\n";
  doc += "## Available Workflows\n\n";
  
  for (const [category, workflows] of Object.entries(WORKFLOW_CATEGORIES)) {
    doc += `### ${category}\n\n`;
    
    for (const workflow of workflows) {
      doc += `#### ${workflow.name}\n`;
      doc += `- **Description**: ${workflow.description}\n`;
      doc += `- **Difficulty**: ${workflow.difficulty}\n`;
      doc += `- **Tools Used**: \`${workflow.toolsUsed.join("`, `")}\`\n\n`;
    }
  }
  
  const stats = getWorkflowStats();
  doc += "## Statistics\n\n";
  doc += `- **Total Workflows**: ${stats.totalWorkflows}\n`;
  doc += `- **Unique Tools Used**: ${stats.uniqueToolsUsed.size}\n`;
  doc += `- **Categories**: ${stats.byCategory.size}\n\n`;
  
  return doc;
}