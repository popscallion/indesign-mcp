/**
 * @fileoverview Change tracking utilities for InDesign MCP
 * Implements JSON-Patch based change summaries for mutation tracking
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScript } from "../extendscript.js";

interface PageInfo {
  number: number;
  frameCount: number;
}

interface DocumentSnapshot {
  schemaVersion: number;
  document: Record<string, unknown>;
  pages: PageInfo[];
  threads: Record<string, unknown>[];
  overset: boolean;
  warnings: string[];
}

interface JsonPatchOp {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  value?: unknown;
  from?: string;
}

/**
 * Captures the current document snapshot for change tracking
 */
export async function captureSnapshot(): Promise<DocumentSnapshot | null> {
  const jsx = `
    if (app.documents.length === 0) { null; }
    else {
      var d = app.activeDocument;
      var snapshot = {
        schemaVersion: 2,
        document: {
          name: d.name,
          pages: d.pages.length,
          units: d.viewPreferences.horizontalMeasurementUnits.toString()
        },
        pages: [],
        threads: [],
        overset: false,
        warnings: []
      };
      
      // Simplified snapshot for change tracking
      for (var i = 0; i < d.pages.length; i++) {
        var p = d.pages[i];
        snapshot.pages.push({
          number: i + 1,
          frameCount: p.textFrames.length
        });
      }
      
      // Check overset
      for (var s = 0; s < d.stories.length; s++) {
        if (d.stories[s].overflows) {
          snapshot.overset = true;
          break;
        }
      }
      
      JSON.stringify(snapshot);
    }
  `;
  
  const result = await executeExtendScript(jsx);
  if (!result.success || result.result === "null") return null;
  
  return JSON.parse(result.result!);
}

/**
 * Generates JSON-Patch operations describing the difference between two snapshots
 */
export function generatePatch(before: DocumentSnapshot, after: DocumentSnapshot): JsonPatchOp[] {
  const patches: JsonPatchOp[] = [];
  
  // Check page count changes
  if (before.pages.length !== after.pages.length) {
    if (after.pages.length > before.pages.length) {
      // Pages added
      for (let i = before.pages.length; i < after.pages.length; i++) {
        patches.push({
          op: "add",
          path: `/pages/${i}`,
          value: after.pages[i]
        });
      }
    } else {
      // Pages removed
      for (let i = after.pages.length; i < before.pages.length; i++) {
        patches.push({
          op: "remove",
          path: `/pages/${i}`
        });
      }
    }
  }
  
  // Check overset changes
  if (before.overset !== after.overset) {
    patches.push({
      op: "replace",
      path: "/overset",
      value: after.overset
    });
  }
  
  // Check frame count changes on existing pages
  const minPages = Math.min(before.pages.length, after.pages.length);
  for (let i = 0; i < minPages; i++) {
    if (before.pages[i].frameCount !== after.pages[i].frameCount) {
      patches.push({
        op: "replace",
        path: `/pages/${i}/frameCount`,
        value: after.pages[i].frameCount
      });
    }
  }
  
  // Check document name changes
  if (before.document.name !== after.document.name) {
    patches.push({
      op: "replace",
      path: "/document/name",
      value: after.document.name
    });
  }
  
  return patches;
}

/**
 * Logs a progress event to the MCP server
 */
export async function logProgress(
  server: McpServer,
  toolName: string,
  message: string,
  progress?: { current: number; total: number }
): Promise<void> {
  await (server as any).server.sendLoggingMessage({
    level: "info",
    logger: "progress",
    data: {
      tool: toolName,
      message,
      progress,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Logs a change summary to the MCP server
 */
export async function logChangeSummary(
  server: McpServer, 
  toolName: string,
  before: DocumentSnapshot,
  after: DocumentSnapshot
): Promise<void> {
  const patches = generatePatch(before, after);
  
  if (patches.length > 0) {
    // Use proper MCP logging API
    await (server as any).server.sendLoggingMessage({
      level: "info",
      logger: "changeSummary",
      data: {
        tool: toolName,
        patches: patches,
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Decorator to wrap tool handlers with automatic change tracking and progress support
 */
export function withChangeTracking(server: McpServer, toolName: string) {
  return function (handler: Function) {
    return async function (...args: unknown[]) {
      const before = await captureSnapshot();
      
      // Add progress logger to the args if the handler expects it
      const progressLogger = {
        log: (message: string, progress?: { current: number; total: number }) => 
          logProgress(server, toolName, message, progress)
      };
      
      // If the handler accepts progressLogger, pass it as the last argument
      const result = await handler(...args, progressLogger);
      const after = await captureSnapshot();
      
      if (before && after) {
        await logChangeSummary(server, toolName, before, after);
      }
      
      return result;
    };
  };
}