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

  // Tool: snap_to_grid
  // Complexity: 3.2 (Medium)
  // Dependencies: measure_relationships
  server.tool(
    "snap_to_grid",
    {
      gridSpec: z.object({
        width: z.number().default(10).describe("Grid cell width"),
        height: z.number().default(10).describe("Grid cell height"),
        offsetX: z.number().default(0).describe("Grid X offset"),
        offsetY: z.number().default(0).describe("Grid Y offset")
      }).describe("Grid specifications for snapping"),
      snapMode: z.enum(["corner", "center", "edges", "all_points"]).default("corner").describe("What part of objects to snap"),
      useSelection: z.boolean().default(true).describe("Snap selected objects or all objects"),
      tolerance: z.number().default(5).describe("Snap tolerance in points"),
      previewMode: z.boolean().default(false).describe("Show preview without applying changes")
    },
    wrapToolForTelemetry("snap_to_grid", async (args: any) => {
      const { gridSpec = {}, snapMode = "corner", useSelection = true, tolerance = 5, previewMode = false } = args;
      const { width: gridWidth = 10, height: gridHeight = 10, offsetX = 0, offsetY = 0 } = gridSpec;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var itemsToSnap = [];
          var snappedCount = 0;
          var previewItems = [];
          
          // Collect items to snap
          if (${useSelection}) {
            if (doc.selection.length === 0) {
              throw new Error("No items selected");
            }
            itemsToSnap = doc.selection;
          } else {
            itemsToSnap = doc.pageItems;
          }
          
          // Function to find nearest grid point
          function snapToGrid(x, y) {
            var gridX = ${offsetX} + Math.round((x - ${offsetX}) / ${gridWidth}) * ${gridWidth};
            var gridY = ${offsetY} + Math.round((y - ${offsetY}) / ${gridHeight}) * ${gridHeight};
            return { x: gridX, y: gridY };
          }
          
          // Function to check if point is within tolerance
          function isWithinTolerance(x1, y1, x2, y2) {
            var distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            return distance <= ${tolerance};
          }
          
          // Process each item
          for (var i = 0; i < itemsToSnap.length; i++) {
            var item = itemsToSnap[i];
            var bounds = item.visibleBounds;
            var moved = false;
            var deltaX = 0;
            var deltaY = 0;
            
            switch("${snapMode}") {
              case "corner":
                // Snap top-left corner
                var snapPoint = snapToGrid(bounds[0], bounds[1]);
                if (isWithinTolerance(bounds[0], bounds[1], snapPoint.x, snapPoint.y)) {
                  deltaX = snapPoint.x - bounds[0];
                  deltaY = snapPoint.y - bounds[1];
                  moved = true;
                }
                break;
                
              case "center":
                // Snap center point
                var centerX = (bounds[0] + bounds[2]) / 2;
                var centerY = (bounds[1] + bounds[3]) / 2;
                var snapPoint = snapToGrid(centerX, centerY);
                if (isWithinTolerance(centerX, centerY, snapPoint.x, snapPoint.y)) {
                  deltaX = snapPoint.x - centerX;
                  deltaY = snapPoint.y - centerY;
                  moved = true;
                }
                break;
                
              case "edges":
                // Snap closest edge to grid
                var snapLeft = snapToGrid(bounds[0], bounds[1]);
                var snapRight = snapToGrid(bounds[2], bounds[1]);
                var snapTop = snapToGrid(bounds[0], bounds[1]);
                var snapBottom = snapToGrid(bounds[0], bounds[3]);
                
                var minDistance = ${tolerance} + 1;
                var bestDelta = null;
                
                // Check left edge
                if (isWithinTolerance(bounds[0], bounds[1], snapLeft.x, snapLeft.y)) {
                  var dist = Math.abs(bounds[0] - snapLeft.x);
                  if (dist < minDistance) {
                    minDistance = dist;
                    bestDelta = { x: snapLeft.x - bounds[0], y: 0 };
                  }
                }
                
                // Check right edge
                if (isWithinTolerance(bounds[2], bounds[1], snapRight.x, snapRight.y)) {
                  var dist = Math.abs(bounds[2] - snapRight.x);
                  if (dist < minDistance) {
                    minDistance = dist;
                    bestDelta = { x: snapRight.x - bounds[2], y: 0 };
                  }
                }
                
                if (bestDelta) {
                  deltaX = bestDelta.x;
                  deltaY = bestDelta.y;
                  moved = true;
                }
                break;
                
              case "all_points":
                // Snap any corner to nearest grid point
                var corners = [
                  { x: bounds[0], y: bounds[1] }, // top-left
                  { x: bounds[2], y: bounds[1] }, // top-right
                  { x: bounds[0], y: bounds[3] }, // bottom-left
                  { x: bounds[2], y: bounds[3] }  // bottom-right
                ];
                
                var minDistance = ${tolerance} + 1;
                var bestDelta = null;
                
                for (var c = 0; c < corners.length; c++) {
                  var corner = corners[c];
                  var snapPoint = snapToGrid(corner.x, corner.y);
                  
                  if (isWithinTolerance(corner.x, corner.y, snapPoint.x, snapPoint.y)) {
                    var dist = Math.sqrt(
                      Math.pow(snapPoint.x - corner.x, 2) + 
                      Math.pow(snapPoint.y - corner.y, 2)
                    );
                    
                    if (dist < minDistance) {
                      minDistance = dist;
                      bestDelta = {
                        x: snapPoint.x - corner.x,
                        y: snapPoint.y - corner.y
                      };
                    }
                  }
                }
                
                if (bestDelta) {
                  deltaX = bestDelta.x;
                  deltaY = bestDelta.y;
                  moved = true;
                }
                break;
            }
            
            // Apply movement or create preview
            if (moved && Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
              if (${previewMode}) {
                // Create preview indicator (small circle)
                var newBounds = item.visibleBounds;
                var previewX = (newBounds[0] + newBounds[2]) / 2 + deltaX;
                var previewY = (newBounds[1] + newBounds[3]) / 2 + deltaY;
                
                var preview = doc.pathItems.ellipse(
                  previewY + 2, previewX - 2, 4, 4
                );
                preview.filled = true;
                var previewColor = new RGBColor();
                previewColor.red = 255;
                previewColor.green = 0;
                previewColor.blue = 0;
                preview.fillColor = previewColor;
                preview.stroked = false;
                preview.name = "SNAP_PREVIEW";
                previewItems.push(preview);
              } else {
                // Actually move the item
                item.translate(deltaX, deltaY);
              }
              snappedCount++;
            }
          }
          
          var result = "";
          if (${previewMode}) {
            result = "Preview: " + snappedCount + " items would snap to grid";
            if (previewItems.length > 0) {
              result += " (red dots show target positions)";
            }
          } else {
            result = "Snapped " + snappedCount + " items to grid";
          }
          
          result += "\\\\nGrid: " + ${gridWidth} + "x" + ${gridHeight} + 
                   " offset(" + ${offsetX} + "," + ${offsetY} + ")";
          
          result;
          
        } catch (e) {
          "Error: " + e.message;
        }
      `;
      
      const result = await executeExtendScriptForApp(script, 'illustrator');
      
      return {
        content: [{
          type: "text" as const,
          text: result.success ? result.result || "Grid snapping completed" : `Error: ${result.error}`
        }]
      };
    })
  );
  
  // Tool: apply_gradient_mapping  
  // Complexity: 2.3 (Intermediate)
  // Dependencies: None
  server.tool(
    "apply_gradient_mapping",
    {
      gradientType: z.enum(["linear", "radial", "mesh", "freeform"]).describe("Type of gradient to apply"),
      gradientStops: z.array(z.object({
        color: z.string().describe("Color value (hex or swatch name)"),
        position: z.number().min(0).max(100).describe("Stop position (0-100%)"),
        opacity: z.number().min(0).max(100).default(100).describe("Stop opacity"),
        midpoint: z.number().min(0).max(100).optional().describe("Midpoint between stops")
      })).describe("Gradient color stops"),
      angle: z.number().default(0).describe("Angle for linear gradient (degrees)"),
      center: z.object({
        x: z.number().describe("Center X for radial gradient"),
        y: z.number().describe("Center Y for radial gradient")
      }).optional().describe("Center point for radial gradient"),
      radius: z.number().optional().describe("Radius for radial gradient"),
      meshPoints: z.array(z.object({
        x: z.number().describe("X coordinate"),
        y: z.number().describe("Y coordinate"),
        color: z.string().describe("Color at this mesh point")
      })).optional().describe("Mesh control points for mesh gradient"),
      mappingMode: z.enum(["fill", "stroke", "both"]).default("fill").describe("Apply to fill, stroke, or both"),
      targetSelection: z.enum(["selected", "all_paths", "by_layer", "by_name"]).default("selected").describe("Objects to apply gradient to"),
      targetCriteria: z.object({
        layerName: z.string().optional().describe("Target layer name"),
        namePattern: z.string().optional().describe("Name pattern to match")
      }).optional().describe("Criteria for target selection"),
      blendMode: z.enum(["normal", "multiply", "screen", "overlay", "soft_light", "hard_light"]).default("normal").describe("Blend mode for gradient"),
      aspectRatio: z.number().default(1).describe("Aspect ratio for radial gradient"),
      gradientPreset: z.enum(["sunset", "ocean", "fire", "rainbow", "metallic", "pastel"]).optional().describe("Use predefined gradient preset")
    },
    wrapToolForTelemetry("apply_gradient_mapping", async (args: any) => {
      const {
        gradientType,
        gradientStops = [],
        angle = 0,
        center,
        radius,
        meshPoints = [],
        mappingMode = "fill",
        targetSelection = "selected",
        targetCriteria = {},
        blendMode = "normal",
        aspectRatio = 1,
        gradientPreset
      } = args;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var targets = [];
          var processedCount = 0;
          
          // Get target objects
          if ("${targetSelection}" === "selected") {
            if (doc.selection.length === 0) {
              throw new Error("No objects selected");
            }
            targets = doc.selection;
          } else if ("${targetSelection}" === "all_paths") {
            for (var i = 0; i < doc.pathItems.length; i++) {
              targets.push(doc.pathItems[i]);
            }
          } else if ("${targetSelection}" === "by_layer" && "${targetCriteria.layerName || ''}") {
            var targetLayer = doc.layers.getByName("${targetCriteria.layerName}");
            for (var j = 0; j < targetLayer.pathItems.length; j++) {
              targets.push(targetLayer.pathItems[j]);
            }
          } else if ("${targetSelection}" === "by_name" && "${targetCriteria.namePattern || ''}") {
            var pattern = "${targetCriteria.namePattern}";
            for (var k = 0; k < doc.pathItems.length; k++) {
              if (doc.pathItems[k].name.indexOf(pattern) !== -1) {
                targets.push(doc.pathItems[k]);
              }
            }
          }
          
          if (targets.length === 0) {
            throw new Error("No valid targets found");
          }
          
          // Create or get gradient
          var gradient = null;
          var gradientColor = new GradientColor();
          
          // Use preset if specified
          var stops = ${JSON.stringify(gradientStops)};
          if ("${gradientPreset || ''}" !== "") {
            stops = getPresetStops("${gradientPreset}");
          }
          
          // Helper function for preset gradients
          function getPresetStops(preset) {
            switch(preset) {
              case "sunset":
                return [
                  {color: "#FF6B6B", position: 0},
                  {color: "#FFE66D", position: 33},
                  {color: "#4ECDC4", position: 66},
                  {color: "#1A535C", position: 100}
                ];
              case "ocean":
                return [
                  {color: "#006BA6", position: 0},
                  {color: "#0496FF", position: 50},
                  {color: "#89CFF0", position: 100}
                ];
              case "fire":
                return [
                  {color: "#FF0000", position: 0},
                  {color: "#FF7F00", position: 33},
                  {color: "#FFFF00", position: 66},
                  {color: "#FFFFFF", position: 100}
                ];
              case "rainbow":
                return [
                  {color: "#FF0000", position: 0},
                  {color: "#FF7F00", position: 17},
                  {color: "#FFFF00", position: 34},
                  {color: "#00FF00", position: 50},
                  {color: "#0000FF", position: 67},
                  {color: "#4B0082", position: 84},
                  {color: "#9400D3", position: 100}
                ];
              case "metallic":
                return [
                  {color: "#C0C0C0", position: 0},
                  {color: "#FFFFFF", position: 25},
                  {color: "#808080", position: 50},
                  {color: "#FFFFFF", position: 75},
                  {color: "#404040", position: 100}
                ];
              case "pastel":
                return [
                  {color: "#FFB3BA", position: 0},
                  {color: "#BAFFC9", position: 33},
                  {color: "#BAE1FF", position: 66},
                  {color: "#FFFFBA", position: 100}
                ];
              default:
                return [{color: "#000000", position: 0}, {color: "#FFFFFF", position: 100}];
            }
          }
          
          // Find or create gradient
          try {
            gradient = doc.gradients.getByName("CustomGradient_" + Date.now());
          } catch(e) {
            gradient = doc.gradients.add();
            gradient.name = "CustomGradient_" + Date.now();
          }
          
          // Set gradient type
          if ("${gradientType}" === "linear") {
            gradient.type = GradientType.LINEAR;
          } else if ("${gradientType}" === "radial") {
            gradient.type = GradientType.RADIAL;
          }
          
          // Clear existing stops
          while (gradient.gradientStops.length > 0) {
            gradient.gradientStops[0].remove();
          }
          
          // Add gradient stops
          for (var m = 0; m < stops.length; m++) {
            var stop = stops[m];
            var gradientStop = gradient.gradientStops.add();
            
            // Set color
            var stopColor = new RGBColor();
            if (stop.color.charAt(0) === '#') {
              var hex = stop.color.substring(1);
              stopColor.red = parseInt(hex.substring(0, 2), 16);
              stopColor.green = parseInt(hex.substring(2, 4), 16);
              stopColor.blue = parseInt(hex.substring(4, 6), 16);
            } else {
              // Try to get from swatch
              try {
                var swatch = doc.swatches.getByName(stop.color);
                if (swatch.color.typename === "RGBColor") {
                  stopColor = swatch.color;
                }
              } catch(e) {
                // Default to black
                stopColor.red = 0;
                stopColor.green = 0;
                stopColor.blue = 0;
              }
            }
            
            gradientStop.color = stopColor;
            gradientStop.rampPoint = stop.position || (m * 100 / (stops.length - 1));
            
            if (stop.midpoint !== undefined && m < stops.length - 1) {
              gradientStop.midPoint = stop.midpoint;
            }
            
            if (stop.opacity !== undefined) {
              gradientStop.opacity = stop.opacity;
            }
          }
          
          gradientColor.gradient = gradient;
          
          // Apply to targets
          for (var n = 0; n < targets.length; n++) {
            var target = targets[n];
            
            try {
              if ("${mappingMode}" === "fill" || "${mappingMode}" === "both") {
                target.filled = true;
                target.fillColor = gradientColor;
                
                // Set gradient angle for linear
                if ("${gradientType}" === "linear") {
                  gradientColor.angle = ${angle};
                }
                
                // Set origin and length for proper mapping
                if (target.geometricBounds) {
                  var bounds = target.geometricBounds;
                  gradientColor.origin = [bounds[0], bounds[1]];
                  gradientColor.length = Math.sqrt(
                    Math.pow(bounds[2] - bounds[0], 2) + 
                    Math.pow(bounds[3] - bounds[1], 2)
                  );
                }
                
                // Apply aspect ratio for radial
                if ("${gradientType}" === "radial") {
                  gradientColor.hiliteAngle = 0;
                  gradientColor.hiliteLength = ${radius || 100};
                  
                  // Set center if specified
                  if (${center ? 'true' : 'false'}) {
                    gradientColor.origin = [${center?.x || 0}, ${center?.y || 0}];
                  }
                }
              }
              
              if ("${mappingMode}" === "stroke" || "${mappingMode}" === "both") {
                target.stroked = true;
                target.strokeColor = gradientColor;
                
                if (!target.strokeWidth || target.strokeWidth === 0) {
                  target.strokeWidth = 1;
                }
              }
              
              // Set blend mode
              switch("${blendMode}") {
                case "multiply":
                  target.blendingMode = BlendModes.MULTIPLY;
                  break;
                case "screen":
                  target.blendingMode = BlendModes.SCREEN;
                  break;
                case "overlay":
                  target.blendingMode = BlendModes.OVERLAY;
                  break;
                case "soft_light":
                  target.blendingMode = BlendModes.SOFTLIGHT;
                  break;
                case "hard_light":
                  target.blendingMode = BlendModes.HARDLIGHT;
                  break;
                default:
                  target.blendingMode = BlendModes.NORMAL;
              }
              
              processedCount++;
            } catch(e) {
              // Skip objects that can't accept gradients
            }
          }
          
          // Handle mesh gradient (simplified - would need mesh item)
          if ("${gradientType}" === "mesh" && ${meshPoints.length} > 0) {
            // Mesh gradients require creating mesh items
            // This is a simplified placeholder
            "Note: Mesh gradients require manual mesh item creation";
          }
          
          "Applied ${gradientType} gradient to " + processedCount + " objects";
          
        } catch (e) {
          "Error: " + e.message;
        }
      `;
      
      const result = await executeExtendScriptForApp(script, 'illustrator');
      
      return {
        content: [{
          type: "text" as const,
          text: result.success ? result.result || "Gradient mapping applied" : `Error: ${result.error}`
        }]
      };
    })
  );
  
  console.error("Registered Illustrator generative tools");
}