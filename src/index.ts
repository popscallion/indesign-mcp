/**
 * @fileoverview Main entry point for the Adobe Creative Cloud MCP (Model Context Protocol) server.
 * Provides tools for InDesign and Illustrator automation via ExtendScript.
 * 
 * Supports both InDesign and Illustrator with mode selection via environment variable.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllInDesignTools } from "./tools/index.js";
import { registerAllIllustratorTools } from "./illustrator/index.js";
import { registerStrategicPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";
import { createTelemetryServer } from "./tools/telemetryServer.js";
import { setTelemetryEnabled } from "./tools/index.js";

/**
 * Determine which app mode to run in
 */
const APP_MODE = process.env.MCP_APP_MODE?.toLowerCase() === 'illustrator' ? 'illustrator' : 'indesign';

/**
 * Server configuration and identity
 */
export const SERVER_CONFIG = {
  name: APP_MODE === 'illustrator' ? "illustrator-mcp" : "indesign-mcp",
  version: "1.0.0"
} as const;

/**
 * Creates and configures the MCP server instance with Adobe CC capabilities
 */
async function createAdobeMcpServer(enableTelemetry: boolean = false): Promise<McpServer> {
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
    const { TelemetryCapture } = await import('./tools/telemetry.js');
    // Initialize telemetry directory
    await TelemetryCapture.initializeTelemetryDir();
    // Clean up old telemetry files (async, don't block startup)
    TelemetryCapture.cleanupOldTelemetry().catch(error => {
      console.error('Failed to cleanup old telemetry files:', error);
    });
  }
  
  // Use telemetry-enabled server if requested
  const server = enableTelemetry ? createTelemetryServer(baseServer) : baseServer;

  // Register tools based on app mode
  if (APP_MODE === 'illustrator') {
    await registerAllIllustratorTools(server);
  } else {
    await registerAllInDesignTools(server);
  }
  
  // Register strategic prompts for intelligent workflow guidance
  await registerStrategicPrompts(server);
  
  // Register read-only resources (style catalog, document settings, etc.)
  await registerResources(server);
  
  return server;
}

/**
 * Export for test runners to create telemetry-enabled servers
 */
export { createAdobeMcpServer, createAdobeMcpServer as createInDesignMcpServer };

/**
 * Main server startup function
 */
async function main(): Promise<void> {
  try {
    // Auto-detect telemetry mode for evolutionary testing
    const enableTelemetry = process.env.TELEMETRY_ENABLED === 'true' ||
                           process.env.EVOLUTION_SESSION_ID !== undefined ||
                           process.env.TELEMETRY_SESSION_ID !== undefined;
    
    const server = await createAdobeMcpServer(enableTelemetry);
    
    if (enableTelemetry) {
      console.error("🔬 MCP Server started with telemetry enabled");
    }
    
    console.error(`📱 Running in ${APP_MODE.toUpperCase()} mode`);
    
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    console.error(`${APP_MODE === 'illustrator' ? 'Illustrator' : 'InDesign'} MCP Server started successfully`);
  } catch (error) {
    console.error(`Failed to start ${APP_MODE === 'illustrator' ? 'Illustrator' : 'InDesign'} MCP Server:`, error);
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