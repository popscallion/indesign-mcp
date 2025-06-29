/**
 * @fileoverview Telemetry-enabled MCP server wrapper
 * Intercepts tool registrations to add telemetry capture
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { wrapToolForTelemetry, isTelemetryEnabled } from "./index.js";

/**
 * Create a telemetry-enabled MCP server that wraps all tool handlers
 * 
 * All tools are registered with telemetry wrappers. The wrapper checks
 * the telemetry enabled flag at runtime, allowing dynamic enable/disable
 * via set_environment_variable tool.
 */
export function createTelemetryServer(baseServer: McpServer): McpServer {
  // Create a proxy that intercepts the tool registration method
  return new Proxy(baseServer, {
    get(target, prop, receiver) {
      if (prop === 'tool') {
        // Return a wrapped version of the tool registration function
        return function(...args: any[]) {
          // Handle both 2-arg and 3-arg forms of server.tool()
          const [name, maybeSchema, maybeHandler] = args;
          const handler = args.length === 2 ? maybeSchema : maybeHandler;
          const schema = args.length === 2 ? undefined : maybeSchema;
          
          // Always wrap with telemetry - the wrapper handles enable/disable at runtime
          const wrappedHandler = wrapToolForTelemetry(name, handler);
          return target.tool(name, schema, wrappedHandler);
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