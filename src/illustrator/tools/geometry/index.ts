// src/illustrator/tools/geometry/index.ts

/**
 * @fileoverview Geometry and shape manipulation tools for Illustrator MCP
 * Foundation layer tools with minimal dependencies
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScriptForApp } from "../../../extendscript.js";
import { wrapToolForTelemetry } from "../../../tools/index.js";
import { z } from "zod";
import type { 
  SelectionCriteria, 
  ShapeType, 
  Point, 
  Dimensions, 
  StyleAttributes,
  DocumentInfo,
  MeasurementResult 
} from "../../types.js";

/**
 * Registers geometry-related tools with the MCP server
 */
export async function registerGeometryTools(server: McpServer): Promise<void> {
  
  // Tool: select_elements
  // Complexity: 1.6 (Low)
  // Dependencies: None
  server.tool(
    "select_elements",
    {
      criteria: z.object({
        type: z.enum(["path", "text", "group", "symbol", "all"]).optional().describe("Type of elements to select"),
        layer: z.string().optional().describe("Layer name to select from"),
        name: z.string().optional().describe("Element name pattern to match"),
        hasAttribute: z.string().optional().describe("Select elements with specific attribute (fill, stroke, etc.)")
      }).optional().describe("Selection criteria"),
      action: z.enum(["select", "add", "subtract", "deselect"]).default("select").describe("Selection action to perform")
    },
    wrapToolForTelemetry("select_elements", async (args: any) => {
      const criteria = args.criteria || {};
      const action = args.action || "select";
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var selectedCount = 0;
          var items = [];
          
          // Build item collection based on criteria
          if ("${criteria.type || 'all'}" === "all") {
            items = doc.pageItems;
          } else if ("${criteria.type || ''}" === "path") {
            items = doc.pathItems;
          } else if ("${criteria.type || ''}" === "text") {
            items = doc.textFrames;
          } else if ("${criteria.type || ''}" === "group") {
            items = doc.groupItems;
          } else if ("${criteria.type || ''}" === "symbol") {
            items = doc.symbolItems;
          }
          
          // Clear selection if action is "select"
          if ("${action}" === "select") {
            doc.selection = null;
          }
          
          var matchedItems = [];
          
          // Apply filters
          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var matches = true;
            
            // Layer filter
            if ("${criteria.layer || ''}" !== "" && item.layer.name !== "${criteria.layer || ''}") {
              matches = false;
            }
            
            // Name filter
            if ("${criteria.name || ''}" !== "" && item.name.indexOf("${criteria.name || ''}") === -1) {
              matches = false;
            }
            
            // Attribute filter
            if ("${criteria.hasAttribute || ''}" === "fill" && !item.filled) {
              matches = false;
            } else if ("${criteria.hasAttribute || ''}" === "stroke" && !item.stroked) {
              matches = false;
            }
            
            if (matches) {
              matchedItems.push(item);
              selectedCount++;
            }
          }
          
          // Apply selection action
          if ("${action}" === "select" || "${action}" === "add") {
            doc.selection = matchedItems;
          } else if ("${action}" === "subtract") {
            // Remove from current selection
            var newSelection = [];
            for (var j = 0; j < doc.selection.length; j++) {
              var isInMatched = false;
              for (var k = 0; k < matchedItems.length; k++) {
                if (doc.selection[j] === matchedItems[k]) {
                  isInMatched = true;
                  break;
                }
              }
              if (!isInMatched) {
                newSelection.push(doc.selection[j]);
              }
            }
            doc.selection = newSelection;
          } else if ("${action}" === "deselect") {
            doc.selection = null;
            selectedCount = 0;
          }
          
          "Selected " + selectedCount + " items";
          
        } catch (e) {
          "Error: " + e.message;
        }
      `;
      
      const result = await executeExtendScriptForApp(script, 'illustrator');
      
      return {
        content: [{
          type: "text" as const,
          text: result.success ? result.result || "Selection completed" : `Error: ${result.error}`
        }]
      };
    })
  );
  
  // Tool: create_shape_primitive
  // Complexity: 1.8 (Low)
  // Dependencies: None
  server.tool(
    "create_shape_primitive",
    {
      shapeType: z.enum(["rectangle", "ellipse", "polygon", "star", "line"]).describe("Type of shape to create"),
      position: z.object({
        x: z.number().describe("X coordinate"),
        y: z.number().describe("Y coordinate")
      }).describe("Position of the shape"),
      dimensions: z.object({
        width: z.number().optional().describe("Width of the shape"),
        height: z.number().optional().describe("Height of the shape"),
        radius: z.number().optional().describe("Radius for circles or polygons")
      }).optional().describe("Dimensions of the shape"),
      attributes: z.object({
        fill: z.string().optional().describe("Fill color (hex or name)"),
        stroke: z.string().optional().describe("Stroke color (hex or name)"),
        strokeWidth: z.number().optional().describe("Stroke width in points")
      }).optional().describe("Visual attributes")
    },
    wrapToolForTelemetry("create_shape_primitive", async (args: any) => {
      const { shapeType, position, dimensions = {}, attributes = {} } = args;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var shape = null;
          
          // Create shape based on type
          if ("${shapeType}" === "rectangle") {
            shape = doc.pathItems.rectangle(
              ${position.y}, // top
              ${position.x}, // left
              ${dimensions.width || 100}, // width
              ${dimensions.height || 100} // height
            );
          } else if ("${shapeType}" === "ellipse") {
            shape = doc.pathItems.ellipse(
              ${position.y}, // top
              ${position.x}, // left
              ${dimensions.width || 100}, // width
              ${dimensions.height || 100} // height
            );
          } else if ("${shapeType}" === "star") {
            shape = doc.pathItems.star(
              ${position.x + (dimensions.radius || 50)}, // centerX
              ${position.y - (dimensions.radius || 50)}, // centerY
              ${dimensions.radius || 50}, // radius
              ${dimensions.radius ? dimensions.radius / 2 : 25}, // innerRadius
              5, // points
              false // reversed
            );
          } else if ("${shapeType}" === "polygon") {
            shape = doc.pathItems.add();
            var sides = 6; // Default hexagon
            var radius = ${dimensions.radius || 50};
            var centerX = ${position.x + (dimensions.radius || 50)};
            var centerY = ${position.y - (dimensions.radius || 50)};
            
            for (var i = 0; i < sides; i++) {
              var angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
              var x = centerX + radius * Math.cos(angle);
              var y = centerY + radius * Math.sin(angle);
              
              var point = shape.pathPoints.add();
              point.anchor = [x, y];
              point.leftDirection = point.anchor;
              point.rightDirection = point.anchor;
              point.pointType = PointType.CORNER;
            }
            shape.closed = true;
          } else if ("${shapeType}" === "line") {
            shape = doc.pathItems.add();
            var point1 = shape.pathPoints.add();
            point1.anchor = [${position.x}, ${position.y}];
            point1.leftDirection = point1.anchor;
            point1.rightDirection = point1.anchor;
            
            var point2 = shape.pathPoints.add();
            point2.anchor = [
              ${position.x + (dimensions.width || 100)},
              ${position.y - (dimensions.height || 0)}
            ];
            point2.leftDirection = point2.anchor;
            point2.rightDirection = point2.anchor;
            
            shape.closed = false;
          }
          
          if (shape) {
            // Apply attributes
            if ("${attributes.fill || ''}" !== "") {
              shape.filled = true;
              // Parse hex color
              var fillColor = "${attributes.fill || ''}";
              if (fillColor.charAt(0) === '#') {
                var rgbColor = new RGBColor();
                var hex = fillColor.substring(1);
                rgbColor.red = parseInt(hex.substring(0, 2), 16);
                rgbColor.green = parseInt(hex.substring(2, 4), 16);
                rgbColor.blue = parseInt(hex.substring(4, 6), 16);
                shape.fillColor = rgbColor;
              }
            } else {
              shape.filled = false;
            }
            
            if ("${attributes.stroke || ''}" !== "") {
              shape.stroked = true;
              var strokeColor = "${attributes.stroke || ''}";
              if (strokeColor.charAt(0) === '#') {
                var rgbStroke = new RGBColor();
                var hexStroke = strokeColor.substring(1);
                rgbStroke.red = parseInt(hexStroke.substring(0, 2), 16);
                rgbStroke.green = parseInt(hexStroke.substring(2, 4), 16);
                rgbStroke.blue = parseInt(hexStroke.substring(4, 6), 16);
                shape.strokeColor = rgbStroke;
              }
              
              if (${attributes.strokeWidth || 0} > 0) {
                shape.strokeWidth = ${attributes.strokeWidth || 1};
              }
            } else {
              shape.stroked = false;
            }
            
            "Created " + "${shapeType}" + " at (" + ${position.x} + ", " + ${position.y} + ")";
          } else {
            "Failed to create shape";
          }
          
        } catch (e) {
          "Error: " + e.message;
        }
      `;
      
      const result = await executeExtendScriptForApp(script, 'illustrator');
      
      return {
        content: [{
          type: "text" as const,
          text: result.success ? result.result || "Shape created" : `Error: ${result.error}`
        }]
      };
    })
  );
  
  // Tool: measure_relationships
  // Complexity: 1.8 (Low)
  // Dependencies: None
  server.tool(
    "measure_relationships",
    {
      measurementType: z.enum(["distance", "angle", "bounds", "overlap"]).describe("Type of measurement to perform"),
      useSelection: z.boolean().default(true).describe("Use currently selected items (requires 2 items for distance/angle)"),
      item1Index: z.number().optional().describe("Index of first item (if not using selection)"),
      item2Index: z.number().optional().describe("Index of second item (if not using selection)")
    },
    wrapToolForTelemetry("measure_relationships", async (args: any) => {
      const { measurementType, useSelection = true, item1Index, item2Index } = args;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var item1 = null;
          var item2 = null;
          
          if (${useSelection}) {
            if (doc.selection.length < 1) {
              throw new Error("Please select at least one item");
            }
            item1 = doc.selection[0];
            if (doc.selection.length > 1) {
              item2 = doc.selection[1];
            }
          } else {
            if (${item1Index !== undefined}) {
              item1 = doc.pageItems[${item1Index}];
            }
            if (${item2Index !== undefined}) {
              item2 = doc.pageItems[${item2Index}];
            }
          }
          
          if (!item1) {
            throw new Error("No item to measure");
          }
          
          var result = "";
          
          if ("${measurementType}" === "bounds") {
            var bounds = item1.visibleBounds;
            result = "Bounds: Left=" + bounds[0].toFixed(2) + 
                    ", Top=" + bounds[1].toFixed(2) + 
                    ", Right=" + bounds[2].toFixed(2) + 
                    ", Bottom=" + bounds[3].toFixed(2) +
                    ", Width=" + (bounds[2] - bounds[0]).toFixed(2) +
                    ", Height=" + (bounds[1] - bounds[3]).toFixed(2);
                    
          } else if ("${measurementType}" === "distance" && item2) {
            var bounds1 = item1.visibleBounds;
            var bounds2 = item2.visibleBounds;
            
            var center1X = (bounds1[0] + bounds1[2]) / 2;
            var center1Y = (bounds1[1] + bounds1[3]) / 2;
            var center2X = (bounds2[0] + bounds2[2]) / 2;
            var center2Y = (bounds2[1] + bounds2[3]) / 2;
            
            var distance = Math.sqrt(
              Math.pow(center2X - center1X, 2) + 
              Math.pow(center2Y - center1Y, 2)
            );
            
            result = "Distance: " + distance.toFixed(2) + " points";
            
          } else if ("${measurementType}" === "angle" && item2) {
            var bounds1 = item1.visibleBounds;
            var bounds2 = item2.visibleBounds;
            
            var center1X = (bounds1[0] + bounds1[2]) / 2;
            var center1Y = (bounds1[1] + bounds1[3]) / 2;
            var center2X = (bounds2[0] + bounds2[2]) / 2;
            var center2Y = (bounds2[1] + bounds2[3]) / 2;
            
            var angle = Math.atan2(center2Y - center1Y, center2X - center1X) * 180 / Math.PI;
            
            result = "Angle: " + angle.toFixed(2) + " degrees";
            
          } else if ("${measurementType}" === "overlap" && item2) {
            var bounds1 = item1.visibleBounds;
            var bounds2 = item2.visibleBounds;
            
            var overlaps = !(bounds1[2] < bounds2[0] || bounds2[2] < bounds1[0] || 
                           bounds1[3] > bounds2[1] || bounds2[3] > bounds1[1]);
            
            result = "Overlap: " + (overlaps ? "Yes" : "No");
          } else {
            result = "Measurement requires appropriate selection";
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
          text: result.success ? result.result || "Measurement completed" : `Error: ${result.error}`
        }]
      };
    })
  );
  
  console.error("Registered Illustrator geometry tools");
}