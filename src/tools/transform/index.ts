/**
 * @fileoverview Object transformation and alignment tools for InDesign MCP
 * Batch 1.3: Object transformation - transform_objects, duplicate_objects, align_distribute_objects
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";
import type { TransformationType, AlignmentType, DistributionType, TransformValues } from "../../types.js";

/**
 * Registers all object transformation tools with the MCP server
 */
export async function registerTransformTools(server: McpServer): Promise<void> {
  // Register transform_objects tool
  server.tool(
    "transform_objects",
    {
      operation: z.enum(["move", "scale", "rotate", "skew"]).describe("Type of transformation to apply"),
      x: z.number().default(0).describe("X offset for move, X scale factor for scale, or X coordinate"),
      y: z.number().default(0).describe("Y offset for move, Y scale factor for scale, or Y coordinate"),
      rotation: z.number().default(0).describe("Rotation angle in degrees for rotate transformation"),
      scale_x: z.number().default(1.0).describe("X scale factor (1.0 = 100%)"),
      scale_y: z.number().default(1.0).describe("Y scale factor (1.0 = 100%)"),
      use_selection: z.boolean().default(true).describe("Transform only selected objects, or all objects if none selected")
    },
    async (args) => {
      const transformation: TransformationType = args.operation;
      const x = args.x || 0;
      const y = args.y || 0;
      const rotation = args.rotation || 0;
      const scaleX = args.scale_x || 1.0;
      const scaleY = args.scale_y || 1.0;
      const useSelection = args.use_selection !== false;

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        if (!doc) {
          throw new Error("No active document found.");
        }
        
        try {
          var objectsToTransform = [];
          
          if (${useSelection ? "true" : "false"} && app.selection.length > 0) {
            // Use selected objects
            for (var i = 0; i < app.selection.length; i++) {
              if (app.selection[i].hasOwnProperty('geometricBounds')) {
                objectsToTransform.push(app.selection[i]);
              }
            }
          } else {
            // Use all page items on current page
            var page = doc.pages[0];
            for (var i = 0; i < page.allPageItems.length; i++) {
              objectsToTransform.push(page.allPageItems[i]);
            }
          }
          
          if (objectsToTransform.length === 0) {
            throw new Error("No transformable objects found.");
          }
          
          var transformedCount = 0;
          
          for (var i = 0; i < objectsToTransform.length; i++) {
            var obj = objectsToTransform[i];
            
            switch ("${transformation}") {
              case "move":
                var currentBounds = obj.geometricBounds;
                obj.geometricBounds = [
                  currentBounds[0] + ${y},
                  currentBounds[1] + ${x},
                  currentBounds[2] + ${y},
                  currentBounds[3] + ${x}
                ];
                break;
                
              case "scale":
                var centerX = (obj.geometricBounds[1] + obj.geometricBounds[3]) / 2;
                var centerY = (obj.geometricBounds[0] + obj.geometricBounds[2]) / 2;
                obj.resize(CoordinateSpaces.INNER_COORDINATES, AnchorPoint.CENTER_ANCHOR, 
                          ResizeMethods.MULTIPLYING_CURRENT_DIMENSIONS_BY,
                          [${scaleX * 100}, ${scaleY * 100}]);
                break;
                
              case "rotate":
                var centerX = (obj.geometricBounds[1] + obj.geometricBounds[3]) / 2;
                var centerY = (obj.geometricBounds[0] + obj.geometricBounds[2]) / 2;
                obj.rotationAngle = ${rotation};
                break;
                
              case "skew":
                obj.shearAngle = ${x}; // Use x parameter for skew angle
                break;
            }
            
            transformedCount++;
          }
          
          "Successfully transformed " + transformedCount + " objects using ${transformation}";
          
        } catch (e) {
          throw new Error("Transform failed: " + e.message);
        }
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        return {
          content: [{
            type: "text",
            text: `Transform completed: ${result.result}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `Transform failed: ${result.error}`
          }]
        };
      }
    }
  );

  // Register duplicate_objects tool
  server.tool(
    "duplicate_objects",
    {
      offsetX: z.number().default(10).describe("X offset for duplicated objects"),
      offsetY: z.number().default(10).describe("Y offset for duplicated objects"),
      count: z.number().default(1).describe("Number of duplicates to create"),
      use_selection: z.boolean().default(true).describe("Duplicate only selected objects, or all objects if none selected")
    },
    async (args) => {
      const offsetX = args.offsetX || 10;
      const offsetY = args.offsetY || 10;
      const count = Math.max(1, Math.min(args.count || 1, 10)); // Limit to 10 duplicates
      const useSelection = args.use_selection !== false;

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        if (!doc) {
          throw new Error("No active document found.");
        }
        
        try {
          var objectsToDuplicate = [];
          
          if (${useSelection ? "true" : "false"} && app.selection.length > 0) {
            // Use selected objects
            for (var i = 0; i < app.selection.length; i++) {
              if (app.selection[i].hasOwnProperty('geometricBounds')) {
                objectsToDuplicate.push(app.selection[i]);
              }
            }
          } else {
            // Use all page items on current page
            var page = doc.pages[0];
            for (var i = 0; i < page.allPageItems.length; i++) {
              objectsToDuplicate.push(page.allPageItems[i]);
            }
          }
          
          if (objectsToDuplicate.length === 0) {
            throw new Error("No objects found to duplicate.");
          }
          
          var duplicatedCount = 0;
          
          for (var d = 0; d < ${count}; d++) {
            var currentOffsetX = ${offsetX} * (d + 1);
            var currentOffsetY = ${offsetY} * (d + 1);
            
            for (var i = 0; i < objectsToDuplicate.length; i++) {
              var obj = objectsToDuplicate[i];
              
              try {
                var duplicatedObj = obj.duplicate();
                
                // Move the duplicate
                var currentBounds = duplicatedObj.geometricBounds;
                duplicatedObj.geometricBounds = [
                  currentBounds[0] + currentOffsetY,
                  currentBounds[1] + currentOffsetX,
                  currentBounds[2] + currentOffsetY,
                  currentBounds[3] + currentOffsetX
                ];
                
                duplicatedCount++;
              } catch (dupError) {
                // Some objects might not be duplicatable, skip them
                continue;
              }
            }
          }
          
          "Successfully created " + duplicatedCount + " duplicates with offset [${offsetX}, ${offsetY}]";
          
        } catch (e) {
          throw new Error("Duplicate failed: " + e.message);
        }
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        return {
          content: [{
            type: "text",
            text: `Duplicate completed: ${result.result}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `Duplicate failed: ${result.error}`
          }]
        };
      }
    }
  );

  // Register align_distribute_objects tool
  server.tool(
    "align_distribute_objects",
    {
      operation: z.enum(["align", "distribute"]).describe("Alignment or distribution operation. REQUIRES: Must have 2+ objects pre-selected in InDesign before calling this tool."),
      alignment: z.enum(["left", "center", "right", "top", "middle", "bottom"]).optional().describe("Alignment type (for align operation)"),
      distribution: z.enum(["horizontal", "vertical"]).optional().describe("Distribution type (for distribute operation)"),
      use_page_bounds: z.boolean().default(false).describe("Align/distribute relative to page bounds instead of selection bounds")
    },
    async (args) => {
      const operation = args.operation;
      const alignment: AlignmentType = args.alignment || "left";
      const distribution: DistributionType = args.distribution || "horizontal";
      const usePageBounds = args.use_page_bounds || false;

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        if (!doc) {
          throw new Error("No active document found.");
        }
        
        if (app.selection.length < 2) {
          throw new Error("SELECTION REQUIRED: Please manually select 2 or more objects in InDesign before using align/distribute tools. Currently " + app.selection.length + " objects selected.");
        }
        
        try {
          var objects = [];
          for (var i = 0; i < app.selection.length; i++) {
            if (app.selection[i].hasOwnProperty('geometricBounds')) {
              objects.push(app.selection[i]);
            }
          }
          
          if (objects.length < 2) {
            throw new Error("SELECTION REQUIRED: Need at least 2 transformable objects (with geometricBounds) selected. Found " + objects.length + " transformable objects out of " + app.selection.length + " selected.");
          }
          
          var referenceBounds;
          if (${usePageBounds ? "true" : "false"}) {
            // Use page bounds as reference
            referenceBounds = doc.pages[0].bounds;
          } else {
            // Calculate bounds of all selected objects
            var minX = objects[0].geometricBounds[1];
            var minY = objects[0].geometricBounds[0];
            var maxX = objects[0].geometricBounds[3];
            var maxY = objects[0].geometricBounds[2];
            
            for (var i = 1; i < objects.length; i++) {
              var bounds = objects[i].geometricBounds;
              minX = Math.min(minX, bounds[1]);
              minY = Math.min(minY, bounds[0]);
              maxX = Math.max(maxX, bounds[3]);
              maxY = Math.max(maxY, bounds[2]);
            }
            referenceBounds = [minY, minX, maxY, maxX];
          }
          
          if ("${operation}" === "align") {
            // Perform alignment
            for (var i = 0; i < objects.length; i++) {
              var obj = objects[i];
              var bounds = obj.geometricBounds;
              var newBounds = bounds.slice(); // Copy array
              
              switch ("${alignment}") {
                case "left":
                  var offset = referenceBounds[1] - bounds[1];
                  newBounds[1] = referenceBounds[1];
                  newBounds[3] = bounds[3] + offset;
                  break;
                case "center":
                  var centerX = (referenceBounds[1] + referenceBounds[3]) / 2;
                  var objWidth = bounds[3] - bounds[1];
                  newBounds[1] = centerX - objWidth / 2;
                  newBounds[3] = centerX + objWidth / 2;
                  break;
                case "right":
                  var offset = referenceBounds[3] - bounds[3];
                  newBounds[1] = bounds[1] + offset;
                  newBounds[3] = referenceBounds[3];
                  break;
                case "top":
                  var offset = referenceBounds[0] - bounds[0];
                  newBounds[0] = referenceBounds[0];
                  newBounds[2] = bounds[2] + offset;
                  break;
                case "middle":
                  var centerY = (referenceBounds[0] + referenceBounds[2]) / 2;
                  var objHeight = bounds[2] - bounds[0];
                  newBounds[0] = centerY - objHeight / 2;
                  newBounds[2] = centerY + objHeight / 2;
                  break;
                case "bottom":
                  var offset = referenceBounds[2] - bounds[2];
                  newBounds[0] = bounds[0] + offset;
                  newBounds[2] = referenceBounds[2];
                  break;
              }
              
              obj.geometricBounds = newBounds;
            }
            
            "Successfully aligned " + objects.length + " objects to ${alignment}";
            
          } else if ("${operation}" === "distribute") {
            // Perform distribution
            if ("${distribution}" === "horizontal") {
              // Sort objects by X position
              objects.sort(function(a, b) {
                return a.geometricBounds[1] - b.geometricBounds[1];
              });
              
              var totalSpace = referenceBounds[3] - referenceBounds[1];
              var usedSpace = 0;
              for (var i = 0; i < objects.length; i++) {
                usedSpace += objects[i].geometricBounds[3] - objects[i].geometricBounds[1];
              }
              var spacing = (totalSpace - usedSpace) / (objects.length - 1);
              
              var currentX = referenceBounds[1];
              for (var i = 0; i < objects.length; i++) {
                var obj = objects[i];
                var bounds = obj.geometricBounds;
                var width = bounds[3] - bounds[1];
                var offset = currentX - bounds[1];
                
                obj.geometricBounds = [
                  bounds[0],
                  currentX,
                  bounds[2],
                  currentX + width
                ];
                
                currentX += width + spacing;
              }
            } else {
              // Vertical distribution
              objects.sort(function(a, b) {
                return a.geometricBounds[0] - b.geometricBounds[0];
              });
              
              var totalSpace = referenceBounds[2] - referenceBounds[0];
              var usedSpace = 0;
              for (var i = 0; i < objects.length; i++) {
                usedSpace += objects[i].geometricBounds[2] - objects[i].geometricBounds[0];
              }
              var spacing = (totalSpace - usedSpace) / (objects.length - 1);
              
              var currentY = referenceBounds[0];
              for (var i = 0; i < objects.length; i++) {
                var obj = objects[i];
                var bounds = obj.geometricBounds;
                var height = bounds[2] - bounds[0];
                var offset = currentY - bounds[0];
                
                obj.geometricBounds = [
                  currentY,
                  bounds[1],
                  currentY + height,
                  bounds[3]
                ];
                
                currentY += height + spacing;
              }
            }
            
            "Successfully distributed " + objects.length + " objects ${distribution}ly";
          }
          
        } catch (e) {
          throw new Error("Align/distribute failed: " + e.message);
        }
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        return {
          content: [{
            type: "text",
            text: `Align/distribute completed: ${result.result}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `Align/distribute failed: ${result.error}`
          }]
        };
      }
    }
  );
}