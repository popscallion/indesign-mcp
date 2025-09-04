// src/illustrator/tools/data/index.ts

/**
 * @fileoverview Data-driven tools for Illustrator MCP
 * Handles variable data, CSV import, data merge, and dynamic content
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScriptForApp } from "../../../extendscript.js";
import { wrapToolForTelemetry } from "../../../tools/index.js";
import { z } from "zod";

/**
 * Registers data-related tools with the MCP server
 */
export async function registerDataTools(server: McpServer): Promise<void> {
  
  // Tool: import_csv_data
  // Complexity: 3.5 (Medium-High)
  // Dependencies: None
  server.tool(
    "import_csv_data",
    {
      csvContent: z.string().describe("CSV content to import (headers in first row)"),
      options: z.object({
        delimiter: z.string().default(",").describe("Field delimiter character"),
        quoteChar: z.string().default('"').describe("Quote character for fields"),
        escapeChar: z.string().default("\\").describe("Escape character"),
        hasHeaders: z.boolean().default(true).describe("First row contains headers"),
        trimFields: z.boolean().default(true).describe("Trim whitespace from fields"),
        skipEmptyRows: z.boolean().default(true).describe("Skip empty rows"),
        maxRows: z.number().optional().describe("Maximum rows to import")
      }).optional()
    },
    wrapToolForTelemetry("import_csv_data", async (args: any) => {
      const { csvContent, options = {} } = args;
      const {
        delimiter = ",",
        quoteChar = '"',
        escapeChar = "\\",
        hasHeaders = true,
        trimFields = true,
        skipEmptyRows = true,
        maxRows
      } = options;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var csvContent = ${JSON.stringify(csvContent)};
          var delimiter = ${JSON.stringify(delimiter)};
          var quoteChar = ${JSON.stringify(quoteChar)};
          var escapeChar = ${JSON.stringify(escapeChar)};
          var hasHeaders = ${hasHeaders};
          var trimFields = ${trimFields};
          var skipEmptyRows = ${skipEmptyRows};
          var maxRows = ${maxRows || "null"};
          
          // Parse CSV
          function parseCSV(csv) {
            var rows = [];
            var currentRow = [];
            var currentField = "";
            var inQuotes = false;
            var escaped = false;
            
            for (var i = 0; i < csv.length; i++) {
              var char = csv[i];
              var nextChar = csv[i + 1];
              
              if (escaped) {
                currentField += char;
                escaped = false;
              } else if (char === escapeChar) {
                escaped = true;
              } else if (char === quoteChar) {
                if (inQuotes && nextChar === quoteChar) {
                  currentField += quoteChar;
                  i++; // Skip next quote
                } else {
                  inQuotes = !inQuotes;
                }
              } else if (!inQuotes && char === delimiter) {
                if (trimFields) {
                  currentField = currentField.replace(/^\\s+|\\s+$/g, '');
                }
                currentRow.push(currentField);
                currentField = "";
              } else if (!inQuotes && (char === "\\n" || (char === "\\r" && nextChar !== "\\n"))) {
                if (trimFields) {
                  currentField = currentField.replace(/^\\s+|\\s+$/g, '');
                }
                currentRow.push(currentField);
                
                if (!skipEmptyRows || currentRow.some(function(f) { return f.length > 0; })) {
                  rows.push(currentRow);
                }
                
                currentRow = [];
                currentField = "";
                
                if (char === "\\r" && nextChar === "\\n") {
                  i++; // Skip LF in CRLF
                }
              } else {
                currentField += char;
              }
            }
            
            // Handle last field and row
            if (currentField.length > 0 || currentRow.length > 0) {
              if (trimFields) {
                currentField = currentField.replace(/^\\s+|\\s+$/g, '');
              }
              currentRow.push(currentField);
              if (!skipEmptyRows || currentRow.some(function(f) { return f.length > 0; })) {
                rows.push(currentRow);
              }
            }
            
            return rows;
          }
          
          var data = parseCSV(csvContent);
          
          // Apply row limit if specified
          if (maxRows && data.length > maxRows) {
            data = data.slice(0, maxRows);
          }
          
          // Separate headers and data rows
          var headers = hasHeaders && data.length > 0 ? data[0] : null;
          var dataRows = hasHeaders ? data.slice(1) : data;
          
          // Create data objects
          var parsedData = [];
          for (var i = 0; i < dataRows.length; i++) {
            var row = dataRows[i];
            if (headers) {
              var obj = {};
              for (var j = 0; j < headers.length; j++) {
                obj[headers[j]] = row[j] || "";
              }
              parsedData.push(obj);
            } else {
              parsedData.push(row);
            }
          }
          
          // Store in document as XMP metadata for later use
          if (doc.XMPString) {
            var xmp = new XMPMeta(doc.XMPString);
          } else {
            var xmp = new XMPMeta();
          }
          
          var ns = "http://ns.adobe.com/illustrator/mcp/data/1.0/";
          XMPMeta.registerNamespace(ns, "mcpdata:");
          xmp.setProperty(ns, "csvData", JSON.stringify(parsedData));
          doc.XMPString = xmp.serialize();
          
          JSON.stringify({
            success: true,
            rowCount: dataRows.length,
            columnCount: headers ? headers.length : (dataRows[0] ? dataRows[0].length : 0),
            headers: headers,
            sampleData: parsedData.slice(0, 3),
            message: "CSV data imported and stored in document metadata"
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  // Tool: create_data_merge_template
  // Complexity: 4.0 (High)
  // Dependencies: import_csv_data
  server.tool(
    "create_data_merge_template",
    {
      templateElements: z.array(z.object({
        type: z.enum(["text", "image", "shape", "group"]).describe("Element type"),
        variableName: z.string().describe("Variable name from data source"),
        position: z.object({
          x: z.number().describe("X position in points"),
          y: z.number().describe("Y position in points")
        }),
        style: z.object({
          fontSize: z.number().optional().describe("Font size for text elements"),
          fontFamily: z.string().optional().describe("Font family for text"),
          fillColor: z.object({
            r: z.number().min(0).max(255),
            g: z.number().min(0).max(255),
            b: z.number().min(0).max(255)
          }).optional().describe("Fill color"),
          strokeColor: z.object({
            r: z.number().min(0).max(255),
            g: z.number().min(0).max(255),
            b: z.number().min(0).max(255)
          }).optional().describe("Stroke color"),
          strokeWidth: z.number().optional().describe("Stroke width"),
          opacity: z.number().min(0).max(100).optional().describe("Opacity percentage")
        }).optional()
      })).describe("Template elements with variable mappings"),
      layoutOptions: z.object({
        pageSize: z.object({
          width: z.number().describe("Page width in points"),
          height: z.number().describe("Page height in points")
        }).optional(),
        margin: z.number().default(36).describe("Page margin in points"),
        columns: z.number().default(1).describe("Number of columns"),
        rows: z.number().default(1).describe("Number of rows"),
        gutter: z.number().default(12).describe("Gutter between items")
      }).optional()
    },
    wrapToolForTelemetry("create_data_merge_template", async (args: any) => {
      const { templateElements, layoutOptions = {} } = args;
      const {
        pageSize,
        margin = 36,
        columns = 1,
        rows = 1,
        gutter = 12
      } = layoutOptions;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var templateElements = ${JSON.stringify(templateElements)};
          var pageSize = ${JSON.stringify(pageSize)};
          var margin = ${margin};
          var columns = ${columns};
          var rows = ${rows};
          var gutter = ${gutter};
          
          // Create template layer
          var templateLayer = doc.layers.add();
          templateLayer.name = "Data Merge Template";
          
          // Calculate layout grid
          var artboard = doc.artboards[0];
          var bounds = artboard.artboardRect;
          var pageWidth = pageSize ? pageSize.width : (bounds[2] - bounds[0]);
          var pageHeight = pageSize ? pageSize.height : (bounds[1] - bounds[3]);
          
          var contentWidth = pageWidth - (margin * 2);
          var contentHeight = pageHeight - (margin * 2);
          var cellWidth = (contentWidth - (gutter * (columns - 1))) / columns;
          var cellHeight = (contentHeight - (gutter * (rows - 1))) / rows;
          
          var createdElements = [];
          
          // Create template elements
          for (var i = 0; i < templateElements.length; i++) {
            var element = templateElements[i];
            var item = null;
            
            switch (element.type) {
              case "text":
                item = templateLayer.textFrames.add();
                item.contents = "{{" + element.variableName + "}}";
                item.position = [element.position.x, -element.position.y];
                
                if (element.style) {
                  if (element.style.fontSize) {
                    item.textRange.characterAttributes.size = element.style.fontSize;
                  }
                  if (element.style.fontFamily) {
                    try {
                      var font = app.textFonts.getByName(element.style.fontFamily);
                      item.textRange.characterAttributes.textFont = font;
                    } catch(e) {}
                  }
                  if (element.style.fillColor) {
                    var color = new RGBColor();
                    color.red = element.style.fillColor.r;
                    color.green = element.style.fillColor.g;
                    color.blue = element.style.fillColor.b;
                    item.textRange.characterAttributes.fillColor = color;
                  }
                }
                break;
                
              case "shape":
                // Create placeholder rectangle
                item = templateLayer.pathItems.rectangle(
                  -element.position.y,
                  element.position.x,
                  100,
                  100
                );
                item.name = "{{" + element.variableName + "}}";
                
                if (element.style) {
                  if (element.style.fillColor) {
                    var fillColor = new RGBColor();
                    fillColor.red = element.style.fillColor.r;
                    fillColor.green = element.style.fillColor.g;
                    fillColor.blue = element.style.fillColor.b;
                    item.fillColor = fillColor;
                  }
                  if (element.style.strokeColor) {
                    var strokeColor = new RGBColor();
                    strokeColor.red = element.style.strokeColor.r;
                    strokeColor.green = element.style.strokeColor.g;
                    strokeColor.blue = element.style.strokeColor.b;
                    item.strokeColor = strokeColor;
                  }
                  if (element.style.strokeWidth !== undefined) {
                    item.strokeWidth = element.style.strokeWidth;
                  }
                  if (element.style.opacity !== undefined) {
                    item.opacity = element.style.opacity;
                  }
                }
                break;
                
              case "image":
                // Create placeholder for image
                item = templateLayer.pathItems.rectangle(
                  -element.position.y,
                  element.position.x,
                  200,
                  150
                );
                item.name = "{{IMAGE:" + element.variableName + "}}";
                item.filled = false;
                item.stroked = true;
                item.strokeWidth = 1;
                var gray = new GrayColor();
                gray.gray = 50;
                item.strokeColor = gray;
                
                // Add label
                var label = templateLayer.textFrames.add();
                label.contents = "Image: {{" + element.variableName + "}}";
                label.position = [element.position.x + 10, -element.position.y - 10];
                label.textRange.characterAttributes.size = 10;
                break;
                
              case "group":
                // Create a group placeholder
                var group = templateLayer.groupItems.add();
                group.name = "{{GROUP:" + element.variableName + "}}";
                
                // Add a bounding box
                var bounds = group.pathItems.rectangle(
                  -element.position.y,
                  element.position.x,
                  150,
                  150
                );
                bounds.filled = false;
                bounds.stroked = true;
                bounds.strokeDashed = true;
                item = group;
                break;
            }
            
            if (item) {
              createdElements.push({
                type: element.type,
                variableName: element.variableName,
                itemName: item.name || ""
              });
            }
          }
          
          // Store template configuration in XMP
          if (doc.XMPString) {
            var xmp = new XMPMeta(doc.XMPString);
          } else {
            var xmp = new XMPMeta();
          }
          
          var ns = "http://ns.adobe.com/illustrator/mcp/data/1.0/";
          XMPMeta.registerNamespace(ns, "mcpdata:");
          xmp.setProperty(ns, "mergeTemplate", JSON.stringify({
            elements: templateElements,
            layout: layoutOptions,
            created: new Date().toISOString()
          }));
          doc.XMPString = xmp.serialize();
          
          JSON.stringify({
            success: true,
            elementsCreated: createdElements.length,
            templateLayer: templateLayer.name,
            layoutGrid: {
              columns: columns,
              rows: rows,
              cellWidth: Math.round(cellWidth),
              cellHeight: Math.round(cellHeight)
            },
            message: "Data merge template created successfully"
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  // Tool: execute_data_merge
  // Complexity: 4.5 (High)
  // Dependencies: import_csv_data, create_data_merge_template
  server.tool(
    "execute_data_merge",
    {
      dataSource: z.enum(["stored", "provided"]).describe("Use stored CSV data or provide new data"),
      data: z.array(z.record(z.string(), z.any())).optional().describe("Data records if dataSource is 'provided'"),
      mergeOptions: z.object({
        createNewDocument: z.boolean().default(true).describe("Create new document for merged results"),
        recordsPerPage: z.number().default(1).describe("Number of records per page"),
        pageLayout: z.enum(["single", "grid", "sequential"]).default("single"),
        spacing: z.number().default(20).describe("Spacing between records in points"),
        duplicateTemplate: z.boolean().default(true).describe("Duplicate template for each record"),
        updateImages: z.boolean().default(false).describe("Update image placeholders with file paths"),
        imagePath: z.string().optional().describe("Base path for image files")
      }).optional(),
      recordRange: z.object({
        start: z.number().min(0).describe("Start record index"),
        end: z.number().min(0).describe("End record index")
      }).optional().describe("Range of records to merge")
    },
    wrapToolForTelemetry("execute_data_merge", async (args: any) => {
      const { dataSource, data, mergeOptions = {}, recordRange } = args;
      const {
        createNewDocument = true,
        recordsPerPage = 1,
        pageLayout = "single",
        spacing = 20,
        duplicateTemplate = true,
        updateImages = false,
        imagePath
      } = mergeOptions;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var dataSource = ${JSON.stringify(dataSource)};
          var providedData = ${JSON.stringify(data)};
          var createNewDocument = ${createNewDocument};
          var recordsPerPage = ${recordsPerPage};
          var pageLayout = ${JSON.stringify(pageLayout)};
          var spacing = ${spacing};
          var duplicateTemplate = ${duplicateTemplate};
          var updateImages = ${updateImages};
          var imagePath = ${JSON.stringify(imagePath || "")};
          var recordRange = ${JSON.stringify(recordRange)};
          
          // Get data
          var mergeData = [];
          if (dataSource === "stored") {
            // Retrieve from XMP
            if (doc.XMPString) {
              var xmp = new XMPMeta(doc.XMPString);
              var ns = "http://ns.adobe.com/illustrator/mcp/data/1.0/";
              var csvData = xmp.getProperty(ns, "csvData");
              if (csvData) {
                mergeData = JSON.parse(csvData.value);
              }
            }
          } else {
            mergeData = providedData;
          }
          
          if (!mergeData || mergeData.length === 0) {
            throw new Error("No data available for merge");
          }
          
          // Apply record range if specified
          if (recordRange) {
            var start = recordRange.start || 0;
            var end = recordRange.end || mergeData.length;
            mergeData = mergeData.slice(start, end);
          }
          
          // Find template elements
          var templateLayer = null;
          for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === "Data Merge Template") {
              templateLayer = doc.layers[i];
              break;
            }
          }
          
          if (!templateLayer) {
            throw new Error("No template layer found. Create a template first.");
          }
          
          var targetDoc = createNewDocument ? app.documents.add() : doc;
          var mergedCount = 0;
          var currentPage = 0;
          var currentPosition = { x: 0, y: 0 };
          
          // Process each data record
          for (var recordIndex = 0; recordIndex < mergeData.length; recordIndex++) {
            var record = mergeData[recordIndex];
            
            // Calculate position for this record
            if (pageLayout === "grid") {
              var col = recordIndex % Math.ceil(Math.sqrt(recordsPerPage));
              var row = Math.floor(recordIndex / Math.ceil(Math.sqrt(recordsPerPage)));
              currentPosition.x = col * (200 + spacing);
              currentPosition.y = -row * (200 + spacing);
            } else if (pageLayout === "sequential") {
              currentPosition.y = -recordIndex * (200 + spacing);
            }
            
            // Duplicate template items
            var mergedLayer = targetDoc.layers.add();
            mergedLayer.name = "Merged Record " + (recordIndex + 1);
            
            // Process template items
            for (var j = 0; j < templateLayer.pageItems.length; j++) {
              var templateItem = templateLayer.pageItems[j];
              var duplicate = templateItem.duplicate(mergedLayer, ElementPlacement.PLACEATEND);
              
              // Replace variables in text frames
              if (duplicate.typename === "TextFrame") {
                var content = duplicate.contents;
                for (var field in record) {
                  var pattern = "{{" + field + "}}";
                  content = content.replace(new RegExp(pattern, "g"), record[field]);
                }
                duplicate.contents = content;
              }
              
              // Handle named items (shapes, groups)
              else if (duplicate.name && duplicate.name.indexOf("{{") !== -1) {
                var varMatch = duplicate.name.match(/{{([^}]+)}}/);
                if (varMatch && record[varMatch[1]] !== undefined) {
                  // Update name with actual value
                  duplicate.name = record[varMatch[1]];
                }
              }
              
              // Apply position offset for grid/sequential layouts
              if (pageLayout !== "single") {
                duplicate.position = [
                  duplicate.position[0] + currentPosition.x,
                  duplicate.position[1] + currentPosition.y
                ];
              }
            }
            
            mergedCount++;
            
            // Handle pagination
            if (recordsPerPage > 1 && (recordIndex + 1) % recordsPerPage === 0) {
              currentPage++;
              currentPosition = { x: 0, y: 0 };
            }
          }
          
          JSON.stringify({
            success: true,
            recordsMerged: mergedCount,
            documentCreated: createNewDocument,
            targetDocument: targetDoc.name,
            pagesCreated: currentPage + 1,
            message: "Data merge completed successfully"
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  // Tool: update_variable_text
  // Complexity: 3.2 (Medium)
  // Dependencies: None
  server.tool(
    "update_variable_text",
    {
      variables: z.record(z.string(), z.string()).describe("Variable name to value mapping"),
      scope: z.enum(["all", "selection", "layer", "artboard"]).default("all").describe("Scope for variable replacement"),
      layerName: z.string().optional().describe("Layer name if scope is 'layer'"),
      artboardIndex: z.number().optional().describe("Artboard index if scope is 'artboard'"),
      format: z.object({
        preserveFormatting: z.boolean().default(true).describe("Preserve text formatting"),
        caseTransform: z.enum(["none", "upper", "lower", "title"]).optional(),
        trimWhitespace: z.boolean().default(true).describe("Trim whitespace from values")
      }).optional()
    },
    wrapToolForTelemetry("update_variable_text", async (args: any) => {
      const { variables, scope = "all", layerName, artboardIndex, format = {} } = args;
      const {
        preserveFormatting = true,
        caseTransform,
        trimWhitespace = true
      } = format;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var variables = ${JSON.stringify(variables)};
          var scope = ${JSON.stringify(scope)};
          var layerName = ${JSON.stringify(layerName || "")};
          var artboardIndex = ${artboardIndex !== undefined ? artboardIndex : "null"};
          var preserveFormatting = ${preserveFormatting};
          var caseTransform = ${JSON.stringify(caseTransform || "none")};
          var trimWhitespace = ${trimWhitespace};
          
          // Get text frames based on scope
          var textFrames = [];
          
          switch (scope) {
            case "selection":
              for (var i = 0; i < app.selection.length; i++) {
                if (app.selection[i].typename === "TextFrame") {
                  textFrames.push(app.selection[i]);
                }
              }
              break;
              
            case "layer":
              if (layerName) {
                for (var i = 0; i < doc.layers.length; i++) {
                  if (doc.layers[i].name === layerName) {
                    var layer = doc.layers[i];
                    for (var j = 0; j < layer.textFrames.length; j++) {
                      textFrames.push(layer.textFrames[j]);
                    }
                    break;
                  }
                }
              }
              break;
              
            case "artboard":
              if (artboardIndex !== null) {
                doc.artboards.setActiveArtboardIndex(artboardIndex);
                var artboard = doc.artboards[artboardIndex];
                var bounds = artboard.artboardRect;
                
                for (var i = 0; i < doc.textFrames.length; i++) {
                  var tf = doc.textFrames[i];
                  var tfBounds = tf.geometricBounds;
                  // Check if text frame is within artboard bounds
                  if (tfBounds[0] >= bounds[0] && tfBounds[2] <= bounds[2] &&
                      tfBounds[1] <= bounds[1] && tfBounds[3] >= bounds[3]) {
                    textFrames.push(tf);
                  }
                }
              }
              break;
              
            default: // "all"
              textFrames = doc.textFrames;
              break;
          }
          
          var updatedCount = 0;
          var replacements = [];
          
          // Process each text frame
          for (var i = 0; i < textFrames.length; i++) {
            var textFrame = textFrames[i];
            var originalContent = textFrame.contents;
            var newContent = originalContent;
            var hasChanges = false;
            
            // Replace variables
            for (var varName in variables) {
              var value = variables[varName];
              
              // Process value
              if (trimWhitespace && typeof value === "string") {
                value = value.replace(/^\\s+|\\s+$/g, '');
              }
              
              // Apply case transformation
              if (caseTransform && typeof value === "string") {
                switch (caseTransform) {
                  case "upper":
                    value = value.toUpperCase();
                    break;
                  case "lower":
                    value = value.toLowerCase();
                    break;
                  case "title":
                    value = value.replace(/\\w\\S*/g, function(txt) {
                      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                    });
                    break;
                }
              }
              
              // Replace all occurrences of {{varName}}
              var pattern = "{{" + varName + "}}";
              if (newContent.indexOf(pattern) !== -1) {
                // Simple string replace without regex
                while (newContent.indexOf(pattern) !== -1) {
                  newContent = newContent.replace(pattern, value);
                }
                hasChanges = true;
              }
            }
            
            // Apply changes if any variables were found
            if (hasChanges) {
              if (preserveFormatting) {
                // Preserve formatting by updating only the content
                textFrame.contents = newContent;
              } else {
                // Replace entire content (may lose formatting)
                textFrame.contents = newContent;
              }
              
              updatedCount++;
              replacements.push({
                textFrame: i,
                original: originalContent.substring(0, 50) + (originalContent.length > 50 ? "..." : ""),
                updated: newContent.substring(0, 50) + (newContent.length > 50 ? "..." : "")
              });
            }
          }
          
          JSON.stringify({
            success: true,
            textFramesProcessed: textFrames.length,
            textFramesUpdated: updatedCount,
            scope: scope,
            replacements: replacements.slice(0, 5), // First 5 replacements as sample
            message: "Variable text updated in " + updatedCount + " text frames"
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  console.error("Data tools registered successfully");
}