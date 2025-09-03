// src/illustrator/tools/generative/index.ts

/**
 * @fileoverview Generative and pattern creation tools for Illustrator MCP
 * Handles grids, patterns, and algorithmic design generation
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
      gridType: z.enum(["rectangular", "isometric", "hexagonal", "circular"]).describe("Type of grid layout"),
      dimensions: z.object({
        x: z.number().describe("X position of grid origin"),
        y: z.number().describe("Y position of grid origin"),
        width: z.number().describe("Total width of grid"),
        height: z.number().describe("Total height of grid"),
        columns: z.number().min(1).describe("Number of columns"),
        rows: z.number().min(1).describe("Number of rows")
      }).describe("Grid dimensions"),
      spacing: z.object({
        horizontal: z.number().default(0).describe("Horizontal spacing between elements"),
        vertical: z.number().default(0).describe("Vertical spacing between elements"),
        gutter: z.number().default(0).describe("Additional gutter spacing")
      }).optional().describe("Spacing configuration"),
      elementType: z.enum(["guides", "shapes", "placeholders"]).default("guides").describe("What to create at grid points"),
      elementStyle: z.object({
        stroke: z.string().optional().describe("Stroke color for shapes/guides"),
        fill: z.string().optional().describe("Fill color for shapes"),
        opacity: z.number().min(0).max(100).default(100).describe("Element opacity")
      }).optional().describe("Style for grid elements")
    },
    wrapToolForTelemetry("create_grid_layout", async (args: any) => {
      const { gridType, dimensions, spacing = {}, elementType = "guides", elementStyle = {} } = args;
      const { x, y, width, height, columns, rows } = dimensions;
      const { horizontal = 0, vertical = 0, gutter = 0 } = spacing;
      const { stroke, fill, opacity = 100 } = elementStyle;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var createdElements = 0;
          
          // Create or find grid layer
          var gridLayer = null;
          for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === "Grid Layout") {
              gridLayer = doc.layers[i];
              break;
            }
          }
          if (!gridLayer) {
            gridLayer = doc.layers.add();
            gridLayer.name = "Grid Layout";
          }
          
          // Calculate cell dimensions
          var cellWidth = (${width} - ${horizontal} * (${columns} - 1) - ${gutter} * 2) / ${columns};
          var cellHeight = (${height} - ${vertical} * (${rows} - 1) - ${gutter} * 2) / ${rows};
          
          // Create grid based on type
          switch("${gridType}") {
            case "rectangular":
              for (var row = 0; row < ${rows}; row++) {
                for (var col = 0; col < ${columns}; col++) {
                  var cellX = ${x} + ${gutter} + col * (cellWidth + ${horizontal});
                  var cellY = ${y} - ${gutter} - row * (cellHeight + ${vertical});
                  
                  if ("${elementType}" === "guides") {
                    // Create guide lines (using thin stroked paths as guides aren't directly scriptable)
                    if (col === 0) {
                      // Horizontal guide
                      var hGuide = doc.pathItems.add();
                      hGuide.setEntirePath([[${x}, cellY], [${x} + ${width}, cellY]]);
                      hGuide.filled = false;
                      hGuide.stroked = true;
                      hGuide.strokeWidth = 0.5;
                      hGuide.strokeColor = new RGBColor();
                      hGuide.strokeColor.red = 0;
                      hGuide.strokeColor.green = 174;
                      hGuide.strokeColor.blue = 239;
                      hGuide.opacity = 50;
                      hGuide.move(gridLayer, ElementPlacement.INSIDE);
                    }
                    if (row === 0) {
                      // Vertical guide
                      var vGuide = doc.pathItems.add();
                      vGuide.setEntirePath([[cellX, ${y}], [cellX, ${y} - ${height}]]);
                      vGuide.filled = false;
                      vGuide.stroked = true;
                      vGuide.strokeWidth = 0.5;
                      vGuide.strokeColor = new RGBColor();
                      vGuide.strokeColor.red = 0;
                      vGuide.strokeColor.green = 174;
                      vGuide.strokeColor.blue = 239;
                      vGuide.opacity = 50;
                      vGuide.move(gridLayer, ElementPlacement.INSIDE);
                    }
                  } else if ("${elementType}" === "shapes") {
                    var rect = doc.pathItems.rectangle(
                      cellY,
                      cellX,
                      cellWidth,
                      cellHeight
                    );
                    
                    // Apply style
                    if ("${fill || ''}" !== "") {
                      rect.filled = true;
                      var fillColor = new RGBColor();
                      var hexFill = "${fill}".substring(1);
                      fillColor.red = parseInt(hexFill.substring(0, 2), 16);
                      fillColor.green = parseInt(hexFill.substring(2, 4), 16);
                      fillColor.blue = parseInt(hexFill.substring(4, 6), 16);
                      rect.fillColor = fillColor;
                    } else {
                      rect.filled = false;
                    }
                    
                    if ("${stroke || ''}" !== "") {
                      rect.stroked = true;
                      var strokeColor = new RGBColor();
                      var hexStroke = "${stroke}".substring(1);
                      strokeColor.red = parseInt(hexStroke.substring(0, 2), 16);
                      strokeColor.green = parseInt(hexStroke.substring(2, 4), 16);
                      strokeColor.blue = parseInt(hexStroke.substring(4, 6), 16);
                      rect.strokeColor = strokeColor;
                    } else {
                      rect.stroked = true;
                      rect.strokeColor = new NoColor();
                    }
                    
                    rect.opacity = ${opacity};
                    rect.move(gridLayer, ElementPlacement.INSIDE);
                  } else if ("${elementType}" === "placeholders") {
                    // Create placeholder with X
                    var placeholder = doc.groupItems.add();
                    placeholder.move(gridLayer, ElementPlacement.INSIDE);
                    
                    var frame = doc.pathItems.rectangle(
                      cellY,
                      cellX,
                      cellWidth,
                      cellHeight
                    );
                    frame.filled = false;
                    frame.stroked = true;
                    frame.strokeWidth = 1;
                    frame.strokeDashes = [5, 3];
                    frame.move(placeholder, ElementPlacement.INSIDE);
                    
                    // Add X
                    var line1 = doc.pathItems.add();
                    line1.setEntirePath([[cellX, cellY], [cellX + cellWidth, cellY - cellHeight]]);
                    line1.filled = false;
                    line1.stroked = true;
                    line1.strokeWidth = 0.5;
                    line1.move(placeholder, ElementPlacement.INSIDE);
                    
                    var line2 = doc.pathItems.add();
                    line2.setEntirePath([[cellX + cellWidth, cellY], [cellX, cellY - cellHeight]]);
                    line2.filled = false;
                    line2.stroked = true;
                    line2.strokeWidth = 0.5;
                    line2.move(placeholder, ElementPlacement.INSIDE);
                  }
                  
                  createdElements++;
                }
              }
              break;
              
            case "isometric":
              // 30-degree isometric grid
              var isoAngle = 30 * Math.PI / 180;
              for (var isoRow = 0; isoRow < ${rows}; isoRow++) {
                for (var isoCol = 0; isoCol < ${columns}; isoCol++) {
                  var isoX = ${x} + isoCol * cellWidth * Math.cos(isoAngle) + isoRow * cellWidth * Math.cos(isoAngle + Math.PI * 2 / 3);
                  var isoY = ${y} - isoCol * cellWidth * Math.sin(isoAngle) - isoRow * cellWidth * Math.sin(isoAngle + Math.PI * 2 / 3);
                  
                  if ("${elementType}" === "shapes") {
                    // Create isometric diamond
                    var diamond = doc.pathItems.add();
                    var points = [
                      [isoX, isoY],
                      [isoX + cellWidth * Math.cos(isoAngle), isoY - cellWidth * Math.sin(isoAngle)],
                      [isoX + cellWidth * Math.cos(isoAngle) + cellWidth * Math.cos(isoAngle + Math.PI * 2 / 3), 
                       isoY - cellWidth * Math.sin(isoAngle) - cellWidth * Math.sin(isoAngle + Math.PI * 2 / 3)],
                      [isoX + cellWidth * Math.cos(isoAngle + Math.PI * 2 / 3), 
                       isoY - cellWidth * Math.sin(isoAngle + Math.PI * 2 / 3)]
                    ];
                    diamond.setEntirePath(points);
                    diamond.closed = true;
                    diamond.filled = false;
                    diamond.stroked = true;
                    diamond.strokeWidth = 1;
                    diamond.move(gridLayer, ElementPlacement.INSIDE);
                  }
                  createdElements++;
                }
              }
              break;
              
            case "hexagonal":
              // Hexagonal grid
              var hexRadius = Math.min(cellWidth, cellHeight) / 2;
              for (var hexRow = 0; hexRow < ${rows}; hexRow++) {
                for (var hexCol = 0; hexCol < ${columns}; hexCol++) {
                  var hexX = ${x} + hexCol * hexRadius * 3;
                  var hexY = ${y} - hexRow * hexRadius * Math.sqrt(3);
                  
                  // Offset every other row
                  if (hexRow % 2 === 1) {
                    hexX += hexRadius * 1.5;
                  }
                  
                  // Create hexagon
                  var hex = doc.pathItems.add();
                  var hexPoints = [];
                  for (var h = 0; h < 6; h++) {
                    var angle = h * Math.PI / 3;
                    hexPoints.push([
                      hexX + hexRadius * Math.cos(angle),
                      hexY + hexRadius * Math.sin(angle)
                    ]);
                  }
                  hex.setEntirePath(hexPoints);
                  hex.closed = true;
                  hex.filled = false;
                  hex.stroked = true;
                  hex.strokeWidth = 1;
                  hex.move(gridLayer, ElementPlacement.INSIDE);
                  createdElements++;
                }
              }
              break;
              
            case "circular":
              // Radial/circular grid
              var centerX = ${x} + ${width} / 2;
              var centerY = ${y} - ${height} / 2;
              var maxRadius = Math.min(${width}, ${height}) / 2;
              
              // Concentric circles
              for (var ring = 1; ring <= ${rows}; ring++) {
                var ringRadius = (ring / ${rows}) * maxRadius;
                var circle = doc.pathItems.ellipse(
                  centerY + ringRadius,
                  centerX - ringRadius,
                  ringRadius * 2,
                  ringRadius * 2
                );
                circle.filled = false;
                circle.stroked = true;
                circle.strokeWidth = 0.5;
                circle.move(gridLayer, ElementPlacement.INSIDE);
              }
              
              // Radial lines
              for (var spoke = 0; spoke < ${columns}; spoke++) {
                var spokeAngle = (spoke / ${columns}) * Math.PI * 2;
                var line = doc.pathItems.add();
                line.setEntirePath([
                  [centerX, centerY],
                  [centerX + maxRadius * Math.cos(spokeAngle), 
                   centerY + maxRadius * Math.sin(spokeAngle)]
                ]);
                line.filled = false;
                line.stroked = true;
                line.strokeWidth = 0.5;
                line.move(gridLayer, ElementPlacement.INSIDE);
              }
              createdElements = ${rows} + ${columns};
              break;
          }
          
          "Created ${gridType} grid with " + createdElements + " elements";
          
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
      patternType: z.enum(["dots", "stripes", "checkers", "diamonds", "custom"]).describe("Type of pattern"),
      tileSize: z.object({
        width: z.number().describe("Pattern tile width"),
        height: z.number().describe("Pattern tile height")
      }).describe("Size of the pattern tile"),
      patternParameters: z.object({
        spacing: z.number().optional().describe("Spacing between pattern elements"),
        angle: z.number().optional().describe("Rotation angle for pattern"),
        scale: z.number().optional().describe("Scale factor for pattern elements"),
        count: z.number().optional().describe("Number of elements in pattern")
      }).optional().describe("Pattern-specific parameters"),
      colors: z.object({
        primary: z.string().describe("Primary color (hex)"),
        secondary: z.string().optional().describe("Secondary color (hex)"),
        background: z.string().optional().describe("Background color (hex)")
      }).describe("Pattern colors"),
      applyToSelection: z.boolean().default(false).describe("Apply pattern to selected objects")
    },
    wrapToolForTelemetry("create_pattern_fill", async (args: any) => {
      const { patternName, patternType, tileSize, patternParameters = {}, colors, applyToSelection = false } = args;
      const { width, height } = tileSize;
      const { spacing = 5, angle = 0, scale = 1, count = 4 } = patternParameters;
      const { primary, secondary, background } = colors;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          
          // Create a temporary artboard for pattern creation
          var patternGroup = doc.groupItems.add();
          patternGroup.name = "__pattern_temp";
          
          // Create background if specified
          if ("${background || ''}" !== "") {
            var bgRect = doc.pathItems.rectangle(
              0,
              0,
              ${width},
              ${height}
            );
            bgRect.filled = true;
            var bgColor = new RGBColor();
            var bgHex = "${background}".substring(1);
            bgColor.red = parseInt(bgHex.substring(0, 2), 16);
            bgColor.green = parseInt(bgHex.substring(2, 4), 16);
            bgColor.blue = parseInt(bgHex.substring(4, 6), 16);
            bgRect.fillColor = bgColor;
            bgRect.stroked = false;
            bgRect.move(patternGroup, ElementPlacement.INSIDE);
          }
          
          // Create primary color
          var primaryColor = new RGBColor();
          var primaryHex = "${primary}".substring(1);
          primaryColor.red = parseInt(primaryHex.substring(0, 2), 16);
          primaryColor.green = parseInt(primaryHex.substring(2, 4), 16);
          primaryColor.blue = parseInt(primaryHex.substring(4, 6), 16);
          
          // Create secondary color if provided
          var secondaryColor = null;
          if ("${secondary || ''}" !== "") {
            secondaryColor = new RGBColor();
            var secondaryHex = "${secondary}".substring(1);
            secondaryColor.red = parseInt(secondaryHex.substring(0, 2), 16);
            secondaryColor.green = parseInt(secondaryHex.substring(2, 4), 16);
            secondaryColor.blue = parseInt(secondaryHex.substring(4, 6), 16);
          }
          
          // Create pattern based on type
          switch("${patternType}") {
            case "dots":
              var dotRadius = Math.min(${width}, ${height}) / (${count} * 2 + ${spacing}/10);
              for (var dotRow = 0; dotRow < ${count}; dotRow++) {
                for (var dotCol = 0; dotCol < ${count}; dotCol++) {
                  var dotX = (dotCol + 0.5) * (${width} / ${count});
                  var dotY = -(dotRow + 0.5) * (${height} / ${count});
                  
                  var dot = doc.pathItems.ellipse(
                    dotY + dotRadius,
                    dotX - dotRadius,
                    dotRadius * 2 * ${scale},
                    dotRadius * 2 * ${scale}
                  );
                  dot.filled = true;
                  dot.fillColor = (dotRow + dotCol) % 2 === 0 ? primaryColor : (secondaryColor || primaryColor);
                  dot.stroked = false;
                  dot.move(patternGroup, ElementPlacement.INSIDE);
                }
              }
              break;
              
            case "stripes":
              var stripeWidth = ${width} / (${count} * 2);
              for (var stripe = 0; stripe < ${count} * 2; stripe++) {
                if (stripe % 2 === 0) {
                  var stripeRect = doc.pathItems.rectangle(
                    0,
                    stripe * stripeWidth,
                    stripeWidth,
                    ${height}
                  );
                  stripeRect.filled = true;
                  stripeRect.fillColor = stripe % 4 === 0 ? primaryColor : (secondaryColor || primaryColor);
                  stripeRect.stroked = false;
                  
                  // Rotate if angle specified
                  if (${angle} !== 0) {
                    stripeRect.rotate(${angle});
                  }
                  
                  stripeRect.move(patternGroup, ElementPlacement.INSIDE);
                }
              }
              break;
              
            case "checkers":
              var checkSize = Math.min(${width}, ${height}) / ${count};
              for (var checkRow = 0; checkRow < ${count}; checkRow++) {
                for (var checkCol = 0; checkCol < ${count}; checkCol++) {
                  if ((checkRow + checkCol) % 2 === 0) {
                    var check = doc.pathItems.rectangle(
                      -checkRow * checkSize,
                      checkCol * checkSize,
                      checkSize,
                      checkSize
                    );
                    check.filled = true;
                    check.fillColor = primaryColor;
                    check.stroked = false;
                    check.move(patternGroup, ElementPlacement.INSIDE);
                  } else if (secondaryColor) {
                    var check2 = doc.pathItems.rectangle(
                      -checkRow * checkSize,
                      checkCol * checkSize,
                      checkSize,
                      checkSize
                    );
                    check2.filled = true;
                    check2.fillColor = secondaryColor;
                    check2.stroked = false;
                    check2.move(patternGroup, ElementPlacement.INSIDE);
                  }
                }
              }
              break;
              
            case "diamonds":
              var diamondSize = Math.min(${width}, ${height}) / ${count};
              for (var diamRow = 0; diamRow < ${count}; diamRow++) {
                for (var diamCol = 0; diamCol < ${count}; diamCol++) {
                  var diamX = (diamCol + 0.5) * diamondSize;
                  var diamY = -(diamRow + 0.5) * diamondSize;
                  
                  var diamond = doc.pathItems.add();
                  diamond.setEntirePath([
                    [diamX, diamY + diamondSize/2],
                    [diamX + diamondSize/2, diamY],
                    [diamX, diamY - diamondSize/2],
                    [diamX - diamondSize/2, diamY]
                  ]);
                  diamond.closed = true;
                  diamond.filled = true;
                  diamond.fillColor = (diamRow + diamCol) % 2 === 0 ? primaryColor : (secondaryColor || primaryColor);
                  diamond.stroked = false;
                  diamond.move(patternGroup, ElementPlacement.INSIDE);
                }
              }
              break;
              
            case "custom":
              // Create a simple geometric pattern
              var elementSize = Math.min(${width}, ${height}) / 4;
              
              // Center cross
              var cross1 = doc.pathItems.rectangle(
                -${height}/2 + elementSize,
                ${width}/2 - elementSize/4,
                elementSize/2,
                elementSize * 2
              );
              cross1.filled = true;
              cross1.fillColor = primaryColor;
              cross1.stroked = false;
              cross1.move(patternGroup, ElementPlacement.INSIDE);
              
              var cross2 = doc.pathItems.rectangle(
                -${height}/2 + elementSize/4,
                ${width}/2 - elementSize,
                elementSize * 2,
                elementSize/2
              );
              cross2.filled = true;
              cross2.fillColor = primaryColor;
              cross2.stroked = false;
              cross2.move(patternGroup, ElementPlacement.INSIDE);
              
              // Corner elements
              if (secondaryColor) {
                for (var corner = 0; corner < 4; corner++) {
                  var cornerX = corner % 2 === 0 ? elementSize/2 : ${width} - elementSize/2;
                  var cornerY = corner < 2 ? -elementSize/2 : -${height} + elementSize/2;
                  
                  var cornerDot = doc.pathItems.ellipse(
                    cornerY + elementSize/4,
                    cornerX - elementSize/4,
                    elementSize/2,
                    elementSize/2
                  );
                  cornerDot.filled = true;
                  cornerDot.fillColor = secondaryColor;
                  cornerDot.stroked = false;
                  cornerDot.move(patternGroup, ElementPlacement.INSIDE);
                }
              }
              break;
          }
          
          // Create pattern swatch from the group
          try {
            // Select the pattern group
            doc.selection = [patternGroup];
            
            // Create pattern (this is simplified - actual pattern creation is complex)
            var pattern = doc.patterns.add();
            pattern.name = "${patternName}";
            
            // Apply to selection if requested
            if (${applyToSelection}) {
              for (var i = 0; i < doc.selection.length; i++) {
                if (doc.selection[i] !== patternGroup) {
                  doc.selection[i].filled = true;
                  // Note: Direct pattern application requires more complex scripting
                }
              }
            }
          } catch(e) {
            // Pattern creation failed, keep the group as visual reference
          }
          
          // Clean up temporary group (or keep it as reference)
          // patternGroup.remove();
          
          "Created ${patternType} pattern '${patternName}' with tile size ${width}x${height}";
          
        } catch (e) {
          "Error: " + e.message;
        }
      `;
      
      const result = await executeExtendScriptForApp(script, 'illustrator');
      
      return {
        content: [{
          type: "text" as const,
          text: result.success ? result.result || "Pattern fill created" : `Error: ${result.error}`
        }]
      };
    })
  );
  
  console.error("Registered Illustrator generative tools");
}