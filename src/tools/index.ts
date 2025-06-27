/**
 * @fileoverview Central registry for all InDesign MCP tools
 * Organizes tool registration into logical batches for systematic migration
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTextTools } from "./text/index.js";
import { registerStyleTools } from "./styles/index.js";
import { registerLayoutTools } from "./layout/index.js";
import { registerPageTools } from "./pages/index.js";
import { registerSpecialTools } from "./special/index.js";
import { registerUtilityTools } from "./utility/index.js";
import { registerExportTools } from "./export/index.js";
import { registerTransformTools } from "./transform/index.js";
import { registerCompositeTools } from "./composite/index.js";
import { registerAnalysisTools } from "./analysis/index.js";
import { TelemetryCapture } from "./telemetry.js";

// Global flag to enable/disable telemetry
let telemetryEnabled = false;

/**
 * Enable or disable telemetry capture
 */
export function setTelemetryEnabled(enabled: boolean) {
  telemetryEnabled = enabled;
}

/**
 * Check if telemetry is enabled
 */
export function isTelemetryEnabled(): boolean {
  return telemetryEnabled;
}

/**
 * Wrap a tool handler with telemetry capture
 * 
 * NOTE: The telemetry check happens at runtime, but the wrapper is added
 * at registration time. This means tools must be registered with telemetry
 * enabled if you want the option to capture telemetry later.
 */
export function wrapToolForTelemetry<T extends Record<string, any>>(
  toolName: string, 
  handler: (args: T) => Promise<any>
): (args: T) => Promise<any> {
  return async (args: T) => {
    if (!telemetryEnabled) {
      // Run without telemetry if disabled
      return handler(args);
    }
    
    const startTime = Date.now();
    try {
      const result = await handler(args);
      
      // Capture successful execution (async but don't await to avoid blocking)
      await TelemetryCapture.capture(toolName, args, {
        success: true,
        executionTime: Date.now() - startTime,
        data: result // Include result data for sanitization
      });
      
      return result;
    } catch (error) {
      // Capture error (async but don't await to avoid blocking on error path)
      const errorMessage = error instanceof Error ? error.message : String(error);
      await TelemetryCapture.capture(toolName, args, {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime
      });
      
      // Re-throw the error
      throw error;
    }
  };
}

/**
 * Registers all InDesign tools with the MCP server
 * Following the migration plan's 6-batch organization
 */
export async function registerAllInDesignTools(server: McpServer): Promise<void> {
  try {
    // Batch 1: Core Text Tools (4 tools)
    await registerTextTools(server);
    
    // Batch 2: Style Management (4 tools) 
    await registerStyleTools(server);
    
    // Batch 3: Layout & Positioning (2 tools)
    await registerLayoutTools(server);
    
    // Batch 4: Page Management (3 tools)
    await registerPageTools(server);
    
    // Batch 5: Special Features (4 tools)
    await registerSpecialTools(server);
    
    // Batch 6: Advanced & Utility (7 tools)
    await registerUtilityTools(server);
    
    // Tier 1 Expansion: Document Export/Import (5 tools)
    await registerExportTools(server);
    
    // Tier 1 Expansion: Object Transformation (3 tools) 
    await registerTransformTools(server);
    
    // Composite Macros
    await registerCompositeTools(server);
    
    // Decision Analysis Tools
    await registerAnalysisTools(server);
    
    console.error("Successfully registered all InDesign tools");
  } catch (error) {
    console.error("Failed to register InDesign tools:", error);
    throw error;
  }
}