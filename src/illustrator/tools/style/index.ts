// src/illustrator/tools/style/index.ts

/**
 * @fileoverview Style and appearance tools for Illustrator MCP
 * Manages colors, graphic styles, and text styling
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScriptForApp } from "../../../extendscript.js";
import { wrapToolForTelemetry } from "../../../tools/index.js";
import { z } from "zod";

/**
 * Registers style-related tools with the MCP server
 */
export async function registerStyleTools(server: McpServer): Promise<void> {
  
  // Tool: generate_color_variations
  // Complexity: 3.0 (Medium)
  // Dependencies: None
  server.tool(
    "generate_color_variations",
    {
      baseColor: z.string().describe("Base color in hex format (e.g., #FF5733)"),
      variationType: z.enum(["monochromatic", "analogous", "complementary", "triadic", "tetradic"]).describe("Type of color scheme"),
      count: z.number().min(2).max(10).default(5).describe("Number of color variations to generate"),
      adjustments: z.object({
        brightnessRange: z.number().default(30).describe("Brightness variation range (0-100)"),
        saturationRange: z.number().default(30).describe("Saturation variation range (0-100)"),
        hueShift: z.number().default(30).describe("Hue shift amount in degrees")
      }).optional().describe("Color adjustment parameters"),
      applyToSelection: z.boolean().default(false).describe("Apply variations to selected objects")
    },
    wrapToolForTelemetry("generate_color_variations", async (args: any) => {
      const { baseColor, variationType, count = 5, adjustments = {}, applyToSelection = false } = args;
      const { brightnessRange = 30, saturationRange = 30, hueShift = 30 } = adjustments;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var colors = [];
          
          // Parse base color from hex
          var hex = "${baseColor}".replace("#", "");
          var baseRGB = new RGBColor();
          baseRGB.red = parseInt(hex.substring(0, 2), 16);
          baseRGB.green = parseInt(hex.substring(2, 4), 16);
          baseRGB.blue = parseInt(hex.substring(4, 6), 16);
          
          // Convert RGB to HSB for calculations
          function rgbToHsb(r, g, b) {
            r /= 255; g /= 255; b /= 255;
            var max = Math.max(r, g, b);
            var min = Math.min(r, g, b);
            var h, s, v = max;
            var d = max - min;
            s = max === 0 ? 0 : d / max;
            
            if (max === min) {
              h = 0;
            } else {
              switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
              }
            }
            return { h: h * 360, s: s * 100, b: v * 100 };
          }
          
          // Convert HSB to RGB
          function hsbToRgb(h, s, b) {
            h /= 360; s /= 100; b /= 100;
            var r, g, blue;
            var i = Math.floor(h * 6);
            var f = h * 6 - i;
            var p = b * (1 - s);
            var q = b * (1 - f * s);
            var t = b * (1 - (1 - f) * s);
            
            switch (i % 6) {
              case 0: r = b; g = t; blue = p; break;
              case 1: r = q; g = b; blue = p; break;
              case 2: r = p; g = b; blue = t; break;
              case 3: r = p; g = q; blue = b; break;
              case 4: r = t; g = p; blue = b; break;
              case 5: r = b; g = p; blue = q; break;
            }
            
            return {
              r: Math.round(r * 255),
              g: Math.round(g * 255),
              b: Math.round(blue * 255)
            };
          }
          
          // Get base color in HSB
          var baseHSB = rgbToHsb(baseRGB.red, baseRGB.green, baseRGB.blue);
          
          // Generate variations based on type
          switch("${variationType}") {
            case "monochromatic":
              // Vary brightness and saturation
              for (var i = 0; i < ${count}; i++) {
                var factor = i / (${count} - 1);
                var newB = baseHSB.b + (factor - 0.5) * ${brightnessRange};
                var newS = baseHSB.s + (factor - 0.5) * ${saturationRange};
                newB = Math.max(0, Math.min(100, newB));
                newS = Math.max(0, Math.min(100, newS));
                
                var rgb = hsbToRgb(baseHSB.h, newS, newB);
                var color = new RGBColor();
                color.red = rgb.r;
                color.green = rgb.g;
                color.blue = rgb.b;
                colors.push(color);
              }
              break;
              
            case "analogous":
              // Adjacent colors on color wheel
              var step = ${hueShift} / (${count} - 1);
              for (var j = 0; j < ${count}; j++) {
                var hueOffset = -${hueShift}/2 + (j * step);
                var newH = (baseHSB.h + hueOffset + 360) % 360;
                
                var rgb = hsbToRgb(newH, baseHSB.s, baseHSB.b);
                var color = new RGBColor();
                color.red = rgb.r;
                color.green = rgb.g;
                color.blue = rgb.b;
                colors.push(color);
              }
              break;
              
            case "complementary":
              // Base and opposite color with variations
              colors.push(baseRGB);
              var compH = (baseHSB.h + 180) % 360;
              
              for (var k = 1; k < ${count}; k++) {
                var factor = k / ${count};
                var varH = compH + (factor - 0.5) * 20;
                var varS = baseHSB.s + (factor - 0.5) * ${saturationRange};
                varS = Math.max(0, Math.min(100, varS));
                
                var rgb = hsbToRgb(varH, varS, baseHSB.b);
                var color = new RGBColor();
                color.red = rgb.r;
                color.green = rgb.g;
                color.blue = rgb.b;
                colors.push(color);
              }
              break;
              
            case "triadic":
              // Three colors equally spaced on wheel
              for (var m = 0; m < Math.min(${count}, 3); m++) {
                var triadH = (baseHSB.h + m * 120) % 360;
                var rgb = hsbToRgb(triadH, baseHSB.s, baseHSB.b);
                var color = new RGBColor();
                color.red = rgb.r;
                color.green = rgb.g;
                color.blue = rgb.b;
                colors.push(color);
              }
              // Add variations if more colors needed
              for (var n = 3; n < ${count}; n++) {
                var baseIdx = n % 3;
                var baseTriadH = (baseHSB.h + baseIdx * 120) % 360;
                var varB = baseHSB.b + (n - 3) * 10;
                varB = Math.max(0, Math.min(100, varB));
                
                var rgb = hsbToRgb(baseTriadH, baseHSB.s, varB);
                var color = new RGBColor();
                color.red = rgb.r;
                color.green = rgb.g;
                color.blue = rgb.b;
                colors.push(color);
              }
              break;
              
            case "tetradic":
              // Four colors in rectangular pattern
              for (var p = 0; p < Math.min(${count}, 4); p++) {
                var tetH = (baseHSB.h + p * 90) % 360;
                var rgb = hsbToRgb(tetH, baseHSB.s, baseHSB.b);
                var color = new RGBColor();
                color.red = rgb.r;
                color.green = rgb.g;
                color.blue = rgb.b;
                colors.push(color);
              }
              // Add variations if more colors needed
              for (var q = 4; q < ${count}; q++) {
                var baseIdx = q % 4;
                var baseTetH = (baseHSB.h + baseIdx * 90) % 360;
                var varS = baseHSB.s + (q - 4) * 10;
                varS = Math.max(0, Math.min(100, varS));
                
                var rgb = hsbToRgb(baseTetH, varS, baseHSB.b);
                var color = new RGBColor();
                color.red = rgb.r;
                color.green = rgb.g;
                color.blue = rgb.b;
                colors.push(color);
              }
              break;
          }
          
          // Apply to selection if requested
          if (${applyToSelection} && doc.selection.length > 0) {
            for (var s = 0; s < Math.min(doc.selection.length, colors.length); s++) {
              var item = doc.selection[s];
              if (item.filled) {
                item.fillColor = colors[s % colors.length];
              }
            }
          }
          
          // Add colors to swatches
          var addedCount = 0;
          for (var t = 0; t < colors.length; t++) {
            try {
              var spot = doc.spots.add();
              spot.name = "${variationType}_" + (t + 1);
              spot.color = colors[t];
              addedCount++;
            } catch (e) {
              // Swatch might already exist
            }
          }
          
          "Generated " + colors.length + " ${variationType} variations, added " + addedCount + " swatches";
          
        } catch (e) {
          "Error: " + e.message;
        }
      `;
      
      const result = await executeExtendScriptForApp(script, 'illustrator');
      
      return {
        content: [{
          type: "text" as const,
          text: result.success ? result.result || "Color variations generated" : `Error: ${result.error}`
        }]
      };
    })
  );

  // Tool: create_graphic_style
  // Complexity: 3.0 (Medium)
  // Dependencies: select_elements
  server.tool(
    "create_graphic_style",
    {
      styleName: z.string().describe("Name for the graphic style"),
      styleProperties: z.object({
        fill: z.object({
          enabled: z.boolean().default(true).describe("Enable fill"),
          color: z.string().optional().describe("Fill color (hex)"),
          opacity: z.number().min(0).max(100).default(100).describe("Fill opacity percentage")
        }).optional().describe("Fill properties"),
        stroke: z.object({
          enabled: z.boolean().default(true).describe("Enable stroke"),
          color: z.string().optional().describe("Stroke color (hex)"),
          width: z.number().default(1).describe("Stroke width in points"),
          opacity: z.number().min(0).max(100).default(100).describe("Stroke opacity percentage"),
          cap: z.enum(["butt", "round", "projecting"]).optional().describe("Stroke cap type"),
          join: z.enum(["miter", "round", "bevel"]).optional().describe("Stroke join type"),
          dashArray: z.array(z.number()).optional().describe("Dash pattern array")
        }).optional().describe("Stroke properties"),
        effects: z.object({
          dropShadow: z.boolean().default(false).describe("Add drop shadow"),
          innerGlow: z.boolean().default(false).describe("Add inner glow"),
          outerGlow: z.boolean().default(false).describe("Add outer glow"),
          blur: z.number().optional().describe("Gaussian blur radius")
        }).optional().describe("Effect properties")
      }).describe("Style properties to apply"),
      applyToSelection: z.boolean().default(true).describe("Apply style to current selection"),
      saveToLibrary: z.boolean().default(true).describe("Save as reusable graphic style")
    },
    wrapToolForTelemetry("create_graphic_style", async (args: any) => {
      const { styleName, styleProperties = {}, applyToSelection = true, saveToLibrary = true } = args;
      const { fill = {}, stroke = {}, effects = {} } = styleProperties;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var styleApplied = false;
          
          // Create a temporary object to define the style if no selection
          var targetItem = null;
          if (doc.selection.length > 0 && ${applyToSelection}) {
            targetItem = doc.selection[0];
          } else if (!${applyToSelection} || doc.selection.length === 0) {
            // Create a temporary rectangle to define the style
            targetItem = doc.pathItems.rectangle(0, 0, 100, 100);
          }
          
          if (!targetItem) {
            throw new Error("No item to apply style to");
          }
          
          // Apply fill properties
          if (${fill.enabled !== false}) {
            targetItem.filled = true;
            if ("${fill.color || ''}" !== "") {
              var fillHex = "${fill.color}".replace("#", "");
              var fillColor = new RGBColor();
              fillColor.red = parseInt(fillHex.substring(0, 2), 16);
              fillColor.green = parseInt(fillHex.substring(2, 4), 16);
              fillColor.blue = parseInt(fillHex.substring(4, 6), 16);
              targetItem.fillColor = fillColor;
            }
            if (${fill.opacity || 100} < 100) {
              targetItem.opacity = ${fill.opacity || 100};
            }
          } else {
            targetItem.filled = false;
          }
          
          // Apply stroke properties
          if (${stroke.enabled !== false}) {
            targetItem.stroked = true;
            if ("${stroke.color || ''}" !== "") {
              var strokeHex = "${stroke.color}".replace("#", "");
              var strokeColor = new RGBColor();
              strokeColor.red = parseInt(strokeHex.substring(0, 2), 16);
              strokeColor.green = parseInt(strokeHex.substring(2, 4), 16);
              strokeColor.blue = parseInt(strokeHex.substring(4, 6), 16);
              targetItem.strokeColor = strokeColor;
            }
            targetItem.strokeWidth = ${stroke.width || 1};
            
            // Stroke cap type
            if ("${stroke.cap || ''}" !== "") {
              switch("${stroke.cap}") {
                case "butt": targetItem.strokeCap = StrokeCap.BUTTCAP; break;
                case "round": targetItem.strokeCap = StrokeCap.ROUNDCAP; break;
                case "projecting": targetItem.strokeCap = StrokeCap.PROJECTINGCAP; break;
              }
            }
            
            // Stroke join type
            if ("${stroke.join || ''}" !== "") {
              switch("${stroke.join}") {
                case "miter": targetItem.strokeJoin = StrokeJoin.MITERENDJOIN; break;
                case "round": targetItem.strokeJoin = StrokeJoin.ROUNDENDJOIN; break;
                case "bevel": targetItem.strokeJoin = StrokeJoin.BEVELENDJOIN; break;
              }
            }
            
            // Dash pattern
            if (${stroke.dashArray?.length || 0} > 0) {
              targetItem.strokeDashes = [${stroke.dashArray?.join(',') || ''}];
            }
          } else {
            targetItem.stroked = false;
          }
          
          // Save as graphic style if requested
          if (${saveToLibrary}) {
            try {
              // Create new graphic style from the item
              var newStyle = doc.graphicStyles.add("${styleName}");
              newStyle.applyTo(targetItem);
              styleApplied = true;
            } catch (e) {
              // Style might already exist or creation failed
              // Try to find and update existing style
              for (var i = 0; i < doc.graphicStyles.length; i++) {
                if (doc.graphicStyles[i].name === "${styleName}") {
                  doc.graphicStyles[i].applyTo(targetItem);
                  styleApplied = true;
                  break;
                }
              }
            }
          }
          
          // Apply to all selected items if requested
          if (${applyToSelection} && doc.selection.length > 0) {
            for (var j = 0; j < doc.selection.length; j++) {
              var item = doc.selection[j];
              
              // Apply fill
              if (${fill.enabled !== false}) {
                item.filled = targetItem.filled;
                if (targetItem.fillColor) item.fillColor = targetItem.fillColor;
                if (targetItem.opacity) item.opacity = targetItem.opacity;
              }
              
              // Apply stroke
              if (${stroke.enabled !== false}) {
                item.stroked = targetItem.stroked;
                if (targetItem.strokeColor) item.strokeColor = targetItem.strokeColor;
                item.strokeWidth = targetItem.strokeWidth;
                if (targetItem.strokeCap) item.strokeCap = targetItem.strokeCap;
                if (targetItem.strokeJoin) item.strokeJoin = targetItem.strokeJoin;
                if (targetItem.strokeDashes) item.strokeDashes = targetItem.strokeDashes;
              }
            }
          }
          
          // Remove temporary item if created
          if (!${applyToSelection} || doc.selection.length === 0) {
            targetItem.remove();
          }
          
          var result = "Created graphic style: ${styleName}";
          if (${applyToSelection} && doc.selection.length > 0) {
            result += ", applied to " + doc.selection.length + " items";
          }
          if (styleApplied && ${saveToLibrary}) {
            result += ", saved to library";
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
          text: result.success ? result.result || "Graphic style created" : `Error: ${result.error}`
        }]
      };
    })
  );

  // Tool: create_text_on_path
  // Complexity: 3.6 (Medium)
  // Dependencies: create_shape_primitive
  server.tool(
    "create_text_on_path",
    {
      text: z.string().describe("Text content to place on path"),
      pathType: z.enum(["circle", "arc", "wave", "spiral", "custom"]).describe("Type of path to create"),
      pathParameters: z.object({
        x: z.number().default(100).describe("X position of path center"),
        y: z.number().default(100).describe("Y position of path center"),
        radius: z.number().optional().describe("Radius for circular paths"),
        width: z.number().optional().describe("Width for wave or custom paths"),
        height: z.number().optional().describe("Height for wave or custom paths"),
        startAngle: z.number().optional().describe("Start angle for arc (degrees)"),
        endAngle: z.number().optional().describe("End angle for arc (degrees)"),
        turns: z.number().optional().describe("Number of turns for spiral")
      }).optional().describe("Path creation parameters"),
      textStyle: z.object({
        font: z.string().optional().describe("Font family name"),
        size: z.number().default(12).describe("Font size in points"),
        color: z.string().optional().describe("Text color (hex)"),
        alignment: z.enum(["left", "center", "right"]).default("left").describe("Text alignment on path"),
        spacing: z.number().optional().describe("Letter spacing"),
        flipText: z.boolean().default(false).describe("Flip text to other side of path")
      }).optional().describe("Text styling options"),
      useSelectedPath: z.boolean().default(false).describe("Use currently selected path instead of creating new")
    },
    wrapToolForTelemetry("create_text_on_path", async (args: any) => {
      const { text, pathType, pathParameters = {}, textStyle = {}, useSelectedPath = false } = args;
      const { x = 100, y = 100, radius = 50, width = 200, height = 100, startAngle = 0, endAngle = 180, turns = 2 } = pathParameters;
      const { font, size = 12, color, alignment = "left", spacing, flipText = false } = textStyle;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var path = null;
          
          // Use selected path or create new one
          if (${useSelectedPath} && doc.selection.length > 0) {
            // Use first selected path item
            for (var i = 0; i < doc.selection.length; i++) {
              if (doc.selection[i].typename === "PathItem") {
                path = doc.selection[i];
                break;
              }
            }
            if (!path) {
              throw new Error("No path selected");
            }
          } else {
            // Create path based on type
            switch("${pathType}") {
              case "circle":
                path = doc.pathItems.ellipse(
                  ${y + radius}, // top
                  ${x - radius}, // left
                  ${radius * 2}, // width
                  ${radius * 2}  // height
                );
                break;
                
              case "arc":
                path = doc.pathItems.add();
                var angleStep = (${endAngle} - ${startAngle}) / 20;
                for (var j = 0; j <= 20; j++) {
                  var angle = (${startAngle} + j * angleStep) * Math.PI / 180;
                  var px = ${x} + ${radius} * Math.cos(angle);
                  var py = ${y} + ${radius} * Math.sin(angle);
                  
                  var point = path.pathPoints.add();
                  point.anchor = [px, py];
                  point.leftDirection = point.anchor;
                  point.rightDirection = point.anchor;
                  
                  // Smooth the curve
                  if (j > 0 && j < 20) {
                    var prevAngle = (${startAngle} + (j-1) * angleStep) * Math.PI / 180;
                    var nextAngle = (${startAngle} + (j+1) * angleStep) * Math.PI / 180;
                    
                    var tangentX = ${radius} * (Math.cos(nextAngle) - Math.cos(prevAngle)) / 4;
                    var tangentY = ${radius} * (Math.sin(nextAngle) - Math.sin(prevAngle)) / 4;
                    
                    point.leftDirection = [px - tangentX, py - tangentY];
                    point.rightDirection = [px + tangentX, py + tangentY];
                  }
                }
                path.closed = false;
                break;
                
              case "wave":
                path = doc.pathItems.add();
                var wavePoints = 20;
                for (var k = 0; k <= wavePoints; k++) {
                  var wx = ${x} + (k / wavePoints) * ${width};
                  var wy = ${y} + Math.sin(k * Math.PI / 5) * ${height / 2};
                  
                  var point = path.pathPoints.add();
                  point.anchor = [wx, wy];
                  
                  // Add bezier handles for smooth wave
                  var handleLength = ${width} / wavePoints / 3;
                  point.leftDirection = [wx - handleLength, wy];
                  point.rightDirection = [wx + handleLength, wy];
                  point.pointType = PointType.SMOOTH;
                }
                path.closed = false;
                break;
                
              case "spiral":
                path = doc.pathItems.add();
                var spiralPoints = ${turns} * 20;
                var maxRadius = ${radius};
                
                for (var m = 0; m <= spiralPoints; m++) {
                  var spiralAngle = (m / 20) * 2 * Math.PI;
                  var spiralRadius = (m / spiralPoints) * maxRadius;
                  
                  var sx = ${x} + spiralRadius * Math.cos(spiralAngle);
                  var sy = ${y} + spiralRadius * Math.sin(spiralAngle);
                  
                  var point = path.pathPoints.add();
                  point.anchor = [sx, sy];
                  
                  // Smooth spiral curve
                  var tangentAngle = spiralAngle + Math.PI / 2;
                  var tangentLength = spiralRadius / 5;
                  point.leftDirection = [
                    sx - tangentLength * Math.cos(tangentAngle),
                    sy - tangentLength * Math.sin(tangentAngle)
                  ];
                  point.rightDirection = [
                    sx + tangentLength * Math.cos(tangentAngle),
                    sy + tangentLength * Math.sin(tangentAngle)
                  ];
                }
                path.closed = false;
                break;
                
              case "custom":
                // Create a simple bezier curve
                path = doc.pathItems.add();
                
                var p1 = path.pathPoints.add();
                p1.anchor = [${x}, ${y}];
                p1.leftDirection = p1.anchor;
                p1.rightDirection = [${x + width/3}, ${y}];
                
                var p2 = path.pathPoints.add();
                p2.anchor = [${x + width}, ${y}];
                p2.leftDirection = [${x + width*2/3}, ${y}];
                p2.rightDirection = p2.anchor;
                
                path.closed = false;
                break;
            }
            
            // Make sure path is not filled or stroked
            path.filled = false;
            path.stroked = true;
            path.strokeWidth = 0.5;
            var gray = new GrayColor();
            gray.gray = 50;
            path.strokeColor = gray;
          }
          
          // Create text on path
          var textPath = doc.textFrames.pathText(path);
          textPath.contents = "${text}";
          
          // Apply text styling
          var textRange = textPath.textRange;
          
          // Font
          if ("${font || ''}" !== "") {
            try {
              textRange.textFont = app.textFonts.getByName("${font}");
            } catch (e) {
              // Font not found, use default
            }
          }
          
          // Size
          textRange.size = ${size};
          
          // Color
          if ("${color || ''}" !== "") {
            var textHex = "${color}".replace("#", "");
            var textColor = new RGBColor();
            textColor.red = parseInt(textHex.substring(0, 2), 16);
            textColor.green = parseInt(textHex.substring(2, 4), 16);
            textColor.blue = parseInt(textHex.substring(4, 6), 16);
            textRange.fillColor = textColor;
          }
          
          // Alignment
          switch("${alignment}") {
            case "left":
              textPath.textPath.textPathOffset = 0;
              break;
            case "center":
              // Center text on path
              var pathLength = path.length || 100;
              var textWidth = textPath.width || 50;
              textPath.textPath.textPathOffset = (pathLength - textWidth) / 2;
              break;
            case "right":
              var pathLength = path.length || 100;
              var textWidth = textPath.width || 50;
              textPath.textPath.textPathOffset = pathLength - textWidth;
              break;
          }
          
          // Letter spacing
          if (${spacing || 0} !== 0) {
            textRange.tracking = ${spacing};
          }
          
          // Flip text
          if (${flipText}) {
            textPath.textPath.flipPathEffect = true;
          }
          
          "Created text on ${pathType} path: " + "${text}".substring(0, 20) + ("${text}".length > 20 ? "..." : "");
          
        } catch (e) {
          "Error: " + e.message;
        }
      `;
      
      const result = await executeExtendScriptForApp(script, 'illustrator');
      
      return {
        content: [{
          type: "text" as const,
          text: result.success ? result.result || "Text on path created" : `Error: ${result.error}`
        }]
      };
    })
  );

  // Tool: bulk_style_application
  // Complexity: 3.8 (Medium-High)
  // Dependencies: create_graphic_style, select_elements
  server.tool(
    "bulk_style_application",
    {
      styleSource: z.enum(["existing_style", "template_object", "style_definition"]).describe("Source of style to apply"),
      styleName: z.string().optional().describe("Name of existing graphic style (if using existing_style)"),
      templateObjectIndex: z.number().optional().describe("Index of object to copy style from (if using template_object)"),
      styleDefinition: z.object({
        fill: z.object({
          enabled: z.boolean().default(true),
          color: z.string().optional(),
          opacity: z.number().min(0).max(100).default(100)
        }).optional(),
        stroke: z.object({
          enabled: z.boolean().default(false),
          color: z.string().optional(),
          width: z.number().default(1),
          opacity: z.number().min(0).max(100).default(100)
        }).optional(),
        transform: z.object({
          scale: z.number().optional().describe("Uniform scale factor"),
          scaleX: z.number().optional().describe("X-axis scale factor"),
          scaleY: z.number().optional().describe("Y-axis scale factor"),
          rotation: z.number().optional().describe("Rotation in degrees"),
          opacity: z.number().min(0).max(100).optional().describe("Overall opacity")
        }).optional()
      }).optional().describe("Style definition object (if using style_definition)"),
      targetSelection: z.enum(["all", "by_type", "by_name", "by_layer", "current_selection"]).describe("How to select target objects"),
      targetCriteria: z.object({
        objectTypes: z.array(z.enum(["path", "text", "image", "compound", "group"])).optional().describe("Object types to target"),
        namePattern: z.string().optional().describe("Name pattern to match (supports wildcards)"),
        layerName: z.string().optional().describe("Layer name to target"),
        excludePattern: z.string().optional().describe("Pattern for objects to exclude")
      }).optional().describe("Criteria for target selection"),
      applicationMode: z.enum(["replace", "merge", "additive"]).default("replace").describe("How to apply the style"),
      preserveProperties: z.array(z.enum(["position", "size", "rotation", "opacity", "effects"])).optional().describe("Properties to preserve during application"),
      batchSize: z.number().min(1).max(100).default(20).describe("Number of objects to process in each batch"),
      reportProgress: z.boolean().default(true).describe("Report progress during processing")
    },
    wrapToolForTelemetry("bulk_style_application", async (args: any) => {
      const {
        styleSource,
        styleName,
        templateObjectIndex,
        styleDefinition = {},
        targetSelection,
        targetCriteria = {},
        applicationMode = "replace",
        preserveProperties = [],
        batchSize = 20,
        reportProgress = true
      } = args;
      
      const { objectTypes = [], namePattern, layerName, excludePattern } = targetCriteria;
      const { fill = {}, stroke = {}, transform = {} } = styleDefinition;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var sourceStyle = {};
          var targetObjects = [];
          var processedCount = 0;
          var errorCount = 0;
          
          // Step 1: Get source style
          switch("${styleSource}") {
            case "existing_style":
              if ("${styleName}" === "") {
                throw new Error("Style name required for existing_style source");
              }
              
              var foundStyle = null;
              for (var i = 0; i < doc.graphicStyles.length; i++) {
                if (doc.graphicStyles[i].name === "${styleName}") {
                  foundStyle = doc.graphicStyles[i];
                  break;
                }
              }
              
              if (!foundStyle) {
                throw new Error("Graphic style not found: ${styleName}");
              }
              
              // Extract style properties from existing style
              // Note: This is complex in ExtendScript, so we'll apply the style directly later
              sourceStyle = { type: "graphicStyle", style: foundStyle };
              break;
              
            case "template_object":
              if (${templateObjectIndex} === undefined || ${templateObjectIndex} < 0) {
                throw new Error("Valid template object index required");
              }
              
              if (${templateObjectIndex} >= doc.pageItems.length) {
                throw new Error("Template object index out of range");
              }
              
              var templateItem = doc.pageItems[${templateObjectIndex}];
              sourceStyle = {
                type: "template",
                item: templateItem,
                fill: {
                  enabled: templateItem.filled,
                  color: templateItem.fillColor,
                  opacity: templateItem.opacity
                },
                stroke: {
                  enabled: templateItem.stroked,
                  color: templateItem.strokeColor,
                  width: templateItem.strokeWidth,
                  cap: templateItem.strokeCap,
                  join: templateItem.strokeJoin
                }
              };
              break;
              
            case "style_definition":
              sourceStyle = {
                type: "definition",
                fill: ${JSON.stringify(fill)},
                stroke: ${JSON.stringify(stroke)},
                transform: ${JSON.stringify(transform)}
              };
              break;
          }
          
          // Step 2: Select target objects
          switch("${targetSelection}") {
            case "current_selection":
              for (var j = 0; j < doc.selection.length; j++) {
                targetObjects.push(doc.selection[j]);
              }
              break;
              
            case "all":
              for (var k = 0; k < doc.pageItems.length; k++) {
                targetObjects.push(doc.pageItems[k]);
              }
              break;
              
            case "by_type":
              var types = ${JSON.stringify(objectTypes)};
              for (var m = 0; m < doc.pageItems.length; m++) {
                var item = doc.pageItems[m];
                var itemType = "";
                
                switch(item.typename) {
                  case "PathItem": itemType = "path"; break;
                  case "TextFrame": itemType = "text"; break;
                  case "PlacedItem": itemType = "image"; break;
                  case "CompoundPathItem": itemType = "compound"; break;
                  case "GroupItem": itemType = "group"; break;
                  default: itemType = "other"; break;
                }
                
                if (types.indexOf(itemType) !== -1) {
                  targetObjects.push(item);
                }
              }
              break;
              
            case "by_name":
              if ("${namePattern}" === "") {
                throw new Error("Name pattern required for by_name selection");
              }
              
              var pattern = "${namePattern}";
              var isWildcard = pattern.indexOf("*") !== -1;
              
              for (var n = 0; n < doc.pageItems.length; n++) {
                var item = doc.pageItems[n];
                var itemName = item.name || "";
                
                var matches = false;
                if (isWildcard) {
                  var regexPattern = pattern.replace(/\\*/g, ".*");
                  var regex = new RegExp(regexPattern, "i");
                  matches = regex.test(itemName);
                } else {
                  matches = (itemName.toLowerCase().indexOf(pattern.toLowerCase()) !== -1);
                }
                
                if (matches) {
                  targetObjects.push(item);
                }
              }
              break;
              
            case "by_layer":
              if ("${layerName}" === "") {
                throw new Error("Layer name required for by_layer selection");
              }
              
              var targetLayer = null;
              for (var p = 0; p < doc.layers.length; p++) {
                if (doc.layers[p].name === "${layerName}") {
                  targetLayer = doc.layers[p];
                  break;
                }
              }
              
              if (!targetLayer) {
                throw new Error("Layer not found: ${layerName}");
              }
              
              for (var q = 0; q < doc.pageItems.length; q++) {
                if (doc.pageItems[q].layer === targetLayer) {
                  targetObjects.push(doc.pageItems[q]);
                }
              }
              break;
          }
          
          // Apply exclusion pattern if specified
          if ("${excludePattern || ''}" !== "") {
            var filteredObjects = [];
            var excludePattern = "${excludePattern}";
            var isExcludeWildcard = excludePattern.indexOf("*") !== -1;
            
            for (var r = 0; r < targetObjects.length; r++) {
              var item = targetObjects[r];
              var itemName = item.name || "";
              
              var excluded = false;
              if (isExcludeWildcard) {
                var excludeRegexPattern = excludePattern.replace(/\\*/g, ".*");
                var excludeRegex = new RegExp(excludeRegexPattern, "i");
                excluded = excludeRegex.test(itemName);
              } else {
                excluded = (itemName.toLowerCase().indexOf(excludePattern.toLowerCase()) !== -1);
              }
              
              if (!excluded) {
                filteredObjects.push(item);
              }
            }
            
            targetObjects = filteredObjects;
          }
          
          if (targetObjects.length === 0) {
            throw new Error("No objects found matching the target criteria");
          }
          
          // Step 3: Apply styles in batches
          var preserveProps = ${JSON.stringify(preserveProperties)};
          var batchSize = ${batchSize};
          var totalBatches = Math.ceil(targetObjects.length / batchSize);
          
          function applyStyleToItem(item, sourceStyle, applicationMode, preserveProps) {
            try {
              var originalProps = {};
              
              // Preserve specified properties
              if (preserveProps.indexOf("position") !== -1) {
                originalProps.position = item.position;
              }
              if (preserveProps.indexOf("size") !== -1) {
                originalProps.width = item.width;
                originalProps.height = item.height;
              }
              if (preserveProps.indexOf("rotation") !== -1) {
                originalProps.rotation = item.rotation;
              }
              if (preserveProps.indexOf("opacity") !== -1) {
                originalProps.opacity = item.opacity;
              }
              
              // Apply style based on source type
              if (sourceStyle.type === "graphicStyle") {
                sourceStyle.style.applyTo(item);
              } else if (sourceStyle.type === "template") {
                var template = sourceStyle;
                
                if (applicationMode === "replace" || applicationMode === "merge") {
                  // Apply fill
                  if (template.fill && template.fill.enabled) {
                    item.filled = true;
                    if (template.fill.color) {
                      item.fillColor = template.fill.color;
                    }
                  } else if (applicationMode === "replace") {
                    item.filled = false;
                  }
                  
                  // Apply stroke
                  if (template.stroke && template.stroke.enabled) {
                    item.stroked = true;
                    if (template.stroke.color) item.strokeColor = template.stroke.color;
                    if (template.stroke.width) item.strokeWidth = template.stroke.width;
                    if (template.stroke.cap) item.strokeCap = template.stroke.cap;
                    if (template.stroke.join) item.strokeJoin = template.stroke.join;
                  } else if (applicationMode === "replace") {
                    item.stroked = false;
                  }
                }
              } else if (sourceStyle.type === "definition") {
                var def = sourceStyle;
                
                // Apply fill from definition
                if (def.fill && (applicationMode === "replace" || applicationMode === "merge")) {
                  if (def.fill.enabled !== false) {
                    item.filled = true;
                    if (def.fill.color) {
                      var fillHex = def.fill.color.replace("#", "");
                      var fillColor = new RGBColor();
                      fillColor.red = parseInt(fillHex.substring(0, 2), 16);
                      fillColor.green = parseInt(fillHex.substring(2, 4), 16);
                      fillColor.blue = parseInt(fillHex.substring(4, 6), 16);
                      item.fillColor = fillColor;
                    }
                  } else if (applicationMode === "replace") {
                    item.filled = false;
                  }
                }
                
                // Apply stroke from definition
                if (def.stroke && (applicationMode === "replace" || applicationMode === "merge")) {
                  if (def.stroke.enabled) {
                    item.stroked = true;
                    if (def.stroke.color) {
                      var strokeHex = def.stroke.color.replace("#", "");
                      var strokeColor = new RGBColor();
                      strokeColor.red = parseInt(strokeHex.substring(0, 2), 16);
                      strokeColor.green = parseInt(strokeHex.substring(2, 4), 16);
                      strokeColor.blue = parseInt(strokeHex.substring(4, 6), 16);
                      item.strokeColor = strokeColor;
                    }
                    if (def.stroke.width) item.strokeWidth = def.stroke.width;
                  } else if (applicationMode === "replace") {
                    item.stroked = false;
                  }
                }
                
                // Apply transform from definition
                if (def.transform) {
                  if (def.transform.scale !== undefined) {
                    item.resize(def.transform.scale * 100, def.transform.scale * 100);
                  }
                  if (def.transform.scaleX !== undefined && def.transform.scaleY !== undefined) {
                    item.resize(def.transform.scaleX * 100, def.transform.scaleY * 100);
                  }
                  if (def.transform.rotation !== undefined) {
                    item.rotate(def.transform.rotation);
                  }
                  if (def.transform.opacity !== undefined) {
                    item.opacity = def.transform.opacity;
                  }
                }
              }
              
              // Restore preserved properties
              if (originalProps.position) item.position = originalProps.position;
              if (originalProps.width) item.width = originalProps.width;
              if (originalProps.height) item.height = originalProps.height;
              if (originalProps.rotation) item.rotation = originalProps.rotation;
              if (originalProps.opacity) item.opacity = originalProps.opacity;
              
              return true;
            } catch (e) {
              return false;
            }
          }
          
          // Process in batches
          for (var batch = 0; batch < totalBatches; batch++) {
            var startIdx = batch * batchSize;
            var endIdx = Math.min(startIdx + batchSize, targetObjects.length);
            
            for (var idx = startIdx; idx < endIdx; idx++) {
              var success = applyStyleToItem(
                targetObjects[idx],
                sourceStyle,
                "${applicationMode}",
                preserveProps
              );
              
              if (success) {
                processedCount++;
              } else {
                errorCount++;
              }
            }
            
            // Progress reporting
            if (${reportProgress} && totalBatches > 1) {
              var progress = Math.round((batch + 1) / totalBatches * 100);
              // Note: Progress reporting in ExtendScript is limited
            }
          }
          
          var result = "Bulk style application completed";
          result += "\\\\\\\\nProcessed: " + processedCount + " objects";
          result += "\\\\\\\\nErrors: " + errorCount;
          result += "\\\\\\\\nSource: ${styleSource}";
          result += "\\\\\\\\nMode: ${applicationMode}";
          result += "\\\\\\\\nPreserved: " + preserveProps.join(", ");
          
          result;
          
        } catch (e) {
          "Error: " + e.message;
        }
      `;
      
      const result = await executeExtendScriptForApp(script, 'illustrator');
      
      return {
        content: [{
          type: "text" as const,
          text: result.success ? result.result || "Bulk style application completed" : `Error: ${result.error}`
        }]
      };
    })
  );
  
  console.error("Registered Illustrator style tools");
}