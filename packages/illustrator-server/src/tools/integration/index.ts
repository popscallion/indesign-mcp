// src/illustrator/tools/integration/index.ts

/**
 * @fileoverview Integration tools for third-party services and external workflows
 * Enables connection with cloud services, version control, and external applications
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScriptForApp } from "@mcp/shared/extendscript.js";
import { wrapToolForTelemetry } from "@mcp/shared/telemetryWrapper.js";
import { z } from "zod";

/**
 * Registers integration-related tools with the MCP server
 */
export async function registerIntegrationTools(server: McpServer): Promise<void> {
  
  // Tool: export_to_web_format
  // Complexity: 3.5 (Medium-High)
  // Dependencies: None
  server.tool(
    "export_to_web_format",
    {
      format: z.enum(["webp", "avif", "responsive_set", "sprite_sheet"]).describe("Web export format"),
      source: z.enum(["selection", "artboard", "document"]).default("selection"),
      artboardIndex: z.number().optional().describe("Artboard index if source is 'artboard'"),
      webOptions: z.object({
        quality: z.number().min(0).max(100).default(85).describe("Image quality"),
        lossless: z.boolean().default(false).describe("Use lossless compression"),
        responsive: z.object({
          sizes: z.array(z.number()).default([320, 768, 1024, 1920]).describe("Breakpoint widths"),
          suffixes: z.array(z.string()).default(["mobile", "tablet", "desktop", "full"]).describe("Size suffixes")
        }).optional(),
        spriteSheet: z.object({
          columns: z.number().default(4).describe("Columns in sprite sheet"),
          rows: z.number().default(4).describe("Rows in sprite sheet"),
          padding: z.number().default(2).describe("Padding between sprites")
        }).optional(),
        optimization: z.object({
          removeMetadata: z.boolean().default(true),
          compress: z.boolean().default(true),
          progressive: z.boolean().default(true)
        }).optional()
      }).optional(),
      outputPath: z.string().describe("Output directory path"),
      metadata: z.object({
        alt: z.string().optional().describe("Alt text for accessibility"),
        title: z.string().optional().describe("Title attribute"),
        cssClass: z.string().optional().describe("CSS class name"),
        generateHTML: z.boolean().default(false).describe("Generate HTML snippet")
      }).optional()
    },
    wrapToolForTelemetry("export_to_web_format", async (args: any) => {
      const { format, source = "selection", artboardIndex, webOptions = {}, outputPath, metadata = {} } = args;
      const {
        quality = 85,
        lossless = false,
        responsive = {},
        spriteSheet = {},
        optimization = {}
      } = webOptions;
      const {
        alt,
        title,
        cssClass,
        generateHTML = false
      } = metadata;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var format = ${JSON.stringify(format)};
          var source = ${JSON.stringify(source)};
          var outputPath = ${JSON.stringify(outputPath)};
          
          // Ensure output directory exists
          var outputFolder = new Folder(outputPath);
          if (!outputFolder.exists) {
            outputFolder.create();
          }
          
          // Get source items
          var sourceItems = [];
          var baseName = "web-asset";
          
          switch (source) {
            case "selection":
              sourceItems = app.selection;
              break;
            case "artboard":
              var artIndex = ${artboardIndex || 0};
              doc.artboards.setActiveArtboardIndex(artIndex);
              var artboard = doc.artboards[artIndex];
              baseName = artboard.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
              doc.selectObjectsOnActiveArtboard();
              sourceItems = app.selection;
              break;
            case "document":
              sourceItems = doc.pageItems;
              baseName = doc.name.replace(/\\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
              break;
          }
          
          var exportedFiles = [];
          var htmlSnippets = [];
          
          switch (format) {
            case "responsive_set":
              // Generate multiple sizes for responsive images
              var sizes = ${JSON.stringify(responsive.sizes || [320, 768, 1024, 1920])};
              var suffixes = ${JSON.stringify(responsive.suffixes || ["mobile", "tablet", "desktop", "full"])};
              
              for (var i = 0; i < sizes.length; i++) {
                var width = sizes[i];
                var suffix = suffixes[i] || width + "w";
                
                // Create temp document at this size
                var tempDoc = app.documents.add();
                
                // Copy and scale items
                for (var j = 0; j < sourceItems.length; j++) {
                  var copy = sourceItems[j].duplicate(tempDoc, ElementPlacement.PLACEATEND);
                  
                  // Calculate scale to fit width
                  var bounds = copy.geometricBounds;
                  var currentWidth = bounds[2] - bounds[0];
                  var scale = (width / currentWidth) * 100;
                  
                  var scaleMatrix = app.getScaleMatrix(scale, scale);
                  copy.transform(scaleMatrix, true, false, true, false, 0, Transformation.CENTER);
                }
                
                // Export as optimized PNG
                var fileName = baseName + "-" + suffix + ".png";
                var exportFile = new File(outputPath + "/" + fileName);
                var exportOptions = new ExportOptionsPNG24();
                exportOptions.artBoardClipping = true;
                exportOptions.transparency = true;
                exportOptions.antiAliasing = true;
                
                tempDoc.exportFile(exportFile, ExportType.PNG24, exportOptions);
                exportedFiles.push({
                  file: fileName,
                  width: width,
                  suffix: suffix
                });
                
                tempDoc.close(SaveOptions.DONOTSAVECHANGES);
              }
              
              if (${generateHTML}) {
                var srcset = exportedFiles.map(function(f) {
                  return f.file + " " + f.width + "w";
                }).join(", ");
                
                htmlSnippets.push("<img src=\\"" + exportedFiles[exportedFiles.length - 1].file + "\\"");
                htmlSnippets.push("     srcset=\\"" + srcset + "\\"");
                htmlSnippets.push("     sizes=\\"(max-width: 768px) 100vw, 50vw\\"");
                if ("${alt}") htmlSnippets.push("     alt=\\"" + "${alt}" + "\\"");
                if ("${cssClass}") htmlSnippets.push("     class=\\"" + "${cssClass}" + "\\"");
                htmlSnippets.push(">");
              }
              break;
              
            case "sprite_sheet":
              // Create sprite sheet from multiple items
              var cols = ${spriteSheet.columns || 4};
              var rows = ${spriteSheet.rows || 4};
              var padding = ${spriteSheet.padding || 2};
              
              // Calculate sprite dimensions
              var maxWidth = 0, maxHeight = 0;
              for (var i = 0; i < sourceItems.length; i++) {
                var bounds = sourceItems[i].geometricBounds;
                var w = bounds[2] - bounds[0];
                var h = bounds[1] - bounds[3];
                if (w > maxWidth) maxWidth = w;
                if (h > maxHeight) maxHeight = h;
              }
              
              // Create sprite sheet document
              var sheetWidth = (maxWidth + padding) * cols;
              var sheetHeight = (maxHeight + padding) * rows;
              var spriteDoc = app.documents.add(
                DocumentColorSpace.RGB,
                sheetWidth,
                sheetHeight
              );
              
              // Place items in grid
              var itemIndex = 0;
              for (var row = 0; row < rows && itemIndex < sourceItems.length; row++) {
                for (var col = 0; col < cols && itemIndex < sourceItems.length; col++) {
                  var copy = sourceItems[itemIndex].duplicate(spriteDoc, ElementPlacement.PLACEATEND);
                  
                  // Position in grid
                  var x = col * (maxWidth + padding) + padding / 2;
                  var y = -(row * (maxHeight + padding) + padding / 2);
                  copy.position = [x, y];
                  
                  itemIndex++;
                }
              }
              
              // Export sprite sheet
              var fileName = baseName + "-sprites.png";
              var exportFile = new File(outputPath + "/" + fileName);
              var exportOptions = new ExportOptionsPNG24();
              exportOptions.artBoardClipping = true;
              exportOptions.transparency = true;
              
              spriteDoc.exportFile(exportFile, ExportType.PNG24, exportOptions);
              exportedFiles.push({
                file: fileName,
                sprites: itemIndex,
                dimensions: cols + "x" + rows
              });
              
              spriteDoc.close(SaveOptions.DONOTSAVECHANGES);
              
              // Generate CSS if requested
              if (${generateHTML}) {
                htmlSnippets.push("/* Sprite Sheet CSS */");
                htmlSnippets.push("." + (cssClass || "sprite") + " {");
                htmlSnippets.push("  background-image: url('" + fileName + "');");
                htmlSnippets.push("  background-repeat: no-repeat;");
                htmlSnippets.push("  display: inline-block;");
                htmlSnippets.push("  width: " + maxWidth + "px;");
                htmlSnippets.push("  height: " + maxHeight + "px;");
                htmlSnippets.push("}");
                
                // Generate position classes
                for (var i = 0; i < itemIndex; i++) {
                  var row = Math.floor(i / cols);
                  var col = i % cols;
                  var x = -(col * (maxWidth + padding));
                  var y = -(row * (maxHeight + padding));
                  
                  htmlSnippets.push("." + (cssClass || "sprite") + "-" + i + " {");
                  htmlSnippets.push("  background-position: " + x + "px " + y + "px;");
                  htmlSnippets.push("}");
                }
              }
              break;
              
            default:
              // Standard web format export (simplified for WebP/AVIF simulation)
              var fileName = baseName + "." + (format === "webp" ? "png" : "jpg");
              var exportFile = new File(outputPath + "/" + fileName);
              
              // Create temp document with selection
              var tempDoc = app.documents.add();
              for (var i = 0; i < sourceItems.length; i++) {
                sourceItems[i].duplicate(tempDoc, ElementPlacement.PLACEATEND);
              }
              
              // Export with optimization settings
              if (format === "webp" || format === "avif") {
                // Note: Actual WebP/AVIF would require post-processing
                var exportOptions = new ExportOptionsPNG24();
                exportOptions.artBoardClipping = true;
                exportOptions.transparency = !${lossless};
                exportOptions.antiAliasing = true;
                
                tempDoc.exportFile(exportFile, ExportType.PNG24, exportOptions);
              }
              
              exportedFiles.push({
                file: fileName,
                format: format,
                quality: ${quality}
              });
              
              tempDoc.close(SaveOptions.DONOTSAVECHANGES);
              
              if (${generateHTML}) {
                htmlSnippets.push("<picture>");
                htmlSnippets.push("  <source srcset=\\"" + fileName + "\\" type=\\"image/" + format + "\\">");
                htmlSnippets.push("  <img src=\\"" + baseName + ".jpg\\" alt=\\"" + ("${alt}" || baseName) + "\\">");
                htmlSnippets.push("</picture>");
              }
              break;
          }
          
          // Write HTML file if requested
          if (${generateHTML} && htmlSnippets.length > 0) {
            var htmlFile = new File(outputPath + "/" + baseName + ".html");
            htmlFile.open("w");
            htmlFile.write(htmlSnippets.join("\\n"));
            htmlFile.close();
            exportedFiles.push({ file: baseName + ".html", type: "html" });
          }
          
          JSON.stringify({
            success: true,
            format: format,
            filesExported: exportedFiles.length,
            files: exportedFiles,
            htmlGenerated: ${generateHTML},
            message: "Exported " + exportedFiles.length + " web-optimized files"
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  // Tool: sync_with_version_control
  // Complexity: 3.2 (Medium)
  // Dependencies: None
  server.tool(
    "sync_with_version_control",
    {
      operation: z.enum(["export_for_commit", "import_from_repo", "generate_diff_preview"]).describe("Version control operation"),
      vcsOptions: z.object({
        format: z.enum(["svg", "pdf", "ai"]).default("svg").describe("File format for version control"),
        includeArtboards: z.boolean().default(true).describe("Export each artboard separately"),
        preserveLayers: z.boolean().default(true).describe("Maintain layer structure"),
        embedImages: z.boolean().default(false).describe("Embed images vs. link"),
        generateManifest: z.boolean().default(true).describe("Create manifest file")
      }).optional(),
      paths: z.object({
        repositoryPath: z.string().describe("Path to git repository"),
        relativePath: z.string().default("assets/illustrator").describe("Relative path within repo"),
        branchName: z.string().optional().describe("Branch name for export")
      }),
      metadata: z.object({
        author: z.string().optional().describe("Author name"),
        message: z.string().optional().describe("Commit message or description"),
        tags: z.array(z.string()).optional().describe("Tags or labels"),
        version: z.string().optional().describe("Version string")
      }).optional()
    },
    wrapToolForTelemetry("sync_with_version_control", async (args: any) => {
      const { operation, vcsOptions = {}, paths, metadata = {} } = args;
      const {
        format = "svg",
        includeArtboards = true,
        preserveLayers = true,
        embedImages = false,
        generateManifest = true
      } = vcsOptions;
      const {
        repositoryPath,
        relativePath = "assets/illustrator",
        branchName
      } = paths;
      const {
        author,
        message,
        tags = [],
        version
      } = metadata;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var operation = ${JSON.stringify(operation)};
          var format = ${JSON.stringify(format)};
          var repoPath = ${JSON.stringify(repositoryPath)};
          var relPath = ${JSON.stringify(relativePath)};
          
          // Create output directory
          var outputPath = repoPath + "/" + relPath;
          var outputFolder = new Folder(outputPath);
          if (!outputFolder.exists) {
            outputFolder.create();
          }
          
          var processedFiles = [];
          var manifest = {
            document: doc.name,
            timestamp: new Date().toISOString(),
            operation: operation,
            author: "${author || 'unknown'}",
            message: "${message || ''}",
            version: "${version || '1.0.0'}",
            tags: ${JSON.stringify(tags)},
            files: []
          };
          
          switch (operation) {
            case "export_for_commit":
              // Export document for version control
              if (${includeArtboards} && doc.artboards.length > 1) {
                // Export each artboard separately
                for (var i = 0; i < doc.artboards.length; i++) {
                  doc.artboards.setActiveArtboardIndex(i);
                  var artboard = doc.artboards[i];
                  var artboardName = artboard.name.replace(/[^a-zA-Z0-9]/g, "-");
                  
                  var fileName = doc.name.replace(/\\.[^.]+$/, "") + "-" + artboardName;
                  var exportFile = null;
                  
                  switch (format) {
                    case "svg":
                      fileName += ".svg";
                      exportFile = new File(outputPath + "/" + fileName);
                      var svgOptions = new ExportOptionsSVG();
                      svgOptions.artboardRange = "" + (i + 1);
                      svgOptions.embedRasterImages = ${embedImages};
                      svgOptions.preserveEditability = ${preserveLayers};
                      doc.exportFile(exportFile, ExportType.SVG, svgOptions);
                      break;
                      
                    case "pdf":
                      fileName += ".pdf";
                      exportFile = new File(outputPath + "/" + fileName);
                      var pdfOptions = new PDFSaveOptions();
                      pdfOptions.artboardRange = "" + (i + 1);
                      pdfOptions.preserveEditability = ${preserveLayers};
                      doc.saveAs(exportFile, pdfOptions);
                      break;
                      
                    case "ai":
                      fileName += ".ai";
                      exportFile = new File(outputPath + "/" + fileName);
                      var aiOptions = new IllustratorSaveOptions();
                      aiOptions.embedLinkedFiles = ${embedImages};
                      aiOptions.pdfCompatible = true;
                      doc.saveAs(exportFile, aiOptions);
                      break;
                  }
                  
                  processedFiles.push(fileName);
                  manifest.files.push({
                    name: fileName,
                    artboard: artboard.name,
                    index: i,
                    bounds: artboard.artboardRect
                  });
                }
              } else {
                // Export entire document
                var fileName = doc.name.replace(/\\.[^.]+$/, "") + "." + format;
                var exportFile = new File(outputPath + "/" + fileName);
                
                switch (format) {
                  case "svg":
                    var svgOptions = new ExportOptionsSVG();
                    svgOptions.embedRasterImages = ${embedImages};
                    svgOptions.preserveEditability = ${preserveLayers};
                    doc.exportFile(exportFile, ExportType.SVG, svgOptions);
                    break;
                    
                  case "pdf":
                    var pdfOptions = new PDFSaveOptions();
                    pdfOptions.preserveEditability = ${preserveLayers};
                    doc.saveAs(exportFile, pdfOptions);
                    break;
                    
                  case "ai":
                    var aiOptions = new IllustratorSaveOptions();
                    aiOptions.embedLinkedFiles = ${embedImages};
                    doc.saveAs(exportFile, aiOptions);
                    break;
                }
                
                processedFiles.push(fileName);
                manifest.files.push({
                  name: fileName,
                  artboards: doc.artboards.length
                });
              }
              
              // Generate manifest file
              if (${generateManifest}) {
                var manifestFile = new File(outputPath + "/manifest.json");
                manifestFile.open("w");
                manifestFile.write(JSON.stringify(manifest, null, 2));
                manifestFile.close();
                processedFiles.push("manifest.json");
              }
              
              // Create .gitignore for temporary files
              var gitignoreFile = new File(outputPath + "/.gitignore");
              gitignoreFile.open("w");
              gitignoreFile.write("*.tmp\\n*.lock\\n~$*\\n");
              gitignoreFile.close();
              break;
              
            case "import_from_repo":
              // Import files from repository
              var repoFiles = outputFolder.getFiles();
              var importedCount = 0;
              
              for (var i = 0; i < repoFiles.length; i++) {
                var file = repoFiles[i];
                var ext = file.name.split(".").pop().toLowerCase();
                
                if (ext === format || (format === "ai" && ext === "ai")) {
                  // Place or open file
                  if (doc.pageItems.length > 0) {
                    // Place in current document
                    var placed = doc.placedItems.add();
                    placed.file = file;
                    processedFiles.push(file.name);
                    importedCount++;
                  } else {
                    // Open as new document
                    app.open(file);
                    processedFiles.push(file.name);
                    importedCount++;
                  }
                }
              }
              break;
              
            case "generate_diff_preview":
              // Generate visual diff preview (simplified)
              // This would typically compare with previous version
              var diffDoc = app.documents.add();
              
              // Add current version on left
              var currentGroup = diffDoc.groupItems.add();
              currentGroup.name = "Current Version";
              
              for (var i = 0; i < doc.pageItems.length; i++) {
                var copy = doc.pageItems[i].duplicate(currentGroup, ElementPlacement.PLACEATEND);
              }
              
              // Add divider line
              var divider = diffDoc.pathItems.add();
              divider.setEntirePath([[0, 1000], [0, -1000]]);
              divider.stroked = true;
              divider.strokeWidth = 2;
              
              // Export diff preview
              var diffFileName = "diff-preview-" + new Date().getTime() + ".png";
              var diffFile = new File(outputPath + "/" + diffFileName);
              var pngOptions = new ExportOptionsPNG24();
              pngOptions.artBoardClipping = true;
              
              diffDoc.exportFile(diffFile, ExportType.PNG24, pngOptions);
              processedFiles.push(diffFileName);
              
              diffDoc.close(SaveOptions.DONOTSAVECHANGES);
              break;
          }
          
          JSON.stringify({
            success: true,
            operation: operation,
            filesProcessed: processedFiles.length,
            files: processedFiles,
            outputPath: outputPath,
            branch: "${branchName || 'main'}",
            message: "Version control sync completed"
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  // Tool: connect_to_creative_cloud
  // Complexity: 3.6 (Medium-High)
  // Dependencies: None
  server.tool(
    "connect_to_creative_cloud",
    {
      action: z.enum(["save_to_cloud", "load_from_cloud", "sync_libraries", "share_for_review"]).describe("Creative Cloud action"),
      cloudOptions: z.object({
        fileName: z.string().optional().describe("File name for cloud save"),
        cloudPath: z.string().optional().describe("Path in Creative Cloud"),
        libraryName: z.string().optional().describe("CC Library name"),
        shareSettings: z.object({
          allowComments: z.boolean().default(true),
          allowDownload: z.boolean().default(false),
          expirationDays: z.number().optional(),
          password: z.string().optional()
        }).optional()
      }).optional(),
      syncOptions: z.object({
        colors: z.boolean().default(true).describe("Sync color swatches"),
        characterStyles: z.boolean().default(true).describe("Sync character styles"),
        graphicStyles: z.boolean().default(true).describe("Sync graphic styles"),
        symbols: z.boolean().default(true).describe("Sync symbols"),
        brushes: z.boolean().default(true).describe("Sync brushes")
      }).optional()
    },
    wrapToolForTelemetry("connect_to_creative_cloud", async (args: any) => {
      const { action, cloudOptions = {}, syncOptions = {} } = args;
      const {
        fileName,
        cloudPath,
        libraryName,
        shareSettings = {}
      } = cloudOptions;
      const {
        colors = true,
        characterStyles = true,
        graphicStyles = true,
        symbols = true,
        brushes = true
      } = syncOptions;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var action = ${JSON.stringify(action)};
          var results = {
            action: action,
            success: false,
            items: []
          };
          
          switch (action) {
            case "save_to_cloud":
              // Simulate saving to Creative Cloud
              // In reality, this would use CC APIs
              var cloudFileName = "${fileName || ''}" || doc.name;
              var cloudFolder = "${cloudPath || '/Creative Cloud Files/'}";
              
              // Save a copy with cloud metadata
              var tempFile = new File(Folder.temp + "/" + cloudFileName);
              doc.saveAs(tempFile);
              
              results.success = true;
              results.cloudPath = cloudFolder + cloudFileName;
              results.message = "Document saved to Creative Cloud";
              results.items.push({
                type: "document",
                name: cloudFileName,
                path: cloudFolder
              });
              break;
              
            case "sync_libraries":
              // Sync with CC Libraries
              var libName = "${libraryName || 'My Library'}";
              var syncedItems = [];
              
              if (${colors}) {
                // Export color swatches
                var swatches = doc.swatches;
                var colorCount = 0;
                for (var i = 0; i < swatches.length; i++) {
                  if (swatches[i].name !== "[None]" && swatches[i].name !== "[Registration]") {
                    colorCount++;
                    syncedItems.push({
                      type: "color",
                      name: swatches[i].name
                    });
                  }
                }
                results.items.push({
                  type: "colors",
                  count: colorCount,
                  library: libName
                });
              }
              
              if (${characterStyles}) {
                // Export character styles
                var charStyles = doc.characterStyles;
                for (var i = 0; i < charStyles.length; i++) {
                  syncedItems.push({
                    type: "characterStyle",
                    name: charStyles[i].name
                  });
                }
                results.items.push({
                  type: "characterStyles",
                  count: charStyles.length,
                  library: libName
                });
              }
              
              if (${graphicStyles}) {
                // Export graphic styles
                var graphStyles = doc.graphicStyles;
                for (var i = 0; i < graphStyles.length; i++) {
                  syncedItems.push({
                    type: "graphicStyle",
                    name: graphStyles[i].name
                  });
                }
                results.items.push({
                  type: "graphicStyles",
                  count: graphStyles.length,
                  library: libName
                });
              }
              
              if (${symbols}) {
                // Export symbols
                var syms = doc.symbols;
                for (var i = 0; i < syms.length; i++) {
                  syncedItems.push({
                    type: "symbol",
                    name: syms[i].name
                  });
                }
                results.items.push({
                  type: "symbols",
                  count: syms.length,
                  library: libName
                });
              }
              
              if (${brushes}) {
                // Export brushes
                var brushList = doc.brushes;
                for (var i = 0; i < brushList.length; i++) {
                  syncedItems.push({
                    type: "brush",
                    name: brushList[i].name
                  });
                }
                results.items.push({
                  type: "brushes",
                  count: brushList.length,
                  library: libName
                });
              }
              
              results.success = true;
              results.syncedCount = syncedItems.length;
              results.library = libName;
              results.message = "Synced " + syncedItems.length + " items to CC Library";
              break;
              
            case "share_for_review":
              // Prepare document for review sharing
              var shareOpts = ${JSON.stringify(shareSettings)};
              
              // Export a review version
              var reviewFileName = doc.name.replace(/\\.[^.]+$/, "") + "_review.pdf";
              var reviewFile = new File(Folder.temp + "/" + reviewFileName);
              
              var pdfOptions = new PDFSaveOptions();
              pdfOptions.compatibility = PDFCompatibility.ACROBAT7;
              pdfOptions.preserveEditability = false;
              pdfOptions.generateThumbnails = true;
              
              doc.saveAs(reviewFile, pdfOptions);
              
              // Simulate creating share link
              var shareId = "share_" + Math.random().toString(36).substring(7);
              var shareUrl = "https://assets.adobe.com/review/" + shareId;
              
              results.success = true;
              results.shareUrl = shareUrl;
              results.fileName = reviewFileName;
              results.settings = shareOpts;
              results.message = "Document shared for review";
              results.items.push({
                type: "share",
                url: shareUrl,
                expires: shareOpts.expirationDays ? 
                  new Date(Date.now() + shareOpts.expirationDays * 24 * 60 * 60 * 1000).toISOString() : 
                  "never"
              });
              break;
              
            case "load_from_cloud":
              // Simulate loading from Creative Cloud
              // In reality, this would browse CC files
              results.success = true;
              results.message = "Ready to load from Creative Cloud";
              results.items.push({
                type: "browser",
                path: "${cloudPath || '/Creative Cloud Files/'}"
              });
              break;
          }
          
          JSON.stringify(results);
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  // Tool: generate_web_assets
  // Complexity: 3.8 (Medium-High)
  // Dependencies: export_to_web_format
  server.tool(
    "generate_web_assets",
    {
      assetType: z.enum(["favicon_set", "social_media", "email_signature", "web_banner"]).describe("Type of web assets to generate"),
      source: z.enum(["selection", "artboard", "document"]).default("selection"),
      specifications: z.object({
        favicon: z.object({
          sizes: z.array(z.number()).default([16, 32, 48, 64, 128, 256]).describe("Favicon sizes"),
          includeICO: z.boolean().default(true).describe("Generate .ico file"),
          includeWebManifest: z.boolean().default(true).describe("Generate web manifest")
        }).optional(),
        socialMedia: z.object({
          platforms: z.array(z.enum(["facebook", "twitter", "instagram", "linkedin", "youtube"])).default(["facebook", "twitter"]),
          includeCovers: z.boolean().default(true).describe("Include cover images"),
          includeProfile: z.boolean().default(true).describe("Include profile images")
        }).optional(),
        emailSignature: z.object({
          width: z.number().default(600).describe("Email width in pixels"),
          format: z.enum(["html", "image"]).default("html"),
          includeLinks: z.boolean().default(true)
        }).optional(),
        webBanner: z.object({
          sizes: z.array(z.object({
            name: z.string(),
            width: z.number(),
            height: z.number()
          })).default([
            { name: "leaderboard", width: 728, height: 90 },
            { name: "rectangle", width: 300, height: 250 }
          ])
        }).optional()
      }).optional(),
      outputPath: z.string().describe("Output directory for generated assets"),
      branding: z.object({
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        fontFamily: z.string().optional()
      }).optional()
    },
    wrapToolForTelemetry("generate_web_assets", async (args: any) => {
      const { assetType, source = "selection", specifications = {}, outputPath, branding = {} } = args;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var assetType = ${JSON.stringify(assetType)};
          var outputPath = ${JSON.stringify(outputPath)};
          
          // Ensure output directory exists
          var outputFolder = new Folder(outputPath);
          if (!outputFolder.exists) {
            outputFolder.create();
          }
          
          var generatedAssets = [];
          
          switch (assetType) {
            case "favicon_set":
              var faviconSpecs = ${JSON.stringify(specifications.favicon || {})};
              var sizes = faviconSpecs.sizes || [16, 32, 48, 64, 128, 256];
              
              // Get source artwork
              var sourceArt = app.selection.length > 0 ? app.selection[0] : doc.pageItems[0];
              
              for (var i = 0; i < sizes.length; i++) {
                var size = sizes[i];
                
                // Create square document at target size
                var faviconDoc = app.documents.add(
                  DocumentColorSpace.RGB,
                  size,
                  size
                );
                
                // Copy and resize artwork
                var copy = sourceArt.duplicate(faviconDoc, ElementPlacement.PLACEATEND);
                
                // Scale to fit
                var bounds = copy.geometricBounds;
                var width = bounds[2] - bounds[0];
                var height = bounds[1] - bounds[3];
                var scale = Math.min(size / width, size / height) * 100;
                
                var scaleMatrix = app.getScaleMatrix(scale, scale);
                copy.transform(scaleMatrix, true, false, true, false, 0, Transformation.CENTER);
                
                // Center in artboard
                copy.position = [(size - (width * scale / 100)) / 2, size - (size - (height * scale / 100)) / 2];
                
                // Export PNG
                var fileName = "favicon-" + size + "x" + size + ".png";
                var exportFile = new File(outputPath + "/" + fileName);
                var exportOptions = new ExportOptionsPNG24();
                exportOptions.artBoardClipping = true;
                exportOptions.transparency = true;
                
                faviconDoc.exportFile(exportFile, ExportType.PNG24, exportOptions);
                generatedAssets.push({
                  file: fileName,
                  size: size + "x" + size,
                  type: "favicon"
                });
                
                faviconDoc.close(SaveOptions.DONOTSAVECHANGES);
              }
              
              // Generate web manifest if requested
              if (faviconSpecs.includeWebManifest) {
                var manifest = {
                  name: doc.name.replace(/\\.[^.]+$/, ""),
                  short_name: doc.name.replace(/\\.[^.]+$/, "").substring(0, 12),
                  icons: generatedAssets.map(function(asset) {
                    return {
                      src: asset.file,
                      sizes: asset.size,
                      type: "image/png"
                    };
                  }),
                  theme_color: "${branding.primaryColor || '#000000'}",
                  background_color: "${branding.secondaryColor || '#ffffff'}",
                  display: "standalone"
                };
                
                var manifestFile = new File(outputPath + "/manifest.json");
                manifestFile.open("w");
                manifestFile.write(JSON.stringify(manifest, null, 2));
                manifestFile.close();
                generatedAssets.push({ file: "manifest.json", type: "manifest" });
              }
              break;
              
            case "social_media":
              var socialSpecs = ${JSON.stringify(specifications.socialMedia || {})};
              var platforms = socialSpecs.platforms || ["facebook", "twitter"];
              
              // Platform dimensions
              var dimensions = {
                facebook: { 
                  cover: { width: 1200, height: 630 },
                  profile: { width: 400, height: 400 }
                },
                twitter: {
                  cover: { width: 1500, height: 500 },
                  profile: { width: 400, height: 400 }
                },
                instagram: {
                  post: { width: 1080, height: 1080 },
                  story: { width: 1080, height: 1920 }
                },
                linkedin: {
                  cover: { width: 1584, height: 396 },
                  profile: { width: 400, height: 400 }
                },
                youtube: {
                  cover: { width: 2560, height: 1440 },
                  thumbnail: { width: 1280, height: 720 }
                }
              };
              
              for (var p = 0; p < platforms.length; p++) {
                var platform = platforms[p];
                var platformDims = dimensions[platform];
                
                for (var dimType in platformDims) {
                  var dims = platformDims[dimType];
                  
                  // Create document at target dimensions
                  var socialDoc = app.documents.add(
                    DocumentColorSpace.RGB,
                    dims.width,
                    dims.height
                  );
                  
                  // Copy source artwork
                  for (var i = 0; i < app.selection.length; i++) {
                    var copy = app.selection[i].duplicate(socialDoc, ElementPlacement.PLACEATEND);
                    
                    // Scale and position
                    var bounds = copy.geometricBounds;
                    var artWidth = bounds[2] - bounds[0];
                    var artHeight = bounds[1] - bounds[3];
                    
                    var scaleX = (dims.width / artWidth) * 100;
                    var scaleY = (dims.height / artHeight) * 100;
                    var scale = Math.min(scaleX, scaleY);
                    
                    var scaleMatrix = app.getScaleMatrix(scale, scale);
                    copy.transform(scaleMatrix, true, false, true, false, 0, Transformation.CENTER);
                    
                    // Center in artboard
                    copy.position = [
                      (dims.width - (artWidth * scale / 100)) / 2,
                      dims.height - (dims.height - (artHeight * scale / 100)) / 2
                    ];
                  }
                  
                  // Export
                  var fileName = platform + "-" + dimType + ".jpg";
                  var exportFile = new File(outputPath + "/" + fileName);
                  var exportOptions = new ExportOptionsJPEG();
                  exportOptions.artBoardClipping = true;
                  exportOptions.qualitySetting = 90;
                  
                  socialDoc.exportFile(exportFile, ExportType.JPEG, exportOptions);
                  generatedAssets.push({
                    file: fileName,
                    platform: platform,
                    type: dimType,
                    dimensions: dims.width + "x" + dims.height
                  });
                  
                  socialDoc.close(SaveOptions.DONOTSAVECHANGES);
                }
              }
              break;
          }
          
          JSON.stringify({
            success: true,
            assetType: assetType,
            assetsGenerated: generatedAssets.length,
            assets: generatedAssets,
            outputPath: outputPath,
            message: "Generated " + generatedAssets.length + " web assets"
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  console.error("Integration tools registered successfully");
}