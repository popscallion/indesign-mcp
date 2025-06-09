/**
 * @fileoverview Special features tools for InDesign MCP
 * Batch 5: Special characters, layers, tables, status
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";
import type { SpecialCharacterType, LayerAction, LayerColor, TextPosition } from "../../types.js";

/**
 * Registers special features tools with the MCP server
 */
export async function registerSpecialTools(server: McpServer): Promise<void> {
  // Register insert_special_character tool
  server.tool(
    "insert_special_character",
    "Insert special characters like page numbers, em dashes, etc.",
    {
      character_type: {
        type: "string",
        enum: [
          "auto_page_number", "next_page_number", "previous_page_number",
          "em_dash", "en_dash", "copyright", "registered", "trademark",
          "section_symbol", "paragraph_symbol", "bullet", "ellipsis",
          "forced_line_break", "column_break", "frame_break", "page_break"
        ],
        description: "Type of special character to insert"
      },
      position: {
        type: "string",
        enum: ["cursor", "end", "start"],
        description: "Where to insert",
        default: "end"
      },
      story_index: {
        type: "integer",
        description: "Story index (0-based)",
        default: 0
      }
    },
    async (args) => {
      return await handleInsertSpecialCharacter(args);
    }
  );

  // Register manage_layers tool
  server.tool(
    "manage_layers",
    "Create, delete, or modify layers",
    {
      action: {
        type: "string",
        enum: ["create", "delete", "rename", "list"],
        description: "Action to perform"
      },
      layer_name: {
        type: "string",
        description: "Layer name"
      },
      new_name: {
        type: "string",
        description: "New name for rename action",
        default: ""
      },
      layer_color: {
        type: "string",
        description: "Layer color",
        default: "Light Blue"
      }
    },
    async (args) => {
      return await handleManageLayers(args);
    }
  );

  // Register create_table tool
  server.tool(
    "create_table",
    "Create a table with specified dimensions",
    {
      rows: {
        type: "integer",
        description: "Number of rows"
      },
      columns: {
        type: "integer",
        description: "Number of columns"
      },
      x: {
        type: "number",
        description: "X position"
      },
      y: {
        type: "number",
        description: "Y position"
      },
      width: {
        type: "number",
        description: "Table width"
      },
      height: {
        type: "number",
        description: "Table height"
      }
    },
    async (args) => {
      return await handleCreateTable(args);
    }
  );

  // Register indesign_status tool
  server.tool(
    "indesign_status",
    "Check InDesign application status and document information",
    {},
    async (args) => {
      return await handleInDesignStatus(args);
    }
  );
}


async function handleInsertSpecialCharacter(args: any): Promise<{ content: TextContent[] }> {
  const characterType: SpecialCharacterType = args.character_type;
  const position: TextPosition = args.position || "end";
  const storyIndex = args.story_index || 0;
  
  // Map character types to InDesign SpecialCharacters enum
  const charMap: Record<SpecialCharacterType, string> = {
    "auto_page_number": "SpecialCharacters.AUTO_PAGE_NUMBER",
    "next_page_number": "SpecialCharacters.NEXT_PAGE_NUMBER",
    "previous_page_number": "SpecialCharacters.PREVIOUS_PAGE_NUMBER",
    "em_dash": "SpecialCharacters.EM_DASH",
    "en_dash": "SpecialCharacters.EN_DASH",
    "copyright": "SpecialCharacters.COPYRIGHT_SYMBOL",
    "registered": "SpecialCharacters.REGISTERED_TRADEMARK",
    "trademark": "SpecialCharacters.TRADEMARK_SYMBOL",
    "section_symbol": "SpecialCharacters.SECTION_SYMBOL",
    "paragraph_symbol": "SpecialCharacters.PARAGRAPH_SYMBOL",
    "bullet": "SpecialCharacters.BULLET_CHARACTER",
    "ellipsis": "SpecialCharacters.ELLIPSIS_CHARACTER",
    "forced_line_break": "SpecialCharacters.FORCED_LINE_BREAK",
    "column_break": "SpecialCharacters.COLUMN_BREAK",
    "frame_break": "SpecialCharacters.FRAME_BREAK",
    "page_break": "SpecialCharacters.PAGE_BREAK"
  };
  
  const specialChar = charMap[characterType];
  
  const script = `
    var doc = app.activeDocument;
    if (doc.stories.length <= ${storyIndex}) {
      throw new Error("Story index out of range.");
    }
    
    var story = doc.stories[${storyIndex}];
    var insertionPoint;
    
    if ("${position}" === "start") {
      insertionPoint = story.insertionPoints[0];
    } else if ("${position}" === "end") {
      insertionPoint = story.insertionPoints[-1];
    } else {
      // Use current selection or end
      if (app.selection.length > 0 && app.selection[0].hasOwnProperty("insertionPoints")) {
        insertionPoint = app.selection[0].insertionPoints[0];
      } else {
        insertionPoint = story.insertionPoints[-1];
      }
    }
    
    insertionPoint.contents = ${specialChar};
    "Special character '${characterType}' inserted successfully";
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Successfully inserted special character: ${result.result}` : `Error inserting special character: ${result.error}`
    }]
  };
}

