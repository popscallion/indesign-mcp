/**
 * @fileoverview Main entry point for the Adobe Illustrator MCP server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTelemetryServer } from "@mcp/shared/telemetryServer.js";
import { setTelemetryEnabled } from "@mcp/shared/telemetryFlag.js";
import { TelemetryCapture } from "@mcp/shared/telemetry.js";
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
 */
export async function registerAllIllustratorTools(server: McpServer): Promise<void> {
  try {
    await registerGeometryTools(server);
    await registerTransformTools(server);
    await registerExportTools(server);
    await registerStyleTools(server);
    await registerGenerativeTools(server);
    await registerSymbolTools(server);
    await registerDataTools(server);
    await registerAnalysisTools(server);
    await registerIntegrationTools(server);
    
    console.error("Illustrator MCP Tools registered successfully");
  } catch (error) {
    console.error("Failed to register Illustrator tools:", error);
    throw error;
  }
}

/**
 * Server configuration and identity
 */
export const SERVER_CONFIG = {
  name: "illustrator-mcp",
  version: "1.0.0"
} as const;

/**
 * Creates and configures the MCP server instance with Adobe Illustrator capabilities
 */
async function createIllustratorMcpServer(enableTelemetry: boolean = false): Promise<McpServer> {
  const baseServer = new McpServer(
    { 
      name: SERVER_CONFIG.name, 
      version: SERVER_CONFIG.version 
    },
    {
      capabilities: {
        logging: {},
        tools: { listChanged: true },
        prompts: { listChanged: true },
      },
    }
  );

  // Set telemetry state
  setTelemetryEnabled(enableTelemetry);
  
  // If telemetry is enabled, initialize and cleanup old files
  if (enableTelemetry) {
    // Initialize telemetry directory
    await TelemetryCapture.initializeTelemetryDir();
    // Clean up old telemetry files (async, don't block startup)
    TelemetryCapture.cleanupOldTelemetry().catch(error => {
      console.error('Failed to cleanup old telemetry files:', error);
    });
  }
  
  // Use telemetry-enabled server if requested
  const server = enableTelemetry ? createTelemetryServer(baseServer) : baseServer;

  // Register Illustrator tools
  await registerAllIllustratorTools(server);
  
  return server;
}

/**
 * Export for test runners to create telemetry-enabled servers
 */
export { createIllustratorMcpServer };

/**
 * Main server startup function
 */
async function main(): Promise<void> {
  try {
    // Auto-detect telemetry mode for evolutionary testing
    const enableTelemetry = process.env.TELEMETRY_ENABLED === 'true' ||
                           process.env.EVOLUTION_SESSION_ID !== undefined ||
                           process.env.TELEMETRY_SESSION_ID !== undefined;
    
    const server = await createIllustratorMcpServer(enableTelemetry);
    
    if (enableTelemetry) {
      console.error("🔬 MCP Server started with telemetry enabled");
    }
    
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    console.error(`Illustrator MCP Server started successfully`);
  } catch (error) {
    console.error(`Failed to start Illustrator MCP Server:`, error);
    process.exit(1);
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}