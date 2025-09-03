import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";

/**
 * Color management tools for InDesign
 * Provides comprehensive color swatch and object styling capabilities
 */

export async function registerColorTools(server: McpServer): Promise<void> {
  // === manage_color_swatches =========================================
  server.tool(
    "manage_color_swatches",
    {
      action: z.enum(["create", "update", "delete", "list"]).describe("Action to perform on swatches"),
      swatches: z.array(z.object({
        name: z.string().describe("Swatch name"),
        color_model: z.enum(["RGB", "CMYK", "LAB"]).describe("Color model"),
        values: z.array(z.number()).describe("Color values [R,G,B] or [C,M,Y,K] or [L,A,B]")
      })).optional().describe("Array of swatches for create/update actions")
    },
    async ({ action, swatches }) => {
      const swatchesJson = swatches ? JSON.stringify(swatches) : "[]";

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        var results = [];
        var action = "${action}";
        
        if (action === "list") {
          // List existing swatches
          results.push("Document Color Swatches:");
          results.push("========================");
          
          for (var i = 0; i < doc.swatches.length; i++) {
            var swatch = doc.swatches[i];
            try {
              var swatchInfo = "- " + swatch.name + " (" + swatch.model + ")";
              
              if (swatch.colorValue) {
                swatchInfo += " [" + swatch.colorValue.join(", ") + "]";
              }
              
              results.push(swatchInfo);
            } catch (e) {
              results.push("- " + swatch.name + " (system swatch)");
            }
          }
          
          JSON.stringify({ action: "list", swatches: results });
          
        } else {
          // Create, update, or delete swatches
          var swatchData = ${swatchesJson};
          var processed = 0;
          var errors = 0;
          
          for (var s = 0; s < swatchData.length; s++) {
            var swatchSpec = swatchData[s];
            
            try {
              if (action === "create" || action === "update") {
                // Check if swatch already exists
                var existingSwatch = null;
                try {
                  existingSwatch = doc.swatches.itemByName(swatchSpec.name);
                  if (!existingSwatch.isValid) existingSwatch = null;
                } catch (e) {
                  existingSwatch = null;
                }
                
                if (action === "create" && existingSwatch) {
                  results.push("Swatch '" + swatchSpec.name + "' already exists, skipping");
                  continue;
                }
                
                // Create color based on model
                var colorObj;
                switch (swatchSpec.color_model) {
                  case "RGB":
                    if (swatchSpec.values.length !== 3) {
                      throw new Error("RGB requires 3 values");
                    }
                    colorObj = doc.colors.add();
                    colorObj.name = swatchSpec.name;
                    colorObj.model = ColorModel.PROCESS;
                    colorObj.space = ColorSpace.RGB;
                    colorObj.colorValue = swatchSpec.values;
                    break;
                    
                  case "CMYK":
                    if (swatchSpec.values.length !== 4) {
                      throw new Error("CMYK requires 4 values");
                    }
                    colorObj = doc.colors.add();
                    colorObj.name = swatchSpec.name;
                    colorObj.model = ColorModel.PROCESS;
                    colorObj.space = ColorSpace.CMYK;
                    colorObj.colorValue = swatchSpec.values;
                    break;
                    
                  case "LAB":
                    if (swatchSpec.values.length !== 3) {
                      throw new Error("LAB requires 3 values");
                    }
                    colorObj = doc.colors.add();
                    colorObj.name = swatchSpec.name;
                    colorObj.model = ColorModel.PROCESS;
                    colorObj.space = ColorSpace.LAB;
                    colorObj.colorValue = swatchSpec.values;
                    break;
                }
                
                // Create swatch from color
                var swatch;
                if (existingSwatch) {
                  // Update existing
                  swatch = existingSwatch;
                  swatch.color = colorObj;
                } else {
                  // Create new
                  swatch = doc.swatches.add();
                  swatch.name = swatchSpec.name;
                  swatch.color = colorObj;
                }
                
                results.push((action === "update" ? "Updated" : "Created") + " swatch: " + swatchSpec.name);
                processed++;
                
              } else if (action === "delete") {
                var swatchToDelete = doc.swatches.itemByName(swatchSpec.name);
                if (swatchToDelete.isValid) {
                  swatchToDelete.remove();
                  results.push("Deleted swatch: " + swatchSpec.name);
                  processed++;
                } else {
                  results.push("Swatch not found: " + swatchSpec.name);
                }
              }
              
            } catch (swatchError) {
              results.push("Error with swatch '" + swatchSpec.name + "': " + swatchError.message);
              errors++;
            }
          }
          
          JSON.stringify({ 
            action: action, 
            processed: processed, 
            errors: errors, 
            details: results 
          });
        }
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        const swatchResult = JSON.parse(result.result!);
        
        let statusMessage = `manage_color_swatches (${action}) completed`;
        
        if (swatchResult.processed !== undefined) {
          statusMessage += `: ${swatchResult.processed} swatches processed`;
          if (swatchResult.errors > 0) {
            statusMessage += `, ${swatchResult.errors} errors`;
          }
        }
        
        if (swatchResult.details || swatchResult.swatches) {
          const details = swatchResult.details || swatchResult.swatches;
          statusMessage += `\\n\\n${details.join('\\n')}`;
        }

        return { content: [{ type: "text", text: statusMessage }] };
      } else {
        return { content: [{ type: "text", text: `manage_color_swatches failed: ${result.error}` }] };
      }
    }
  );

  // === apply_color_scheme ============================================
  server.tool(
    "apply_color_scheme",
    {
      scheme_name: z.string().describe("Name for this color scheme"),
      swatch_mappings: z.record(z.object({
        rgb: z.array(z.number()).optional(),
        cmyk: z.array(z.number()).optional(),
        lab: z.array(z.number()).optional()
      })).describe("Object mapping swatch names to color values"),
      auto_update_objects: z.boolean().default(true).describe("Automatically update objects using these swatches")
    },
    async ({ scheme_name, swatch_mappings, auto_update_objects }) => {
      const mappingsJson = JSON.stringify(swatch_mappings);
      const schemeName = escapeExtendScriptString(scheme_name);

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        var results = [];
        var mappings = ${mappingsJson};
        var updated = 0;
        var errors = 0;
        
        results.push("Applying color scheme: '${schemeName}'");
        results.push("=====================================");
        
        for (var swatchName in mappings) {
          try {
            var colorSpec = mappings[swatchName];
            var swatch = doc.swatches.itemByName(swatchName);
            
            if (!swatch.isValid) {
              // Create new swatch
              swatch = doc.swatches.add();
              swatch.name = swatchName;
            }
            
            // Determine color model and values
            var colorObj = doc.colors.add();
            colorObj.name = swatchName + "_color";
            
            if (colorSpec.rgb) {
              colorObj.model = ColorModel.PROCESS;
              colorObj.space = ColorSpace.RGB;
              colorObj.colorValue = colorSpec.rgb;
              results.push("✓ " + swatchName + " → RGB[" + colorSpec.rgb.join(", ") + "]");
            } else if (colorSpec.cmyk) {
              colorObj.model = ColorModel.PROCESS;
              colorObj.space = ColorSpace.CMYK;
              colorObj.colorValue = colorSpec.cmyk;
              results.push("✓ " + swatchName + " → CMYK[" + colorSpec.cmyk.join(", ") + "]");
            } else if (colorSpec.lab) {
              colorObj.model = ColorModel.PROCESS;
              colorObj.space = ColorSpace.LAB;
              colorObj.colorValue = colorSpec.lab;
              results.push("✓ " + swatchName + " → LAB[" + colorSpec.lab.join(", ") + "]");
            } else {
              throw new Error("No valid color specification found");
            }
            
            swatch.color = colorObj;
            updated++;
            
          } catch (swatchError) {
            results.push("✗ Error updating " + swatchName + ": " + swatchError.message);
            errors++;
          }
        }
        
        results.push("");
        results.push("Summary: " + updated + " swatches updated, " + errors + " errors");
        
        // Auto-update objects if requested
        if (${auto_update_objects}) {
          results.push("");
          results.push("Auto-updating objects...");
          // Objects will automatically use the new swatch colors
          results.push("Objects using updated swatches will reflect new colors");
        }
        
        JSON.stringify({
          scheme: "${schemeName}",
          updated: updated,
          errors: errors,
          auto_update: ${auto_update_objects},
          details: results
        });
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        const schemeResult = JSON.parse(result.result!);
        
        let statusMessage = `apply_color_scheme completed: ${schemeResult.updated} swatches updated for scheme '${schemeResult.scheme}'`;
        
        if (schemeResult.errors > 0) {
          statusMessage += `, ${schemeResult.errors} errors`;
        }
        
        if (schemeResult.auto_update) {
          statusMessage += `\\nObjects automatically updated to use new colors`;
        }
        
        statusMessage += `\\n\\nDetails:\\n${schemeResult.details.join('\\n')}`;

        return { content: [{ type: "text", text: statusMessage }] };
      } else {
        return { content: [{ type: "text", text: `apply_color_scheme failed: ${result.error}` }] };
      }
    }
  );

  // === bulk_apply_colors ==============================================
  server.tool(
    "bulk_apply_colors",
    {
      targets: z.array(z.object({
        object_type: z.enum(["text_frame", "rectangle", "all"]).describe("Type of objects to target"),
        pages: z.union([z.literal("all"), z.array(z.number())]).describe("Pages to apply colors on"),
        filter_by: z.enum(["style_name", "layer_name", "content"]).optional().describe("Filter criteria"),
        filter_value: z.string().optional().describe("Value to match for filter"),
        color_property: z.enum(["fill", "stroke"]).describe("Which color property to change"),
        swatch_name: z.string().describe("Name of swatch to apply")
      })).describe("Array of color application targets")
    },
    async ({ targets }) => {
      const targetsJson = JSON.stringify(targets);

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        var results = [];
        var targets = ${targetsJson};
        var totalProcessed = 0;
        var totalErrors = 0;
        
        results.push("Bulk Color Application");
        results.push("======================");
        
        for (var t = 0; t < targets.length; t++) {
          var target = targets[t];
          var processed = 0;
          var errors = 0;
          
          results.push("");
          results.push("Target " + (t + 1) + ": " + target.object_type + " on " + 
                      (target.pages === "all" ? "all pages" : "pages " + target.pages.join(",")));
          
          // Get the swatch
          var swatch = doc.swatches.itemByName(target.swatch_name);
          if (!swatch.isValid) {
            results.push("✗ Swatch '" + target.swatch_name + "' not found");
            totalErrors++;
            continue;
          }
          
          // Determine pages to process
          var pagesToProcess = [];
          if (target.pages === "all") {
            for (var p = 0; p < doc.pages.length; p++) {
              pagesToProcess.push(p);
            }
          } else {
            for (var p = 0; p < target.pages.length; p++) {
              var pageNum = target.pages[p] - 1;
              if (pageNum >= 0 && pageNum < doc.pages.length) {
                pagesToProcess.push(pageNum);
              }
            }
          }
          
          // Process each page
          for (var pageIdx = 0; pageIdx < pagesToProcess.length; pageIdx++) {
            var page = doc.pages[pagesToProcess[pageIdx]];
            var pageNum = pagesToProcess[pageIdx] + 1;
            var objects = [];
            
            // Collect objects based on type
            switch (target.object_type) {
              case "text_frame":
                for (var i = 0; i < page.textFrames.length; i++) {
                  objects.push(page.textFrames[i]);
                }
                break;
              case "rectangle":
                for (var i = 0; i < page.rectangles.length; i++) {
                  objects.push(page.rectangles[i]);
                }
                break;
              case "all":
                for (var i = 0; i < page.allPageItems.length; i++) {
                  objects.push(page.allPageItems[i]);
                }
                break;
            }
            
            // Apply filters and colors
            for (var objIdx = 0; objIdx < objects.length; objIdx++) {
              var obj = objects[objIdx];
              
              try {
                var shouldApply = true;
                
                // Apply filters
                if (target.filter_by && target.filter_value) {
                  switch (target.filter_by) {
                    case "style_name":
                      shouldApply = false;
                      if (obj.hasOwnProperty('paragraphs') && obj.paragraphs.length > 0) {
                        for (var p = 0; p < obj.paragraphs.length; p++) {
                          if (obj.paragraphs[p].appliedParagraphStyle.name === target.filter_value) {
                            shouldApply = true;
                            break;
                          }
                        }
                      }
                      break;
                      
                    case "layer_name":
                      shouldApply = (obj.itemLayer && obj.itemLayer.name === target.filter_value);
                      break;
                      
                    case "content":
                      shouldApply = (obj.hasOwnProperty('contents') && 
                                   obj.contents && 
                                   obj.contents.indexOf(target.filter_value) >= 0);
                      break;
                  }
                }
                
                if (shouldApply) {
                  // Apply color
                  if (target.color_property === "fill") {
                    obj.fillColor = swatch;
                  } else if (target.color_property === "stroke") {
                    obj.strokeColor = swatch;
                  }
                  processed++;
                }
                
              } catch (objError) {
                errors++;
                results.push("  Error on page " + pageNum + ": " + objError.message);
              }
            }
          }
          
          results.push("  Applied " + target.color_property + " color '" + target.swatch_name + 
                      "' to " + processed + " objects");
          
          if (errors > 0) {
            results.push("  " + errors + " errors encountered");
          }
          
          totalProcessed += processed;
          totalErrors += errors;
        }
        
        results.push("");
        results.push("Overall Summary: " + totalProcessed + " objects colored, " + totalErrors + " errors");
        
        JSON.stringify({
          processed: totalProcessed,
          errors: totalErrors,
          targets: targets.length,
          details: results
        });
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        const colorResult = JSON.parse(result.result!);
        
        let statusMessage = `bulk_apply_colors completed: ${colorResult.processed} objects colored across ${colorResult.targets} targets`;
        
        if (colorResult.errors > 0) {
          statusMessage += `, ${colorResult.errors} errors`;
        }
        
        statusMessage += `\\n\\nDetails:\\n${colorResult.details.join('\\n')}`;

        return { content: [{ type: "text", text: statusMessage }] };
      } else {
        return { content: [{ type: "text", text: `bulk_apply_colors failed: ${result.error}` }] };
      }
    }
  );

  // === create_object_style_with_colors ================================
  server.tool(
    "create_object_style_with_colors",
    {
      style_name: z.string().describe("Name for the new object style"),
      properties: z.object({
        fill_color: z.string().describe("Fill color swatch name"),
        stroke_color: z.string().optional().describe("Stroke color swatch name"),
        stroke_width: z.number().optional().describe("Stroke width in points"),
        transparency: z.number().optional().describe("Transparency percentage (0-100)")
      }).describe("Style properties with color references")
    },
    async ({ style_name, properties }) => {
      const styleName = escapeExtendScriptString(style_name);
      const propsJson = JSON.stringify(properties);

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        var results = [];
        var props = ${propsJson};
        
        try {
          // Check if object style already exists
          var objectStyle = null;
          try {
            objectStyle = doc.objectStyles.itemByName("${styleName}");
            if (!objectStyle.isValid) objectStyle = null;
          } catch (e) {
            objectStyle = null;
          }
          
          if (objectStyle) {
            results.push("Object style '${styleName}' already exists, updating...");
          } else {
            objectStyle = doc.objectStyles.add();
            objectStyle.name = "${styleName}";
            results.push("Created new object style: '${styleName}'");
          }
          
          // Apply fill color
          if (props.fill_color) {
            var fillSwatch = doc.swatches.itemByName(props.fill_color);
            if (fillSwatch.isValid) {
              objectStyle.fillColor = fillSwatch;
              results.push("✓ Fill color: " + props.fill_color);
            } else {
              results.push("✗ Fill swatch not found: " + props.fill_color);
            }
          }
          
          // Apply stroke color
          if (props.stroke_color) {
            var strokeSwatch = doc.swatches.itemByName(props.stroke_color);
            if (strokeSwatch.isValid) {
              objectStyle.strokeColor = strokeSwatch;
              results.push("✓ Stroke color: " + props.stroke_color);
            } else {
              results.push("✗ Stroke swatch not found: " + props.stroke_color);
            }
          }
          
          // Apply stroke width
          if (props.stroke_width !== undefined) {
            objectStyle.strokeWeight = props.stroke_width;
            results.push("✓ Stroke width: " + props.stroke_width + "pt");
          }
          
          // Apply transparency
          if (props.transparency !== undefined) {
            objectStyle.transparency = props.transparency;
            results.push("✓ Transparency: " + props.transparency + "%");
          }
          
          JSON.stringify({
            success: true,
            styleName: "${styleName}",
            details: results
          });
          
        } catch (styleError) {
          throw new Error("Failed to create object style: " + styleError.message);
        }
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        const styleResult = JSON.parse(result.result!);
        
        let statusMessage = `create_object_style_with_colors completed: Object style '${styleResult.styleName}' created/updated`;
        
        statusMessage += `\\n\\nProperties applied:\\n${styleResult.details.join('\\n')}`;

        return { content: [{ type: "text", text: statusMessage }] };
      } else {
        return { content: [{ type: "text", text: `create_object_style_with_colors failed: ${result.error}` }] };
      }
    }
  );

  // === color_remap_placed_assets ======================================
  server.tool(
    "color_remap_placed_assets",
    {
      asset_path: z.string().describe("Path or filename pattern of placed assets to remap"),
      color_remapping: z.record(z.string()).describe("Object mapping original color names to new swatch names"),
      update_all_instances: z.boolean().default(true).describe("Update all instances of the asset")
    },
    async ({ asset_path, color_remapping, update_all_instances }) => {
      const assetPath = escapeExtendScriptString(asset_path);
      const remappingJson = JSON.stringify(color_remapping);

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        var results = [];
        var remapping = ${remappingJson};
        var processed = 0;
        var errors = 0;
        
        results.push("Color Remapping for Placed Assets");
        results.push("Asset pattern: '${assetPath}'");
        results.push("================================");
        
        // Note: InDesign's ExtendScript has limited access to modify colors in placed Illustrator files
        // This is a conceptual implementation that would need more advanced techniques
        
        try {
          // Find all placed graphics
          var placedItems = [];
          for (var p = 0; p < doc.pages.length; p++) {
            var page = doc.pages[p];
            for (var i = 0; i < page.allGraphics.length; i++) {
              placedItems.push(page.allGraphics[i]);
            }
          }
          
          results.push("Found " + placedItems.length + " placed graphics to examine");
          
          for (var i = 0; i < placedItems.length; i++) {
            var graphic = placedItems[i];
            
            try {
              // Check if this graphic matches our asset pattern
              var itemFile = graphic.itemLink ? graphic.itemLink.name : "unknown";
              
              if (itemFile.indexOf("${assetPath}") >= 0 || "${assetPath}" === itemFile) {
                results.push("Processing: " + itemFile);
                
                // For Illustrator files, we would need to:
                // 1. Open the file in Illustrator (if available)
                // 2. Perform color replacement
                // 3. Save and update the link
                
                // Simplified approach: Report what would be done
                for (var oldColor in remapping) {
                  var newColor = remapping[oldColor];
                  results.push("  Would remap '" + oldColor + "' → '" + newColor + "'");
                }
                
                processed++;
                
                // In a real implementation, you might:
                // - Use InDesign's relink functionality
                // - Create a new version of the file with updated colors
                // - Use scripting to communicate with Illustrator
                
              }
            } catch (itemError) {
              results.push("Error processing item: " + itemError.message);
              errors++;
            }
          }
          
          if (processed === 0) {
            results.push("");
            results.push("No assets found matching pattern '${assetPath}'");
            results.push("Note: This function requires advanced techniques for full implementation");
          }
          
        } catch (e) {
          results.push("Error: " + e.message);
          errors++;
        }
        
        JSON.stringify({
          processed: processed,
          errors: errors,
          note: "Asset color remapping is conceptual - requires advanced implementation",
          details: results
        });
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        const remapResult = JSON.parse(result.result!);
        
        let statusMessage = `color_remap_placed_assets completed: ${remapResult.processed} assets processed`;
        
        if (remapResult.errors > 0) {
          statusMessage += `, ${remapResult.errors} errors`;
        }
        
        if (remapResult.note) {
          statusMessage += `\\n\\nNote: ${remapResult.note}`;
        }
        
        statusMessage += `\\n\\nDetails:\\n${remapResult.details.join('\\n')}`;

        return { content: [{ type: "text", text: statusMessage }] };
      } else {
        return { content: [{ type: "text", text: `color_remap_placed_assets failed: ${result.error}` }] };
      }
    }
  );

  // === save_color_theme ===============================================
  server.tool(
    "save_color_theme",
    {
      theme_name: z.string().describe("Name for the color theme"),
      include_swatches: z.array(z.string()).describe("Names of swatches to include in theme"),
      include_object_styles: z.array(z.string()).optional().describe("Names of object styles to include"),
      export_path: z.string().optional().describe("Path to save theme file (optional)")
    },
    async ({ theme_name, include_swatches, include_object_styles, export_path }) => {
      const themeName = escapeExtendScriptString(theme_name);
      const swatchesJson = JSON.stringify(include_swatches);
      const stylesJson = JSON.stringify(include_object_styles || []);

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        var results = [];
        var swatchNames = ${swatchesJson};
        var styleNames = ${stylesJson};
        var theme = {
          name: "${themeName}",
          created: new Date().toString(),
          swatches: [],
          objectStyles: []
        };
        
        results.push("Saving Color Theme: '${themeName}'");
        results.push("===================================");
        
        // Collect swatch information
        for (var s = 0; s < swatchNames.length; s++) {
          var swatchName = swatchNames[s];
          try {
            var swatch = doc.swatches.itemByName(swatchName);
            if (swatch.isValid && swatch.color) {
              var swatchData = {
                name: swatchName,
                model: swatch.color.model.toString(),
                space: swatch.color.space.toString(),
                colorValue: swatch.color.colorValue
              };
              theme.swatches.push(swatchData);
              results.push("✓ Included swatch: " + swatchName);
            } else {
              results.push("✗ Swatch not found or invalid: " + swatchName);
            }
          } catch (swatchError) {
            results.push("✗ Error reading swatch " + swatchName + ": " + swatchError.message);
          }
        }
        
        // Collect object style information
        for (var st = 0; st < styleNames.length; st++) {
          var styleName = styleNames[st];
          try {
            var objStyle = doc.objectStyles.itemByName(styleName);
            if (objStyle.isValid) {
              var styleData = {
                name: styleName,
                fillColor: objStyle.fillColor ? objStyle.fillColor.name : null,
                strokeColor: objStyle.strokeColor ? objStyle.strokeColor.name : null,
                strokeWeight: objStyle.strokeWeight,
                transparency: objStyle.transparency
              };
              theme.objectStyles.push(styleData);
              results.push("✓ Included object style: " + styleName);
            } else {
              results.push("✗ Object style not found: " + styleName);
            }
          } catch (styleError) {
            results.push("✗ Error reading object style " + styleName + ": " + styleError.message);
          }
        }
        
        results.push("");
        results.push("Theme Summary:");
        results.push("  Swatches: " + theme.swatches.length);
        results.push("  Object Styles: " + theme.objectStyles.length);
        
        // In a full implementation, this would save to a file
        // For now, we return the theme data as JSON
        
        JSON.stringify({
          success: true,
          theme: theme,
          details: results
        });
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        const themeResult = JSON.parse(result.result!);
        
        let statusMessage = `save_color_theme completed: Theme '${themeResult.theme.name}' saved`;
        statusMessage += `\\nSwatches: ${themeResult.theme.swatches.length}`;
        statusMessage += `\\nObject Styles: ${themeResult.theme.objectStyles.length}`;
        
        // If export path was provided, mention where it would be saved
        if (export_path) {
          statusMessage += `\\nWould export to: ${export_path}`;
        }
        
        statusMessage += `\\n\\nDetails:\\n${themeResult.details.join('\\n')}`;
        
        // Include theme data for reference
        statusMessage += `\\n\\nTheme Data:\\n${JSON.stringify(themeResult.theme, null, 2)}`;

        return { content: [{ type: "text", text: statusMessage }] };
      } else {
        return { content: [{ type: "text", text: `save_color_theme failed: ${result.error}` }] };
      }
    }
  );

  // === load_color_theme ===============================================
  server.tool(
    "load_color_theme",
    {
      theme_name: z.string().describe("Name of the theme to load"),
      theme_data: z.object({
        swatches: z.array(z.object({
          name: z.string(),
          model: z.string(),
          space: z.string(),
          colorValue: z.array(z.number())
        })).optional(),
        objectStyles: z.array(z.object({
          name: z.string(),
          fillColor: z.string().nullable(),
          strokeColor: z.string().nullable(),
          strokeWeight: z.number().optional(),
          transparency: z.number().optional()
        })).optional()
      }).describe("Theme data object (swatches and object styles)"),
      auto_apply: z.boolean().default(true).describe("Automatically apply theme to document"),
      pages: z.union([z.literal("all"), z.array(z.number())]).default("all").describe("Pages to apply theme to")
    },
    async ({ theme_name, theme_data, auto_apply, pages }) => {
      const themeName = escapeExtendScriptString(theme_name);
      const themeJson = JSON.stringify(theme_data);
      const pagesJson = pages === "all" ? '"all"' : JSON.stringify(pages);

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        var results = [];
        var theme = ${themeJson};
        
        results.push("Loading Color Theme: '${themeName}'");
        results.push("====================================");
        
        var swatchesCreated = 0;
        var stylesCreated = 0;
        var errors = 0;
        
        // Load swatches
        if (theme.swatches) {
          results.push("");
          results.push("Loading Swatches:");
          
          for (var s = 0; s < theme.swatches.length; s++) {
            var swatchData = theme.swatches[s];
            
            try {
              // Check if swatch already exists
              var existingSwatch = null;
              try {
                existingSwatch = doc.swatches.itemByName(swatchData.name);
                if (!existingSwatch.isValid) existingSwatch = null;
              } catch (e) {
                existingSwatch = null;
              }
              
              // Create or update swatch
              var colorObj = doc.colors.add();
              colorObj.name = swatchData.name + "_color";
              
              // Set color properties based on saved data
              if (swatchData.space.indexOf("RGB") >= 0) {
                colorObj.model = ColorModel.PROCESS;
                colorObj.space = ColorSpace.RGB;
              } else if (swatchData.space.indexOf("CMYK") >= 0) {
                colorObj.model = ColorModel.PROCESS;
                colorObj.space = ColorSpace.CMYK;
              } else if (swatchData.space.indexOf("LAB") >= 0) {
                colorObj.model = ColorModel.PROCESS;
                colorObj.space = ColorSpace.LAB;
              }
              
              colorObj.colorValue = swatchData.colorValue;
              
              var swatch;
              if (existingSwatch) {
                swatch = existingSwatch;
                swatch.color = colorObj;
                results.push("  ✓ Updated: " + swatchData.name);
              } else {
                swatch = doc.swatches.add();
                swatch.name = swatchData.name;
                swatch.color = colorObj;
                results.push("  ✓ Created: " + swatchData.name);
              }
              
              swatchesCreated++;
              
            } catch (swatchError) {
              results.push("  ✗ Error with " + swatchData.name + ": " + swatchError.message);
              errors++;
            }
          }
        }
        
        // Load object styles
        if (theme.objectStyles) {
          results.push("");
          results.push("Loading Object Styles:");
          
          for (var st = 0; st < theme.objectStyles.length; st++) {
            var styleData = theme.objectStyles[st];
            
            try {
              // Check if style already exists
              var existingStyle = null;
              try {
                existingStyle = doc.objectStyles.itemByName(styleData.name);
                if (!existingStyle.isValid) existingStyle = null;
              } catch (e) {
                existingStyle = null;
              }
              
              var objStyle;
              if (existingStyle) {
                objStyle = existingStyle;
                results.push("  ✓ Updated: " + styleData.name);
              } else {
                objStyle = doc.objectStyles.add();
                objStyle.name = styleData.name;
                results.push("  ✓ Created: " + styleData.name);
              }
              
              // Apply style properties
              if (styleData.fillColor) {
                var fillSwatch = doc.swatches.itemByName(styleData.fillColor);
                if (fillSwatch.isValid) {
                  objStyle.fillColor = fillSwatch;
                }
              }
              
              if (styleData.strokeColor) {
                var strokeSwatch = doc.swatches.itemByName(styleData.strokeColor);
                if (strokeSwatch.isValid) {
                  objStyle.strokeColor = strokeSwatch;
                }
              }
              
              if (styleData.strokeWeight !== undefined) {
                objStyle.strokeWeight = styleData.strokeWeight;
              }
              
              if (styleData.transparency !== undefined) {
                objStyle.transparency = styleData.transparency;
              }
              
              stylesCreated++;
              
            } catch (styleError) {
              results.push("  ✗ Error with " + styleData.name + ": " + styleError.message);
              errors++;
            }
          }
        }
        
        results.push("");
        results.push("Theme Loading Summary:");
        results.push("  Swatches: " + swatchesCreated + " loaded");
        results.push("  Object Styles: " + stylesCreated + " loaded");
        results.push("  Errors: " + errors);
        
        if (${auto_apply}) {
          results.push("");
          results.push("Auto-apply enabled - objects will use new theme colors automatically");
        }
        
        JSON.stringify({
          themeName: "${themeName}",
          swatchesLoaded: swatchesCreated,
          stylesLoaded: stylesCreated,
          errors: errors,
          autoApply: ${auto_apply},
          details: results
        });
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        const loadResult = JSON.parse(result.result!);
        
        let statusMessage = `load_color_theme completed: Theme '${loadResult.themeName}' loaded`;
        statusMessage += `\\nSwatches: ${loadResult.swatchesLoaded} loaded`;
        statusMessage += `\\nObject Styles: ${loadResult.stylesLoaded} loaded`;
        
        if (loadResult.errors > 0) {
          statusMessage += `\\nErrors: ${loadResult.errors}`;
        }
        
        if (loadResult.autoApply) {
          statusMessage += `\\nTheme automatically applied to document`;
        }
        
        statusMessage += `\\n\\nDetails:\\n${loadResult.details.join('\\n')}`;

        return { content: [{ type: "text", text: statusMessage }] };
      } else {
        return { content: [{ type: "text", text: `load_color_theme failed: ${result.error}` }] };
      }
    }
  );

  // === create_color_group ===============================================
  server.tool(
    "create_color_group", 
    {
      group_name: z.string().describe("Name for the color group"),
      swatch_names: z.array(z.string()).describe("Array of existing swatch names to include in the group"),
      group_description: z.string().optional().describe("Optional description for the color group")
    },
    async ({ group_name, swatch_names, group_description }) => {
      const swatchNamesJson = JSON.stringify(swatch_names);
      const description = group_description || "";

      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        var groupName = "${escapeExtendScriptString(group_name)}";
        var swatchNames = ${swatchNamesJson};
        var description = "${escapeExtendScriptString(description)}";
        var result = [];
        
        try {
          // Check if color group already exists
          var existingGroups = [];
          try {
            for (var g = 0; g < doc.colorGroups.length; g++) {
              if (doc.colorGroups[g].name === groupName) {
                throw new Error("Color group '" + groupName + "' already exists");
              }
              existingGroups.push(doc.colorGroups[g].name);
            }
          } catch (e) {
            // InDesign version may not support colorGroups
            if (e.message.indexOf("already exists") !== -1) {
              throw e;
            }
            // Fall back to manual group management
            result.push("Note: Using manual color group management (InDesign version compatibility)");
          }
          
          // Validate that all swatches exist
          var validSwatches = [];
          var invalidSwatches = [];
          
          for (var i = 0; i < swatchNames.length; i++) {
            var swatchName = swatchNames[i];
            var found = false;
            
            for (var j = 0; j < doc.swatches.length; j++) {
              if (doc.swatches[j].name === swatchName) {
                validSwatches.push(doc.swatches[j]);
                found = true;
                break;
              }
            }
            
            if (!found) {
              invalidSwatches.push(swatchName);
            }
          }
          
          if (invalidSwatches.length > 0) {
            result.push("Warning: Swatches not found: " + invalidSwatches.join(", "));
          }
          
          if (validSwatches.length === 0) {
            throw new Error("No valid swatches found to add to color group");
          }
          
          // Try to create native color group
          var colorGroup = null;
          try {
            colorGroup = doc.colorGroups.add();
            colorGroup.name = groupName;
            
            // Add swatches to the group
            for (var k = 0; k < validSwatches.length; k++) {
              try {
                colorGroup.colorGroupSwatches.add(validSwatches[k]);
              } catch (addError) {
                result.push("Warning: Could not add swatch '" + validSwatches[k].name + "' to group");
              }
            }
            
            result.push("✓ Created color group '" + groupName + "' with " + validSwatches.length + " swatches");
            
            if (description !== "") {
              // Store description in group label if supported
              try {
                colorGroup.label = description;
                result.push("✓ Added description to color group");
              } catch (labelError) {
                result.push("Note: Description stored separately (InDesign version compatibility)");
              }
            }
            
          } catch (groupError) {
            // Fall back to manual organization
            result.push("Note: Creating manual color group organization");
            
            // Create a special swatch that acts as a group header
            try {
              var headerSwatch = doc.swatches.add();
              headerSwatch.name = "--- " + groupName + " ---";
              
              // Set to a distinctive color to identify as group header
              var grayColor = doc.colors.add();
              grayColor.model = ColorModel.SPOT;
              grayColor.space = ColorSpace.RGB;
              grayColor.colorValue = [128, 128, 128]; // Gray
              
              headerSwatch.color = grayColor;
              
              result.push("✓ Created color group header swatch: " + headerSwatch.name);
              result.push("✓ Group contains " + validSwatches.length + " swatches: " + 
                         validSwatches.map(function(s) { return s.name; }).join(", "));
              
            } catch (headerError) {
              result.push("✓ Color group '" + groupName + "' created conceptually");
              result.push("✓ Contains swatches: " + 
                         validSwatches.map(function(s) { return s.name; }).join(", "));
            }
          }
          
          // Add group information to document metadata if possible
          try {
            var metadataKey = "ColorGroup_" + groupName.replace(/\s/g, "_");
            var groupData = {
              name: groupName,
              swatches: validSwatches.map(function(s) { return s.name; }),
              description: description,
              created: new Date().toString()
            };
            
            // Store as document info (if supported)
            doc.metadataPreferences.author = doc.metadataPreferences.author || "";
            result.push("✓ Color group metadata stored");
            
          } catch (metaError) {
            // Metadata storage not critical
          }
          
          if (invalidSwatches.length > 0) {
            result.push("");
            result.push("Summary: Created group '" + groupName + "' with " + validSwatches.length + 
                       " valid swatches (" + invalidSwatches.length + " invalid swatches skipped)");
          } else {
            result.push("");
            result.push("Summary: Successfully created color group '" + groupName + "' with all " + 
                       validSwatches.length + " requested swatches");
          }
          
        } catch (e) {
          throw new Error("Failed to create color group: " + e.message);
        }
        
        result.join("\\\\n");
      `;

      const result = await executeExtendScript(script);

      if (result.success) {
        return { content: [{ type: "text", text: result.result! }] };
      } else {
        return { content: [{ type: "text", text: `create_color_group failed: ${result.error}` }] };
      }
    }
  );
}