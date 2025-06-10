/**
 * @fileoverview Document export and import tools for InDesign MCP
 * Batch 1.1: Document export/import operations - export_document, save_document, import_content
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";
import type { ExportFormat, ExportQuality, ImportOptions } from "../../types.js";

/**
 * Registers all document export/import tools with the MCP server
 */
export async function registerExportTools(server: McpServer): Promise<void> {
  // Register export_document tool
  server.tool(
    "export_document",
    "Export InDesign document to various formats (PDF, EPUB, HTML, IDML, JPEG, PNG, EPS)",
    {
      format: {
        type: "string",
        description: "Export format",
        enum: ["PDF", "EPUB", "HTML", "IDML", "JPEG", "PNG", "EPS"]
      },
      path: {
        type: "string",
        description: "Export file path"
      },
      quality: {
        type: "string",
        description: "Export quality setting",
        enum: ["high", "medium", "low"],
        default: "high"
      },
      pages: {
        type: "string",
        description: "Page range to export (e.g., 'all', '1-5', '3,7,9')",
        default: "all"
      },
      spreads: {
        type: "boolean", 
        description: "Export as spreads instead of individual pages",
        default: false
      }
    },
    async (args) => {
      const format: ExportFormat = args.format;
      const path = escapeExtendScriptString(args.path);
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
          var exportFormat;
          var exportPresets = [];
          
          // Determine export format
          switch ("${format}") {
            case "PDF":
              exportFormat = ExportFormat.pdfType;
              exportPresets = doc.pdfExportPresets;
              break;
            case "EPUB":
              exportFormat = ExportFormat.EPUB;
              exportPresets = doc.epubExportPresets;
              break;
            case "HTML":
              exportFormat = ExportFormat.HTML;
              break;
            case "IDML":
              exportFormat = ExportFormat.IDML;
              break;
            case "JPEG":
              exportFormat = ExportFormat.jpg;
              exportPresets = doc.jpegExportPresets;
              break;
            case "PNG":
              exportFormat = ExportFormat.PNG_FORMAT;
              exportPresets = doc.pngExportPresets;
              break;
            case "EPS":
              exportFormat = ExportFormat.epsType;
              exportPresets = doc.epsExportPresets;
              break;
            default:
              throw new Error("Unsupported export format: ${format}");
          }
          
          // Set up export preferences based on quality
          var preset = null;
          if (exportPresets && exportPresets.length > 0) {
            var qualityName = "${quality}";
            for (var i = 0; i < exportPresets.length; i++) {
              if (exportPresets[i].name.toLowerCase().indexOf(qualityName) !== -1) {
                preset = exportPresets[i];
                break;
              }
            }
            if (!preset) {
              preset = exportPresets[0]; // Use first available preset
            }
          }
          
          // Configure page range
          if ("${pages}" !== "all") {
            app.pdfExportPreferences.pageRange = "${pages}";
          }
          
          // Configure spreads setting
          if ("${format}" === "PDF") {
            app.pdfExportPreferences.exportReaderSpreads = ${spreads ? "true" : "false"};
          }
          
          // Perform export
          doc.exportFile(exportFormat, exportFile, false, preset);
          
          "Successfully exported document to " + exportFile.fsName + " in ${format} format";
          
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
    "Save the current InDesign document",
    {
      path: {
        type: "string",
        description: "Save path (optional - uses current location if not specified)"
      },
      copy: {
        type: "boolean",
        description: "Save as copy without changing current document",
        default: false
      }
    },
    async (args) => {
      const path = args.path ? escapeExtendScriptString(args.path) : null;
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
    "Import content from external files (text, images, other documents)",
    {
      path: {
        type: "string",
        description: "Path to file to import"
      },
      link_file: {
        type: "boolean",
        description: "Link to file instead of embedding",
        default: true
      },
      show_options: {
        type: "boolean", 
        description: "Show import options dialog",
        default: false
      },
      retain_format: {
        type: "boolean",
        description: "Retain formatting from source file",
        default: true
      }
    },
    async (args) => {
      const path = escapeExtendScriptString(args.path);
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
}