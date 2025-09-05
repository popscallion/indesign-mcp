// packages/shared/src/server-factory-simple.ts

/**
 * @fileoverview Simple factory utilities for server configuration
 * without circular dependencies
 */

export interface ServerConfig {
  name: string;
  version: string;
}

/**
 * Application mode type
 */
export type AppMode = 'indesign' | 'illustrator';

/**
 * Get the current application mode from environment or default
 */
export function getAppMode(): AppMode {
  const mode = process.env.MCP_APP_MODE?.toLowerCase();
  if (mode === 'illustrator') {
    return 'illustrator';
  }
  return 'indesign'; // Default to InDesign for backwards compatibility
}

/**
 * Get server configuration based on application mode
 */
export function getServerConfig(mode?: AppMode): ServerConfig {
  const appMode = mode || getAppMode();
  
  if (appMode === 'illustrator') {
    return {
      name: 'illustrator-mcp',
      version: '1.0.0'
    };
  } else {
    return {
      name: 'indesign-mcp',
      version: '1.0.0'
    };
  }
}

/**
 * Get application name for display purposes
 */
export function getAppName(mode?: AppMode): string {
  const appMode = mode || getAppMode();
  return appMode === 'illustrator' ? 'Illustrator' : 'InDesign';
}