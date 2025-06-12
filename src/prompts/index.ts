/**
 * @fileoverview Central registry for InDesign MCP strategic prompts
 * Registers all prompt functions with the MCP server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  document_creation_strategy, 
  magazine_layout_strategy, 
  report_document_strategy 
} from "./document-strategy.js";

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

    // Register document-type specific strategy prompts
    server.prompt(
      "magazine_layout_strategy", 
      "Specialized workflow guidance for magazine-style layouts in InDesign",
      () => ({
        messages: [
          {
            role: "assistant" as const,
            content: {
              type: "text" as const,
              text: magazine_layout_strategy()
            }
          }
        ]
      })
    );

    server.prompt(
      "report_document_strategy",
      "Specialized workflow guidance for report-style documents in InDesign", 
      () => ({
        messages: [
          {
            role: "assistant" as const,
            content: {
              type: "text" as const,
              text: report_document_strategy()
            }
          }
        ]
      })
    );

    console.error("Successfully registered strategic prompts for InDesign");
  } catch (error) {
    console.error("Failed to register strategic prompts:", error);
    throw error;
  }
}