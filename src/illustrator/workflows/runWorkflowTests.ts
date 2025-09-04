#!/usr/bin/env node
// src/illustrator/workflows/runWorkflowTests.ts

/**
 * Illustrator Workflow Test Runner
 * Command-line interface for testing Illustrator MCP workflows
 * 
 * Usage:
 *   npx tsx src/illustrator/workflows/runWorkflowTests.ts --all
 *   npx tsx src/illustrator/workflows/runWorkflowTests.ts --category "Logo Design"
 *   npx tsx src/illustrator/workflows/runWorkflowTests.ts --workflow "Tech Company Logo"
 *   npx tsx src/illustrator/workflows/runWorkflowTests.ts --stats
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  runWorkflow,
  runCategoryWorkflows,
  runAllWorkflows,
  getWorkflowStats,
  exportWorkflowDocumentation,
  WORKFLOW_CATEGORIES
} from "./index.js";

// Parse command line arguments
function parseArgs(): {
  mode: "all" | "category" | "workflow" | "stats" | "docs";
  target?: string;
} {
  const args = process.argv.slice(2);
  
  if (args.includes("--all")) {
    return { mode: "all" };
  }
  
  if (args.includes("--stats")) {
    return { mode: "stats" };
  }
  
  if (args.includes("--docs")) {
    return { mode: "docs" };
  }
  
  const categoryIndex = args.indexOf("--category");
  if (categoryIndex !== -1 && args[categoryIndex + 1]) {
    return { mode: "category", target: args[categoryIndex + 1] };
  }
  
  const workflowIndex = args.indexOf("--workflow");
  if (workflowIndex !== -1 && args[workflowIndex + 1]) {
    return { mode: "workflow", target: args[workflowIndex + 1] };
  }
  
  // Default to showing help
  return { mode: "stats" };
}

// Display help information
function showHelp() {
  console.log(`
Illustrator Workflow Test Runner
═══════════════════════════════

Usage:
  npx tsx src/illustrator/workflows/runWorkflowTests.ts [options]

Options:
  --all                    Run all workflows in all categories
  --category <name>        Run all workflows in a specific category
  --workflow <name>        Run a specific workflow by name
  --stats                  Show workflow statistics
  --docs                   Export workflow documentation

Categories:
${Object.keys(WORKFLOW_CATEGORIES).map(c => `  - ${c}`).join("\n")}

Examples:
  npx tsx src/illustrator/workflows/runWorkflowTests.ts --all
  npx tsx src/illustrator/workflows/runWorkflowTests.ts --category "Logo Design"
  npx tsx src/illustrator/workflows/runWorkflowTests.ts --workflow "Tech Company Logo"
`);
}

// Create a mock MCP server for testing
function createMockServer(): McpServer {
  const server = new McpServer({
    name: "illustrator-workflow-test",
    version: "1.0.0"
  }, {
    capabilities: {}
  });
  
  // Mock the callTool method for testing
  (server as any).callTool = async (toolName: string, args: any) => {
    console.log(`  → Calling tool: ${toolName}`);
    
    // Simulate successful tool execution
    return {
      success: true,
      result: {
        content: [{
          type: "text",
          text: `Executed ${toolName} with args: ${JSON.stringify(args, null, 2).substring(0, 100)}...`
        }]
      }
    };
  };
  
  return server;
}

// Main execution
async function main() {
  const { mode, target } = parseArgs();
  
  console.log("\n🎨 Illustrator MCP Workflow Test Runner");
  console.log("═".repeat(50));
  
  // Create mock server for testing
  const server = createMockServer();
  
  try {
    switch (mode) {
      case "all":
        console.log("\n🚀 Running all workflows...");
        await runAllWorkflows(server);
        break;
        
      case "category":
        if (!target) {
          console.error("❌ Error: Category name required");
          showHelp();
          process.exit(1);
        }
        console.log(`\n🎯 Running workflows in category: ${target}`);
        await runCategoryWorkflows(server, target);
        break;
        
      case "workflow":
        if (!target) {
          console.error("❌ Error: Workflow name required");
          showHelp();
          process.exit(1);
        }
        
        // Find the workflow in any category
        let found = false;
        for (const [category, workflows] of Object.entries(WORKFLOW_CATEGORIES)) {
          const workflow = workflows.find(w => w.name === target);
          if (workflow) {
            console.log(`\n🎨 Running workflow: ${target}`);
            const result = await runWorkflow(server, category, target);
            
            console.log("\n📋 Workflow Steps:");
            result.steps.forEach((step, i) => {
              console.log(`  ${i + 1}. ${step}`);
            });
            
            if (result.success) {
              console.log(`\n✅ Workflow completed successfully in ${result.duration}ms`);
            } else {
              console.log(`\n❌ Workflow failed: ${result.error}`);
            }
            
            found = true;
            break;
          }
        }
        
        if (!found) {
          console.error(`❌ Error: Workflow '${target}' not found`);
          console.log("\nAvailable workflows:");
          for (const [category, workflows] of Object.entries(WORKFLOW_CATEGORIES)) {
            console.log(`\n${category}:`);
            workflows.forEach(w => console.log(`  - ${w.name}`));
          }
          process.exit(1);
        }
        break;
        
      case "stats":
        const stats = getWorkflowStats();
        console.log("\n📊 Workflow Statistics");
        console.log("─".repeat(50));
        console.log(`Total Workflows: ${stats.totalWorkflows}`);
        console.log(`Unique Tools Used: ${stats.uniqueToolsUsed.size}`);
        console.log("\nWorkflows by Category:");
        for (const [category, count] of stats.byCategory) {
          console.log(`  ${category}: ${count}`);
        }
        console.log("\nWorkflows by Difficulty:");
        for (const [difficulty, count] of stats.byDifficulty) {
          console.log(`  ${difficulty}: ${count}`);
        }
        console.log("\nTools Coverage:");
        console.log(`  ${stats.uniqueToolsUsed.size} out of 44 total tools used in workflows`);
        console.log(`  Coverage: ${Math.round(stats.uniqueToolsUsed.size / 44 * 100)}%`);
        break;
        
      case "docs":
        const documentation = exportWorkflowDocumentation();
        console.log("\n📚 Exporting workflow documentation...");
        
        // Save to file
        const fs = await import("fs/promises");
        const path = await import("path");
        const docPath = path.join(process.cwd(), "ILLUSTRATOR-WORKFLOWS.md");
        await fs.writeFile(docPath, documentation);
        
        console.log(`✅ Documentation saved to: ${docPath}`);
        console.log("\nPreview:");
        console.log("─".repeat(50));
        console.log(documentation.substring(0, 500) + "...");
        break;
        
      default:
        showHelp();
        break;
    }
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});