async function handleManageLayers(args: any): Promise<{ content: TextContent[] }> {
  const action: LayerAction = args.action;
  const layerName = args.layer_name ? escapeExtendScriptString(args.layer_name) : "";
  const newName = args.new_name ? escapeExtendScriptString(args.new_name) : "";
  const layerColor: LayerColor = args.layer_color || "Light Blue";
  
  const script = `
    var doc = app.activeDocument;
    var result = "";
    
    switch("${action}") {
      case "create":
        if ("${layerName}" === "") {
          throw new Error("Layer name is required for create action.");
        }
        
        var newLayer = doc.layers.add();
        newLayer.name = "${layerName}";
        newLayer.layerColor = UIColors.${layerColor.toUpperCase().replace(/ /g, "_")};
        result = "Created layer '" + "${layerName}" + "'";
        break;
        
      case "delete":
        if ("${layerName}" === "") {
          throw new Error("Layer name is required for delete action.");
        }
        
        var layerToDelete = doc.layers.itemByName("${layerName}");
        if (layerToDelete.isValid) {
          layerToDelete.remove();
          result = "Deleted layer '" + "${layerName}" + "'";
        } else {
          throw new Error("Layer '" + "${layerName}" + "' not found.");
        }
        break;
        
      case "rename":
        if ("${layerName}" === "" || "${newName}" === "") {
          throw new Error("Both old and new layer names are required for rename action.");
        }
        
        var layerToRename = doc.layers.itemByName("${layerName}");
        if (layerToRename.isValid) {
          layerToRename.name = "${newName}";
          result = "Renamed layer '" + "${layerName}" + "' to '" + "${newName}" + "'";
        } else {
          throw new Error("Layer '" + "${layerName}" + "' not found.");
        }
        break;
        
      case "list":
        var layerList = [];
        layerList.push("=== Layers in " + doc.name + " ===");
        layerList.push("");
        
        for (var i = 0; i < doc.layers.length; i++) {
          var layer = doc.layers[i];
          var layerInfo = (i + 1) + ". " + layer.name;
          
          try {
            layerInfo += " (Visible: " + layer.visible + ", Locked: " + layer.locked + ")";
          } catch(e) {
            // Skip if properties not accessible
          }
          
          layerList.push(layerInfo);
        }
        
        result = layerList.join("\\n");
        break;
        
      default:
        throw new Error("Unknown layer action: " + "${action}");
    }
    
    result;
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Successfully managed layers: ${result.result}` : `Error managing layers: ${result.error}`
    }]
  };
}

async function handleCreateTable(args: any): Promise<{ content: TextContent[] }> {
  const rows = args.rows;
  const columns = args.columns;
  const x = args.x;
  const y = args.y;
  const width = args.width;
  const height = args.height;
  
  const script = `
    var doc = app.activeDocument;
    var page = doc.pages[0]; // Create on first page by default
    
    // Create a text frame first
    var textFrame = page.textFrames.add();
    textFrame.geometricBounds = [${y}, ${x}, ${y + height}, ${x + width}];
    
    // Create table in the text frame
    var table = textFrame.tables.add();
    table.bodyRowCount = ${rows};
    table.columnCount = ${columns};
    
    // Set some basic formatting
    table.width = ${width};
    table.height = ${height};
    
    "Created table with " + ${rows} + " rows and " + ${columns} + " columns";
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Successfully created table: ${result.result}` : `Error creating table: ${result.error}`
    }]
  };
}

async function handleInDesignStatus(args: any): Promise<{ content: TextContent[] }> {
  const script = `
    var status = "=== InDesign Status ===\\n";
    status += "Application: " + app.name + " " + app.version + "\\n";
    status += "Documents open: " + app.documents.length + "\\n";
    
    if (app.documents.length > 0) {
      var doc = app.activeDocument;
      status += "Active document: " + doc.name + "\\n";
      status += "Document stories: " + doc.stories.length + "\\n";
      status += "Document pages: " + doc.pages.length + "\\n";
      
      if (doc.stories.length > 0) {
        status += "\\nFirst story preview: " + doc.stories[0].contents.substring(0, 100) + "...\\n";
      }
    } else {
      status += "\\nNo documents are currently open.\\n";
      status += "Please open or create a document in InDesign.\\n";
    }
    
    status;
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? result.result! : `Error checking InDesign status: ${result.error}`
    }]
  };
}