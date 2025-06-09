/**
 * @fileoverview Layout and positioning tools for InDesign MCP
 * Batch 3: Text frame positioning and creation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";

/**
 * Registers layout and positioning tools with the MCP server
 */
export async function registerLayoutTools(server: McpServer): Promise<void> {
  // Register position_textframe tool
  server.tool(
    "position_textframe",
    "Move and resize text frames with precise positioning",
    {
      textframe_index: {
        type: "integer",
        description: "Index of text frame (0-based)",
        default: 0
      },
      x: {
        type: "number",
        description: "X position in points"
      },
      y: {
        type: "number",
        description: "Y position in points"
      },
      width: {
        type: "number",
        description: "Width in points (optional)",
        default: -1
      },
      height: {
        type: "number",
        description: "Height in points (optional)",
        default: -1
      }
    },
    async (args) => {
      return await handlePositionTextFrame(args);
    }
  );

  // Register create_textframe tool
  server.tool(
    "create_textframe",
    "Create a new text frame with specified position and size",
    {
      x: {
        type: "number",
        description: "X position in points"
      },
      y: {
        type: "number",
        description: "Y position in points"
      },
      width: {
        type: "number",
        description: "Width in points"
      },
      height: {
        type: "number",
        description: "Height in points"
      },
      page_index: {
        type: "integer",
        description: "Page index (0-based)",
        default: 0
      },
      text_content: {
        type: "string",
        description: "Initial text content",
        default: ""
      }
    },
    async (args) => {
      return await handleCreateTextFrame(args);
    }
  );
}


async function handlePositionTextFrame(args: any): Promise<{ content: TextContent[] }> {
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
  const x = args.x;
  const y = args.y;
  const width = args.width;
  const height = args.height;
  const pageIndex = args.page_index || 0;
  const textContent = args.text_content ? escapeExtendScriptString(args.text_content) : "";
  
  const script = `
    var doc = app.activeDocument;
    if (doc.pages.length <= ${pageIndex}) {
      throw new Error("Page index out of range.");
    }
    
    var page = doc.pages[${pageIndex}];
    var textFrame = page.textFrames.add();
    
    // Set bounds [y1, x1, y2, x2]
    textFrame.geometricBounds = [${y}, ${x}, ${y + height}, ${x + width}];
    
    if ("${textContent}" !== "") {
      textFrame.contents = "${textContent}";
    }
    
    "Text frame created successfully on page " + (page.name || (${pageIndex} + 1));
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Successfully created text frame: ${result.result}` : `Error creating text frame: ${result.error}`
    }]
  };
}