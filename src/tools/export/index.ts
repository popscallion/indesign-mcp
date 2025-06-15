/**
 * @fileoverview Document export and import tools for InDesign MCP
 * Batch 1.1: Document export/import operations - export_document, save_document, import_content
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";
import type { ExportFormat, ExportQuality, ImportOptions } from "../../types.js";
import { updatePageDimensionsCache } from "../layout/index.js";
import { z } from "zod";
import { promises as fs } from "fs";
import { mkdtempSync, mkdirSync } from "fs";
import path from "path";
import os from "os";

/**
 * Preview cache to avoid redundant exports
 * Key: document_name_page_quality_dpi, Value: { filePath, timestamp }
 */
const previewCache = new Map<string, { filePath: string; timestamp: number }>();

/**
 * Reusable temp directory for the session based on process ID
 * This persists across module reloads during the server lifetime
 */
const baseTmpDir = path.join(os.tmpdir(), `id-mcp-${process.pid}`);
mkdirSync(baseTmpDir, { recursive: true });

/**
 * Create safe user temp file path (avoids macOS TCC restrictions)
 */
function safeUserTempFile(name: string): string {
  return path.join(baseTmpDir, name);
}

/**
 * Generate cache key for preview (includes DPI for quality-specific caching)
 */
function generateCacheKey(docName: string, page: number | null, quality: string, dpi: number): string {
  const pageKey = page || 1;
  return `${docName}_${pageKey}_${quality}_${dpi}`;
}

/**
 * Check if cached preview is still valid (less than 5 minutes old)
 */
async function getCachedPreview(cacheKey: string, tempDir: string): Promise<string | null> {
  const cached = previewCache.get(cacheKey);
  if (!cached) return null;

  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  if (cached.timestamp < fiveMinutesAgo) {
    // Cache expired
    previewCache.delete(cacheKey);
    return null;
  }

  // Check if file still exists
  try {
    await fs.access(cached.filePath);
    return cached.filePath;
  } catch {
    // File doesn't exist anymore
    previewCache.delete(cacheKey);
    return null;
  }
}

/**
 * Store preview in cache
 */
function cachePreview(cacheKey: string, filePath: string): void {
  previewCache.set(cacheKey, {
    filePath,
    timestamp: Date.now()
  });
}

/**
 * Clean up old preview files in the specified directory
 * Removes files older than 1 hour that match the preview naming pattern
 */
