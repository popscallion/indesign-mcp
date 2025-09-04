// src/illustrator/tools/analysis/index.ts

/**
 * @fileoverview Analysis and measurement tools for Illustrator MCP
 * Provides color analysis, font usage, path complexity, and performance metrics
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScriptForApp } from "@mcp/shared/extendscript.js";
import { wrapToolForTelemetry } from "@mcp/shared/telemetryWrapper.js";
import { z } from "zod";

/**
 * Registers analysis-related tools with the MCP server
 */
export async function registerAnalysisTools(server: McpServer): Promise<void> {
  
  // Tool: analyze_color_usage
  // Complexity: 3.8 (Medium-High)
  // Dependencies: read_illustrator_document
  server.tool(
    "analyze_color_usage",
    {
      scope: z.enum(["document", "selection", "layer", "artboard"]).default("document"),
      layerName: z.string().optional().describe("Layer name if scope is 'layer'"),
      artboardIndex: z.number().optional().describe("Artboard index if scope is 'artboard'"),
      analysisOptions: z.object({
        includeGradients: z.boolean().default(true).describe("Include gradient colors"),
        includePatterns: z.boolean().default(true).describe("Include pattern colors"),
        groupByMode: z.boolean().default(true).describe("Group colors by color mode (RGB, CMYK, etc.)"),
        calculateHarmony: z.boolean().default(true).describe("Calculate color harmony relationships"),
        threshold: z.number().min(0).max(100).default(5).describe("Similarity threshold for grouping (0-100)")
      }).optional()
    },
    wrapToolForTelemetry("analyze_color_usage", async (args: any) => {
      const { scope = "document", layerName, artboardIndex, analysisOptions = {} } = args;
      const {
        includeGradients = true,
        includePatterns = true,
        groupByMode = true,
        calculateHarmony = true,
        threshold = 5
      } = analysisOptions;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var scope = ${JSON.stringify(scope)};
          var layerName = ${JSON.stringify(layerName || "")};
          var artboardIndex = ${artboardIndex !== undefined ? artboardIndex : "null"};
          var includeGradients = ${includeGradients};
          var includePatterns = ${includePatterns};
          var groupByMode = ${groupByMode};
          var calculateHarmony = ${calculateHarmony};
          var threshold = ${threshold};
          
          var colors = [];
          var gradients = [];
          var patterns = [];
          var items = [];
          
          // Get items based on scope
          function getItemsInScope() {
            var scopeItems = [];
            
            switch (scope) {
              case "selection":
                scopeItems = app.selection;
                break;
                
              case "layer":
                if (layerName) {
                  for (var i = 0; i < doc.layers.length; i++) {
                    if (doc.layers[i].name === layerName) {
                      scopeItems = doc.layers[i].pageItems;
                      break;
                    }
                  }
                }
                break;
                
              case "artboard":
                if (artboardIndex !== null) {
                  var artboard = doc.artboards[artboardIndex];
                  var bounds = artboard.artboardRect;
                  
                  for (var i = 0; i < doc.pageItems.length; i++) {
                    var item = doc.pageItems[i];
                    var itemBounds = item.geometricBounds;
                    // Check if item is within artboard
                    if (itemBounds[0] >= bounds[0] && itemBounds[2] <= bounds[2] &&
                        itemBounds[1] <= bounds[1] && itemBounds[3] >= bounds[3]) {
                      scopeItems.push(item);
                    }
                  }
                }
                break;
                
              default: // document
                scopeItems = doc.pageItems;
                break;
            }
            
            return scopeItems;
          }
          
          items = getItemsInScope();
          
          // Extract colors from items
          function extractColor(color) {
            if (!color) return null;
            
            var colorData = {
              type: color.typename,
              mode: "",
              values: {},
              hex: ""
            };
            
            switch (color.typename) {
              case "RGBColor":
                colorData.mode = "RGB";
                colorData.values = {
                  r: Math.round(color.red),
                  g: Math.round(color.green),
                  b: Math.round(color.blue)
                };
                colorData.hex = "#" + 
                  ("0" + colorData.values.r.toString(16)).slice(-2) +
                  ("0" + colorData.values.g.toString(16)).slice(-2) +
                  ("0" + colorData.values.b.toString(16)).slice(-2);
                break;
                
              case "CMYKColor":
                colorData.mode = "CMYK";
                colorData.values = {
                  c: Math.round(color.cyan),
                  m: Math.round(color.magenta),
                  y: Math.round(color.yellow),
                  k: Math.round(color.black)
                };
                break;
                
              case "GrayColor":
                colorData.mode = "Gray";
                colorData.values = { gray: Math.round(color.gray) };
                break;
                
              case "SpotColor":
                colorData.mode = "Spot";
                colorData.values = { name: color.spot.name };
                if (color.tint !== undefined) {
                  colorData.values.tint = color.tint;
                }
                break;
                
              case "GradientColor":
                if (includeGradients) {
                  colorData.mode = "Gradient";
                  colorData.values = {
                    type: color.gradient.type,
                    stops: []
                  };
                  for (var i = 0; i < color.gradient.gradientStops.length; i++) {
                    var stop = color.gradient.gradientStops[i];
                    colorData.values.stops.push({
                      position: stop.rampPoint,
                      color: extractColor(stop.color)
                    });
                  }
                  gradients.push(colorData);
                }
                return null; // Don't add to main colors array
                
              case "PatternColor":
                if (includePatterns) {
                  colorData.mode = "Pattern";
                  colorData.values = { name: color.pattern.name };
                  patterns.push(colorData);
                }
                return null; // Don't add to main colors array
            }
            
            return colorData;
          }
          
          // Process all items
          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            
            // Check fill color
            if (item.filled && item.fillColor) {
              var fillColor = extractColor(item.fillColor);
              if (fillColor) colors.push(fillColor);
            }
            
            // Check stroke color
            if (item.stroked && item.strokeColor) {
              var strokeColor = extractColor(item.strokeColor);
              if (strokeColor) colors.push(strokeColor);
            }
            
            // Check text colors
            if (item.typename === "TextFrame") {
              for (var j = 0; j < item.textRanges.length; j++) {
                var range = item.textRanges[j];
                if (range.characterAttributes.fillColor) {
                  var textColor = extractColor(range.characterAttributes.fillColor);
                  if (textColor) colors.push(textColor);
                }
              }
            }
          }
          
          // Remove duplicates and group similar colors
          function areSimilarColors(c1, c2) {
            if (c1.mode !== c2.mode) return false;
            
            if (c1.mode === "RGB") {
              var diff = Math.sqrt(
                Math.pow(c1.values.r - c2.values.r, 2) +
                Math.pow(c1.values.g - c2.values.g, 2) +
                Math.pow(c1.values.b - c2.values.b, 2)
              );
              return diff < (threshold * 2.55); // Convert threshold to 0-255 scale
            }
            
            return JSON.stringify(c1.values) === JSON.stringify(c2.values);
          }
          
          var uniqueColors = [];
          var colorGroups = {};
          
          for (var i = 0; i < colors.length; i++) {
            var color = colors[i];
            var foundSimilar = false;
            
            for (var j = 0; j < uniqueColors.length; j++) {
              if (areSimilarColors(color, uniqueColors[j])) {
                foundSimilar = true;
                break;
              }
            }
            
            if (!foundSimilar) {
              uniqueColors.push(color);
              
              // Group by mode
              if (groupByMode) {
                if (!colorGroups[color.mode]) {
                  colorGroups[color.mode] = [];
                }
                colorGroups[color.mode].push(color);
              }
            }
          }
          
          // Calculate color harmony if requested
          var harmony = null;
          if (calculateHarmony && uniqueColors.length > 0) {
            // Simple harmony detection based on hue relationships
            harmony = {
              isMonochromatic: false,
              isComplementary: false,
              isAnalogous: false,
              isTriadic: false
            };
            
            // Convert RGB colors to HSB for harmony analysis
            var hues = [];
            for (var i = 0; i < uniqueColors.length; i++) {
              if (uniqueColors[i].mode === "RGB") {
                var rgb = uniqueColors[i].values;
                var r = rgb.r / 255;
                var g = rgb.g / 255;
                var b = rgb.b / 255;
                
                var max = Math.max(r, g, b);
                var min = Math.min(r, g, b);
                var delta = max - min;
                
                var hue = 0;
                if (delta !== 0) {
                  if (max === r) {
                    hue = ((g - b) / delta) % 6;
                  } else if (max === g) {
                    hue = (b - r) / delta + 2;
                  } else {
                    hue = (r - g) / delta + 4;
                  }
                  hue = Math.round(hue * 60);
                  if (hue < 0) hue += 360;
                  hues.push(hue);
                }
              }
            }
            
            // Check for harmony patterns
            if (hues.length > 0) {
              var hueRange = Math.max.apply(null, hues) - Math.min.apply(null, hues);
              harmony.isMonochromatic = hueRange < 30;
              harmony.isAnalogous = hueRange < 90 && hueRange > 30;
              harmony.isComplementary = hues.length === 2 && Math.abs(hues[0] - hues[1]) > 150 && Math.abs(hues[0] - hues[1]) < 210;
            }
          }
          
          JSON.stringify({
            success: true,
            totalColors: colors.length,
            uniqueColors: uniqueColors.length,
            colors: uniqueColors.slice(0, 20), // Return first 20 colors
            gradients: gradients.length,
            patterns: patterns.length,
            colorGroups: groupByMode ? colorGroups : null,
            harmony: harmony,
            scope: scope,
            itemsAnalyzed: items.length
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  // Tool: measure_font_usage
  // Complexity: 3.5 (Medium-High)
  // Dependencies: None
  server.tool(
    "measure_font_usage",
    {
      scope: z.enum(["document", "selection", "layer", "artboard"]).default("document"),
      layerName: z.string().optional().describe("Layer name if scope is 'layer'"),
      artboardIndex: z.number().optional().describe("Artboard index if scope is 'artboard'"),
      includeMetrics: z.object({
        sizes: z.boolean().default(true).describe("Track font sizes"),
        weights: z.boolean().default(true).describe("Track font weights"),
        styles: z.boolean().default(true).describe("Track font styles (italic, etc.)"),
        characterCount: z.boolean().default(true).describe("Count characters per font"),
        missingFonts: z.boolean().default(true).describe("Check for missing fonts")
      }).optional()
    },
    wrapToolForTelemetry("measure_font_usage", async (args: any) => {
      const { scope = "document", layerName, artboardIndex, includeMetrics = {} } = args;
      const {
        sizes = true,
        weights = true,
        styles = true,
        characterCount = true,
        missingFonts = true
      } = includeMetrics;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var scope = ${JSON.stringify(scope)};
          var layerName = ${JSON.stringify(layerName || "")};
          var artboardIndex = ${artboardIndex !== undefined ? artboardIndex : "null"};
          var includeSizes = ${sizes};
          var includeWeights = ${weights};
          var includeStyles = ${styles};
          var includeCharCount = ${characterCount};
          var checkMissing = ${missingFonts};
          
          var fontUsage = {};
          var textFrames = [];
          var totalCharacters = 0;
          var missingFontsList = [];
          
          // Get text frames based on scope
          switch (scope) {
            case "selection":
              for (var i = 0; i < app.selection.length; i++) {
                if (app.selection[i].typename === "TextFrame") {
                  textFrames.push(app.selection[i]);
                }
              }
              break;
              
            case "layer":
              if (layerName) {
                for (var i = 0; i < doc.layers.length; i++) {
                  if (doc.layers[i].name === layerName) {
                    textFrames = doc.layers[i].textFrames;
                    break;
                  }
                }
              }
              break;
              
            case "artboard":
              if (artboardIndex !== null) {
                var artboard = doc.artboards[artboardIndex];
                var bounds = artboard.artboardRect;
                
                for (var i = 0; i < doc.textFrames.length; i++) {
                  var tf = doc.textFrames[i];
                  var tfBounds = tf.geometricBounds;
                  if (tfBounds[0] >= bounds[0] && tfBounds[2] <= bounds[2] &&
                      tfBounds[1] <= bounds[1] && tfBounds[3] >= bounds[3]) {
                    textFrames.push(tf);
                  }
                }
              }
              break;
              
            default: // document
              textFrames = doc.textFrames;
              break;
          }
          
          // Analyze each text frame
          for (var i = 0; i < textFrames.length; i++) {
            var textFrame = textFrames[i];
            
            // Process each text range (different formatting)
            for (var j = 0; j < textFrame.textRanges.length; j++) {
              var range = textFrame.textRanges[j];
              var charCount = range.length;
              totalCharacters += charCount;
              
              if (range.characterAttributes.textFont) {
                var font = range.characterAttributes.textFont;
                var fontName = font.name;
                var fontFamily = font.family || fontName;
                
                // Initialize font entry if not exists
                if (!fontUsage[fontFamily]) {
                  fontUsage[fontFamily] = {
                    family: fontFamily,
                    postScriptName: fontName,
                    characterCount: 0,
                    instances: 0,
                    sizes: [],
                    weights: [],
                    styles: [],
                    isMissing: false
                  };
                }
                
                // Update metrics
                fontUsage[fontFamily].instances++;
                
                if (includeCharCount) {
                  fontUsage[fontFamily].characterCount += charCount;
                }
                
                if (includeSizes) {
                  var size = range.characterAttributes.size;
                  if (fontUsage[fontFamily].sizes.indexOf(size) === -1) {
                    fontUsage[fontFamily].sizes.push(size);
                  }
                }
                
                // Extract weight and style from font name
                if (includeWeights || includeStyles) {
                  var fontNameLower = fontName.toLowerCase();
                  
                  if (includeWeights) {
                    var weight = "Regular";
                    if (fontNameLower.indexOf("bold") !== -1) weight = "Bold";
                    else if (fontNameLower.indexOf("black") !== -1) weight = "Black";
                    else if (fontNameLower.indexOf("heavy") !== -1) weight = "Heavy";
                    else if (fontNameLower.indexOf("light") !== -1) weight = "Light";
                    else if (fontNameLower.indexOf("thin") !== -1) weight = "Thin";
                    else if (fontNameLower.indexOf("medium") !== -1) weight = "Medium";
                    else if (fontNameLower.indexOf("semibold") !== -1) weight = "SemiBold";
                    
                    if (fontUsage[fontFamily].weights.indexOf(weight) === -1) {
                      fontUsage[fontFamily].weights.push(weight);
                    }
                  }
                  
                  if (includeStyles) {
                    var style = "Normal";
                    if (fontNameLower.indexOf("italic") !== -1) style = "Italic";
                    else if (fontNameLower.indexOf("oblique") !== -1) style = "Oblique";
                    
                    if (fontUsage[fontFamily].styles.indexOf(style) === -1) {
                      fontUsage[fontFamily].styles.push(style);
                    }
                  }
                }
              } else if (checkMissing) {
                // Font is missing
                missingFontsList.push({
                  textFrame: i,
                  range: j,
                  content: range.contents.substring(0, 50)
                });
              }
            }
          }
          
          // Sort sizes for each font
          for (var font in fontUsage) {
            if (fontUsage[font].sizes.length > 0) {
              fontUsage[font].sizes.sort(function(a, b) { return a - b; });
            }
          }
          
          // Convert to array for output
          var fontList = [];
          for (var font in fontUsage) {
            fontList.push(fontUsage[font]);
          }
          
          // Sort by usage (character count or instances)
          fontList.sort(function(a, b) {
            if (includeCharCount) {
              return b.characterCount - a.characterCount;
            }
            return b.instances - a.instances;
          });
          
          JSON.stringify({
            success: true,
            totalFonts: fontList.length,
            totalTextFrames: textFrames.length,
            totalCharacters: totalCharacters,
            fonts: fontList,
            missingFonts: missingFontsList.length,
            missingFontDetails: missingFontsList.slice(0, 5),
            scope: scope,
            metrics: {
              sizes: includeSizes,
              weights: includeWeights,
              styles: includeStyles,
              characterCount: includeCharCount
            }
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  // Tool: analyze_path_complexity
  // Complexity: 4.0 (High)
  // Dependencies: None
  server.tool(
    "analyze_path_complexity",
    {
      targetPaths: z.enum(["all", "selection", "layer"]).default("selection"),
      layerName: z.string().optional().describe("Layer name if targetPaths is 'layer'"),
      metrics: z.object({
        anchorPoints: z.boolean().default(true).describe("Count anchor points"),
        pathLength: z.boolean().default(true).describe("Calculate path length"),
        curvature: z.boolean().default(true).describe("Analyze curve complexity"),
        boundingBox: z.boolean().default(true).describe("Calculate bounding dimensions"),
        intersections: z.boolean().default(false).describe("Check for self-intersections (slow)"),
        smoothness: z.boolean().default(true).describe("Evaluate path smoothness")
      }).optional(),
      complexityThresholds: z.object({
        simple: z.number().default(10).describe("Max anchor points for simple path"),
        moderate: z.number().default(50).describe("Max anchor points for moderate path"),
        complex: z.number().default(200).describe("Max anchor points for complex path")
      }).optional()
    },
    wrapToolForTelemetry("analyze_path_complexity", async (args: any) => {
      const { targetPaths = "selection", layerName, metrics = {}, complexityThresholds = {} } = args;
      const {
        anchorPoints = true,
        pathLength = true,
        curvature = true,
        boundingBox = true,
        intersections = false,
        smoothness = true
      } = metrics;
      const {
        simple = 10,
        moderate = 50,
        complex = 200
      } = complexityThresholds;
      
      const script = `
        try {
          var doc = app.activeDocument;
          var targetPaths = ${JSON.stringify(targetPaths)};
          var layerName = ${JSON.stringify(layerName || "")};
          var calcAnchors = ${anchorPoints};
          var calcLength = ${pathLength};
          var calcCurvature = ${curvature};
          var calcBounds = ${boundingBox};
          var checkIntersections = ${intersections};
          var calcSmoothness = ${smoothness};
          var simpleThreshold = ${simple};
          var moderateThreshold = ${moderate};
          var complexThreshold = ${complex};
          
          var paths = [];
          
          // Get paths based on target
          switch (targetPaths) {
            case "selection":
              for (var i = 0; i < app.selection.length; i++) {
                if (app.selection[i].typename === "PathItem" || 
                    app.selection[i].typename === "CompoundPathItem") {
                  paths.push(app.selection[i]);
                }
              }
              break;
              
            case "layer":
              if (layerName) {
                for (var i = 0; i < doc.layers.length; i++) {
                  if (doc.layers[i].name === layerName) {
                    var layer = doc.layers[i];
                    for (var j = 0; j < layer.pathItems.length; j++) {
                      paths.push(layer.pathItems[j]);
                    }
                    for (var j = 0; j < layer.compoundPathItems.length; j++) {
                      paths.push(layer.compoundPathItems[j]);
                    }
                    break;
                  }
                }
              }
              break;
              
            default: // all
              for (var i = 0; i < doc.pathItems.length; i++) {
                paths.push(doc.pathItems[i]);
              }
              for (var i = 0; i < doc.compoundPathItems.length; i++) {
                paths.push(doc.compoundPathItems[i]);
              }
              break;
          }
          
          var analysisResults = [];
          var totalComplexity = {
            simple: 0,
            moderate: 0,
            complex: 0,
            veryComplex: 0
          };
          
          // Analyze each path
          for (var i = 0; i < paths.length; i++) {
            var path = paths[i];
            var analysis = {
              index: i,
              type: path.typename,
              name: path.name || "Path " + i
            };
            
            // Get path points
            var pathPoints = [];
            if (path.typename === "PathItem") {
              pathPoints = path.pathPoints;
            } else if (path.typename === "CompoundPathItem") {
              // Aggregate points from all sub-paths
              for (var j = 0; j < path.pathItems.length; j++) {
                for (var k = 0; k < path.pathItems[j].pathPoints.length; k++) {
                  pathPoints.push(path.pathItems[j].pathPoints[k]);
                }
              }
            }
            
            // Count anchor points
            if (calcAnchors) {
              analysis.anchorPoints = pathPoints.length;
              
              // Determine complexity level
              if (analysis.anchorPoints <= simpleThreshold) {
                analysis.complexity = "simple";
                totalComplexity.simple++;
              } else if (analysis.anchorPoints <= moderateThreshold) {
                analysis.complexity = "moderate";
                totalComplexity.moderate++;
              } else if (analysis.anchorPoints <= complexThreshold) {
                analysis.complexity = "complex";
                totalComplexity.complex++;
              } else {
                analysis.complexity = "veryComplex";
                totalComplexity.veryComplex++;
              }
            }
            
            // Calculate path length
            if (calcLength && pathPoints.length > 1) {
              var length = 0;
              for (var j = 1; j < pathPoints.length; j++) {
                var p1 = pathPoints[j - 1];
                var p2 = pathPoints[j];
                var dx = p2.anchor[0] - p1.anchor[0];
                var dy = p2.anchor[1] - p1.anchor[1];
                
                // Simple linear approximation (more accurate would use bezier arc length)
                length += Math.sqrt(dx * dx + dy * dy);
              }
              analysis.pathLength = Math.round(length * 100) / 100;
            }
            
            // Analyze curvature
            if (calcCurvature) {
              var curveCount = 0;
              var sharpCorners = 0;
              
              for (var j = 0; j < pathPoints.length; j++) {
                var point = pathPoints[j];
                
                // Check if point has handles (is a curve)
                var hasLeftHandle = point.leftDirection[0] !== point.anchor[0] || 
                                   point.leftDirection[1] !== point.anchor[1];
                var hasRightHandle = point.rightDirection[0] !== point.anchor[0] || 
                                    point.rightDirection[1] !== point.anchor[1];
                
                if (hasLeftHandle || hasRightHandle) {
                  curveCount++;
                }
                
                // Check for sharp corners (angle between segments)
                if (j > 0 && j < pathPoints.length - 1) {
                  var prev = pathPoints[j - 1];
                  var next = pathPoints[j + 1];
                  
                  var v1x = point.anchor[0] - prev.anchor[0];
                  var v1y = point.anchor[1] - prev.anchor[1];
                  var v2x = next.anchor[0] - point.anchor[0];
                  var v2y = next.anchor[1] - point.anchor[1];
                  
                  var angle = Math.atan2(v2y, v2x) - Math.atan2(v1y, v1x);
                  angle = Math.abs(angle * 180 / Math.PI);
                  if (angle > 180) angle = 360 - angle;
                  
                  if (angle < 30 || angle > 150) {
                    sharpCorners++;
                  }
                }
              }
              
              analysis.curvePoints = curveCount;
              analysis.sharpCorners = sharpCorners;
              analysis.curvatureRatio = pathPoints.length > 0 ? 
                Math.round((curveCount / pathPoints.length) * 100) : 0;
            }
            
            // Calculate bounding box
            if (calcBounds) {
              var bounds = path.geometricBounds;
              analysis.boundingBox = {
                width: Math.round((bounds[2] - bounds[0]) * 100) / 100,
                height: Math.round((bounds[1] - bounds[3]) * 100) / 100,
                area: Math.round((bounds[2] - bounds[0]) * (bounds[1] - bounds[3]) * 100) / 100
              };
            }
            
            // Calculate smoothness
            if (calcSmoothness && pathPoints.length > 2) {
              var smoothnessScore = 100; // Start with perfect smoothness
              
              for (var j = 1; j < pathPoints.length - 1; j++) {
                var point = pathPoints[j];
                
                // Check handle alignment
                var leftHandle = [
                  point.leftDirection[0] - point.anchor[0],
                  point.leftDirection[1] - point.anchor[1]
                ];
                var rightHandle = [
                  point.rightDirection[0] - point.anchor[0],
                  point.rightDirection[1] - point.anchor[1]
                ];
                
                // Calculate angle between handles
                var dot = leftHandle[0] * rightHandle[0] + leftHandle[1] * rightHandle[1];
                var leftMag = Math.sqrt(leftHandle[0] * leftHandle[0] + leftHandle[1] * leftHandle[1]);
                var rightMag = Math.sqrt(rightHandle[0] * rightHandle[0] + rightHandle[1] * rightHandle[1]);
                
                if (leftMag > 0 && rightMag > 0) {
                  var cosAngle = dot / (leftMag * rightMag);
                  // Perfect smoothness when handles are opposite (cosAngle = -1)
                  var deviation = Math.abs(cosAngle + 1) / 2; // 0 = smooth, 1 = not smooth
                  smoothnessScore -= deviation * 10;
                }
              }
              
              analysis.smoothness = Math.max(0, Math.round(smoothnessScore));
            }
            
            analysisResults.push(analysis);
          }
          
          // Calculate summary statistics
          var summary = {
            totalPaths: paths.length,
            complexityDistribution: totalComplexity,
            averageAnchors: 0,
            averageLength: 0
          };
          
          if (analysisResults.length > 0) {
            var totalAnchors = 0;
            var totalLength = 0;
            var lengthCount = 0;
            
            for (var i = 0; i < analysisResults.length; i++) {
              if (analysisResults[i].anchorPoints) {
                totalAnchors += analysisResults[i].anchorPoints;
              }
              if (analysisResults[i].pathLength) {
                totalLength += analysisResults[i].pathLength;
                lengthCount++;
              }
            }
            
            summary.averageAnchors = Math.round(totalAnchors / analysisResults.length);
            summary.averageLength = lengthCount > 0 ? 
              Math.round(totalLength / lengthCount * 100) / 100 : 0;
          }
          
          JSON.stringify({
            success: true,
            pathsAnalyzed: analysisResults.length,
            paths: analysisResults.slice(0, 50), // Return first 50 paths
            summary: summary,
            targetPaths: targetPaths
          });
        } catch (e) {
          JSON.stringify({ error: e.toString(), line: e.line });
        }
      `;
      
      return executeExtendScriptForApp(script, "illustrator");
    })
  );

  console.error("Analysis tools registered successfully");
}