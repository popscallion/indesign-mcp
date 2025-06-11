/**
 * @fileoverview Layout and positioning tools for InDesign MCP
 * Batch 3: Text frame positioning and creation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";
import { z } from "zod";

/**
 * Registers layout and positioning tools with the MCP server
 */
export async function registerLayoutTools(server: McpServer): Promise<void> {
  // Register position_textframe tool
  server.tool(
    "position_textframe",
    {
      textframe_index: z.number().default(0).describe("Index of text frame (0-based)"),
      x: z.number().describe("X position in points"),
      y: z.number().describe("Y position in points"),
      width: z.number().default(-1).describe("Width in points (optional)"),
      height: z.number().default(-1).describe("Height in points (optional)")
    },
    async (args) => {
      return await handlePositionTextFrame(args);
    }
  );

  // Register create_textframe tool
  server.tool(
    "create_textframe",
    {
      x: z.number().describe("X position in points"),
      y: z.number().describe("Y position in points"),
      width: z.number().describe("Width in points"),
      height: z.number().describe("Height in points"),
      page_number: z.number().default(1).describe("Page number (1-based)"),
      text_content: z.string().default("").describe("Initial text content")
    },
    async (args) => {
      return await handleCreateTextFrame(args);
    }
  );
}


async function handlePositionTextFrame(args: any): Promise<{ content: TextContent[] }> {
  if (args.x === undefined || args.x === null) {
    throw new Error("x parameter is required");
  }
  if (args.y === undefined || args.y === null) {
    throw new Error("y parameter is required");
  }
  
  const textFrameIndex = args.textframe_index || 0;
  const x = args.x;
  const y = args.y;
  const width = args.width || -1;
  const height = args.height || -1;
  
  const script = `
    var doc = app.activeDocument;
    if (doc.textFrames.length <= ${textFrameIndex}) {
      throw new Error("Text frame index out of range.");
    }
    
    var textFrame = doc.textFrames[${textFrameIndex}];
    var currentBounds = textFrame.geometricBounds;
    
    // Set new bounds [y1, x1, y2, x2]
    var newBounds = [
      ${y},
      ${x},
      ${height > 0 ? y + height : 'currentBounds[2] - currentBounds[0] + ' + y},
      ${width > 0 ? x + width : 'currentBounds[3] - currentBounds[1] + ' + x}
    ];
    
    textFrame.geometricBounds = newBounds;
    
    "Text frame repositioned successfully";
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Successfully positioned text frame: ${result.result}` : `Error positioning text frame: ${result.error}`
    }]
  };
}

async function handleCreateTextFrame(args: any): Promise<{ content: TextContent[] }> {
  if (args.x === undefined || args.x === null) {
    throw new Error("x parameter is required");
  }
  if (args.y === undefined || args.y === null) {
    throw new Error("y parameter is required");
  }
  if (args.width === undefined || args.width === null) {
    throw new Error("width parameter is required");
  }
  if (args.height === undefined || args.height === null) {
    throw new Error("height parameter is required");
  }
  
  const x = args.x;
  const y = args.y;
  const width = args.width;
  const height = args.height;
  const pageNumber = args.page_number || 1;
  const textContent = args.text_content ? escapeExtendScriptString(args.text_content) : "";
  
  const script = `
    var doc = app.activeDocument;
    if (doc.pages.length < ${pageNumber}) {
      throw new Error("Page number " + ${pageNumber} + " out of range. Document has " + doc.pages.length + " pages.");
    }
    
    var page = doc.pages[${pageNumber} - 1];
    var textFrame = page.textFrames.add();
    
    // Set bounds [y1, x1, y2, x2]
    textFrame.geometricBounds = [${y}, ${x}, ${y + height}, ${x + width}];
    
    if ("${textContent}" !== "") {
      textFrame.contents = "${textContent}";
    }
    
    "Text frame created successfully on page " + (page.name || ${pageNumber});
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Successfully created text frame: ${result.result}` : `Error creating text frame: ${result.error}`
    }]
  };
}