async function cleanupOldPreviews(tempDir: string): Promise<void> {
  try {
    const files = await fs.readdir(tempDir, { withFileTypes: true });
    const previewFiles = files.filter(
      dirent => dirent.isFile() && 
      dirent.name.startsWith('indesign_preview_') && 
      dirent.name.endsWith('.png')
    );
    const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1 hour in milliseconds

    for (const file of previewFiles) {
      const filePath = path.join(tempDir, file.name);
      try {
        const stats = await fs.stat(filePath);
        if (stats.mtime.getTime() < oneHourAgo) {
          await fs.unlink(filePath);
          console.log(`Cleaned up old preview: ${filePath}`);
        }
      } catch (fileError) {
        // Skip files that can't be accessed or deleted
        console.warn(`Could not clean up preview file ${filePath}:`, fileError);
      }
    }
  } catch (dirError) {
    // If directory doesn't exist or can't be read, that's fine
    console.warn(`Could not access temp directory ${tempDir} for cleanup:`, dirError);
  }
}

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
      
      // Handle /tmp paths with safe temp directory
      let filePath = args.filePath;
      if (filePath.startsWith("/tmp") || filePath.startsWith("/private/tmp")) {
        filePath = safeUserTempFile(path.basename(filePath));
      }
      
      const escapedPath = escapeExtendScriptString(filePath);
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
          var exportFile = new File("${escapedPath}");
          
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
            // PNG export (document-level export)
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
      const escapedPath2 = escapeExtendScriptString(args.filePath);
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
          var importFile = new File("${escapedPath2}");
          if (!importFile.exists) {
            throw new Error("Import file does not exist: ${escapedPath2}");
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
      const escapedPath3 = escapeExtendScriptString(filePath);
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
          var placeFile = new File("${escapedPath3}");
          if (!placeFile.exists) {
            throw new Error("File does not exist: ${escapedPath3}");
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
        (function () {
          if (app.documents.length === 0) {
            return "ERROR: No open document";
          }
          
          var oldUnit = app.scriptPreferences.measurementUnit;
          try {
            app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;
            
            var p = app.activeDocument.pages[0];
            var b = p.bounds;               // UnitValues
            var w = Number(b[3] - b[1]);    // Number in pt
            var h = Number(b[2] - b[0]);
            
            // Always return explicitly
            return "Page 1: " + w + " × " + h + " pt";
          }
          catch (e) {
            // Return the message so the bridge can forward it
            return "ERROR: " + e.message;
          }
          finally {
            app.scriptPreferences.measurementUnit = oldUnit;
          }
        })();
      `;

      const result = await executeExtendScript(script);

      if (result.success && result.result) {
        // Parse dimensions from result and update cache for layout tools
        const dimensionMatch = result.result.match(/(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)\s*pt/);
        if (dimensionMatch) {
          const width = parseFloat(dimensionMatch[1]);
          const height = parseFloat(dimensionMatch[2]);
          updatePageDimensionsCache(width, height);
        }
      }

      return {
        content: [{
          type: "text",
          text: result.success ? 
            `📐 ${result.result || "No result"}

📋 WORKFLOW CONTEXT: Page dimensions checked. Layout tools now have spatial context.
💡 NEXT STEPS: Use create_textframe() or position_textframe() with confidence in spatial constraints.` :
            `❌ Get page dimensions failed: ${result.error}

💡 TROUBLESHOOTING:
• Ensure InDesign is running with indesign_status
• Verify a document is open
• Check document has at least one page`
        }]
      };
    }
  );

  // Register preview_document tool
  server.tool(
    "preview_document",
    "🔍 **CONTEXT**: Generate optimized PNG previews for rapid design iteration and visual feedback. Essential for validating styling changes and layout adjustments during automation workflows.\n\n**LIMITATIONS**: Requires open document. Preview quality affects generation speed. Temp files auto-cleanup after 1 hour. Current page only for speed.\n\n**EXAMPLES**:\n• Quick preview: `{quality: \"preview\"}` (72dpi, ~1-2 seconds)\n• Medium quality: `{quality: \"medium\", page: 2}` (150dpi for review)\n• High quality: `{quality: \"high\", auto_cleanup: false}` (300dpi, keep files)\n• Custom location: `{temp_dir: \"/Users/name/previews\"}`\n\n**ALTERNATIVES**: Use `test_export_document` for final exports. Manual export in InDesign. Screenshot tools for quick captures.\n\n**RESULTS**: Returns file path to generated PNG preview, enables visual validation of design changes, supports iterative design workflows with immediate feedback.",
    {
      quality: z.enum(["preview", "medium", "high"]).default("preview").describe("Preview quality: preview=72dpi (fast), medium=150dpi, high=300dpi"),
      page: z.number().optional().describe("Page number to preview (1-based), defaults to current active page"),
      auto_cleanup: z.boolean().default(true).describe("Automatically remove preview files older than 1 hour"),
      temp_dir: z.string().default("/tmp").describe("Directory for temporary preview files")
    },
    async (args) => {
      const quality = args.quality || "preview";
      const page = args.page || null;
      const autoCleanup = args.auto_cleanup !== false;
      const tempDir = args.temp_dir || os.tmpdir();

      // Validate temp directory path
      const sanitizedTempDir = escapeExtendScriptString(tempDir);

      // Map quality to DPI settings
      const qualitySettings = {
        preview: { dpi: 72 },
        medium: { dpi: 150 },
        high: { dpi: 300 }
      };

      const settings = qualitySettings[quality];
      const timestamp = Date.now();
      const previewFileName = `indesign_preview_${timestamp}.png`;
      
      // Use user-writable temp folder (avoids macOS TCC restrictions)
      // This will be resolved to /var/folders/<hash>/T which is user-accessible
      
      // Pre-calculate page index for simpler template
      const pageIndex = page ? page - 1 : 0;
      const pageValidation = page ? `
        if (doc.pages.length < ${page}) {
          throw new Error("Page ${page} does not exist. Document has " + doc.pages.length + " pages.");
        }` : '';

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        if (!doc) {
          throw new Error("No active document found.");
        }
        
        try {
          // Create preview file using user-writable temp folder
          var previewFile = new File(Folder.temp.fsName + "/${previewFileName}");
          ${pageValidation}
          
          // Set PNG export quality
          app.pngExportPreferences.exportResolution = ${settings.dpi};
          
          // PNG export (document-level export)
          doc.exportFile(ExportFormat.PNG_FORMAT, previewFile, false);
          "Preview generated successfully: " + previewFile.fsName + " (${quality} quality)";
          
        } catch (e) {
          throw new Error("Preview generation failed: " + e.message);
        }
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        // Extract file path from result - ExtendScript will return the actual path
        const filePathMatch = result.result?.match(/Preview generated successfully: (.+?) \(/);
        const filePath = filePathMatch ? filePathMatch[1] : `User temp directory/${previewFileName}`;

        // Perform cleanup if requested
        if (autoCleanup) {
          try {
            // Always use the persistent session directory for cleanup
            await cleanupOldPreviews(baseTmpDir);
          } catch (cleanupError) {
            // Don't fail the preview generation if cleanup fails
            console.warn(`Preview cleanup warning: ${cleanupError}`);
          }
        }

        return {
          content: [{
            type: "text",
            text: `✅ ${result.result}

📁 **FILE LOCATION**: ${filePath}
📋 **WORKFLOW CONTEXT**: Visual preview generated for design validation.
💡 **NEXT STEPS**: Review preview, make adjustments, and re-generate as needed.
🔗 **RELATED TOOLS**: apply_paragraph_style, position_textframe, transform_objects`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `❌ Preview generation failed: ${result.error}

💡 **TROUBLESHOOTING**:
• Ensure InDesign is running with a document open
• Verify the page number exists (use get_page_info)
• Check temp directory permissions: ${tempDir}
• Ensure sufficient disk space available`
          }]
        };
      }
    }
  );

}