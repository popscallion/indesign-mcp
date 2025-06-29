/**
 * @fileoverview Main entry point for the InDesign MCP (Model Context Protocol) server.
 * Provides tools for InDesign text manipulation via ExtendScript automation.
 * 
 * Based on migration from Python implementation to TypeScript while maintaining
 * 100% functional compatibility with all existing 20+ tools.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllInDesignTools } from "./tools/index.js";
import { registerStrategicPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";
import { createTelemetryServer } from "./tools/telemetryServer.js";
import { setTelemetryEnabled } from "./tools/index.js";

/**
 * Server configuration and identity
 */
const SERVER_CONFIG = {
  name: "indesign-mcp",
  version: "1.0.0"
} as const;

/**
 * Creates and configures the MCP server instance with InDesign capabilities
 */
async function createInDesignMcpServer(enableTelemetry: boolean = false): Promise<McpServer> {
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

  // Register all InDesign tools
  await registerAllInDesignTools(server);
  
  // Register strategic prompts for intelligent workflow guidance
  await registerStrategicPrompts(server);
  
  // Register read-only resources (style catalog, document settings, etc.)
  await registerResources(server);
  
  return server;
}

/**
 * Export for test runners to create telemetry-enabled servers
 */
export { createInDesignMcpServer };

/**
 * Main server startup function
 */
async function main(): Promise<void> {
  try {
    // Auto-detect telemetry mode for evolutionary testing
    const enableTelemetry = process.env.TELEMETRY_ENABLED === 'true' ||
                           process.env.EVOLUTION_SESSION_ID !== undefined ||
                           process.env.TELEMETRY_SESSION_ID !== undefined;
    
    const server = await createInDesignMcpServer(enableTelemetry);
    
    if (enableTelemetry) {
      console.error("🔬 MCP Server started with telemetry enabled");
    }
    
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    console.error("InDesign MCP Server started successfully");
  } catch (error) {
    console.error("Failed to start InDesign MCP Server:", error);
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