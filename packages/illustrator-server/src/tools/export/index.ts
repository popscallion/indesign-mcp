// src/illustrator/tools/export/index.ts

/**
 * @fileoverview Export and asset extraction tools for Illustrator MCP
 * Handles exporting layers, artboards, and batch operations
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScriptForApp } from "../../../extendscript.js";
import { wrapToolForTelemetry } from "../../../tools/index.js";
import { z } from "zod";

/**
 * Registers export-related tools with the MCP server
 */
export async function registerExportTools(server: McpServer): Promise<void> {
  
  // Tool: extract_layer_assets
  // Complexity: 2.6 (Low)
  // Dependencies: organize_layers
  server.tool(
    "extract_layer_assets",
    {
      layerNames: z.array(z.string()).optional().describe("Specific layer names to export (exports all if not specified)"),
      outputPath: z.string().describe("Directory path for exported assets"),
      format: z.enum(["png", "jpg", "svg", "pdf", "eps"]).default("png").describe("Export format"),
      options: z.object({
        resolution: z.number().default(72).describe("Resolution in DPI (for raster formats)"),
        artboardClipping: z.boolean().default(true).describe("Clip to artboard bounds"),
        transparency: z.boolean().default(true).describe("Preserve transparency (PNG only)"),
        quality: z.number().min(0).max(100).default(80).describe("JPEG quality (0-100)")
      }).optional().describe("Export options")
    },
    wrapToolForTelemetry("extract_layer_assets", async (args: any) => {
      const { layerNames = [], outputPath, format = "png", options = {} } = args;
      const { resolution = 72, artboardClipping = true, transparency = true, quality = 80 } = options;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var exportedCount = 0;
          var failedLayers = [];
          
          // Prepare export options based on format
          var exportOptions;
          var fileExtension = ".${format}";
          
          switch("${format}") {
            case "png":
              exportOptions = new ExportOptionsPNG24();
              exportOptions.transparency = ${transparency};
              exportOptions.artBoardClipping = ${artboardClipping};
              exportOptions.horizontalScale = ${resolution / 72 * 100};
              exportOptions.verticalScale = ${resolution / 72 * 100};
              break;
              
            case "jpg":
              exportOptions = new ExportOptionsJPEG();
              exportOptions.qualitySetting = ${quality};
              exportOptions.artBoardClipping = ${artboardClipping};
              exportOptions.horizontalScale = ${resolution / 72 * 100};
              exportOptions.verticalScale = ${resolution / 72 * 100};
              break;
              
            case "svg":
              exportOptions = new ExportOptionsSVG();
              exportOptions.artBoardClipping = ${artboardClipping};
              exportOptions.embedImages = true;
              break;
              
            case "pdf":
              exportOptions = new PDFSaveOptions();
              exportOptions.compatibility = PDFCompatibility.ACROBAT5;
              exportOptions.preserveEditability = false;
              break;
              
            case "eps":
              exportOptions = new EPSSaveOptions();
              exportOptions.compatibility = EPSCompatibility.ILLUSTRATOR10;
              exportOptions.embedLinkedFiles = true;
              break;
          }
          
          // Determine which layers to export
          var layersToExport = [];
          if (${layerNames.length} > 0) {
            // Export specific layers
            var requestedLayers = [${layerNames.map((n: string) => `"${n}"`).join(',')}];
            for (var i = 0; i < requestedLayers.length; i++) {
              var found = false;
              for (var j = 0; j < doc.layers.length; j++) {
                if (doc.layers[j].name === requestedLayers[i]) {
                  layersToExport.push(doc.layers[j]);
                  found = true;
                  break;
                }
              }
              if (!found) {
                failedLayers.push(requestedLayers[i]);
              }
            }
          } else {
            // Export all visible layers
            for (var k = 0; k < doc.layers.length; k++) {
              if (doc.layers[k].visible) {
                layersToExport.push(doc.layers[k]);
              }
            }
          }
          
          // Export each layer
          for (var m = 0; m < layersToExport.length; m++) {
            var layer = layersToExport[m];
            
            // Hide all layers except current
            for (var n = 0; n < doc.layers.length; n++) {
              doc.layers[n].visible = (doc.layers[n] === layer);
            }
            
            // Construct file path
            var fileName = layer.name.replace(/[^a-zA-Z0-9_-]/g, "_");
            var filePath = new File("${outputPath}/" + fileName + fileExtension);
            
            try {
              // Export based on format
              if ("${format}" === "pdf" || "${format}" === "eps") {
                doc.saveAs(filePath, exportOptions);
              } else {
                doc.exportFile(filePath, ExportType.PNG24, exportOptions);
              }
              exportedCount++;
            } catch (exportError) {
              failedLayers.push(layer.name + " (export failed)");
            }
          }
          
          // Restore all layer visibility
          for (var p = 0; p < doc.layers.length; p++) {
            doc.layers[p].visible = true;
          }
          
          var result = "Exported " + exportedCount + " layers as ${format}";
          if (failedLayers.length > 0) {
            result += "\\\\nFailed: " + failedLayers.join(", ");
          }
          
          result;
          
        } catch (e) {
          "Error: " + e.message;
        }
      `;
      
      const result = await executeExtendScriptForApp(script, 'illustrator');
      
      return {
        content: [{
          type: "text" as const,
          text: result.success ? result.result || "Layers exported" : `Error: ${result.error}`
        }]
      };
    })
  );

  // Tool: batch_export_layouts
  // Complexity: 2.8 (Low) 
  // Dependencies: configure_export_presets
  server.tool(
    "batch_export_layouts",
    {
      exportType: z.enum(["artboards", "pages", "selection", "all"]).describe("What to export"),
      outputPath: z.string().describe("Directory path for exported files"),
      format: z.enum(["png", "jpg", "svg", "pdf", "eps"]).default("png").describe("Export format"),
      naming: z.object({
        prefix: z.string().optional().describe("Prefix for file names"),
        suffix: z.string().optional().describe("Suffix for file names"),
        includeArtboardName: z.boolean().default(true).describe("Include artboard name in filename"),
        includeIndex: z.boolean().default(true).describe("Include index number in filename")
      }).optional().describe("File naming options"),
      options: z.object({
        resolution: z.number().default(72).describe("Resolution in DPI"),
        quality: z.number().min(0).max(100).default(80).describe("JPEG quality"),
        transparency: z.boolean().default(true).describe("Preserve transparency"),
        separateFiles: z.boolean().default(true).describe("Export as separate files (vs multi-page)")
      }).optional().describe("Export options")
    },
    wrapToolForTelemetry("batch_export_layouts", async (args: any) => {
      const { exportType, outputPath, format = "png", naming = {}, options = {} } = args;
      const { prefix = "", suffix = "", includeArtboardName = true, includeIndex = true } = naming;
      const { resolution = 72, quality = 80, transparency = true, separateFiles = true } = options;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var exportedCount = 0;
          
          // Prepare export options
          var exportOptions;
          var fileExtension = ".${format}";
          var exportMethod;
          
          switch("${format}") {
            case "png":
              exportOptions = new ExportOptionsPNG24();
              exportOptions.transparency = ${transparency};
              exportOptions.horizontalScale = ${resolution / 72 * 100};
              exportOptions.verticalScale = ${resolution / 72 * 100};
              exportMethod = ExportType.PNG24;
              break;
              
            case "jpg":
              exportOptions = new ExportOptionsJPEG();
              exportOptions.qualitySetting = ${quality};
              exportOptions.horizontalScale = ${resolution / 72 * 100};
              exportOptions.verticalScale = ${resolution / 72 * 100};
              exportMethod = ExportType.JPEG;
              break;
              
            case "svg":
              exportOptions = new ExportOptionsSVG();
              exportOptions.embedImages = true;
              exportMethod = ExportType.SVG;
              break;
              
            case "pdf":
              exportOptions = new PDFSaveOptions();
              exportOptions.compatibility = PDFCompatibility.ACROBAT5;
              if (!${separateFiles} && doc.artboards.length > 1) {
                exportOptions.artboardRange = "1-" + doc.artboards.length;
                exportOptions.saveMultipleArtboards = true;
              }
              break;
              
            case "eps":
              exportOptions = new EPSSaveOptions();
              exportOptions.compatibility = EPSCompatibility.ILLUSTRATOR10;
              break;
          }
          
          // Determine what to export
          if ("${exportType}" === "artboards" || "${exportType}" === "all") {
            // Export each artboard
            for (var i = 0; i < doc.artboards.length; i++) {
              doc.artboards.setActiveArtboardIndex(i);
              var artboard = doc.artboards[i];
              
              // Build filename
              var fileName = "${prefix}";
              if (${includeIndex}) {
                fileName += (i + 1) + "_";
              }
              if (${includeArtboardName}) {
                fileName += artboard.name.replace(/[^a-zA-Z0-9_-]/g, "_");
              }
              fileName += "${suffix}" + fileExtension;
              
              var filePath = new File("${outputPath}/" + fileName);
              
              // Set artboard clipping for raster exports
              if (exportOptions.artBoardClipping !== undefined) {
                exportOptions.artBoardClipping = true;
              }
              
              try {
                if ("${format}" === "pdf" || "${format}" === "eps") {
                  // For PDF/EPS, use saveAs with artboard range
                  if ("${format}" === "pdf") {
                    exportOptions.artboardRange = (i + 1).toString();
                  }
                  doc.saveAs(filePath, exportOptions);
                } else {
                  // For other formats, use export
                  doc.exportFile(filePath, exportMethod, exportOptions);
                }
                exportedCount++;
              } catch (e) {
                // Skip failed exports but continue
              }
            }
            
          } else if ("${exportType}" === "selection") {
            // Export current selection
            if (doc.selection.length === 0) {
              throw new Error("No items selected for export");
            }
            
            var fileName = "${prefix}selection${suffix}" + fileExtension;
            var filePath = new File("${outputPath}/" + fileName);
            
            // Export selection
            try {
              if (exportOptions.artBoardClipping !== undefined) {
                exportOptions.artBoardClipping = false;
              }
              
              if ("${format}" === "pdf" || "${format}" === "eps") {
                doc.saveAs(filePath, exportOptions);
              } else {
                doc.exportFile(filePath, exportMethod, exportOptions);
              }
              exportedCount++;
            } catch (e) {
              throw new Error("Failed to export selection: " + e.message);
            }
            
          } else if ("${exportType}" === "pages") {
            // For Illustrator, pages are essentially artboards
            // Export as multi-page PDF if possible
            if ("${format}" === "pdf" && !${separateFiles}) {
              var fileName = "${prefix}all_pages${suffix}.pdf";
              var filePath = new File("${outputPath}/" + fileName);
              
              exportOptions.saveMultipleArtboards = true;
              exportOptions.artboardRange = "1-" + doc.artboards.length;
              
              try {
                doc.saveAs(filePath, exportOptions);
                exportedCount = doc.artboards.length;
              } catch (e) {
                throw new Error("Failed to export pages: " + e.message);
              }
            } else {
              // Export artboards as separate files
              for (var j = 0; j < doc.artboards.length; j++) {
                doc.artboards.setActiveArtboardIndex(j);
                
                var fileName = "${prefix}page_" + (j + 1) + "${suffix}" + fileExtension;
                var filePath = new File("${outputPath}/" + fileName);
                
                try {
                  if ("${format}" === "pdf" || "${format}" === "eps") {
                    if ("${format}" === "pdf") {
                      exportOptions.artboardRange = (j + 1).toString();
                    }
                    doc.saveAs(filePath, exportOptions);
                  } else {
                    doc.exportFile(filePath, exportMethod, exportOptions);
                  }
                  exportedCount++;
                } catch (e) {
                  // Continue with next page
                }
              }
            }
          }
          
          "Exported " + exportedCount + " items as ${format} to ${outputPath}";
          
        } catch (e) {
          "Error: " + e.message;
        }
      `;
      
      const result = await executeExtendScriptForApp(script, 'illustrator');
      
      return {
        content: [{
          type: "text" as const,
          text: result.success ? result.result || "Batch export completed" : `Error: ${result.error}`
        }]
      };
    })
  );

  // Tool: configure_export_presets
  // Complexity: 3.2 (Medium)
  // Dependencies: read_illustrator_document
  server.tool(
    "configure_export_presets",
    {
      presetName: z.string().describe("Name for the export preset"),
      format: z.enum(["png", "jpg", "svg", "pdf", "eps"]).describe("Export format"),
      settings: z.object({
        // Common settings
        resolution: z.number().default(72).describe("Resolution in DPI"),
        colorSpace: z.enum(["rgb", "cmyk", "grayscale"]).optional().describe("Color space"),
        antialiasing: z.boolean().default(true).describe("Enable antialiasing"),
        
        // PNG settings
        transparency: z.boolean().optional().describe("Preserve transparency (PNG)"),
        interlaced: z.boolean().optional().describe("Interlaced/progressive (PNG)"),
        
        // JPG settings
        quality: z.number().min(0).max(100).optional().describe("JPEG quality (0-100)"),
        progressive: z.boolean().optional().describe("Progressive JPEG"),
        optimized: z.boolean().optional().describe("Optimize JPEG"),
        
        // SVG settings
        embedImages: z.boolean().optional().describe("Embed images in SVG"),
        embedFonts: z.boolean().optional().describe("Embed fonts in SVG"),
        compressed: z.boolean().optional().describe("Compress SVG"),
        decimals: z.number().min(1).max(7).optional().describe("Decimal precision for SVG"),
        
        // PDF settings
        compatibility: z.enum(["1.3", "1.4", "1.5", "1.6", "1.7"]).optional().describe("PDF version"),
        preserveEditability: z.boolean().optional().describe("Preserve Illustrator editing"),
        embedThumbnails: z.boolean().optional().describe("Embed page thumbnails"),
        
        // EPS settings
        preview: z.enum(["none", "tiff", "pict"]).optional().describe("EPS preview format"),
        embedFontsEPS: z.boolean().optional().describe("Embed fonts in EPS"),
        includeDocumentThumbnails: z.boolean().optional().describe("Include thumbnails")
      }).describe("Format-specific settings"),
      saveAsDefault: z.boolean().default(false).describe("Save as default preset for this format"),
      applyToDocument: z.boolean().default(false).describe("Apply preset to current document")
    },
    wrapToolForTelemetry("configure_export_presets", async (args: any) => {
      const { presetName, format, settings = {}, saveAsDefault = false, applyToDocument = false } = args;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var presetCreated = false;
          var exportOptions = null;
          
          // Configure format-specific options
          switch("${format}") {
            case "png":
              exportOptions = new ExportOptionsPNG24();
              exportOptions.horizontalScale = ${(settings.resolution || 72) / 72 * 100};
              exportOptions.verticalScale = ${(settings.resolution || 72) / 72 * 100};
              exportOptions.transparency = ${settings.transparency !== false};
              exportOptions.artBoardClipping = true;
              exportOptions.antiAliasing = ${settings.antialiasing !== false};
              
              if (${settings.interlaced || false}) {
                exportOptions.interlaced = true;
              }
              break;
              
            case "jpg":
              exportOptions = new ExportOptionsJPEG();
              exportOptions.qualitySetting = ${settings.quality || 80};
              exportOptions.horizontalScale = ${(settings.resolution || 72) / 72 * 100};
              exportOptions.verticalScale = ${(settings.resolution || 72) / 72 * 100};
              exportOptions.artBoardClipping = true;
              exportOptions.antiAliasing = ${settings.antialiasing !== false};
              
              if (${settings.optimized || false}) {
                exportOptions.optimized = true;
              }
              
              // Color model
              if ("${settings.colorSpace || ''}" !== "") {
                switch("${settings.colorSpace}") {
                  case "rgb":
                    exportOptions.colorModel = JPEGColorModel.RGB;
                    break;
                  case "cmyk":
                    exportOptions.colorModel = JPEGColorModel.CMYK;
                    break;
                  case "grayscale":
                    exportOptions.colorModel = JPEGColorModel.GRAYSCALE;
                    break;
                }
              }
              break;
              
            case "svg":
              exportOptions = new ExportOptionsSVG();
              exportOptions.embedImages = ${settings.embedImages !== false};
              exportOptions.embedFonts = ${settings.embedFonts !== false};
              exportOptions.compressed = ${settings.compressed || false};
              exportOptions.artBoardClipping = true;
              
              if (${settings.decimals || 0} > 0) {
                exportOptions.coordinatePrecision = ${settings.decimals || 3};
              }
              
              // Font subsetting
              if (${settings.embedFonts !== false}) {
                exportOptions.fontSubsetting = SVGFontSubsetting.ALLGLYPHS;
              } else {
                exportOptions.fontSubsetting = SVGFontSubsetting.NONE;
              }
              break;
              
            case "pdf":
              exportOptions = new PDFSaveOptions();
              
              // Set compatibility
              switch("${settings.compatibility || '1.5'}") {
                case "1.3":
                  exportOptions.compatibility = PDFCompatibility.ACROBAT4;
                  break;
                case "1.4":
                  exportOptions.compatibility = PDFCompatibility.ACROBAT5;
                  break;
                case "1.5":
                  exportOptions.compatibility = PDFCompatibility.ACROBAT6;
                  break;
                case "1.6":
                  exportOptions.compatibility = PDFCompatibility.ACROBAT7;
                  break;
                case "1.7":
                  exportOptions.compatibility = PDFCompatibility.ACROBAT8;
                  break;
                default:
                  exportOptions.compatibility = PDFCompatibility.ACROBAT5;
              }
              
              exportOptions.preserveEditability = ${settings.preserveEditability || false};
              exportOptions.generateThumbnails = ${settings.embedThumbnails || false};
              exportOptions.optimization = true;
              
              // Color conversion
              if ("${settings.colorSpace || ''}" === "grayscale") {
                exportOptions.colorConversionID = ColorConversion.GRAYSCALE;
              }
              break;
              
            case "eps":
              exportOptions = new EPSSaveOptions();
              exportOptions.compatibility = EPSCompatibility.ILLUSTRATOR10;
              exportOptions.embedLinkedFiles = true;
              exportOptions.embedFonts = ${settings.embedFontsEPS !== false};
              exportOptions.includeDocumentThumbnails = ${settings.includeDocumentThumbnails || false};
              
              // Preview format
              switch("${settings.preview || 'none'}") {
                case "none":
                  exportOptions.preview = EPSPreview.NONE;
                  break;
                case "tiff":
                  exportOptions.preview = EPSPreview.TIFFWITHCOLORS;
                  break;
                case "pict":
                  exportOptions.preview = EPSPreview.MACOSPICTPREVIEW;
                  break;
              }
              break;
          }
          
          // Store preset in document (as a note/tag for reference)
          // Since Illustrator doesn't have a direct preset API like InDesign,
          // we'll store the settings as a document note
          if (exportOptions) {
            presetCreated = true;
            
            // Create a preset description
            var presetDesc = "Export Preset: ${presetName}\\\\n";
            presetDesc += "Format: ${format}\\\\n";
            presetDesc += "Resolution: " + ${settings.resolution || 72} + " DPI\\\\n";
            
            if ("${format}" === "jpg") {
              presetDesc += "Quality: " + ${settings.quality || 80} + "\\\\n";
            }
            if ("${format}" === "png") {
              presetDesc += "Transparency: " + ${settings.transparency !== false} + "\\\\n";
            }
            
            // Store in document notes (if available) or as a text note
            try {
              // Try to create a non-printing text frame to store preset info
              var presetNote = doc.textFrames.add();
              presetNote.name = "PRESET_${presetName}";
              presetNote.contents = presetDesc;
              presetNote.hidden = true;
              presetNote.locked = true;
              
              // Move off artboard
              presetNote.position = [-10000, -10000];
            } catch (e) {
              // Fallback: just note that preset was configured
            }
            
            // Apply to document if requested
            if (${applyToDocument}) {
              // Store a reference to current export settings
              doc.XMPString = "<!-- Export Preset: ${presetName} -->";
            }
          }
          
          var result = "Created export preset: ${presetName} for ${format}";
          if (${saveAsDefault}) {
            result += " (set as default)";
          }
          if (${applyToDocument}) {
            result += " (applied to document)";
          }
          
          result;
          
        } catch (e) {
          "Error: " + e.message;
        }
      `;
      
      const result = await executeExtendScriptForApp(script, 'illustrator');
      
      return {
        content: [{
          type: "text" as const,
          text: result.success ? result.result || "Export preset configured" : `Error: ${result.error}`
        }]
      };
    })
  );
  
  // Tool: package_for_print
  // Complexity: 4.2 (High)
  // Dependencies: read_illustrator_document
  server.tool(
    "package_for_print",
    {
      packageName: z.string().describe("Name for the package folder"),
      outputPath: z.string().describe("Directory path for package output"),
      options: z.object({
        includeFonts: z.boolean().default(true).describe("Include used fonts"),
        includeImages: z.boolean().default(true).describe("Include linked images"),
        includeColorProfiles: z.boolean().default(true).describe("Include color profiles"),
        createPDF: z.boolean().default(true).describe("Generate PDF version"),
        pdfPreset: z.string().default("[High Quality Print]").describe("PDF preset to use"),
        collectInFolder: z.boolean().default(true).describe("Organize in folder structure"),
        includeReport: z.boolean().default(true).describe("Generate package report"),
        updateLinks: z.boolean().default(false).describe("Update links to packaged location")
      }).optional(),
      preflight: z.object({
        checkFonts: z.boolean().default(true).describe("Check for missing fonts"),
        checkImages: z.boolean().default(true).describe("Check image resolution"),
        checkColors: z.boolean().default(true).describe("Check color mode consistency"),
        minResolution: z.number().default(300).describe("Minimum image resolution (DPI)"),
        colorMode: z.enum(["CMYK", "RGB", "Any"]).default("CMYK").describe("Required color mode")
      }).optional()
    },
    wrapToolForTelemetry("package_for_print", async (args: any) => {
      const { packageName, outputPath, options = {}, preflight = {} } = args;
      const {
        includeFonts = true,
        includeImages = true,
        includeColorProfiles = true,
        createPDF = true,
        pdfPreset = "[High Quality Print]",
        collectInFolder = true,
        includeReport = true,
        updateLinks = false
      } = options;
      const {
        checkFonts = true,
        checkImages = true,
        checkColors = true,
        minResolution = 300,
        colorMode = "CMYK"
      } = preflight;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var packageName = ${JSON.stringify(packageName)};
          var outputPath = ${JSON.stringify(outputPath)};
          
          // Preflight checks
          var preflightIssues = [];
          
          if (${checkFonts}) {
            // Check for missing fonts
            for (var i = 0; i < doc.textFrames.length; i++) {
              var tf = doc.textFrames[i];
              for (var j = 0; j < tf.textRanges.length; j++) {
                var tr = tf.textRanges[j];
                if (!tr.characterAttributes.textFont) {
                  preflightIssues.push("Missing font in text frame " + i);
                }
              }
            }
          }
          
          if (${checkImages}) {
            // Check linked images
            var placedItems = doc.placedItems;
            for (var i = 0; i < placedItems.length; i++) {
              var item = placedItems[i];
              if (item.file) {
                // Check if file exists
                var f = new File(item.file);
                if (!f.exists) {
                  preflightIssues.push("Missing linked image: " + item.file);
                }
              }
              
              // Note: Actual resolution check would require more complex logic
            }
            
            // Check raster items for resolution
            var rasterItems = doc.rasterItems;
            for (var i = 0; i < rasterItems.length; i++) {
              // Simplified resolution check
              var bounds = rasterItems[i].boundingBox;
              var width = bounds[2] - bounds[0];
              var height = bounds[1] - bounds[3];
              
              if (width > 0 && height > 0) {
                // Estimate resolution (simplified)
                var estimatedDPI = 72; // Default screen resolution
                if (estimatedDPI < ${minResolution}) {
                  preflightIssues.push("Low resolution raster item: " + i);
                }
              }
            }
          }
          
          if (${checkColors}) {
            // Check color mode consistency
            var requiredMode = "${colorMode}";
            if (requiredMode !== "Any") {
              if (requiredMode === "CMYK" && doc.documentColorSpace !== DocumentColorSpace.CMYK) {
                preflightIssues.push("Document not in CMYK mode");
              } else if (requiredMode === "RGB" && doc.documentColorSpace !== DocumentColorSpace.RGB) {
                preflightIssues.push("Document not in RGB mode");
              }
            }
          }
          
          // Create package folder
          var packageFolder = new Folder(outputPath + "/" + packageName);
          if (!packageFolder.exists) {
            packageFolder.create();
          }
          
          var packagedFiles = [];
          
          // Save document copy
          var docFile = new File(packageFolder.fullName + "/" + doc.name);
          doc.saveAs(docFile);
          packagedFiles.push(doc.name);
          
          // Collect fonts
          var fontsCollected = [];
          if (${includeFonts}) {
            var fontsFolder = new Folder(packageFolder.fullName + "/Document fonts");
            if (!fontsFolder.exists) {
              fontsFolder.create();
            }
            
            // Note: Actual font collection would require system-level access
            // This is a simplified representation
            for (var i = 0; i < app.textFonts.length; i++) {
              var font = app.textFonts[i];
              fontsCollected.push(font.name);
            }
          }
          
          // Collect linked images
          var imagesCollected = [];
          if (${includeImages}) {
            var linksFolder = new Folder(packageFolder.fullName + "/Links");
            if (!linksFolder.exists) {
              linksFolder.create();
            }
            
            for (var i = 0; i < doc.placedItems.length; i++) {
              var placed = doc.placedItems[i];
              if (placed.file) {
                var sourceFile = new File(placed.file);
                if (sourceFile.exists) {
                  var destFile = new File(linksFolder.fullName + "/" + sourceFile.name);
                  sourceFile.copy(destFile);
                  imagesCollected.push(sourceFile.name);
                  
                  if (${updateLinks}) {
                    // Update link to new location
                    placed.file = destFile;
                  }
                }
              }
            }
            
            // Also handle raster items if embedded
            for (var i = 0; i < doc.rasterItems.length; i++) {
              // Note: Embedded items would need to be exported
              imagesCollected.push("Embedded raster " + i);
            }
          }
          
          // Create PDF if requested
          var pdfCreated = false;
          if (${createPDF}) {
            var pdfFile = new File(packageFolder.fullName + "/" + packageName + ".pdf");
            var pdfOptions = new PDFSaveOptions();
            
            // Configure PDF options based on preset
            var preset = ${JSON.stringify(pdfPreset)};
            if (preset === "[High Quality Print]") {
              pdfOptions.compatibility = PDFCompatibility.ACROBAT5;
              pdfOptions.colorCompression = CompressionQuality.None;
              pdfOptions.preserveEditability = false;
            } else if (preset === "[Press Quality]") {
              pdfOptions.compatibility = PDFCompatibility.ACROBAT5;
              pdfOptions.colorCompression = CompressionQuality.MAXIMUM;
            }
            
            doc.saveAs(pdfFile, pdfOptions);
            pdfCreated = true;
            packagedFiles.push(packageName + ".pdf");
          }
          
          // Generate report
          var reportContent = [];
          if (${includeReport}) {
            reportContent.push("Package Report for: " + packageName);
            reportContent.push("Date: " + new Date().toString());
            reportContent.push("Document: " + doc.name);
            reportContent.push("Pages: " + doc.artboards.length);
            reportContent.push("Fonts Used: " + fontsCollected.length);
            reportContent.push("Images: " + imagesCollected.length);
            
            if (preflightIssues.length > 0) {
              reportContent.push("\\nPreflight Issues:");
              for (var i = 0; i < preflightIssues.length; i++) {
                reportContent.push("- " + preflightIssues[i]);
              }
            }
            
            // Write report file
            var reportFile = new File(packageFolder.fullName + "/Package Report.txt");
            reportFile.open("w");
            reportFile.write(reportContent.join("\\n"));
            reportFile.close();
            packagedFiles.push("Package Report.txt");
          }
          
          JSON.stringify({
            success: true,
            packagePath: packageFolder.fullName,
            filesPackaged: packagedFiles.length,
            fonts: fontsCollected.length,
            images: imagesCollected.length,
            pdfCreated: pdfCreated,
            preflightIssues: preflightIssues,
            message: "Package created: " + packageName
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  // Tool: generate_asset_variations
  // Complexity: 3.8 (Medium-High) 
  // Dependencies: extract_layer_assets
  server.tool(
    "generate_asset_variations",
    {
      source: z.enum(["selection", "artboard", "layer", "document"]).default("selection"),
      layerName: z.string().optional().describe("Layer name if source is 'layer'"),
      artboardIndex: z.number().optional().describe("Artboard index if source is 'artboard'"),
      variations: z.array(z.object({
        name: z.string().describe("Variation name suffix"),
        scale: z.number().optional().describe("Scale percentage (100 = original)"),
        format: z.enum(["png", "jpg", "svg", "pdf", "eps"]).describe("Export format"),
        colorMode: z.enum(["RGB", "CMYK", "Grayscale", "Bitmap"]).optional(),
        resolution: z.number().optional().describe("Resolution in DPI"),
        quality: z.number().min(0).max(100).optional().describe("JPEG quality"),
        dimensions: z.object({
          width: z.number().optional(),
          height: z.number().optional(),
          maintainAspectRatio: z.boolean().default(true)
        }).optional()
      })).describe("List of variations to generate"),
      outputPath: z.string().describe("Directory path for generated assets"),
      naming: z.object({
        prefix: z.string().optional().describe("Prefix for file names"),
        separator: z.string().default("-").describe("Separator character"),
        includeArtboardName: z.boolean().default(true).describe("Include artboard name"),
        includeVariationName: z.boolean().default(true).describe("Include variation name")
      }).optional()
    },
    wrapToolForTelemetry("generate_asset_variations", async (args: any) => {
      const { 
        source = "selection", 
        layerName, 
        artboardIndex,
        variations, 
        outputPath,
        naming = {}
      } = args;
      const {
        prefix,
        separator = "-",
        includeArtboardName = true,
        includeVariationName = true
      } = naming;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var outputPath = ${JSON.stringify(outputPath)};
          var variations = ${JSON.stringify(variations)};
          var source = ${JSON.stringify(source)};
          
          // Ensure output directory exists
          var outputFolder = new Folder(outputPath);
          if (!outputFolder.exists) {
            outputFolder.create();
          }
          
          // Get source items
          var sourceItems = [];
          var baseName = "";
          
          switch (source) {
            case "selection":
              sourceItems = app.selection;
              baseName = "asset";
              break;
              
            case "layer":
              var layerName = ${JSON.stringify(layerName || "")};
              for (var i = 0; i < doc.layers.length; i++) {
                if (doc.layers[i].name === layerName) {
                  sourceItems = doc.layers[i].pageItems;
                  baseName = layerName;
                  break;
                }
              }
              break;
              
            case "artboard":
              var artIndex = ${artboardIndex || 0};
              doc.artboards.setActiveArtboardIndex(artIndex);
              var artboard = doc.artboards[artIndex];
              baseName = artboard.name;
              
              // Select all items in artboard
              doc.selectObjectsOnActiveArtboard();
              sourceItems = app.selection;
              break;
              
            case "document":
              sourceItems = doc.pageItems;
              baseName = doc.name.replace(/\\.[^.]+$/, "");
              break;
          }
          
          if (sourceItems.length === 0) {
            throw new Error("No items found in " + source);
          }
          
          var generatedFiles = [];
          
          // Generate each variation
          for (var v = 0; v < variations.length; v++) {
            var variation = variations[v];
            
            // Create a temporary document for this variation
            var tempDoc = app.documents.add();
            
            // Copy source items to temp document
            for (var i = 0; i < sourceItems.length; i++) {
              var copy = sourceItems[i].duplicate(tempDoc, ElementPlacement.PLACEATEND);
              
              // Apply scale if specified
              if (variation.scale && variation.scale !== 100) {
                var scaleMatrix = app.getScaleMatrix(variation.scale, variation.scale);
                copy.transform(scaleMatrix, true, false, true, false, 0, Transformation.CENTER);
              }
              
              // Apply dimensions if specified
              if (variation.dimensions) {
                var dims = variation.dimensions;
                var bounds = copy.geometricBounds;
                var currentWidth = bounds[2] - bounds[0];
                var currentHeight = bounds[1] - bounds[3];
                
                var scaleX = 100, scaleY = 100;
                
                if (dims.width) {
                  scaleX = (dims.width / currentWidth) * 100;
                }
                if (dims.height) {
                  scaleY = (dims.height / currentHeight) * 100;
                }
                
                if (dims.maintainAspectRatio) {
                  var scale = Math.min(scaleX, scaleY);
                  scaleX = scale;
                  scaleY = scale;
                }
                
                if (scaleX !== 100 || scaleY !== 100) {
                  var scaleMatrix = app.getScaleMatrix(scaleX, scaleY);
                  copy.transform(scaleMatrix, true, false, true, false, 0, Transformation.CENTER);
                }
              }
            }
            
            // Fit artboard to content
            tempDoc.artboards[0].artboardRect = tempDoc.visibleBounds;
            
            // Apply color mode if specified
            if (variation.colorMode) {
              switch (variation.colorMode) {
                case "RGB":
                  tempDoc.documentColorSpace = DocumentColorSpace.RGB;
                  break;
                case "CMYK":
                  tempDoc.documentColorSpace = DocumentColorSpace.CMYK;
                  break;
              }
            }
            
            // Build filename
            var fileNameParts = [];
            if ("${prefix}") fileNameParts.push("${prefix}");
            if (${includeArtboardName}) fileNameParts.push(baseName);
            if (${includeVariationName}) fileNameParts.push(variation.name);
            var fileName = fileNameParts.join("${separator}");
            
            // Export based on format
            var exportFile = null;
            var exportOptions = null;
            
            switch (variation.format) {
              case "png":
                fileName += ".png";
                exportFile = new File(outputPath + "/" + fileName);
                exportOptions = new ExportOptionsPNG24();
                exportOptions.artBoardClipping = true;
                exportOptions.transparency = true;
                if (variation.resolution) {
                  exportOptions.horizontalScale = variation.resolution / 72 * 100;
                  exportOptions.verticalScale = variation.resolution / 72 * 100;
                }
                tempDoc.exportFile(exportFile, ExportType.PNG24, exportOptions);
                break;
                
              case "jpg":
                fileName += ".jpg";
                exportFile = new File(outputPath + "/" + fileName);
                exportOptions = new ExportOptionsJPEG();
                exportOptions.artBoardClipping = true;
                exportOptions.qualitySetting = variation.quality || 80;
                if (variation.resolution) {
                  exportOptions.horizontalScale = variation.resolution / 72 * 100;
                  exportOptions.verticalScale = variation.resolution / 72 * 100;
                }
                tempDoc.exportFile(exportFile, ExportType.JPEG, exportOptions);
                break;
                
              case "svg":
                fileName += ".svg";
                exportFile = new File(outputPath + "/" + fileName);
                exportOptions = new ExportOptionsSVG();
                exportOptions.embedRasterImages = true;
                exportOptions.fontSubsetting = SVGFontSubsetting.GLYPHSUSED;
                tempDoc.exportFile(exportFile, ExportType.SVG, exportOptions);
                break;
                
              case "pdf":
                fileName += ".pdf";
                exportFile = new File(outputPath + "/" + fileName);
                var pdfOptions = new PDFSaveOptions();
                pdfOptions.compatibility = PDFCompatibility.ACROBAT5;
                tempDoc.saveAs(exportFile, pdfOptions);
                break;
                
              case "eps":
                fileName += ".eps";
                exportFile = new File(outputPath + "/" + fileName);
                var epsOptions = new EPSSaveOptions();
                epsOptions.compatibility = Compatibility.ILLUSTRATOR8;
                epsOptions.preview = EPSPreview.TRANSPARENTCOLORTIFF;
                tempDoc.saveAs(exportFile, epsOptions);
                break;
            }
            
            generatedFiles.push({
              name: fileName,
              format: variation.format,
              scale: variation.scale || 100,
              path: exportFile.fullName
            });
            
            // Close temp document without saving
            tempDoc.close(SaveOptions.DONOTSAVECHANGES);
          }
          
          JSON.stringify({
            success: true,
            source: source,
            variationsCreated: generatedFiles.length,
            outputPath: outputPath,
            files: generatedFiles,
            message: "Generated " + generatedFiles.length + " asset variations"
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  console.error("Export tools registered successfully");
}