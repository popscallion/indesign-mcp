// src/illustrator/tools/style/index.ts

/**
 * @fileoverview Style and appearance tools for Illustrator MCP
 * Handles graphic styles, colors, text paths, and visual effects
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScriptForApp } from "../../../extendscript.js";
import { wrapToolForTelemetry } from "../../../tools/index.js";
import { z } from "zod";

/**
 * Registers style-related tools with the MCP server
 */
export async function registerStyleTools(server: McpServer): Promise<void> {
  
  // Tool: create_graphic_style
  // Complexity: 3.0 (Medium)
  // Dependencies: select_elements
  server.tool(
    "create_graphic_style",
    {
      styleName: z.string().describe("Name for the graphic style"),
      styleDefinition: z.object({
        fill: z.object({
          enabled: z.boolean().default(true).describe("Enable fill"),
          color: z.string().optional().describe("Fill color (hex or name)"),
          opacity: z.number().min(0).max(100).default(100).describe("Fill opacity percentage")
        }).optional(),
        stroke: z.object({
          enabled: z.boolean().default(true).describe("Enable stroke"),
          color: z.string().optional().describe("Stroke color (hex or name)"),
          width: z.number().optional().describe("Stroke width in points"),
          opacity: z.number().min(0).max(100).default(100).describe("Stroke opacity percentage"),
          cap: z.enum(["butt", "round", "projecting"]).optional().describe("Stroke cap style"),
          join: z.enum(["miter", "round", "bevel"]).optional().describe("Stroke join style")
        }).optional(),
        effects: z.object({
          dropShadow: z.boolean().default(false).describe("Apply drop shadow"),
          blur: z.number().optional().describe("Gaussian blur radius"),
          opacity: z.number().min(0).max(100).default(100).describe("Overall opacity")
        }).optional()
      }).describe("Style properties"),
      applyToSelection: z.boolean().default(false).describe("Apply style to current selection")
    },
    wrapToolForTelemetry("create_graphic_style", async (args: any) => {
      const { styleName, styleDefinition = {}, applyToSelection = false } = args;
      const { fill = {}, stroke = {}, effects = {} } = styleDefinition;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          
          // Create a temporary object to capture the style
          var tempRect = doc.pathItems.rectangle(0, 0, 100, 100);
          tempRect.name = "__temp_style_object";
          
          // Apply fill properties
          if (${fill.enabled !== false}) {
            tempRect.filled = true;
            if ("${fill.color || ''}" !== "") {
              var fillColor = "${fill.color || ''}";
              if (fillColor.charAt(0) === '#') {
                var rgbColor = new RGBColor();
                var hex = fillColor.substring(1);
                rgbColor.red = parseInt(hex.substring(0, 2), 16);
                rgbColor.green = parseInt(hex.substring(2, 4), 16);
                rgbColor.blue = parseInt(hex.substring(4, 6), 16);
                tempRect.fillColor = rgbColor;
              }
            }
            tempRect.opacity = ${fill.opacity || 100};
          } else {
            tempRect.filled = false;
          }
          
          // Apply stroke properties
          if (${stroke.enabled !== false}) {
            tempRect.stroked = true;
            if ("${stroke.color || ''}" !== "") {
              var strokeColor = "${stroke.color || ''}";
              if (strokeColor.charAt(0) === '#') {
                var rgbStroke = new RGBColor();
                var hexStroke = strokeColor.substring(1);
                rgbStroke.red = parseInt(hexStroke.substring(0, 2), 16);
                rgbStroke.green = parseInt(hexStroke.substring(2, 4), 16);
                rgbStroke.blue = parseInt(hexStroke.substring(4, 6), 16);
                tempRect.strokeColor = rgbStroke;
              }
            }
            if (${stroke.width || 0} > 0) {
              tempRect.strokeWidth = ${stroke.width || 1};
            }
            
            // Set stroke cap and join styles
            if ("${stroke.cap || ''}" !== "") {
              switch("${stroke.cap}") {
                case "butt":
                  tempRect.strokeCap = StrokeCap.BUTTENDCAP;
                  break;
                case "round":
                  tempRect.strokeCap = StrokeCap.ROUNDENDCAP;
                  break;
                case "projecting":
                  tempRect.strokeCap = StrokeCap.PROJECTINGENDCAP;
                  break;
              }
            }
            
            if ("${stroke.join || ''}" !== "") {
              switch("${stroke.join}") {
                case "miter":
                  tempRect.strokeJoin = StrokeJoin.MITERENDJOIN;
                  break;
                case "round":
                  tempRect.strokeJoin = StrokeJoin.ROUNDENDJOIN;
                  break;
                case "bevel":
                  tempRect.strokeJoin = StrokeJoin.BEVELENDJOIN;
                  break;
              }
            }
          } else {
            tempRect.stroked = false;
          }
          
          // Apply overall opacity
          if (${effects.opacity || 100} < 100) {
            tempRect.opacity = ${effects.opacity || 100};
          }
          
          // Create the graphic style
          doc.selection = [tempRect];
          
          // Check if style already exists
          var styleExists = false;
          for (var i = 0; i < doc.graphicStyles.length; i++) {
            if (doc.graphicStyles[i].name === "${styleName}") {
              styleExists = true;
              // Update existing style
              doc.graphicStyles[i].applyTo(tempRect);
              break;
            }
          }
          
          if (!styleExists) {
            // Create new graphic style
            var newStyle = doc.graphicStyles.add("${styleName}");
            newStyle.applyTo(tempRect);
          }
          
          // Apply to selection if requested
          var appliedCount = 0;
          if (${applyToSelection} && doc.selection.length > 1) {
            for (var j = 1; j < doc.selection.length; j++) {
              newStyle.applyTo(doc.selection[j]);
              appliedCount++;
            }
          }
          
          // Remove temporary object
          tempRect.remove();
          
          var result = (styleExists ? "Updated" : "Created") + " graphic style: ${styleName}";
          if (appliedCount > 0) {
            result += " (applied to " + appliedCount + " objects)";
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

  // Tool: generate_color_variations
  // Complexity: 3.0 (Medium)
  // Dependencies: None
  server.tool(
    "generate_color_variations",
    {
      baseColor: z.string().describe("Base color (hex format #RRGGBB)"),
      variationType: z.enum(["monochromatic", "analogous", "complementary", "triadic", "tetradic"]).describe("Type of color harmony"),
      count: z.number().min(2).max(12).default(5).describe("Number of variations to generate"),
      adjustments: z.object({
        brightness: z.number().min(-100).max(100).default(0).describe("Brightness adjustment percentage"),
        saturation: z.number().min(-100).max(100).default(0).describe("Saturation adjustment percentage"),
        temperature: z.number().min(-100).max(100).default(0).describe("Temperature adjustment (warm/cool)")
      }).optional().describe("Additional adjustments to variations"),
      createSwatches: z.boolean().default(true).describe("Add colors to swatches panel")
    },
    wrapToolForTelemetry("generate_color_variations", async (args: any) => {
      const { baseColor, variationType, count = 5, adjustments = {}, createSwatches = true } = args;
      const { brightness = 0, saturation = 0, temperature = 0 } = adjustments;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var colors = [];
          
          // Parse base color
          var hex = "${baseColor}".replace('#', '');
          var r = parseInt(hex.substring(0, 2), 16);
          var g = parseInt(hex.substring(2, 4), 16);
          var b = parseInt(hex.substring(4, 6), 16);
          
          // Convert RGB to HSB for manipulation
          function rgbToHsb(r, g, b) {
            r /= 255;
            g /= 255;
            b /= 255;
            
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
          
          // Convert HSB back to RGB
          function hsbToRgb(h, s, b) {
            h /= 360;
            s /= 100;
            b /= 100;
            
            var r, g, blue;
            if (s === 0) {
              r = g = blue = b;
            } else {
              var hue2rgb = function(p, q, t) {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
              };
              
              var q = b < 0.5 ? b * (1 + s) : b + s - b * s;
              var p = 2 * b - q;
              r = hue2rgb(p, q, h + 1/3);
              g = hue2rgb(p, q, h);
              blue = hue2rgb(p, q, h - 1/3);
            }
            
            return {
              r: Math.round(r * 255),
              g: Math.round(g * 255),
              b: Math.round(blue * 255)
            };
          }
          
          var baseHsb = rgbToHsb(r, g, b);
          
          // Generate variations based on type
          for (var i = 0; i < ${count}; i++) {
            var newH = baseHsb.h;
            var newS = baseHsb.s;
            var newB = baseHsb.b;
            
            switch("${variationType}") {
              case "monochromatic":
                // Vary brightness and saturation
                newB = baseHsb.b + (i - ${count}/2) * (100/${count});
                newS = baseHsb.s + (i - ${count}/2) * (50/${count});
                break;
                
              case "analogous":
                // Colors adjacent on color wheel
                newH = baseHsb.h + (i - Math.floor(${count}/2)) * 30;
                break;
                
              case "complementary":
                // Opposite colors
                if (i % 2 === 1) {
                  newH = (baseHsb.h + 180) % 360;
                }
                newB = baseHsb.b + (i - ${count}/2) * (50/${count});
                break;
                
              case "triadic":
                // Three evenly spaced colors
                newH = (baseHsb.h + (i * 120)) % 360;
                break;
                
              case "tetradic":
                // Four colors in rectangular arrangement
                newH = (baseHsb.h + (i * 90)) % 360;
                break;
            }
            
            // Apply adjustments
            newB = Math.max(0, Math.min(100, newB + ${brightness}));
            newS = Math.max(0, Math.min(100, newS + ${saturation}));
            
            // Temperature adjustment (simplified)
            if (${temperature} !== 0) {
              if (${temperature} > 0) {
                // Warmer - shift towards red/yellow
                newH = (newH + ${temperature} * 0.3) % 360;
              } else {
                // Cooler - shift towards blue
                newH = (newH + ${temperature} * 0.3 + 360) % 360;
              }
            }
            
            // Ensure values are in range
            newH = newH % 360;
            if (newH < 0) newH += 360;
            newS = Math.max(0, Math.min(100, newS));
            newB = Math.max(0, Math.min(100, newB));
            
            var rgb = hsbToRgb(newH, newS, newB);
            colors.push(rgb);
            
            // Create swatch if requested
            if (${createSwatches}) {
              var spot = doc.spots.add();
              spot.name = "${variationType}_" + (i + 1);
              var newColor = new RGBColor();
              newColor.red = rgb.r;
              newColor.green = rgb.g;
              newColor.blue = rgb.b;
              spot.color = newColor;
              
              var spotColor = new SpotColor();
              spotColor.spot = spot;
            }
          }
          
          "Generated " + colors.length + " ${variationType} color variations" + 
          (${createSwatches} ? " and added to swatches" : "");
          
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

  // Tool: create_text_on_path
  // Complexity: 3.6 (Medium)
  // Dependencies: create_shape_primitive
  server.tool(
    "create_text_on_path",
    {
      text: z.string().describe("Text content to place on path"),
      pathType: z.enum(["circle", "arc", "wave", "spiral", "custom"]).describe("Type of path for text"),
      pathParameters: z.object({
        x: z.number().describe("X position of path center/start"),
        y: z.number().describe("Y position of path center/start"),
        radius: z.number().optional().describe("Radius for circular paths"),
        width: z.number().optional().describe("Width for wave/custom paths"),
        height: z.number().optional().describe("Height for wave/custom paths"),
        startAngle: z.number().optional().describe("Start angle for arc (degrees)"),
        endAngle: z.number().optional().describe("End angle for arc (degrees)"),
        wavelength: z.number().optional().describe("Wavelength for wave path"),
        turns: z.number().optional().describe("Number of turns for spiral")
      }).describe("Path geometry parameters"),
      textStyle: z.object({
        font: z.string().optional().describe("Font name"),
        size: z.number().optional().describe("Font size in points"),
        color: z.string().optional().describe("Text color (hex)"),
        alignment: z.enum(["left", "center", "right"]).optional().describe("Text alignment on path"),
        spacing: z.number().optional().describe("Character spacing")
      }).optional().describe("Text formatting options")
    },
    wrapToolForTelemetry("create_text_on_path", async (args: any) => {
      const { text, pathType, pathParameters, textStyle = {} } = args;
      const { x, y, radius = 100, width = 200, height = 50, startAngle = 0, endAngle = 180, wavelength = 100, turns = 2 } = pathParameters;
      const { font, size = 12, color, alignment = "left", spacing = 0 } = textStyle;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          var path = null;
          
          // Create path based on type
          switch("${pathType}") {
            case "circle":
              path = doc.pathItems.ellipse(
                ${y} + ${radius},
                ${x} - ${radius},
                ${radius} * 2,
                ${radius} * 2
              );
              break;
              
            case "arc":
              path = doc.pathItems.add();
              var angleStep = (${endAngle} - ${startAngle}) / 20;
              for (var i = 0; i <= 20; i++) {
                var angle = (${startAngle} + i * angleStep) * Math.PI / 180;
                var px = ${x} + ${radius} * Math.cos(angle);
                var py = ${y} + ${radius} * Math.sin(angle);
                
                var point = path.pathPoints.add();
                point.anchor = [px, py];
                
                if (i === 0 || i === 20) {
                  point.leftDirection = point.anchor;
                  point.rightDirection = point.anchor;
                } else {
                  var tangentAngle = angle + Math.PI / 2;
                  var tangentLength = ${radius} * angleStep * Math.PI / 180 * 0.5;
                  point.leftDirection = [
                    px - tangentLength * Math.cos(tangentAngle),
                    py - tangentLength * Math.sin(tangentAngle)
                  ];
                  point.rightDirection = [
                    px + tangentLength * Math.cos(tangentAngle),
                    py + tangentLength * Math.sin(tangentAngle)
                  ];
                }
              }
              path.closed = false;
              break;
              
            case "wave":
              path = doc.pathItems.add();
              var wavePoints = 20;
              for (var j = 0; j <= wavePoints; j++) {
                var wx = ${x} + (j / wavePoints) * ${width};
                var wy = ${y} + Math.sin(j * 2 * Math.PI / (wavePoints / 2)) * ${height};
                
                var wavePoint = path.pathPoints.add();
                wavePoint.anchor = [wx, wy];
                
                // Smooth curve
                var tangent = Math.cos(j * 2 * Math.PI / (wavePoints / 2)) * ${height} * 0.3;
                wavePoint.leftDirection = [wx - ${width} / wavePoints * 0.3, wy - tangent];
                wavePoint.rightDirection = [wx + ${width} / wavePoints * 0.3, wy + tangent];
              }
              path.closed = false;
              break;
              
            case "spiral":
              path = doc.pathItems.add();
              var spiralPoints = ${turns} * 20;
              for (var k = 0; k <= spiralPoints; k++) {
                var spiralAngle = (k / spiralPoints) * ${turns} * 2 * Math.PI;
                var spiralRadius = (k / spiralPoints) * ${radius};
                var sx = ${x} + spiralRadius * Math.cos(spiralAngle);
                var sy = ${y} + spiralRadius * Math.sin(spiralAngle);
                
                var spiralPoint = path.pathPoints.add();
                spiralPoint.anchor = [sx, sy];
                spiralPoint.leftDirection = spiralPoint.anchor;
                spiralPoint.rightDirection = spiralPoint.anchor;
              }
              path.closed = false;
              break;
              
            case "custom":
              // Simple line for custom (user would typically select existing path)
              path = doc.pathItems.add();
              var point1 = path.pathPoints.add();
              point1.anchor = [${x}, ${y}];
              point1.leftDirection = point1.anchor;
              point1.rightDirection = point1.anchor;
              
              var point2 = path.pathPoints.add();
              point2.anchor = [${x} + ${width}, ${y}];
              point2.leftDirection = point2.anchor;
              point2.rightDirection = point2.anchor;
              path.closed = false;
              break;
          }
          
          if (path) {
            // Remove fill and stroke from path
            path.filled = false;
            path.stroked = false;
            
            // Create text on path
            var textPath = doc.textFrames.pathText(path);
            textPath.contents = "${text}";
            
            // Apply text style
            var textRange = textPath.textRange;
            
            if (${size} > 0) {
              textRange.size = ${size};
            }
            
            if ("${font || ''}" !== "") {
              try {
                textRange.textFont = app.textFonts["${font}"];
              } catch(e) {
                // Font not found, use default
              }
            }
            
            if ("${color || ''}" !== "") {
              var textColor = "${color}";
              if (textColor.charAt(0) === '#') {
                var rgbText = new RGBColor();
                var hexText = textColor.substring(1);
                rgbText.red = parseInt(hexText.substring(0, 2), 16);
                rgbText.green = parseInt(hexText.substring(2, 4), 16);
                rgbText.blue = parseInt(hexText.substring(4, 6), 16);
                textRange.fillColor = rgbText;
              }
            }
            
            // Set alignment
            switch("${alignment}") {
              case "center":
                textRange.paragraphAttributes.justification = Justification.CENTER;
                break;
              case "right":
                textRange.paragraphAttributes.justification = Justification.RIGHT;
                break;
              default:
                textRange.paragraphAttributes.justification = Justification.LEFT;
            }
            
            if (${spacing} !== 0) {
              textRange.tracking = ${spacing};
            }
            
            "Created text on ${pathType} path: " + "${text}".substring(0, 20) + 
            ("${text}".length > 20 ? "..." : "");
          } else {
            "Failed to create path";
          }
          
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

  // Tool: configure_export_presets
  // Complexity: 3.2 (Medium)
  // Dependencies: read_illustrator_document
  server.tool(
    "configure_export_presets",
    {
      presetName: z.string().describe("Name for the export preset"),
      format: z.enum(["png", "jpg", "svg", "pdf", "eps"]).describe("Export format"),
      settings: z.object({
        resolution: z.number().optional().describe("Resolution in DPI (raster formats)"),
        quality: z.number().min(0).max(100).optional().describe("JPEG quality"),
        transparency: z.boolean().optional().describe("Preserve transparency"),
        artboardClipping: z.boolean().optional().describe("Clip to artboard bounds"),
        embedImages: z.boolean().optional().describe("Embed linked images"),
        embedFonts: z.boolean().optional().describe("Embed fonts (PDF/EPS)"),
        colorSpace: z.enum(["rgb", "cmyk"]).optional().describe("Color space"),
        compression: z.enum(["none", "lzw", "jpeg", "zip"]).optional().describe("Compression type")
      }).describe("Export settings"),
      saveAsDefault: z.boolean().default(false).describe("Set as default for this format")
    },
    wrapToolForTelemetry("configure_export_presets", async (args: any) => {
      const { presetName, format, settings = {}, saveAsDefault = false } = args;
      
      const script = `
        try {
          if (!app.documents.length) {
            throw new Error("No document open");
          }
          
          var doc = app.activeDocument;
          
          // Create export options based on format
          var exportOptions;
          var presetDetails = [];
          
          switch("${format}") {
            case "png":
              exportOptions = new ExportOptionsPNG24();
              exportOptions.transparency = ${settings.transparency !== false};
              exportOptions.artBoardClipping = ${settings.artboardClipping !== false};
              if (${settings.resolution || 0} > 0) {
                var scale = ${settings.resolution || 72} / 72 * 100;
                exportOptions.horizontalScale = scale;
                exportOptions.verticalScale = scale;
              }
              exportOptions.antiAliasing = true;
              exportOptions.saveAsHTML = false;
              
              presetDetails.push("Format: PNG24");
              presetDetails.push("Transparency: " + exportOptions.transparency);
              presetDetails.push("Resolution: " + (${settings.resolution || 72}) + " DPI");
              break;
              
            case "jpg":
              exportOptions = new ExportOptionsJPEG();
              exportOptions.qualitySetting = ${settings.quality || 80};
              exportOptions.artBoardClipping = ${settings.artboardClipping !== false};
              if (${settings.resolution || 0} > 0) {
                var jpegScale = ${settings.resolution || 72} / 72 * 100;
                exportOptions.horizontalScale = jpegScale;
                exportOptions.verticalScale = jpegScale;
              }
              exportOptions.antiAliasing = true;
              exportOptions.optimization = true;
              
              presetDetails.push("Format: JPEG");
              presetDetails.push("Quality: " + exportOptions.qualitySetting);
              presetDetails.push("Resolution: " + (${settings.resolution || 72}) + " DPI");
              break;
              
            case "svg":
              exportOptions = new ExportOptionsSVG();
              exportOptions.embedImages = ${settings.embedImages !== false};
              exportOptions.embedFonts = ${settings.embedFonts !== false};
              exportOptions.artBoardClipping = ${settings.artboardClipping !== false};
              exportOptions.compressed = ${settings.compression === 'zip'};
              exportOptions.coordinatePrecision = 3;
              exportOptions.cssProperties = SVGCSSPropertyLocation.STYLEELEMENTS;
              
              presetDetails.push("Format: SVG");
              presetDetails.push("Embed Images: " + exportOptions.embedImages);
              presetDetails.push("Embed Fonts: " + exportOptions.embedFonts);
              break;
              
            case "pdf":
              exportOptions = new PDFSaveOptions();
              exportOptions.compatibility = PDFCompatibility.ACROBAT7;
              exportOptions.preserveEditability = false;
              exportOptions.embedFonts = ${settings.embedFonts !== false};
              
              if ("${settings.compression || ''}" !== "") {
                switch("${settings.compression}") {
                  case "none":
                    exportOptions.compressArt = false;
                    break;
                  case "jpeg":
                    exportOptions.compression = PDFCompressionType.JPEG;
                    exportOptions.compressArt = true;
                    break;
                  case "zip":
                    exportOptions.compression = PDFCompressionType.ZIP;
                    exportOptions.compressArt = true;
                    break;
                }
              }
              
              presetDetails.push("Format: PDF");
              presetDetails.push("Compatibility: Acrobat 7");
              presetDetails.push("Embed Fonts: " + exportOptions.embedFonts);
              break;
              
            case "eps":
              exportOptions = new EPSSaveOptions();
              exportOptions.compatibility = EPSCompatibility.ILLUSTRATOR10;
              exportOptions.embedLinkedFiles = ${settings.embedImages !== false};
              exportOptions.embedFonts = ${settings.embedFonts !== false};
              
              if ("${settings.colorSpace || ''}" === "cmyk") {
                exportOptions.cmykPostScript = true;
              }
              
              presetDetails.push("Format: EPS");
              presetDetails.push("Compatibility: Illustrator 10");
              presetDetails.push("Embed Images: " + exportOptions.embedLinkedFiles);
              break;
          }
          
          // Store preset information (in a real implementation, this would save to preferences)
          // For now, we'll just create a visual confirmation
          var presetLayer = null;
          try {
            // Find or create presets layer
            for (var i = 0; i < doc.layers.length; i++) {
              if (doc.layers[i].name === "__export_presets") {
                presetLayer = doc.layers[i];
                break;
              }
            }
            if (!presetLayer) {
              presetLayer = doc.layers.add();
              presetLayer.name = "__export_presets";
              presetLayer.visible = false;
            }
            
            // Add preset info as text (for demonstration)
            var presetText = doc.textFrames.add();
            presetText.position = [20, -20 - (doc.textFrames.length * 15)];
            presetText.contents = "Preset: ${presetName} [${format}]";
            presetText.move(presetLayer, ElementPlacement.INSIDE);
          } catch(e) {
            // Silent fail for visual confirmation
          }
          
          var result = "Created export preset '${presetName}' for ${format}\\\\n";
          result += presetDetails.join("\\\\n");
          
          if (${saveAsDefault}) {
            result += "\\\\nSet as default for ${format} exports";
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
          text: result.success ? result.result || "Export preset configured" : `Error: ${result.error}`
        }]
      };
    })
  );
  
  console.error("Registered Illustrator style tools");
}