/**
 * @fileoverview Page management tools for InDesign MCP
 * Batch 4: Page operations - add, remove, get info
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";
import type { PageLocation } from "../../types.js";

/**
 * Registers page management tools with the MCP server
 */
export async function registerPageTools(server: McpServer): Promise<void> {
  // Register add_pages tool
  server.tool(
    "add_pages",
    "Add new pages to the document",
    {
      page_count: {
        type: "integer",
        description: "Number of pages to add",
        default: 1
      },
      location: {
        type: "string",
        enum: ["beginning", "end", "after_current"],
        description: "Where to add pages",
        default: "end"
      },
      master_spread: {
        type: "string",
        description: "Master spread to apply",
        default: ""
      }
    },
    async (args) => {
      return await handleAddPages(args);
    }
  );

  // Register remove_pages tool
  server.tool(
    "remove_pages",
    "Remove pages from the document",
    {
      page_range: {
        type: "string",
        description: "Page range to remove (e.g., '2-4' or '3')"
      }
    },
    async (args) => {
      return await handleRemovePages(args);
    }
  );

  // Register get_page_info tool
  server.tool(
    "get_page_info",
    "Get information about pages in the document",
    {
      page_number: {
        type: "integer",
        description: "Specific page number (1-based), or -1 for all pages",
        default: -1
      }
    },
    async (args) => {
      return await handleGetPageInfo(args);
    }
  );
}


async function handleAddPages(args: any): Promise<{ content: TextContent[] }> {
  const pageCount = args.page_count || 1;
  const location: PageLocation = args.location || "end";
  const masterSpread = args.master_spread ? escapeExtendScriptString(args.master_spread) : "";
  
  const script = `
    var doc = app.activeDocument;
    var addedPages = [];
    
    for (var i = 0; i < ${pageCount}; i++) {
      var newPage;
      
      switch("${location}") {
        case "beginning":
          newPage = doc.pages.add(LocationOptions.AT_BEGINNING);
          break;
        case "end":
          newPage = doc.pages.add(LocationOptions.AT_END);
          break;
        case "after_current":
          newPage = doc.pages.add(LocationOptions.AFTER, doc.pages[0]);
          break;
        default:
          newPage = doc.pages.add(LocationOptions.AT_END);
      }
      
      if ("${masterSpread}" !== "") {
        try {
          var master = doc.masterSpreads.itemByName("${masterSpread}");
          if (master.isValid) {
            newPage.appliedMaster = master;
          }
        } catch(e) {
          // Master spread not found, continue without applying
        }
      }
      
      addedPages.push(newPage.name || (i + 1));
    }
    
    "Added " + ${pageCount} + " page(s) successfully";
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Successfully added pages: ${result.result}` : `Error adding pages: ${result.error}`
    }]
  };
}

async function handleRemovePages(args: any): Promise<{ content: TextContent[] }> {
  const pageRange = escapeExtendScriptString(args.page_range);
  
  const script = `
    var doc = app.activeDocument;
    var pageNumbers = "${pageRange}";
    var pagesToRemove = [];
    
    // Parse page range (e.g., "2-4" or "3")
    if (pageNumbers.indexOf("-") !== -1) {
      var parts = pageNumbers.split("-");
      var start = parseInt(parts[0]);
      var end = parseInt(parts[1]);
      
      for (var i = start; i <= end; i++) {
        if (i <= doc.pages.length) {
          pagesToRemove.push(doc.pages[i - 1]);
        }
      }
    } else {
      var pageNum = parseInt(pageNumbers);
      if (pageNum <= doc.pages.length) {
        pagesToRemove.push(doc.pages[pageNum - 1]);
      }
    }
    
    var removedCount = 0;
    for (var j = pagesToRemove.length - 1; j >= 0; j--) {
      pagesToRemove[j].remove();
      removedCount++;
    }
    
    "Removed " + removedCount + " page(s) successfully";
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Successfully removed pages: ${result.result}` : `Error removing pages: ${result.error}`
    }]
  };
}

async function handleGetPageInfo(args: any): Promise<{ content: TextContent[] }> {
  const pageNumber = args.page_number || -1;
  
  const script = `
    var doc = app.activeDocument;
    var info = [];
    
    if (${pageNumber} === -1) {
      // Get info for all pages
      info.push("=== Page Information for " + doc.name + " ===");
      info.push("");
      info.push("Total pages: " + doc.pages.length);
      info.push("");
      
      for (var i = 0; i < doc.pages.length; i++) {
        var page = doc.pages[i];
        var pageInfo = "Page " + (i + 1) + ": " + (page.name || ("Page " + (i + 1)));
        
        try {
          if (page.appliedMaster) {
            pageInfo += " (Master: " + page.appliedMaster.name + ")";
          }
        } catch(e) {
          // Master info not available
        }
        
        info.push(pageInfo);
      }
    } else {
      // Get info for specific page
      if (${pageNumber} <= doc.pages.length && ${pageNumber} > 0) {
        var page = doc.pages[${pageNumber} - 1];
        info.push("=== Page " + ${pageNumber} + " Information ===");
        info.push("");
        info.push("Page name: " + (page.name || ("Page " + ${pageNumber})));
        
        try {
          if (page.appliedMaster) {
            info.push("Applied master: " + page.appliedMaster.name);
          }
        } catch(e) {
          info.push("Applied master: None");
        }
        
        info.push("Text frames: " + page.textFrames.length);
        info.push("All page items: " + page.pageItems.length);
      } else {
        throw new Error("Page number out of range.");
      }
    }
    
    info.join("\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? result.result! : `Error getting page info: ${result.error}`
    }]
  };
}