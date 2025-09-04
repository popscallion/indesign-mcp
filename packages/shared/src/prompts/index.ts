/**
 * @fileoverview Central registry for InDesign MCP strategic prompts
 * Registers all prompt functions with the MCP server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  document_creation_strategy, 
  copy_design_strategy,
  add_content_strategy } from "./document-strategy.js";

/**
 * Registers all strategic prompts with the MCP server
 * Following the same pattern as tool registration
 */
export async function registerStrategicPrompts(server: McpServer): Promise<void> {
  try {
    // Register the main document creation strategy prompt
    server.prompt(
      "document_creation_strategy",
      "Comprehensive workflow guidance for InDesign document creation and automation, inspired by BlenderMCP's strategic approach",
      () => ({
        messages: [
          {
            role: "assistant" as const,
            content: {
              type: "text" as const,
              text: document_creation_strategy()
            }
          }
        ]
      })
    );

    // Register scenario-specific strategy prompts

    server.prompt(
      "copy_design_strategy",
      "Step-by-step guide for replicating a reference layout in InDesign",
      () => ({
        messages: [
          { role:"assistant", content:{ type:"text", text: copy_design_strategy() } }
        ]
      })
    );

    server.prompt(
      "add_content_strategy",
      "Guide for flowing new content into existing document while preserving design",
      () => ({
        messages: [
          { role:"assistant", content:{ type:"text", text: add_content_strategy() } }
        ]
      })
    );

    console.error("Successfully registered strategic prompts for InDesign");
  } catch (error) {
    console.error("Failed to register strategic prompts:", error);
    throw error;
  }
}