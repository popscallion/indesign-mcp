/**
 * @fileoverview Text manipulation tools for InDesign MCP
 * Batch 1: Core text operations - add, update, remove, get document text
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";
import type { TextPosition } from "../../types.js";
import { z } from "zod";

/**
 * Registers all text manipulation tools with the MCP server
 */
export async function registerTextTools(server: McpServer): Promise<void> {
  // Register add_text tool  
  server.tool(
    "add_text",
    {
      text: z.string().describe("Text to add to the document"),
      position: z.enum(["start", "end", "after_selection"]).default("end").describe("Position where to add the text")
    },
    async ({ text, position }) => {
      const escapedText = escapeExtendScriptString(text);
      const textPosition: TextPosition = position || "end";
      
      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        if (!doc) {
          throw new Error("No active document found. Please make sure a document is active.");
        }
        
        if (doc.stories.length === 0) {
          throw new Error("Document has no text stories. Please add a text frame first.");
        }
        
        var story = doc.stories[0];
        var insertionPoint;
        
        if ("${textPosition}" === "start") {
          insertionPoint = story.insertionPoints[0];
        } else if ("${textPosition}" === "end") {
          insertionPoint = story.insertionPoints[-1];
        } else {
          insertionPoint = story.insertionPoints[-1];
        }
        
        insertionPoint.contents = "${escapedText}";
        "Text added successfully to " + doc.name;
      `;
      
      const result = await executeExtendScript(script);
      
      if (result.success) {
        return {
          content: [{
            type: "text",
            text: `Successfully added text: '${text}'`
          }]
        };
      } else {
        return {
          content: [{
            type: "text", 
            text: `Error adding text: ${result.error}`
          }]
        };
      }
    }
  );

  // Register update_text tool
  server.tool(
    "update_text",
    {
      findText: z.string().describe("Text to find and replace"),
      replaceText: z.string().describe("Text to replace with"),
      all_occurrences: z.boolean().default(false).describe("Replace all occurrences or just the first")
    },
    async (args) => {
      const findText = escapeExtendScriptString(args.findText);
      const replaceText = escapeExtendScriptString(args.replaceText);
      const allOccurrences = args.all_occurrences || false;
      
      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        if (!doc) {
          throw new Error("No active document found.");
        }
        
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;
        
        app.findGrepPreferences.findWhat = "${findText}";
        app.changeGrepPreferences.changeTo = "${replaceText}";
        
        var found = doc.changeGrep(${allOccurrences ? "true" : "false"});
        
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;
        
        "Replaced " + found.length + " occurrence(s) in " + doc.name;
      `;
      
      const result = await executeExtendScript(script);
      
      if (result.success) {
        return {
          content: [{
            type: "text",
            text: `Successfully updated text: ${result.result}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `Error updating text: ${result.error}`
          }]
        };
      }
    }
  );

  // Register remove_text tool
  server.tool(
    "remove_text",
    {
      text: z.string().describe("Text to remove from the document"),
      all_occurrences: z.boolean().default(false).describe("Remove all occurrences or just the first")
    },
    async (args) => {
      const textToRemove = escapeExtendScriptString(args.text);
      const allOccurrences = args.all_occurrences || false;
      
      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        if (!doc) {
          throw new Error("No active document found.");
        }
        
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;
        
        app.findGrepPreferences.findWhat = "${textToRemove}";
        app.changeGrepPreferences.changeTo = "";
        
        var found = doc.changeGrep(${allOccurrences ? "true" : "false"});
        
        app.findGrepPreferences = NothingEnum.nothing;
        app.changeGrepPreferences = NothingEnum.nothing;
        
        "Removed " + found.length + " occurrence(s) from " + doc.name;
      `;
      
      const result = await executeExtendScript(script);
      
      if (result.success) {
        return {
          content: [{
            type: "text",
            text: `Successfully removed text: ${result.result}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `Error removing text: ${result.error}`
          }]
        };
      }
    }
  );

  // Register get_document_text tool
  server.tool(
    "get_document_text",
    {},
    async () => {
      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        if (!doc) {
          throw new Error("No active document found.");
        }
        
        if (doc.stories.length === 0) {
          "Document " + doc.name + " has no text content.";
        } else {
          var content = [];
          content.push("=== Content from " + doc.name + " ===");
          content.push("");
          content.push("Story 1 of " + doc.stories.length + ":");
          content.push(doc.stories[0].contents.substring(0, 500) + "...");
          
          content.join("\\n");
        }
      `;
      
      const result = await executeExtendScript(script);
      
      if (result.success) {
        return {
          content: [{
            type: "text",
            text: `Document text content:\n${result.result}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `Error getting document text: ${result.error}`
          }]
        };
      }
    }
  );
}