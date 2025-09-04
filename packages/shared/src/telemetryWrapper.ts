// packages/shared/src/telemetryWrapper.ts

import { TelemetryCapture } from "./telemetry.js";
import { isTelemetryEnabled, setTelemetryEnabled } from "./telemetryFlag.js";

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
    // Auto-enable telemetry if evolution context detected
    if (!isTelemetryEnabled() && process.env.EVOLUTION_SESSION_ID) {
      if (process.env.DEBUG_TELEMETRY) {
        console.log(`📊 Evolution context detected - auto-enabling telemetry for tool: ${toolName}`);
      }
      setTelemetryEnabled(true);
      
      // Auto-start session if needed and no current session exists
      if (!TelemetryCapture.getCurrentSession()) {
        const agentId = process.env.TELEMETRY_AGENT_ID || 'task-agent';
        const generation = parseInt(process.env.TELEMETRY_GENERATION || '0');
        // Fire and forget - don't block the tool execution
        TelemetryCapture.startSession(agentId, generation).catch(error => {
          console.error(`📊 Failed to auto-start telemetry session: ${error}`);
        });
      }
    }
    
    if (!isTelemetryEnabled()) {
      // Run without telemetry if disabled
      return handler(args);
    }
    
    const startTime = Date.now();
    try {
      const result = await handler(args);
      
      // Capture successful execution (fire and forget to avoid blocking)
      TelemetryCapture.capture(toolName, args, {
        success: true,
        executionTime: Date.now() - startTime,
        data: result // Include result data for sanitization
      }).catch(error => {
        console.error(`📊 Failed to capture telemetry for ${toolName}: ${error}`);
      });
      
      return result;
    } catch (error) {
      // Capture error (fire and forget to avoid blocking on error path)
      const errorMessage = error instanceof Error ? error.message : String(error);
      TelemetryCapture.capture(toolName, args, {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime
      }).catch(captureError => {
        console.error(`📊 Failed to capture error telemetry for ${toolName}: ${captureError}`);
      });
      
      // Re-throw the error
      throw error;
    }
  };
}