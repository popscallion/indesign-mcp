// src/illustrator/tools/transform/index.ts

/**
 * @fileoverview Transformation and manipulation tools for Illustrator MCP
 * Basic operations for moving, scaling, rotating, and modifying objects
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScriptForApp } from "../../../extendscript.js";
import { wrapToolForTelemetry } from "../../../tools/index.js";
import { z } from "zod";

/**
 * Registers transformation-related tools with the MCP server
 */
export async function registerTransformTools(server: McpServer): Promise<void> {
  
  // Tool: apply_transformation
  // Complexity: 2.4 (Low)
  // Dependencies: select_elements
  server.tool(
    "apply_transformation",
    {
      transformType: z.enum(["move", "scale", "rotate", "reflect", "shear"]).describe("Type of transformation to apply"),
      useSelection: z.boolean().default(true).describe("Apply to selected items (true) or specific items (false)"),
      itemIndices: z.array(z.number()).optional().describe("Indices of items to transform (if not using selection)"),
      parameters: z.object({
        x: z.number().optional().describe("X parameter (move: delta X, scale: X factor)"),
        y: z.number().optional().describe("Y parameter (move: delta Y, scale: Y factor)"),
        angle: z.number().optional().describe("Rotation angle in degrees"),
        axis: z.enum(["horizontal", "vertical"]).optional().describe("Reflection axis"),
        shearAngle: z.number().optional().describe("Shear angle in degrees"),
        origin: z.object({
          x: z.number().describe("X coordinate of transformation origin"),
          y: z.number().describe("Y coordinate of transformation origin")
        }).optional().describe("Custom origin point for transformation")
      }).describe("Transformation parameters")
    },
    wrapToolForTelemetry("apply_transformation", async (args: any) => {
      const { transformType, useSelection = true, itemIndices = [], parameters = {} } = args;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var items = [];
          var transformedCount = 0;
          
          // Collect items to transform
          if (${useSelection}) {
            if (doc.selection.length === 0) {
              throw new Error("No items selected");
            }
            items = doc.selection;
          } else {
            var indices = [${itemIndices.join(',')}];
            for (var i = 0; i < indices.length; i++) {
              if (indices[i] < doc.pageItems.length) {
                items.push(doc.pageItems[indices[i]]);
              }
            }
          }
          
          if (items.length === 0) {
            throw new Error("No items to transform");
          }
          
          // Apply transformation to each item
          for (var j = 0; j < items.length; j++) {
            var item = items[j];
            
            switch("${transformType}") {
              case "move":
                var deltaX = ${parameters.x || 0};
                var deltaY = ${parameters.y || 0};
                item.translate(deltaX, deltaY);
                transformedCount++;
                break;
                
              case "scale":
                var scaleX = ${parameters.x || 1} * 100; // Convert to percentage
                var scaleY = ${parameters.y || 1} * 100;
                
                // Determine origin point
                var originX = ${parameters.origin?.x || 'item.left + item.width / 2'};
                var originY = ${parameters.origin?.y || 'item.top - item.height / 2'};
                
                // Scale around origin
                item.resize(
                  scaleX, // scaleX percentage
                  scaleY, // scaleY percentage
                  true,   // changePositions
                  true,   // changeFillPatterns
                  true,   // changeFillGradients
                  true,   // changeStrokePattern
                  scaleX, // changeLineWidths percentage
                  Transformation.CENTER
                );
                transformedCount++;
                break;
                
              case "rotate":
                var angle = ${parameters.angle || 0};
                
                // Calculate center if no origin specified
                var bounds = item.visibleBounds;
                var centerX = ${parameters.origin?.x || '(bounds[0] + bounds[2]) / 2'};
                var centerY = ${parameters.origin?.y || '(bounds[1] + bounds[3]) / 2'};
                
                item.rotate(
                  angle,    // angle
                  true,     // changePositions
                  true,     // changeFillPatterns
                  true,     // changeFillGradients
                  true,     // changeStrokePattern
                  Transformation.CENTER
                );
                transformedCount++;
                break;
                
              case "reflect":
                var axis = "${parameters.axis || 'horizontal'}";
                var bounds = item.visibleBounds;
                
                if (axis === "horizontal") {
                  // Reflect horizontally (flip along Y axis)
                  item.resize(
                    -100, // negative scaleX for horizontal flip
                    100,
                    true, true, true, true, 100,
                    Transformation.CENTER
                  );
                } else {
                  // Reflect vertically (flip along X axis)  
                  item.resize(
                    100,
                    -100, // negative scaleY for vertical flip
                    true, true, true, true, 100,
                    Transformation.CENTER
                  );
                }
                transformedCount++;
                break;
                
              case "shear":
                var shearAngle = ${parameters.shearAngle || 0};
                var shearMatrix = app.getIdentityMatrix();
                
                // Apply shear transformation
                shearMatrix.mValueC = Math.tan(shearAngle * Math.PI / 180); // Shear X
                item.transform(shearMatrix);
                transformedCount++;
                break;
            }
          }
          
          "Transformed " + transformedCount + " items with " + "${transformType}";
          
        } catch (e) {
          "Error: " + e.message;
        }
      `;
      
      const result = await executeExtendScriptForApp(script, 'illustrator');
      
      return {
        content: [{
          type: "text" as const,
          text: result.success ? result.result || "Transformation applied" : `Error: ${result.error}`
        }]
      };
    })
  );
  
  console.error("Registered Illustrator transform tools");
}