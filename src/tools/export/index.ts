/**
 * @fileoverview Document export and import tools for InDesign MCP
 * Batch 1.1: Document export/import operations - export_document, save_document, import_content
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";
import type { ExportFormat, ExportQuality, ImportOptions } from "../../types.js";
import { z } from "zod";

/**
 * Registers all document export/import tools with the MCP server
 */
export async function registerExportTools(server: McpServer): Promise<void> {
  // Register export_document tool
  server.tool(
    "test_export_document",
    {
      format: z.enum(["PDF", "EPUB", "HTML", "IDML", "JPEG", "PNG", "EPS"]).describe("Export format"),
      filePath: z.string().describe("Export file path (must be a valid local file path, not temp/... paths)"),
      quality: z.enum(["high", "medium", "low"]).default("high").describe("Export quality setting"),
      pages: z.string().default("all").describe("Page range to export (e.g., 'all', '1-5', '3,7,9')"),
      spreads: z.boolean().default(false).describe("Export as spreads instead of individual pages")
    },
    async (args) => {
      const format: ExportFormat = args.format;
      if (!args.filePath) {
        throw new Error("filePath parameter is required");
      }
      const path = escapeExtendScriptString(args.filePath);
      const quality: ExportQuality = args.quality || "high";
      const pages = args.pages || "all";
      const spreads = args.spreads || false;

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        if (!doc) {
          throw new Error("No active document found.");
        }
        
        try {
          var exportFile = new File("${path}");
          
          // Set up export based on format
          if ("${format}" === "PDF") {
            // Use PDF export preset
            var preset = app.pdfExportPresets.item("[High Quality Print]");
            if (!preset.isValid) {
              preset = app.pdfExportPresets[0]; // Use first available preset
            }
            
            // Set page range if specified
            if ("${pages}" !== "all") {
              preset.pageRange = "${pages}";
            }
            
            // Export PDF
            doc.exportFile(ExportFormat.PDF_TYPE, exportFile, false, preset);
            "Successfully exported PDF to " + exportFile.fsName;
            
          } else if ("${format}" === "JPEG") {
            // JPEG export
            doc.exportFile(ExportFormat.JPG, exportFile, false);
            "Successfully exported JPEG to " + exportFile.fsName;
            
          } else if ("${format}" === "PNG") {
            // PNG export
            doc.exportFile(ExportFormat.PNG_FORMAT, exportFile, false);
            "Successfully exported PNG to " + exportFile.fsName;
            
          } else if ("${format}" === "EPS") {
            // EPS export
            doc.exportFile(ExportFormat.EPS_TYPE, exportFile, false);
            "Successfully exported EPS to " + exportFile.fsName;
            
          } else {
            throw new Error("Export format ${format} not yet implemented");
          }
          
        } catch (e) {
          throw new Error("Export failed: " + e.message);
        }
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        return {
          content: [{
            type: "text",
            text: `Export completed: ${result.result}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `Export failed: ${result.error}`
          }]
        };
      }
    }
  );

  // Register save_document tool
  server.tool(
    "save_document",
    {
      filePath: z.string().optional().describe("Save path (optional - uses current location if not specified)"),
      copy: z.boolean().default(false).describe("Save as copy without changing current document")
    },
    async (args) => {
      const path = args.filePath ? escapeExtendScriptString(args.filePath) : null;
      const copy = args.copy || false;

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        if (!doc) {
          throw new Error("No active document found.");
        }
        
        try {
          ${path ? `
            var saveFile = new File("${path}");
            if (${copy ? "true" : "false"}) {
              doc.saveACopy(saveFile);
              "Document saved as copy to " + saveFile.fsName;
            } else {
              doc.save(saveFile);
              "Document saved to " + saveFile.fsName;
            }
          ` : `
            doc.save();
            "Document saved to " + doc.fullName;
          `}
        } catch (e) {
          throw new Error("Save failed: " + e.message);
        }
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        return {
          content: [{
            type: "text",
            text: `Save completed: ${result.result}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `Save failed: ${result.error}`
          }]
        };
      }
    }
  );

  // Register import_content tool
  server.tool(
    "import_content",
    {
      filePath: z.string().describe("Path to file to import (must be a valid local file path)"),
      link_file: z.boolean().default(true).describe("Link to file instead of embedding"),
      show_options: z.boolean().default(false).describe("Show import options dialog"),
      retain_format: z.boolean().default(true).describe("Retain formatting from source file")
    },
    async (args) => {
      if (!args.filePath) {
        throw new Error("filePath parameter is required");
      }
      const path = escapeExtendScriptString(args.filePath);
      const linkFile = args.link_file !== false; // default true
      const showOptions = args.show_options || false;
      const retainFormat = args.retain_format !== false; // default true

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        if (!doc) {
          throw new Error("No active document found.");
        }
        
        try {
          var importFile = new File("${path}");
          if (!importFile.exists) {
            throw new Error("Import file does not exist: ${path}");
          }
          
          // Create a text frame if none exists
          if (doc.textFrames.length === 0) {
            var page = doc.pages[0];
            var bounds = page.bounds;
            var textFrame = page.textFrames.add({
              geometricBounds: [bounds[0] + 72, bounds[1] + 72, bounds[2] - 72, bounds[3] - 72]
            });
          } else {
            var textFrame = doc.textFrames[0];
          }
          
          // Import the content
          var importedContent = textFrame.place(importFile, ${showOptions ? "true" : "false"});
          
          if (${linkFile ? "true" : "false"}) {
            "Content imported and linked from " + importFile.fsName;
          } else {
            "Content imported and embedded from " + importFile.fsName;
          }
          
        } catch (e) {
          throw new Error("Import failed: " + e.message);
        }
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        return {
          content: [{
            type: "text",
            text: `Import completed: ${result.result}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `Import failed: ${result.error}`
          }]
        };
      }
    }
  );

  // Register place_file tool
  server.tool(
    "place_file",
    {
      filePath: z.string().describe("Path to file to place (must be a valid local file path)"),
      x: z.number().default(72).describe("X position for placed content"),
      y: z.number().default(72).describe("Y position for placed content"),
      width: z.number().default(200).describe("Width for placed content"),
      height: z.number().default(200).describe("Height for placed content"),
      link_file: z.boolean().default(true).describe("Link to file instead of embedding"),
      fit_content: z.boolean().default(true).describe("Automatically fit content to frame")
    },
    async (args) => {
      const filePath = args.filePath;
      if (!filePath) {
        throw new Error("filePath parameter is required");
      }
      const path = escapeExtendScriptString(filePath);
      const x = args.x || 72;
      const y = args.y || 72;
      const width = args.width || 200;
      const height = args.height || 200;
      const linkFile = args.link_file !== false;
      const fitContent = args.fit_content !== false;

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        if (!doc) {
          throw new Error("No active document found.");
        }
        
        try {
          var placeFile = new File("${path}");
          if (!placeFile.exists) {
            throw new Error("File does not exist: ${path}");
          }
          
          var page = doc.pages[0];
          var bounds = [${y}, ${x}, ${y + height}, ${x + width}];
          
          // Create a frame for the content
          var frame;
          var fileExtension = placeFile.name.split('.').pop().toLowerCase();
          
          if (fileExtension === 'txt' || fileExtension === 'rtf' || fileExtension === 'doc' || fileExtension === 'docx') {
            // Text file - create text frame
            frame = page.textFrames.add({
              geometricBounds: bounds
            });
          } else {
            // Image or other graphic - create rectangle frame
            frame = page.rectangles.add({
              geometricBounds: bounds
            });
          }
          
          // Place the file
          var placedItem = frame.place(placeFile, false);
          
          // Fit content if requested
          if (${fitContent ? "true" : "false"}) {
            if (frame.images && frame.images.length > 0) {
              // For images, fit proportionally
              frame.fit(FitOptions.PROPORTIONALLY);
            }
          }
          
          "Successfully placed " + placeFile.name + " at position [${x}, ${y}]";
          
        } catch (e) {
          throw new Error("Place file failed: " + e.message);
        }
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        return {
          content: [{
            type: "text",
            text: `Place completed: ${result.result}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `Place failed: ${result.error}`
          }]
        };
      }
    }
  );

  // Register get_page_dimensions tool
  server.tool(
    "get_page_dimensions",
    {
      page_number: z.number().default(1).describe("Page number to get dimensions for (1-based), or 0 for all pages")
    },
    async (args) => {
      const pageNumber = args.page_number || 1;

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        if (!doc) {
          throw new Error("No active document found.");
        }
        
        try {
          var page = doc.pages[0];
          var bounds = page.bounds;
          var width = bounds[3] - bounds[1];
          var height = bounds[2] - bounds[0];
          
          // Get the document's measurement unit - no conversion needed as bounds are already in doc units
          var unit = "mm"; // If InDesign is set to mm, bounds should already be in mm
          
          try {
            var appUnits = app.viewPreferences.horizontalMeasurementUnits;
            if (appUnits == MeasurementUnits.MILLIMETERS) {
              unit = "mm";
            } else if (appUnits == MeasurementUnits.INCHES || appUnits == MeasurementUnits.INCHES_DECIMAL) {
              unit = "in";
            } else if (appUnits == MeasurementUnits.CENTIMETERS) {
              unit = "cm";
            } else if (appUnits == MeasurementUnits.PICAS) {
              unit = "p";
            } else if (appUnits == MeasurementUnits.POINTS) {
              unit = "pts";
            } else {
              unit = "units"; // Unknown unit
            }
          } catch(e) {
            unit = "error";
          }
          
          "Page 1: " + width + " x " + height + " " + unit + " (detected: " + appUnits + ")";
        } catch (e) {
          throw new Error("Get page dimensions failed: " + e.message);
        }
      `;

      const result = await executeExtendScript(script);

      return {
        content: [{
          type: "text",
          text: result.success ? 
            `Page dimensions: ${result.result || "No result"}` :
            `Get page dimensions failed: ${result.error}`
        }]
      };
    }
  );

}