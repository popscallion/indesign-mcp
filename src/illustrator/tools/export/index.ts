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
  
  console.error("Registered Illustrator export tools");
}