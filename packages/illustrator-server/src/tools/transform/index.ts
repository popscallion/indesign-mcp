// src/illustrator/tools/transform/index.ts

/**
 * @fileoverview Transformation and manipulation tools for Illustrator MCP
 * Basic operations for moving, scaling, rotating, and modifying objects
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScriptForApp } from "@mcp/shared/extendscript.js";
import { wrapToolForTelemetry } from "@mcp/shared/telemetryWrapper.js";
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
  
  // Tool: apply_envelope_distortion
  // Complexity: 4.0 (High)
  // Dependencies: select_elements
  server.tool(
    "apply_envelope_distortion",
    {
      envelopeType: z.enum(["warp", "mesh", "object", "preset"]).describe("Type of envelope distortion"),
      target: z.enum(["selection", "layer", "group"]).default("selection"),
      presetName: z.string().optional().describe("Name of preset warp (arc, bulge, flag, wave, etc.)"),
      meshGrid: z.object({
        rows: z.number().min(2).max(50).default(4).describe("Number of mesh rows"),
        columns: z.number().min(2).max(50).default(4).describe("Number of mesh columns")
      }).optional().describe("Mesh grid settings"),
      warpOptions: z.object({
        bendAmount: z.number().min(-100).max(100).default(50).describe("Bend amount percentage"),
        horizontalDistortion: z.number().min(-100).max(100).default(0),
        verticalDistortion: z.number().min(-100).max(100).default(0),
        style: z.enum(["arc", "arc_lower", "arc_upper", "arch", "bulge", "shell_lower", "shell_upper", "flag", "wave", "fish", "rise", "fisheye", "inflate", "squeeze", "twist"]).optional()
      }).optional(),
      expandAppearance: z.boolean().default(false).describe("Expand the envelope after applying")
    },
    wrapToolForTelemetry("apply_envelope_distortion", async (args: any) => {
      const { envelopeType, target = "selection", presetName, meshGrid = {}, warpOptions = {}, expandAppearance = false } = args;
      const { rows = 4, columns = 4 } = meshGrid;
      const { bendAmount = 50, horizontalDistortion = 0, verticalDistortion = 0, style } = warpOptions;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var targets = [];
          
          // Get target objects
          switch ("${target}") {
            case "selection":
              targets = app.selection;
              break;
            case "layer":
              if (doc.activeLayer) {
                targets = doc.activeLayer.pageItems;
              }
              break;
            case "group":
              for (var i = 0; i < app.selection.length; i++) {
                if (app.selection[i].typename === "GroupItem") {
                  targets.push(app.selection[i]);
                }
              }
              break;
          }
          
          if (targets.length === 0) {
            throw new Error("No objects selected for envelope distortion");
          }
          
          var processedCount = 0;
          
          for (var i = 0; i < targets.length; i++) {
            var item = targets[i];
            
            // Create envelope based on type
            switch ("${envelopeType}") {
              case "warp":
                // Apply warp transformation
                var warpStyle = ${style ? '"' + style + '"' : '"arc"'};
                
                // Note: Actual envelope API would be more complex
                // This is a simplified version using transformations
                if (warpStyle === "arc" || warpStyle === "arch") {
                  // Simulate arc distortion with path manipulation
                  if (item.typename === "PathItem") {
                    var bounds = item.geometricBounds;
                    var width = bounds[2] - bounds[0];
                    var height = bounds[1] - bounds[3];
                    var centerX = bounds[0] + width / 2;
                    
                    // Apply bend to path points
                    for (var j = 0; j < item.pathPoints.length; j++) {
                      var point = item.pathPoints[j];
                      var x = point.anchor[0];
                      var y = point.anchor[1];
                      
                      // Calculate bend based on position
                      var relX = (x - bounds[0]) / width;
                      var bendFactor = Math.sin(relX * Math.PI) * ${bendAmount} / 100;
                      
                      // Apply vertical bend
                      point.anchor = [x, y + (height * bendFactor * 0.5)];
                      
                      // Adjust handles
                      if (point.leftDirection) {
                        point.leftDirection = [
                          point.leftDirection[0],
                          point.leftDirection[1] + (height * bendFactor * 0.5)
                        ];
                      }
                      if (point.rightDirection) {
                        point.rightDirection = [
                          point.rightDirection[0],
                          point.rightDirection[1] + (height * bendFactor * 0.5)
                        ];
                      }
                    }
                  }
                } else if (warpStyle === "bulge") {
                  // Simulate bulge with scaling from center
                  var bounds = item.geometricBounds;
                  var centerX = (bounds[0] + bounds[2]) / 2;
                  var centerY = (bounds[1] + bounds[3]) / 2;
                  
                  var scaleFactor = 1 + (${bendAmount} / 100);
                  var scaleMatrix = app.getScaleMatrix(scaleFactor * 100, scaleFactor * 100);
                  item.transform(scaleMatrix, true, false, true, false, 0, Transformation.CENTER);
                }
                break;
                
              case "mesh":
                // Create mesh distortion grid
                if (item.typename === "PathItem" || item.typename === "GroupItem") {
                  // Note: Actual mesh would require gradient mesh API
                  // This creates a visual grid overlay for demonstration
                  var bounds = item.geometricBounds;
                  var width = bounds[2] - bounds[0];
                  var height = bounds[1] - bounds[3];
                  
                  var meshGroup = doc.groupItems.add();
                  meshGroup.name = "Mesh Grid";
                  
                  // Create horizontal lines
                  for (var r = 0; r <= ${rows}; r++) {
                    var y = bounds[1] - (height * r / ${rows});
                    var hLine = meshGroup.pathItems.add();
                    hLine.setEntirePath([[bounds[0], y], [bounds[2], y]]);
                    hLine.stroked = true;
                    hLine.strokeWidth = 0.5;
                    hLine.filled = false;
                  }
                  
                  // Create vertical lines
                  for (var c = 0; c <= ${columns}; c++) {
                    var x = bounds[0] + (width * c / ${columns});
                    var vLine = meshGroup.pathItems.add();
                    vLine.setEntirePath([[x, bounds[1]], [x, bounds[3]]]);
                    vLine.stroked = true;
                    vLine.strokeWidth = 0.5;
                    vLine.filled = false;
                  }
                }
                break;
                
              case "preset":
                // Apply named preset transformation
                var presetName = "${presetName || 'arc'}";
                
                // Simplified preset application
                switch (presetName) {
                  case "wave":
                    // Apply wave distortion
                    if (item.typename === "PathItem") {
                      for (var j = 0; j < item.pathPoints.length; j++) {
                        var point = item.pathPoints[j];
                        var waveAmount = Math.sin(j * 0.5) * 20;
                        point.anchor = [
                          point.anchor[0],
                          point.anchor[1] + waveAmount
                        ];
                      }
                    }
                    break;
                    
                  case "twist":
                    // Apply twist transformation
                    var bounds = item.geometricBounds;
                    var centerX = (bounds[0] + bounds[2]) / 2;
                    var centerY = (bounds[1] + bounds[3]) / 2;
                    var angle = ${bendAmount} / 2;
                    
                    var rotMatrix = app.getRotationMatrix(angle);
                    item.transform(rotMatrix, true, false, true, false, 0, Transformation.CENTER);
                    break;
                }
                break;
            }
            
            // Apply additional distortions
            if (${horizontalDistortion} !== 0 || ${verticalDistortion} !== 0) {
              var hScale = 100 + ${horizontalDistortion};
              var vScale = 100 + ${verticalDistortion};
              var scaleMatrix = app.getScaleMatrix(hScale, vScale);
              item.transform(scaleMatrix, true, false, true, false, 0, Transformation.CENTER);
            }
            
            processedCount++;
          }
          
          // Expand appearance if requested
          if (${expandAppearance}) {
            // Note: This would use actual expand appearance API
            app.executeMenuCommand("expandStyle");
          }
          
          JSON.stringify({
            success: true,
            processedCount: processedCount,
            envelopeType: "${envelopeType}",
            message: "Applied envelope distortion to " + processedCount + " objects"
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  // Tool: distribute_and_align
  // Complexity: 3.5 (Medium-High)
  // Dependencies: select_elements
  server.tool(
    "distribute_and_align",
    {
      operation: z.enum(["align", "distribute", "both"]).describe("Operation type"),
      alignOptions: z.object({
        horizontal: z.enum(["left", "center", "right", "none"]).optional(),
        vertical: z.enum(["top", "middle", "bottom", "none"]).optional(),
        toArtboard: z.boolean().default(false).describe("Align to artboard instead of selection"),
        toKeyObject: z.boolean().default(false).describe("Align to key object (largest)")
      }).optional(),
      distributeOptions: z.object({
        horizontal: z.enum(["left", "center", "right", "space", "none"]).optional(),
        vertical: z.enum(["top", "center", "bottom", "space", "none"]).optional(),
        spacing: z.number().default(0).describe("Spacing between objects (for space distribution)"),
        equalizeWidths: z.boolean().default(false).describe("Make all objects same width"),
        equalizeHeights: z.boolean().default(false).describe("Make all objects same height")
      }).optional(),
      target: z.enum(["selection", "layer", "artboard"]).default("selection"),
      preserveGroups: z.boolean().default(true).describe("Treat groups as single objects")
    },
    wrapToolForTelemetry("distribute_and_align", async (args: any) => {
      const { 
        operation, 
        alignOptions = {}, 
        distributeOptions = {}, 
        target = "selection",
        preserveGroups = true
      } = args;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var items = [];
          
          // Get target items
          switch ("${target}") {
            case "selection":
              items = app.selection;
              break;
            case "layer":
              items = doc.activeLayer.pageItems;
              break;
            case "artboard":
              var artboard = doc.artboards[doc.artboards.getActiveArtboardIndex()];
              var bounds = artboard.artboardRect;
              
              for (var i = 0; i < doc.pageItems.length; i++) {
                var item = doc.pageItems[i];
                var itemBounds = item.geometricBounds;
                // Check if item is within artboard
                if (itemBounds[0] >= bounds[0] && itemBounds[2] <= bounds[2] &&
                    itemBounds[1] <= bounds[1] && itemBounds[3] >= bounds[3]) {
                  items.push(item);
                }
              }
              break;
          }
          
          if (items.length < 2 && "${operation}" !== "align") {
            throw new Error("Need at least 2 objects for distribution");
          }
          
          var alignOpts = ${JSON.stringify(alignOptions)};
          var distOpts = ${JSON.stringify(distributeOptions)};
          var results = { aligned: 0, distributed: 0 };
          
          // Perform alignment
          if ("${operation}" === "align" || "${operation}" === "both") {
            var alignTo = null;
            
            if (alignOpts.toArtboard) {
              // Get artboard bounds
              var artboard = doc.artboards[doc.artboards.getActiveArtboardIndex()];
              alignTo = artboard.artboardRect;
            } else if (alignOpts.toKeyObject && items.length > 0) {
              // Find largest object as key
              var largestArea = 0;
              for (var i = 0; i < items.length; i++) {
                var bounds = items[i].geometricBounds;
                var area = (bounds[2] - bounds[0]) * (bounds[1] - bounds[3]);
                if (area > largestArea) {
                  largestArea = area;
                  alignTo = bounds;
                }
              }
            }
            
            // Apply alignment
            for (var i = 0; i < items.length; i++) {
              var item = items[i];
              var bounds = item.geometricBounds;
              var deltaX = 0, deltaY = 0;
              
              if (alignOpts.horizontal) {
                var refBounds = alignTo || getBoundingBox(items);
                switch (alignOpts.horizontal) {
                  case "left":
                    deltaX = refBounds[0] - bounds[0];
                    break;
                  case "center":
                    var centerX = (refBounds[0] + refBounds[2]) / 2;
                    var itemCenterX = (bounds[0] + bounds[2]) / 2;
                    deltaX = centerX - itemCenterX;
                    break;
                  case "right":
                    deltaX = refBounds[2] - bounds[2];
                    break;
                }
              }
              
              if (alignOpts.vertical) {
                var refBounds = alignTo || getBoundingBox(items);
                switch (alignOpts.vertical) {
                  case "top":
                    deltaY = refBounds[1] - bounds[1];
                    break;
                  case "middle":
                    var centerY = (refBounds[1] + refBounds[3]) / 2;
                    var itemCenterY = (bounds[1] + bounds[3]) / 2;
                    deltaY = centerY - itemCenterY;
                    break;
                  case "bottom":
                    deltaY = refBounds[3] - bounds[3];
                    break;
                }
              }
              
              if (deltaX !== 0 || deltaY !== 0) {
                item.translate(deltaX, deltaY);
                results.aligned++;
              }
            }
          }
          
          // Perform distribution
          if ("${operation}" === "distribute" || "${operation}" === "both") {
            // Sort items by position
            var sortedItems = [];
            for (var i = 0; i < items.length; i++) {
              sortedItems.push(items[i]);
            }
            
            if (distOpts.horizontal && distOpts.horizontal !== "none") {
              sortedItems.sort(function(a, b) {
                return a.geometricBounds[0] - b.geometricBounds[0];
              });
              
              if (distOpts.horizontal === "space") {
                // Distribute with equal spacing
                var totalWidth = 0;
                for (var i = 0; i < sortedItems.length; i++) {
                  var bounds = sortedItems[i].geometricBounds;
                  totalWidth += bounds[2] - bounds[0];
                }
                
                var leftMost = sortedItems[0].geometricBounds[0];
                var rightMost = sortedItems[sortedItems.length - 1].geometricBounds[2];
                var availableSpace = rightMost - leftMost - totalWidth;
                var spacing = distOpts.spacing || (availableSpace / (sortedItems.length - 1));
                
                var currentX = leftMost;
                for (var i = 0; i < sortedItems.length; i++) {
                  var item = sortedItems[i];
                  var bounds = item.geometricBounds;
                  var deltaX = currentX - bounds[0];
                  item.translate(deltaX, 0);
                  currentX += (bounds[2] - bounds[0]) + spacing;
                  results.distributed++;
                }
              }
            }
            
            if (distOpts.vertical && distOpts.vertical !== "none") {
              sortedItems.sort(function(a, b) {
                return b.geometricBounds[1] - a.geometricBounds[1];
              });
              
              if (distOpts.vertical === "space") {
                // Distribute with equal spacing
                var totalHeight = 0;
                for (var i = 0; i < sortedItems.length; i++) {
                  var bounds = sortedItems[i].geometricBounds;
                  totalHeight += bounds[1] - bounds[3];
                }
                
                var topMost = sortedItems[0].geometricBounds[1];
                var bottomMost = sortedItems[sortedItems.length - 1].geometricBounds[3];
                var availableSpace = topMost - bottomMost - totalHeight;
                var spacing = distOpts.spacing || (availableSpace / (sortedItems.length - 1));
                
                var currentY = topMost;
                for (var i = 0; i < sortedItems.length; i++) {
                  var item = sortedItems[i];
                  var bounds = item.geometricBounds;
                  var deltaY = currentY - bounds[1];
                  item.translate(0, deltaY);
                  currentY -= (bounds[1] - bounds[3]) + spacing;
                  results.distributed++;
                }
              }
            }
            
            // Equalize sizes if requested
            if (distOpts.equalizeWidths || distOpts.equalizeHeights) {
              var avgWidth = 0, avgHeight = 0;
              
              for (var i = 0; i < items.length; i++) {
                var bounds = items[i].geometricBounds;
                avgWidth += bounds[2] - bounds[0];
                avgHeight += bounds[1] - bounds[3];
              }
              avgWidth /= items.length;
              avgHeight /= items.length;
              
              for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var bounds = item.geometricBounds;
                var scaleX = distOpts.equalizeWidths ? (avgWidth / (bounds[2] - bounds[0])) * 100 : 100;
                var scaleY = distOpts.equalizeHeights ? (avgHeight / (bounds[1] - bounds[3])) * 100 : 100;
                
                if (scaleX !== 100 || scaleY !== 100) {
                  var matrix = app.getScaleMatrix(scaleX, scaleY);
                  item.transform(matrix, true, false, true, false, 0, Transformation.CENTER);
                }
              }
            }
          }
          
          // Helper function to get bounding box of multiple items
          function getBoundingBox(items) {
            if (items.length === 0) return [0, 0, 0, 0];
            
            var bounds = items[0].geometricBounds;
            var minX = bounds[0], maxX = bounds[2];
            var minY = bounds[3], maxY = bounds[1];
            
            for (var i = 1; i < items.length; i++) {
              bounds = items[i].geometricBounds;
              minX = Math.min(minX, bounds[0]);
              maxX = Math.max(maxX, bounds[2]);
              minY = Math.min(minY, bounds[3]);
              maxY = Math.max(maxY, bounds[1]);
            }
            
            return [minX, maxY, maxX, minY];
          }
          
          JSON.stringify({
            success: true,
            itemsProcessed: items.length,
            aligned: results.aligned,
            distributed: results.distributed,
            operation: "${operation}",
            message: "Processed " + items.length + " items"
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  // Tool: create_clipping_mask
  // Complexity: 3.0 (Medium)
  // Dependencies: select_elements
  server.tool(
    "create_clipping_mask",
    {
      maskType: z.enum(["simple", "compound", "opacity", "layer"]).default("simple"),
      useSelection: z.boolean().default(true).describe("Use current selection"),
      maskObject: z.object({
        shape: z.enum(["rectangle", "ellipse", "polygon", "star", "custom"]).optional(),
        size: z.object({
          width: z.number().describe("Width in points"),
          height: z.number().describe("Height in points")
        }).optional(),
        position: z.object({
          x: z.number().describe("X position"),
          y: z.number().describe("Y position")
        }).optional(),
        sides: z.number().min(3).max(100).optional().describe("Number of sides for polygon/star")
      }).optional().describe("Create new mask shape if not using selection"),
      options: z.object({
        invertMask: z.boolean().default(false).describe("Invert the mask"),
        preserveAppearance: z.boolean().default(true).describe("Preserve object appearance"),
        releaseExisting: z.boolean().default(false).describe("Release existing masks first"),
        groupResult: z.boolean().default(true).describe("Group masked objects")
      }).optional()
    },
    wrapToolForTelemetry("create_clipping_mask", async (args: any) => {
      const { maskType = "simple", useSelection = true, maskObject = {}, options = {} } = args;
      const {
        invertMask = false,
        preserveAppearance = true,
        releaseExisting = false,
        groupResult = true
      } = options;
      
      const script = `
        try {
          var doc = app.activeDocument;
          
          // Release existing masks if requested
          if (${releaseExisting}) {
            try {
              app.executeMenuCommand("releaseMask");
            } catch (e) {
              // No mask to release
            }
          }
          
          var maskPath = null;
          var targetObjects = [];
          
          if (${useSelection}) {
            // Use selection - top object is mask, others are targets
            if (app.selection.length < 2) {
              throw new Error("Select at least 2 objects (top object will be the mask)");
            }
            
            maskPath = app.selection[0];
            for (var i = 1; i < app.selection.length; i++) {
              targetObjects.push(app.selection[i]);
            }
          } else {
            // Create new mask shape
            var maskObj = ${JSON.stringify(maskObject)};
            var shape = maskObj.shape || "rectangle";
            var size = maskObj.size || { width: 200, height: 200 };
            var position = maskObj.position || { x: 0, y: 0 };
            
            switch (shape) {
              case "rectangle":
                maskPath = doc.pathItems.rectangle(
                  position.y + size.height,
                  position.x,
                  size.width,
                  size.height
                );
                break;
                
              case "ellipse":
                maskPath = doc.pathItems.ellipse(
                  position.y + size.height,
                  position.x,
                  size.width,
                  size.height
                );
                break;
                
              case "polygon":
                var sides = maskObj.sides || 6;
                var radius = Math.min(size.width, size.height) / 2;
                maskPath = doc.pathItems.add();
                var points = [];
                
                for (var i = 0; i < sides; i++) {
                  var angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
                  points.push([
                    position.x + size.width / 2 + radius * Math.cos(angle),
                    position.y + size.height / 2 + radius * Math.sin(angle)
                  ]);
                }
                maskPath.setEntirePath(points);
                maskPath.closed = true;
                break;
                
              case "star":
                var sides = maskObj.sides || 5;
                var outerRadius = Math.min(size.width, size.height) / 2;
                var innerRadius = outerRadius * 0.5;
                maskPath = doc.pathItems.add();
                var points = [];
                
                for (var i = 0; i < sides * 2; i++) {
                  var angle = (i * Math.PI) / sides - Math.PI / 2;
                  var radius = i % 2 === 0 ? outerRadius : innerRadius;
                  points.push([
                    position.x + size.width / 2 + radius * Math.cos(angle),
                    position.y + size.height / 2 + radius * Math.sin(angle)
                  ]);
                }
                maskPath.setEntirePath(points);
                maskPath.closed = true;
                break;
            }
            
            // Use all other objects as targets
            targetObjects = app.selection;
          }
          
          if (!maskPath) {
            throw new Error("No mask path created or selected");
          }
          
          // Apply clipping mask based on type
          var result = null;
          
          switch ("${maskType}") {
            case "simple":
              // Create simple clipping mask
              maskPath.filled = false;
              maskPath.stroked = false;
              
              if (${groupResult}) {
                var group = doc.groupItems.add();
                maskPath.move(group, ElementPlacement.PLACEATBEGINNING);
                
                for (var i = 0; i < targetObjects.length; i++) {
                  targetObjects[i].move(group, ElementPlacement.PLACEATEND);
                }
                
                group.clipped = true;
                result = group;
              } else {
                maskPath.clipping = true;
              }
              break;
              
            case "compound":
              // Create compound clipping mask
              var compoundPath = doc.compoundPathItems.add();
              maskPath.move(compoundPath, ElementPlacement.PLACEATBEGINNING);
              
              if (${groupResult}) {
                var group = doc.groupItems.add();
                compoundPath.move(group, ElementPlacement.PLACEATBEGINNING);
                
                for (var i = 0; i < targetObjects.length; i++) {
                  targetObjects[i].move(group, ElementPlacement.PLACEATEND);
                }
                
                group.clipped = true;
                result = group;
              }
              break;
              
            case "opacity":
              // Create opacity mask
              maskPath.filled = true;
              
              // Create gradient for opacity
              var gradient = doc.gradients.add();
              gradient.type = GradientType.LINEAR;
              
              var stop1 = gradient.gradientStops.add();
              stop1.rampPoint = 0;
              stop1.color = new GrayColor();
              stop1.color.gray = ${invertMask} ? 100 : 0;
              
              var stop2 = gradient.gradientStops.add();
              stop2.rampPoint = 100;
              stop2.color = new GrayColor();
              stop2.color.gray = ${invertMask} ? 0 : 100;
              
              var gradientColor = new GradientColor();
              gradientColor.gradient = gradient;
              maskPath.fillColor = gradientColor;
              
              // Group and apply opacity mask
              if (targetObjects.length > 0) {
                var group = doc.groupItems.add();
                for (var i = 0; i < targetObjects.length; i++) {
                  targetObjects[i].move(group, ElementPlacement.PLACEATEND);
                }
                maskPath.move(group, ElementPlacement.PLACEATBEGINNING);
                group.clipped = true;
                result = group;
              }
              break;
              
            case "layer":
              // Create layer clipping mask
              var maskLayer = doc.layers.add();
              maskLayer.name = "Clipping Mask Layer";
              
              maskPath.move(maskLayer, ElementPlacement.PLACEATBEGINNING);
              for (var i = 0; i < targetObjects.length; i++) {
                targetObjects[i].move(maskLayer, ElementPlacement.PLACEATEND);
              }
              
              maskLayer.hasSelectedArtwork = true;
              app.executeMenuCommand("makeMask");
              result = maskLayer;
              break;
          }
          
          JSON.stringify({
            success: true,
            maskType: "${maskType}",
            objectsMasked: targetObjects.length,
            maskCreated: !${useSelection},
            grouped: ${groupResult},
            message: "Created " + "${maskType}" + " clipping mask for " + targetObjects.length + " objects"
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  console.error("Transform tools registered successfully");
}