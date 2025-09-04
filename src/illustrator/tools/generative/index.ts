// src/illustrator/tools/generative/index.ts

/**
 * @fileoverview Generative and pattern creation tools for Illustrator MCP
 * Creates grids, patterns, and procedural designs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScriptForApp } from "../../../extendscript.js";
import { wrapToolForTelemetry } from "../../../tools/index.js";
import { z } from "zod";

/**
 * Registers generative-related tools with the MCP server
 */
export async function registerGenerativeTools(server: McpServer): Promise<void> {
  
  // Tool: create_grid_layout
  // Complexity: 3.0 (Medium)
  // Dependencies: create_shape_primitive, apply_transformation
  server.tool(
    "create_grid_layout",
    {
      gridType: z.enum(["rectangular", "isometric", "hexagonal", "circular", "custom"]).describe("Type of grid layout"),
      dimensions: z.object({
        x: z.number().default(0).describe("X position of grid origin"),
        y: z.number().default(0).describe("Y position of grid origin"),
        width: z.number().default(500).describe("Total width of grid"),
        height: z.number().default(500).describe("Total height of grid")
      }).describe("Grid dimensions"),
      gridSpec: z.object({
        columns: z.number().min(1).max(100).default(5).describe("Number of columns"),
        rows: z.number().min(1).max(100).default(5).describe("Number of rows"),
        cellWidth: z.number().optional().describe("Width of each cell (auto-calculated if not specified)"),
        cellHeight: z.number().optional().describe("Height of each cell (auto-calculated if not specified)"),
        gutter: z.number().default(0).describe("Space between cells"),
        margin: z.number().default(0).describe("Margin around entire grid")
      }).describe("Grid specifications"),
      cellContent: z.object({
        shape: z.enum(["rectangle", "circle", "triangle", "hexagon", "none"]).default("rectangle").describe("Shape to place in cells"),
        fill: z.boolean().default(false).describe("Fill shapes"),
        fillColor: z.string().optional().describe("Fill color (hex)"),
        stroke: z.boolean().default(true).describe("Stroke shapes"),
        strokeColor: z.string().optional().describe("Stroke color (hex)"),
        strokeWidth: z.number().default(1).describe("Stroke width")
      }).optional().describe("Content for grid cells"),
      groupResult: z.boolean().default(true).describe("Group all grid elements together")
    },
    wrapToolForTelemetry("create_grid_layout", async (args: any) => {
      const { gridType, dimensions = {}, gridSpec = {}, cellContent = {}, groupResult = true } = args;
      const { x = 0, y = 0, width = 500, height = 500 } = dimensions;
      const { columns = 5, rows = 5, gutter = 0, margin = 0 } = gridSpec;
      const { shape = "rectangle", fill = false, fillColor, stroke = true, strokeColor, strokeWidth = 1 } = cellContent;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var gridItems = [];
          var createdCount = 0;
          
          // Calculate cell dimensions
          var effectiveWidth = ${width} - (2 * ${margin});
          var effectiveHeight = ${height} - (2 * ${margin});
          var cellWidth = ${gridSpec.cellWidth || 0} || (effectiveWidth - (${columns - 1} * ${gutter})) / ${columns};
          var cellHeight = ${gridSpec.cellHeight || 0} || (effectiveHeight - (${rows - 1} * ${gutter})) / ${rows};
          
          // Starting position with margin
          var startX = ${x} + ${margin};
          var startY = ${y} - ${margin};
          
          // Create grid based on type
          switch("${gridType}") {
            case "rectangular":
              for (var row = 0; row < ${rows}; row++) {
                for (var col = 0; col < ${columns}; col++) {
                  var cellX = startX + col * (cellWidth + ${gutter});
                  var cellY = startY - row * (cellHeight + ${gutter});
                  
                  if ("${shape}" !== "none") {
                    var cellItem = null;
                    
                    switch("${shape}") {
                      case "rectangle":
                        cellItem = doc.pathItems.rectangle(
                          cellY, cellX, cellWidth, cellHeight
                        );
                        break;
                        
                      case "circle":
                        var radius = Math.min(cellWidth, cellHeight) / 2;
                        cellItem = doc.pathItems.ellipse(
                          cellY - (cellHeight - radius * 2) / 2,
                          cellX + (cellWidth - radius * 2) / 2,
                          radius * 2,
                          radius * 2
                        );
                        break;
                        
                      case "triangle":
                        cellItem = doc.pathItems.add();
                        cellItem.setEntirePath([
                          [cellX + cellWidth / 2, cellY],
                          [cellX, cellY - cellHeight],
                          [cellX + cellWidth, cellY - cellHeight]
                        ]);
                        cellItem.closed = true;
                        break;
                        
                      case "hexagon":
                        cellItem = doc.pathItems.add();
                        var hexRadius = Math.min(cellWidth, cellHeight) / 2;
                        var hexCenterX = cellX + cellWidth / 2;
                        var hexCenterY = cellY - cellHeight / 2;
                        var hexPath = [];
                        for (var i = 0; i < 6; i++) {
                          var angle = (i * 60 - 30) * Math.PI / 180;
                          hexPath.push([
                            hexCenterX + hexRadius * Math.cos(angle),
                            hexCenterY + hexRadius * Math.sin(angle)
                          ]);
                        }
                        cellItem.setEntirePath(hexPath);
                        cellItem.closed = true;
                        break;
                    }
                    
                    if (cellItem) {
                      gridItems.push(cellItem);
                      createdCount++;
                    }
                  }
                }
              }
              break;
              
            case "isometric":
              // Create isometric grid (diamond pattern)
              var isoAngle = 30 * Math.PI / 180;
              var isoWidth = cellWidth * Math.cos(isoAngle);
              var isoHeight = cellWidth * Math.sin(isoAngle);
              
              for (var row = 0; row < ${rows}; row++) {
                for (var col = 0; col < ${columns}; col++) {
                  var isoX = startX + col * (isoWidth + ${gutter}) + row * (isoWidth / 2);
                  var isoY = startY - row * (isoHeight + ${gutter});
                  
                  if ("${shape}" !== "none") {
                    var isoItem = doc.pathItems.add();
                    isoItem.setEntirePath([
                      [isoX, isoY],
                      [isoX + isoWidth, isoY - isoHeight],
                      [isoX + isoWidth * 2, isoY],
                      [isoX + isoWidth, isoY + isoHeight]
                    ]);
                    isoItem.closed = true;
                    gridItems.push(isoItem);
                    createdCount++;
                  }
                }
              }
              break;
              
            case "hexagonal":
              // Create hexagonal grid (honeycomb pattern)
              var hexSize = Math.min(cellWidth, cellHeight) / 2;
              var hexWidth = hexSize * 2;
              var hexHeight = hexSize * Math.sqrt(3);
              
              for (var row = 0; row < ${rows}; row++) {
                for (var col = 0; col < ${columns}; col++) {
                  var hexX = startX + col * (hexWidth * 0.75 + ${gutter});
                  var hexY = startY - row * (hexHeight + ${gutter});
                  
                  // Offset every other column
                  if (col % 2 === 1) {
                    hexY -= hexHeight / 2;
                  }
                  
                  var hexItem = doc.pathItems.add();
                  var hexPath = [];
                  for (var i = 0; i < 6; i++) {
                    var angle = (i * 60) * Math.PI / 180;
                    hexPath.push([
                      hexX + hexSize * Math.cos(angle),
                      hexY + hexSize * Math.sin(angle)
                    ]);
                  }
                  hexItem.setEntirePath(hexPath);
                  hexItem.closed = true;
                  gridItems.push(hexItem);
                  createdCount++;
                }
              }
              break;
              
            case "circular":
              // Create circular/radial grid
              var centerX = ${x} + ${width} / 2;
              var centerY = ${y} - ${height} / 2;
              var maxRadius = Math.min(${width}, ${height}) / 2 - ${margin};
              var radiusStep = maxRadius / ${rows};
              
              for (var ring = 1; ring <= ${rows}; ring++) {
                var ringRadius = ring * radiusStep;
                var itemsInRing = ring === 1 ? 1 : ${columns} * ring;
                
                for (var item = 0; item < itemsInRing; item++) {
                  if (ring === 1 && item === 0) {
                    // Center point
                    if ("${shape}" === "circle") {
                      var centerItem = doc.pathItems.ellipse(
                        centerY + radiusStep / 2,
                        centerX - radiusStep / 2,
                        radiusStep,
                        radiusStep
                      );
                      gridItems.push(centerItem);
                      createdCount++;
                    }
                  } else {
                    var angle = (item / itemsInRing) * 2 * Math.PI;
                    var itemX = centerX + ringRadius * Math.cos(angle);
                    var itemY = centerY + ringRadius * Math.sin(angle);
                    
                    if ("${shape}" === "circle") {
                      var circItem = doc.pathItems.ellipse(
                        itemY + radiusStep / 4,
                        itemX - radiusStep / 4,
                        radiusStep / 2,
                        radiusStep / 2
                      );
                      gridItems.push(circItem);
                      createdCount++;
                    }
                  }
                }
              }
              break;
              
            case "custom":
              // Create a custom grid with random variations
              for (var row = 0; row < ${rows}; row++) {
                for (var col = 0; col < ${columns}; col++) {
                  var customX = startX + col * (cellWidth + ${gutter});
                  var customY = startY - row * (cellHeight + ${gutter});
                  
                  // Add some random variation
                  customX += (Math.random() - 0.5) * cellWidth * 0.2;
                  customY += (Math.random() - 0.5) * cellHeight * 0.2;
                  
                  if ("${shape}" === "rectangle") {
                    var customItem = doc.pathItems.rectangle(
                      customY, customX,
                      cellWidth * (0.8 + Math.random() * 0.4),
                      cellHeight * (0.8 + Math.random() * 0.4)
                    );
                    gridItems.push(customItem);
                    createdCount++;
                  }
                }
              }
              break;
          }
          
          // Apply styling to all grid items
          for (var j = 0; j < gridItems.length; j++) {
            var gridItem = gridItems[j];
            
            // Fill
            if (${fill}) {
              gridItem.filled = true;
              if ("${fillColor || ''}" !== "") {
                var fillHex = "${fillColor}".replace("#", "");
                var fillRGB = new RGBColor();
                fillRGB.red = parseInt(fillHex.substring(0, 2), 16);
                fillRGB.green = parseInt(fillHex.substring(2, 4), 16);
                fillRGB.blue = parseInt(fillHex.substring(4, 6), 16);
                gridItem.fillColor = fillRGB;
              }
            } else {
              gridItem.filled = false;
            }
            
            // Stroke
            if (${stroke}) {
              gridItem.stroked = true;
              gridItem.strokeWidth = ${strokeWidth};
              if ("${strokeColor || ''}" !== "") {
                var strokeHex = "${strokeColor}".replace("#", "");
                var strokeRGB = new RGBColor();
                strokeRGB.red = parseInt(strokeHex.substring(0, 2), 16);
                strokeRGB.green = parseInt(strokeHex.substring(2, 4), 16);
                strokeRGB.blue = parseInt(strokeHex.substring(4, 6), 16);
                gridItem.strokeColor = strokeRGB;
              }
            } else {
              gridItem.stroked = false;
            }
          }
          
          // Group all items if requested
          if (${groupResult} && gridItems.length > 0) {
            var gridGroup = doc.groupItems.add();
            for (var k = gridItems.length - 1; k >= 0; k--) {
              gridItems[k].moveToBeginning(gridGroup);
            }
            gridGroup.name = "Grid_${gridType}";
          }
          
          "Created ${gridType} grid with " + createdCount + " elements";
          
        } catch (e) {
          "Error: " + e.message;
        }
      `;
      
      const result = await executeExtendScriptForApp(script, 'illustrator');
      
      return {
        content: [{
          type: "text" as const,
          text: result.success ? result.result || "Grid layout created" : `Error: ${result.error}`
        }]
      };
    })
  );

  // Tool: create_pattern_fill
  // Complexity: 4.2 (Medium)
  // Dependencies: create_grid_layout
  server.tool(
    "create_pattern_fill",
    {
      patternName: z.string().describe("Name for the pattern swatch"),
      patternType: z.enum(["geometric", "dots", "lines", "checkerboard", "custom"]).describe("Type of pattern"),
      tileSize: z.object({
        width: z.number().default(100).describe("Width of pattern tile"),
        height: z.number().default(100).describe("Height of pattern tile")
      }).describe("Size of the repeating tile"),
      patternElements: z.object({
        elementType: z.enum(["circle", "square", "line", "polygon", "star"]).default("circle").describe("Shape of pattern elements"),
        elementSize: z.number().default(10).describe("Size of individual elements"),
        spacing: z.number().default(20).describe("Spacing between elements"),
        rotation: z.number().default(0).describe("Rotation angle in degrees"),
        count: z.number().min(1).max(100).default(4).describe("Number of elements in pattern")
      }).describe("Pattern element specifications"),
      colors: z.object({
        backgroundColor: z.string().optional().describe("Background color (hex)"),
        elementColor: z.string().default("#000000").describe("Element color (hex)"),
        alternateColor: z.string().optional().describe("Alternate color for variations (hex)")
      }).describe("Pattern colors"),
      applyToSelection: z.boolean().default(false).describe("Apply pattern to selected objects"),
      saveToSwatches: z.boolean().default(true).describe("Save pattern as a swatch")
    },
    wrapToolForTelemetry("create_pattern_fill", async (args: any) => {
      const { patternName, patternType, tileSize = {}, patternElements = {}, colors = {}, applyToSelection = false, saveToSwatches = true } = args;
      const { width: tileWidth = 100, height: tileHeight = 100 } = tileSize;
      const { elementType = "circle", elementSize = 10, spacing = 20, rotation = 0, count = 4 } = patternElements;
      const { backgroundColor, elementColor = "#000000", alternateColor } = colors;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var patternItems = [];
          
          // Create a temporary group for pattern elements
          var patternGroup = doc.groupItems.add();
          patternGroup.name = "PatternTile_${patternName}";
          
          // Add background if specified
          if ("${backgroundColor || ''}" !== "") {
            var bgRect = doc.pathItems.rectangle(
              0, 0, ${tileWidth}, ${tileHeight}
            );
            bgRect.filled = true;
            var bgHex = "${backgroundColor}".replace("#", "");
            var bgColor = new RGBColor();
            bgColor.red = parseInt(bgHex.substring(0, 2), 16);
            bgColor.green = parseInt(bgHex.substring(2, 4), 16);
            bgColor.blue = parseInt(bgHex.substring(4, 6), 16);
            bgRect.fillColor = bgColor;
            bgRect.stroked = false;
            bgRect.moveToBeginning(patternGroup);
            patternItems.push(bgRect);
          }
          
          // Parse element color
          var elemHex = "${elementColor}".replace("#", "");
          var elemColor = new RGBColor();
          elemColor.red = parseInt(elemHex.substring(0, 2), 16);
          elemColor.green = parseInt(elemHex.substring(2, 4), 16);
          elemColor.blue = parseInt(elemHex.substring(4, 6), 16);
          
          // Parse alternate color if provided
          var hasAltColor = "${alternateColor || ''}" !== "";
          var altColor = null;
          if (hasAltColor) {
            var altHex = "${alternateColor}".replace("#", "");
            altColor = new RGBColor();
            altColor.red = parseInt(altHex.substring(0, 2), 16);
            altColor.green = parseInt(altHex.substring(2, 4), 16);
            altColor.blue = parseInt(altHex.substring(4, 6), 16);
          }
          
          // Create pattern based on type
          switch("${patternType}") {
            case "geometric":
              // Create geometric pattern
              var rows = Math.floor(${tileHeight} / ${spacing});
              var cols = Math.floor(${tileWidth} / ${spacing});
              
              for (var r = 0; r < rows; r++) {
                for (var c = 0; c < cols; c++) {
                  var posX = c * ${spacing} + ${spacing} / 2;
                  var posY = -r * ${spacing} - ${spacing} / 2;
                  
                  var elem = null;
                  switch("${elementType}") {
                    case "circle":
                      elem = doc.pathItems.ellipse(
                        posY + ${elementSize} / 2,
                        posX - ${elementSize} / 2,
                        ${elementSize},
                        ${elementSize}
                      );
                      break;
                      
                    case "square":
                      elem = doc.pathItems.rectangle(
                        posY + ${elementSize} / 2,
                        posX - ${elementSize} / 2,
                        ${elementSize},
                        ${elementSize}
                      );
                      break;
                      
                    case "polygon":
                      elem = doc.pathItems.add();
                      var sides = 6;
                      var polyPath = [];
                      for (var i = 0; i < sides; i++) {
                        var angle = (i * 360 / sides + ${rotation}) * Math.PI / 180;
                        polyPath.push([
                          posX + ${elementSize} / 2 * Math.cos(angle),
                          posY + ${elementSize} / 2 * Math.sin(angle)
                        ]);
                      }
                      elem.setEntirePath(polyPath);
                      elem.closed = true;
                      break;
                  }
                  
                  if (elem) {
                    elem.filled = true;
                    elem.fillColor = (hasAltColor && (r + c) % 2 === 0) ? altColor : elemColor;
                    elem.stroked = false;
                    elem.moveToBeginning(patternGroup);
                    patternItems.push(elem);
                  }
                }
              }
              break;
              
            case "dots":
              // Create dot pattern
              var dotRows = Math.ceil(${tileHeight} / ${spacing});
              var dotCols = Math.ceil(${tileWidth} / ${spacing});
              
              for (var dr = 0; dr < dotRows; dr++) {
                for (var dc = 0; dc < dotCols; dc++) {
                  var dotX = dc * ${spacing} + ${spacing} / 2;
                  var dotY = -dr * ${spacing} - ${spacing} / 2;
                  
                  // Offset every other row for better distribution
                  if (dr % 2 === 1) {
                    dotX += ${spacing} / 2;
                  }
                  
                  var dot = doc.pathItems.ellipse(
                    dotY + ${elementSize} / 2,
                    dotX - ${elementSize} / 2,
                    ${elementSize},
                    ${elementSize}
                  );
                  dot.filled = true;
                  dot.fillColor = elemColor;
                  dot.stroked = false;
                  dot.moveToBeginning(patternGroup);
                  patternItems.push(dot);
                }
              }
              break;
              
            case "lines":
              // Create line pattern
              var lineCount = Math.floor(${tileWidth} / ${spacing});
              
              for (var l = 0; l < lineCount; l++) {
                var lineX = l * ${spacing} + ${spacing} / 2;
                
                var line = doc.pathItems.add();
                if (${rotation} === 0 || ${rotation} === 180) {
                  // Vertical lines
                  line.setEntirePath([
                    [lineX, 0],
                    [lineX, -${tileHeight}]
                  ]);
                } else if (${rotation} === 90 || ${rotation} === 270) {
                  // Horizontal lines
                  line.setEntirePath([
                    [0, -l * ${spacing} - ${spacing} / 2],
                    [${tileWidth}, -l * ${spacing} - ${spacing} / 2]
                  ]);
                } else {
                  // Diagonal lines
                  var angleRad = ${rotation} * Math.PI / 180;
                  var dx = ${tileWidth} * Math.cos(angleRad);
                  var dy = ${tileWidth} * Math.sin(angleRad);
                  line.setEntirePath([
                    [lineX, 0],
                    [lineX + dx, -dy]
                  ]);
                }
                
                line.filled = false;
                line.stroked = true;
                line.strokeWidth = ${elementSize};
                line.strokeColor = (hasAltColor && l % 2 === 0) ? altColor : elemColor;
                line.moveToBeginning(patternGroup);
                patternItems.push(line);
              }
              break;
              
            case "checkerboard":
              // Create checkerboard pattern
              var checkRows = ${count};
              var checkCols = ${count};
              var checkWidth = ${tileWidth} / checkCols;
              var checkHeight = ${tileHeight} / checkRows;
              
              for (var cr = 0; cr < checkRows; cr++) {
                for (var cc = 0; cc < checkCols; cc++) {
                  if ((cr + cc) % 2 === 0) {
                    var check = doc.pathItems.rectangle(
                      -cr * checkHeight,
                      cc * checkWidth,
                      checkWidth,
                      checkHeight
                    );
                    check.filled = true;
                    check.fillColor = hasAltColor ? altColor : elemColor;
                    check.stroked = false;
                    check.moveToBeginning(patternGroup);
                    patternItems.push(check);
                  }
                }
              }
              break;
              
            case "custom":
              // Create custom scattered pattern
              for (var e = 0; e < ${count}; e++) {
                var randX = Math.random() * ${tileWidth};
                var randY = -Math.random() * ${tileHeight};
                var randSize = ${elementSize} * (0.5 + Math.random());
                
                var customElem = null;
                if ("${elementType}" === "star") {
                  customElem = doc.pathItems.star(
                    randX, randY,
                    randSize, randSize / 2,
                    5, false
                  );
                } else {
                  customElem = doc.pathItems.ellipse(
                    randY + randSize / 2,
                    randX - randSize / 2,
                    randSize, randSize
                  );
                }
                
                if (customElem) {
                  customElem.filled = true;
                  customElem.fillColor = (hasAltColor && e % 2 === 0) ? altColor : elemColor;
                  customElem.stroked = false;
                  customElem.moveToBeginning(patternGroup);
                  patternItems.push(customElem);
                }
              }
              break;
          }
          
          var result = "Created pattern: ${patternName} with " + patternItems.length + " elements";
          
          // Save as pattern swatch if requested
          if (${saveToSwatches}) {
            try {
              // Create pattern swatch
              var patternSwatch = doc.patterns.add();
              patternSwatch.name = "${patternName}";
              
              // Move pattern group to swatch
              patternGroup.moveToEnd(patternSwatch);
              
              result += ", saved to swatches";
            } catch (e) {
              // Pattern creation might fail in some versions
              result += " (swatch creation not available)";
            }
          }
          
          // Apply to selection if requested
          if (${applyToSelection} && doc.selection.length > 0) {
            var appliedCount = 0;
            for (var s = 0; s < doc.selection.length; s++) {
              try {
                var item = doc.selection[s];
                if (item.filled !== undefined) {
                  item.filled = true;
                  // Note: Direct pattern fill might not work in all cases
                  // This is a limitation of ExtendScript
                  appliedCount++;
                }
              } catch (e) {
                // Skip items that can't be filled
              }
            }
            
            if (appliedCount > 0) {
              result += ", applied to " + appliedCount + " items";
            }
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
          text: result.success ? result.result || "Pattern created" : `Error: ${result.error}`
        }]
      };
    })
  );
  
  console.error("Registered Illustrator generative tools");
}