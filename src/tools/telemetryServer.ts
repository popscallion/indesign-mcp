/**
 * @fileoverview Telemetry-enabled MCP server wrapper
 * Intercepts tool registrations to add telemetry capture
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { wrapToolForTelemetry, isTelemetryEnabled } from "./index.js";

/**
 * Create a telemetry-enabled MCP server that wraps all tool handlers
 * 
 * IMPORTANT: Telemetry wrapping is determined at tool registration time.
 * Changing setTelemetryEnabled() after tools are registered will not affect
 * already-registered tools. This is by design to avoid runtime overhead.
 */
export function createTelemetryServer(baseServer: McpServer): McpServer {
  // Create a proxy that intercepts the tool registration method
  return new Proxy(baseServer, {
    get(target, prop, receiver) {
      if (prop === 'tool') {
        // Return a wrapped version of the tool registration function
        return function(name: string, schema: any, handler: any) {
          // Check if we should wrap with telemetry at registration time
          if (isTelemetryEnabled()) {
            const wrappedHandler = wrapToolForTelemetry(name, handler);
            return target.tool(name, schema, wrappedHandler);
          } else {
            // Register normally without telemetry
            return target.tool(name, schema, handler);
          }
        };
      }
      
      // For all other properties, return the original
      return Reflect.get(target, prop, receiver);
    }
  });
}

/**
 * Helper to temporarily enable telemetry for a specific operation
 */
export async function withTelemetry<T>(
  operation: () => Promise<T>, 
  agentId: string = 'default',
  generation: number = 0
): Promise<T> {
  const { setTelemetryEnabled } = await import('./index.js');
  const { TelemetryCapture } = await import('./telemetry.js');
  
  const wasEnabled = isTelemetryEnabled();
  
  try {
    // Enable telemetry and start session
    setTelemetryEnabled(true);
    TelemetryCapture.startSession(agentId, generation);
    
    // Run the operation
    const result = await operation();
    
    // End session
    const session = TelemetryCapture.endSession();
    
    return result;
  } finally {
    // Restore original telemetry state
    setTelemetryEnabled(wasEnabled);
  }
}