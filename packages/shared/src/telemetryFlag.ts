/**
 * @fileoverview Singleton module for telemetry enabled flag
 * Prevents circular import issues in telemetry system
 */

/**
 * Internal flag for telemetry enabled state
 */
let telemetryEnabled = false;

/**
 * Check if telemetry is currently enabled
 */
export function isTelemetryEnabled(): boolean {
  return telemetryEnabled;
}

/**
 * Set telemetry enabled state
 */
export function setTelemetryEnabled(enabled: boolean): void {
  telemetryEnabled = enabled;
  if (process.env.DEBUG_TELEMETRY) {
    console.log(`📊 Telemetry ${enabled ? 'enabled' : 'disabled'}`);
  }
}

/**
 * Initialize telemetry state from environment
 */
export function initializeTelemetryFromEnv(): void {
  // Check environment variables for initial state
  const envEnabled = process.env.TELEMETRY_ENABLED === 'true' ||
                    process.env.EVOLUTION_SESSION_ID !== undefined;
  
  if (envEnabled) {
    setTelemetryEnabled(true);
  }
}