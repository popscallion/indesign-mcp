// src/illustrator/tools/symbol/index.ts

/**
 * @fileoverview Symbol creation and management tools for Illustrator MCP
 * Handles symbols, instances, and symbol libraries
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScriptForApp } from "../../../extendscript.js";
import { wrapToolForTelemetry } from "../../../tools/index.js";
import { z } from "zod";

/**
 * Registers symbol-related tools with the MCP server
 */
export async function registerSymbolTools(server: McpServer): Promise<void> {
  
  // Tool: create_symbol
  // Complexity: 3.6 (Medium)
  // Dependencies: select_elements
  server.tool(
    "create_symbol",
    {
      symbolName: z.string().describe("Name for the new symbol"),
      symbolType: z.enum(["movie_clip", "graphic"]).default("graphic").describe("Type of symbol to create"),
      useSelection: z.boolean().default(true).describe("Create symbol from selected objects"),
      sourceItems: z.array(z.number()).optional().describe("Item indices to use (if not using selection)"),
      registrationPoint: z.enum(["center", "top_left", "top_center", "top_right", "center_left", "center_right", "bottom_left", "bottom_center", "bottom_right"]).default("center").describe("Symbol registration point"),
      replaceSelection: z.boolean().default(true).describe("Replace selected objects with symbol instance")
    },
    wrapToolForTelemetry("create_symbol", async (args: any) => {
      const { symbolName, symbolType = "graphic", useSelection = true, sourceItems = [], registrationPoint = "center", replaceSelection = true } = args;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var itemsToSymbolize = [];
          var symbolCreated = false;
          
          // Collect items to convert to symbol
          if (${useSelection}) {
            if (doc.selection.length === 0) {
              throw new Error("No items selected for symbol creation");
            }
            itemsToSymbolize = doc.selection;
          } else {
            var indices = [${sourceItems.join(',')}];
            for (var i = 0; i < indices.length; i++) {
              if (indices[i] < doc.pageItems.length) {
                itemsToSymbolize.push(doc.pageItems[indices[i]]);
              }
            }
          }
          
          if (itemsToSymbolize.length === 0) {
            throw new Error("No items to convert to symbol");
          }
          
          // Calculate bounds of all items for registration point
          var allBounds = null;
          for (var j = 0; j < itemsToSymbolize.length; j++) {
            var bounds = itemsToSymbolize[j].visibleBounds;
            if (!allBounds) {
              allBounds = [bounds[0], bounds[1], bounds[2], bounds[3]];
            } else {
              allBounds[0] = Math.min(allBounds[0], bounds[0]); // left
              allBounds[1] = Math.max(allBounds[1], bounds[1]); // top
              allBounds[2] = Math.max(allBounds[2], bounds[2]); // right
              allBounds[3] = Math.min(allBounds[3], bounds[3]); // bottom
            }
          }
          
          // Calculate registration point coordinates
          var regX = 0;
          var regY = 0;
          
          switch("${registrationPoint}") {
            case "center":
              regX = (allBounds[0] + allBounds[2]) / 2;
              regY = (allBounds[1] + allBounds[3]) / 2;
              break;
            case "top_left":
              regX = allBounds[0];
              regY = allBounds[1];
              break;
            case "top_center":
              regX = (allBounds[0] + allBounds[2]) / 2;
              regY = allBounds[1];
              break;
            case "top_right":
              regX = allBounds[2];
              regY = allBounds[1];
              break;
            case "center_left":
              regX = allBounds[0];
              regY = (allBounds[1] + allBounds[3]) / 2;
              break;
            case "center_right":
              regX = allBounds[2];
              regY = (allBounds[1] + allBounds[3]) / 2;
              break;
            case "bottom_left":
              regX = allBounds[0];
              regY = allBounds[3];
              break;
            case "bottom_center":
              regX = (allBounds[0] + allBounds[2]) / 2;
              regY = allBounds[3];
              break;
            case "bottom_right":
              regX = allBounds[2];
              regY = allBounds[3];
              break;
          }
          
          // Check if symbol name already exists
          var existingSymbol = null;
          for (var k = 0; k < doc.symbols.length; k++) {
            if (doc.symbols[k].name === "${symbolName}") {
              existingSymbol = doc.symbols[k];
              break;
            }
          }
          
          // Group the items temporarily
          var tempGroup = doc.groupItems.add();
          for (var m = itemsToSymbolize.length - 1; m >= 0; m--) {
            itemsToSymbolize[m].moveToBeginning(tempGroup);
          }
          
          // Move the group so registration point is at origin
          tempGroup.translate(-regX, -regY);
          
          // Create or update the symbol
          var newSymbol = null;
          if (existingSymbol) {
            // Update existing symbol
            existingSymbol.name = "${symbolName}_updated";
            newSymbol = doc.symbols.add(tempGroup);
            newSymbol.name = "${symbolName}";
          } else {
            // Create new symbol
            newSymbol = doc.symbols.add(tempGroup);
            newSymbol.name = "${symbolName}";
          }
          
          symbolCreated = true;
          
          // Create symbol instance if requested
          var instanceCreated = false;
          if (${replaceSelection} && newSymbol) {
            // Move the group back to original position for instance placement
            var instance = doc.symbolItems.add(newSymbol);
            instance.position = [regX, regY];
            instanceCreated = true;
            
            // Remove the temporary group (it's now part of the symbol)
            try {
              tempGroup.remove();
            } catch (e) {
              // Group might already be consumed by symbol creation
            }
          }
          
          var result = "Created symbol: ${symbolName}";
          if (instanceCreated) {
            result += " with instance placed";
          }
          result += "\\\\nRegistration: ${registrationPoint}";
          result += "\\\\nType: ${symbolType}";
          
          result;
          
        } catch (e) {
          "Error: " + e.message;
        }
      `;
      
      const result = await executeExtendScriptForApp(script, 'illustrator');
      
      return {
        content: [{
          type: "text" as const,
          text: result.success ? result.result || "Symbol created" : `Error: ${result.error}`
        }]
      };
    })
  );

  // Tool: place_symbol_instances
  // Complexity: 3.8 (Medium)
  // Dependencies: create_symbol
  server.tool(
    "place_symbol_instances",
    {
      symbolName: z.string().describe("Name of symbol to place instances of"),
      placement: z.object({
        type: z.enum(["grid", "circle", "line", "random", "manual"]).describe("Placement pattern"),
        count: z.number().min(1).max(100).default(5).describe("Number of instances to place"),
        spacing: z.number().default(50).describe("Spacing between instances"),
        center: z.object({
          x: z.number().default(0).describe("Center X coordinate"),
          y: z.number().default(0).describe("Center Y coordinate")
        }).optional().describe("Center point for placement"),
        bounds: z.object({
          width: z.number().default(200).describe("Width of placement area"),
          height: z.number().default(200).describe("Height of placement area")
        }).optional().describe("Bounds for random/grid placement")
      }).describe("Instance placement configuration"),
      variations: z.object({
        scale: z.object({
          min: z.number().default(1).describe("Minimum scale factor"),
          max: z.number().default(1).describe("Maximum scale factor")
        }).optional().describe("Scale variation range"),
        rotation: z.object({
          min: z.number().default(0).describe("Minimum rotation in degrees"),
          max: z.number().default(0).describe("Maximum rotation in degrees")
        }).optional().describe("Rotation variation range"),
        opacity: z.object({
          min: z.number().default(100).describe("Minimum opacity percentage"),
          max: z.number().default(100).describe("Maximum opacity percentage")
        }).optional().describe("Opacity variation range")
      }).optional().describe("Instance variations"),
      groupInstances: z.boolean().default(false).describe("Group all instances together")
    },
    wrapToolForTelemetry("place_symbol_instances", async (args: any) => {
      const { symbolName, placement = {}, variations = {}, groupInstances = false } = args;
      const { type = "grid", count = 5, spacing = 50, center = { x: 0, y: 0 }, bounds = { width: 200, height: 200 } } = placement;
      const { scale, rotation, opacity } = variations;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var targetSymbol = null;
          var placedInstances = [];
          
          // Find the symbol
          for (var i = 0; i < doc.symbols.length; i++) {
            if (doc.symbols[i].name === "${symbolName}") {
              targetSymbol = doc.symbols[i];
              break;
            }
          }
          
          if (!targetSymbol) {
            throw new Error("Symbol not found: ${symbolName}");
          }
          
          // Generate positions based on placement type
          var positions = [];
          
          switch("${type}") {
            case "grid":
              var cols = Math.ceil(Math.sqrt(${count}));
              var rows = Math.ceil(${count} / cols);
              var startX = ${center.x} - ((cols - 1) * ${spacing}) / 2;
              var startY = ${center.y} + ((rows - 1) * ${spacing}) / 2;
              
              for (var r = 0; r < rows && positions.length < ${count}; r++) {
                for (var c = 0; c < cols && positions.length < ${count}; c++) {
                  positions.push({
                    x: startX + c * ${spacing},
                    y: startY - r * ${spacing}
                  });
                }
              }
              break;
              
            case "circle":
              var radius = ${spacing};
              for (var a = 0; a < ${count}; a++) {
                var angle = (a / ${count}) * 2 * Math.PI;
                positions.push({
                  x: ${center.x} + radius * Math.cos(angle),
                  y: ${center.y} + radius * Math.sin(angle)
                });
              }
              break;
              
            case "line":
              var startX = ${center.x} - ((${count} - 1) * ${spacing}) / 2;
              for (var l = 0; l < ${count}; l++) {
                positions.push({
                  x: startX + l * ${spacing},
                  y: ${center.y}
                });
              }
              break;
              
            case "random":
              for (var rand = 0; rand < ${count}; rand++) {
                positions.push({
                  x: ${center.x} + (Math.random() - 0.5) * ${bounds.width},
                  y: ${center.y} + (Math.random() - 0.5) * ${bounds.height}
                });
              }
              break;
              
            case "manual":
              // Just place one at center - user can move manually
              positions.push({ x: ${center.x}, y: ${center.y} });
              break;
          }
          
          // Place instances at each position
          for (var p = 0; p < positions.length; p++) {
            var pos = positions[p];
            var instance = doc.symbolItems.add(targetSymbol);
            instance.position = [pos.x, pos.y];
            
            // Apply variations
            if (${scale?.min !== undefined || scale?.max !== undefined}) {
              var scaleMin = ${scale?.min || 1};
              var scaleMax = ${scale?.max || 1};
              var scaleFactor = scaleMin + Math.random() * (scaleMax - scaleMin);
              instance.resize(scaleFactor * 100, scaleFactor * 100);
            }
            
            if (${rotation?.min !== undefined || rotation?.max !== undefined}) {
              var rotMin = ${rotation?.min || 0};
              var rotMax = ${rotation?.max || 0};
              var rotAngle = rotMin + Math.random() * (rotMax - rotMin);
              instance.rotate(rotAngle);
            }
            
            if (${opacity?.min !== undefined || opacity?.max !== undefined}) {
              var opacityMin = ${opacity?.min || 100};
              var opacityMax = ${opacity?.max || 100};
              var opacityVal = opacityMin + Math.random() * (opacityMax - opacityMin);
              instance.opacity = opacityVal;
            }
            
            placedInstances.push(instance);
          }
          
          // Group instances if requested
          if (${groupInstances} && placedInstances.length > 0) {
            var instanceGroup = doc.groupItems.add();
            instanceGroup.name = "${symbolName}_instances";
            
            for (var g = placedInstances.length - 1; g >= 0; g--) {
              placedInstances[g].moveToBeginning(instanceGroup);
            }
          }
          
          var result = "Placed " + placedInstances.length + " instances of ${symbolName}";
          result += "\\\\nPattern: ${type}";
          if (${scale?.min !== scale?.max}) {
            result += "\\\\nScale variation: " + (${scale?.min || 1}) + "-" + (${scale?.max || 1});
          }
          if (${rotation?.min !== rotation?.max}) {
            result += "\\\\nRotation variation: " + (${rotation?.min || 0}) + "°-" + (${rotation?.max || 0}) + "°";
          }
          if (${groupInstances}) {
            result += "\\\\nInstances grouped";
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
          text: result.success ? result.result || "Symbol instances placed" : `Error: ${result.error}`
        }]
      };
    })
  );
  
  console.error("Registered Illustrator symbol tools");
}