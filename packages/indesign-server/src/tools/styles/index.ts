/**
 * @fileoverview Style management tools for InDesign MCP
 * Batch 2: Paragraph and character style operations
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { executeExtendScript, escapeExtendScriptString } from "@mcp/shared/extendscript.js";
import type { TextAlignment, FontStyle, SelectionType } from "@mcp/shared/types.js";
import { z } from "zod";
import { markFontsChecked } from "../layout/index.js";

/**
 * Registers all style management tools with the MCP server
 */
export async function registerStyleTools(server: McpServer): Promise<void> {
  // Register list_paragraph_styles tool
  server.tool(
    "list_paragraph_styles",
    {},
    async (args) => {
      return await handleListParagraphStyles(args);
    }
  );

  // Register apply_paragraph_style tool
  server.tool(
    "apply_paragraph_style",
    {
      style_name: z.string().describe("Name of the paragraph style to apply"),
      target_text: z.string().default("").describe("Text to find and apply style to (optional)"),
      all_occurrences: z.boolean().default(false).describe("Apply to all occurrences of target_text"),
      story_index: z.number().optional().describe("Story index to apply style to (0-based). Overrides selection if provided"),
      paragraph_range: z.string().optional().describe("Paragraph range within the story (e.g. '1-3' or '5')")
    },
    handleApplyParagraphStyle
  );

  // Register create_paragraph_style tool
  server.tool(
    "create_paragraph_style",
    {
      style_name: z.string().describe("Name for the new paragraph style"),
      font_size: z.number().default(12).describe("Font size in points"),
      font_family: z.string().default("").describe("Font family name"),
      alignment: z.enum(["left", "center", "right", "justify"]).default("left").describe("Text alignment"),
      space_before: z.number().default(0).describe("Space before paragraph in points"),
      space_after: z.number().default(0).describe("Space after paragraph in points")
    },
    async (args) => {
      return await handleCreateParagraphStyle(args);
    }
  );

  // Register select_text_range tool
  server.tool(
    "select_text_range",
    {
      selection_type: z.enum(["paragraph_number", "text_content", "story_range"]).describe("How to select the text"),
      paragraph_number: z.number().optional().describe("Paragraph number to select (1-based)"),
      text_content: z.string().optional().describe("Text content to find and select"),
      story_index: z.number().default(0).describe("Story index (0-based)")
    },
    async (args) => {
      return await handleSelectTextRange(args);
    }
  );

  // Register list_character_styles tool
  server.tool(
    "list_character_styles",
    {},
    async (args) => {
      return await handleListCharacterStyles(args);
    }
  );

  // Register apply_character_style tool
  server.tool(
    "apply_character_style",
    {
      style_name: z.string().describe("Name of the character style"),
      target_text: z.string().describe("Text to find and apply style to"),
      all_occurrences: z.boolean().default(false).describe("Apply to all occurrences")
    },
    async (args) => {
      return await handleApplyCharacterStyle(args);
    }
  );

  // Register create_character_style tool
  server.tool(
    "create_character_style",
    {
      style_name: z.string().describe("Name for the new character style"),
      font_size: z.number().default(12).describe("Font size in points"),
      font_family: z.string().default("").describe("Font family name"),
      font_style: z.string().default("Regular").describe("Font style (Regular, Bold, Italic)"),
      fill_color: z.string().default("[Black]").describe("Fill color name"),
      tracking: z.number().default(0).describe("Character tracking")
    },
    async (args) => {
      return await handleCreateCharacterStyle(args);
    }
  );

  // Register list_system_fonts tool
  server.tool(
    "list_system_fonts",
    {
      filter: z.string().default("").describe("Optional case-insensitive substring to filter font family or full name"),
      status: z.enum(["installed","missing","all"]).default("installed").describe("Filter by font status"),
      limit: z.number().int().default(1000).describe("Maximum number of results to return")
    },
    async (args) => {
      return await handleListSystemFonts(args);
    }
  );

  // Register check_font_availability tool
  server.tool(
    "check_font_availability",
    {
      fonts: z.array(z.string()).min(1).describe("Font names to check. Use 'Family' or 'Family\\tStyle' for specific style"),
      fail_if_missing: z.boolean().optional().describe("Fail if any of the fonts are missing"),
      fallback_map: z.string().optional().describe("Fallback map to use if fonts are missing")
    },
    async (args) => {
      return await handleCheckFontAvailability(args);
    }
  );

  // Register list_object_styles tool
  server.tool(
    "list_object_styles",
    {},
    async (args) => {
      return await handleListObjectStyles(args);
    }
  );

  // Register enhanced apply_object_style tool
  server.tool(
    "apply_object_style",
    {
      style_name: z.string().describe("Name of the object style to apply"),
      page_range: z.union([z.literal("all"), z.array(z.number())]).default("all").describe("Pages to apply on (1-based page numbers or 'all')"),
      target_selection: z.enum(["all_objects", "selected", "by_criteria"]).default("selected").describe("Target objects to apply style to"),
      selection_criteria: z.object({
        object_type: z.union([z.array(z.string()), z.literal("all")]).default("all").describe("Object types: ['rectangle', 'textFrame', 'image'] or 'all'"),
        layer_names: z.array(z.string()).optional().describe("Layer names to include (optional)"),
        position_bounds: z.object({
          x_min: z.number(),
          x_max: z.number(), 
          y_min: z.number(),
          y_max: z.number()
        }).optional().describe("Position bounds filter (optional)"),
        has_fill: z.boolean().optional().describe("Filter by fill property (optional)"),
        has_stroke: z.boolean().optional().describe("Filter by stroke property (optional)")
      }).optional().describe("Advanced selection criteria when target_selection is 'by_criteria'"),
      verbose_logging: z.boolean().default(false).describe("Enable detailed logging of operations"),
      dry_run: z.boolean().default(false).describe("Preview what would be selected/changed without applying")
    },
    async (args) => {
      return await handleApplyObjectStyle(args);
    }
  );

  // Register update_object_style tool
  server.tool(
    "update_object_style",
    {
      style_name: z.string().describe("Name of the object style to update"),
      properties: z.object({
        fill_color: z.string().optional().describe("Fill color swatch name"),
        stroke_color: z.string().optional().describe("Stroke color swatch name"),
        stroke_width: z.number().optional().describe("Stroke width in points"),
        transparency: z.number().optional().describe("Transparency percentage (0-100)"),
        drop_shadow: z.boolean().optional().describe("Enable/disable drop shadow"),
        corner_radius: z.number().optional().describe("Corner radius for rectangles")
      }).describe("Properties to update")
    },
    async (args) => {
      return await handleUpdateObjectStyle(args);
    }
  );
}


// Handler implementations
async function handleListParagraphStyles(_args: any): Promise<{ content: TextContent[] }> {
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    var styleList = [];
    styleList.push("=== Paragraph Styles in " + doc.name + " ===");
    styleList.push("");
    
    for (var i = 0; i < doc.paragraphStyles.length; i++) {
      var style = doc.paragraphStyles[i];
      var styleInfo = (i + 1) + ". " + style.name;
      
      try {
        if (style.pointSize !== undefined && style.pointSize !== "") {
          styleInfo += " (Size: " + style.pointSize + "pt)";
        }
      } catch(e) {
        // Skip property if not accessible
      }
      
      styleList.push(styleInfo);
    }
    
    styleList.join("\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? result.result! : `Error listing paragraph styles: ${result.error}`
    }]
  };
}

async function handleApplyParagraphStyle(args: any) {
  if (!args.style_name) {
    throw new Error("style_name parameter is required");
  }
  
  const styleName = escapeExtendScriptString(args.style_name);
  const targetText = args.target_text ? escapeExtendScriptString(args.target_text) : "";
  const allOccurrences = args.all_occurrences || false;
  const storyIndex = typeof args.story_index === "number" ? args.story_index : -1;
  const paragraphRange = args.paragraph_range ? escapeExtendScriptString(args.paragraph_range) : "";
  
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    // Find the paragraph style
    var targetStyle = null;
    try {
      targetStyle = doc.paragraphStyles.itemByName("${styleName}");
      if (!targetStyle.isValid) {
        throw new Error("Style not found");
      }
    } catch (e) {
      throw new Error("Paragraph style '" + "${styleName}" + "' not found. Available styles: " + 
                      doc.paragraphStyles.everyItem().name.join(", "));
    }
    
    var appliedCount = 0;
    var results = [];
    
    try {
      if (${storyIndex} >= 0) {
        // Apply to an entire story or range without selection
        if (doc.stories.length <= ${storyIndex}) {
          throw new Error('Story index ${storyIndex} out of range (have ' + doc.stories.length + ' stories)');
        }
        
        var story = doc.stories[${storyIndex}];
        var paragraphsToStyle = [];
        
        if ("${paragraphRange}" !== "") {
          if ("${paragraphRange}".indexOf('-') !== -1) {
            var range = "${paragraphRange}".split('-');
            var start = parseInt(range[0], 10) - 1;
            var end = parseInt(range[1], 10) - 1;
            
            if (start < 0) start = 0;
            if (end >= story.paragraphs.length) end = story.paragraphs.length - 1;
            
            for (var i = start; i <= end; i++) {
              paragraphsToStyle.push(i);
            }
          } else {
            var singlePara = parseInt("${paragraphRange}", 10) - 1;
            if (singlePara >= 0 && singlePara < story.paragraphs.length) {
              paragraphsToStyle.push(singlePara);
            }
          }
        } else {
          // Apply to all paragraphs in story
          for (var i = 0; i < story.paragraphs.length; i++) {
            paragraphsToStyle.push(i);
          }
        }
        
        for (var j = 0; j < paragraphsToStyle.length; j++) {
          var paraIndex = paragraphsToStyle[j];
          if (paraIndex >= 0 && paraIndex < story.paragraphs.length) {
            story.paragraphs[paraIndex].appliedParagraphStyle = targetStyle;
            appliedCount++;
          }
        }
        
        results.push("Applied to story " + ${storyIndex} + ": " + appliedCount + " paragraphs");
        
      } else if ("${targetText}" === "") {
        // Apply to current selection or smart selection
        var selectionFound = false;
        
        if (app.selection.length > 0) {
          var selection = app.selection[0];
          
          // Check if it's a text selection
          if (selection.hasOwnProperty("paragraphs")) {
            try {
              for (var j = 0; j < selection.paragraphs.length; j++) {
                selection.paragraphs[j].appliedParagraphStyle = targetStyle;
                appliedCount++;
              }
              selectionFound = true;
              results.push("Applied to text selection: " + appliedCount + " paragraphs");
            } catch (selErr) {
              results.push("Error applying to selection: " + selErr.message);
            }
          }
          // Check if it's a text frame selection
          else if (selection.hasOwnProperty("contents") && selection.constructor.name === "TextFrame") {
            try {
              for (var j = 0; j < selection.paragraphs.length; j++) {
                selection.paragraphs[j].appliedParagraphStyle = targetStyle;
                appliedCount++;
              }
              selectionFound = true;
              results.push("Applied to selected text frame: " + appliedCount + " paragraphs");
            } catch (frameErr) {
              results.push("Error applying to text frame: " + frameErr.message);
            }
          }
        }
        
        if (!selectionFound) {
          // Fallback: apply to first text frame if no selection
          if (doc.textFrames.length > 0) {
            var firstFrame = doc.textFrames[0];
            try {
              for (var j = 0; j < firstFrame.paragraphs.length; j++) {
                firstFrame.paragraphs[j].appliedParagraphStyle = targetStyle;
                appliedCount++;
              }
              results.push("No selection found. Applied to first text frame: " + appliedCount + " paragraphs");
            } catch (fallbackErr) {
              throw new Error("No text selection found and unable to apply to first text frame: " + fallbackErr.message);
            }
          } else {
            throw new Error("No text selection found and no text frames in document. Please select text or provide target_text/story_index.");
          }
        }
        
      } else {
        // Find and apply to specific text
        try {
          app.findGrepPreferences = NothingEnum.nothing;
          app.changeGrepPreferences = NothingEnum.nothing;
          
          app.findGrepPreferences.findWhat = "${targetText}";
          
          var found = doc.findGrep();
          
          if (found.length === 0) {
            throw new Error("Text '${targetText}' not found in document");
          }
          
          var maxToProcess = ${allOccurrences} ? found.length : 1;
          
          for (var k = 0; k < maxToProcess && k < found.length; k++) {
            try {
              // Get the parent paragraph of the found text
              var foundText = found[k];
              var paragraph = foundText.paragraphs[0];
              paragraph.appliedParagraphStyle = targetStyle;
              appliedCount++;
            } catch (applyErr) {
              results.push("Error applying style to occurrence " + (k + 1) + ": " + applyErr.message);
            }
          }
          
          results.push("Found and styled " + appliedCount + " occurrences of '${targetText}'");
          
        } catch (searchErr) {
          throw new Error("Error searching for text: " + searchErr.message);
        } finally {
          // Clean up search preferences
          try {
            app.findGrepPreferences = NothingEnum.nothing;
            app.changeGrepPreferences = NothingEnum.nothing;
          } catch (cleanupErr) {
            // Ignore cleanup errors
          }
        }
      }
      
      // Build final result
      var resultMessage = "Applied paragraph style '${styleName}' to " + appliedCount + " paragraph(s)";
      if (results.length > 0) {
        resultMessage += "\\\\nDetails: " + results.join(", ");
      }
      
      resultMessage;
      
    } catch (mainErr) {
      throw new Error("Failed to apply paragraph style: " + mainErr.message);
    }
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? `Successfully applied paragraph style: ${result.result}` : `Error applying paragraph style: ${result.error}`
    }]
  };
}

async function handleCreateParagraphStyle(args: any): Promise<{ content: TextContent[] }> {
  if (!args.style_name) {
    throw new Error("style_name parameter is required");
  }
  
  const styleName = escapeExtendScriptString(args.style_name);
  const fontSize = args.font_size || 12;
  const fontFamily = args.font_family ? escapeExtendScriptString(args.font_family) : "";
  const alignment: TextAlignment = args.alignment || "left";
  const spaceBefore = args.space_before || 0;
  const spaceAfter = args.space_after || 0;
  
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    // Check if style already exists
    var existingStyle = null;
    for (var i = 0; i < doc.paragraphStyles.length; i++) {
      if (doc.paragraphStyles[i].name === "${styleName}") {
        existingStyle = doc.paragraphStyles[i];
        break;
      }
    }
    
    if (existingStyle) {
      throw new Error("A paragraph style with name '" + "${styleName}" + "' already exists.");
    }
    
    // Create new style
    var newStyle = doc.paragraphStyles.add({ name: "${styleName}" });
    
    // Set properties
    newStyle.pointSize = ${fontSize};
    if ("${fontFamily}" !== "") {
      newStyle.appliedFont = "${fontFamily}";
    }
    
    switch("${alignment}") {
      case "left":
        newStyle.justification = Justification.LEFT_ALIGN;
        break;
      case "center":
        newStyle.justification = Justification.CENTER_ALIGN;
        break;
      case "right":
        newStyle.justification = Justification.RIGHT_ALIGN;
        break;
      case "justify":
        newStyle.justification = Justification.FULLY_JUSTIFIED;
        break;
    }
    
    newStyle.spaceBefore = "${spaceBefore}";
    newStyle.spaceAfter = "${spaceAfter}";
    
    "Created new paragraph style '" + "${styleName}" + "'";
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Successfully created paragraph style: ${result.result}` : `Error creating paragraph style: ${result.error}`
    }]
  };
}

async function handleSelectTextRange(args: any): Promise<{ content: TextContent[] }> {
  if (!args.selection_type) {
    throw new Error("selection_type parameter is required");
  }
  
  // Validate required parameters based on selection type
  if (args.selection_type === "text_content" && !args.text_content) {
    throw new Error("text_content parameter is required when selection_type is 'text_content'");
  }
  
  const selectionType: SelectionType = args.selection_type;
  const paragraphNumber = args.paragraph_number || 1;
  const textContent = args.text_content ? escapeExtendScriptString(args.text_content) : "";
  const storyIndex = args.story_index || 0;
  
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    var selectionResult = "";
    
    switch("${selectionType}") {
      case "paragraph_number":
        if (doc.stories.length <= ${storyIndex}) {
          throw new Error("Story index out of range. Document has " + doc.stories.length + " stories.");
        }
        
        var story = doc.stories[${storyIndex}];
        var paragraphs = story.paragraphs;
        
        if (${paragraphNumber} < 1 || ${paragraphNumber} > paragraphs.length) {
          throw new Error("Paragraph number out of range. Story has " + paragraphs.length + " paragraphs.");
        }
        
        var targetParagraph = paragraphs[${paragraphNumber} - 1];
        // Use app.selection to set the selection properly
        app.selection = [targetParagraph];
        selectionResult = "Selected paragraph " + ${paragraphNumber} + " from story " + ${storyIndex};
        break;
        
      case "text_content":
        app.findGrepPreferences = NothingEnum.nothing;
        app.findGrepPreferences.findWhat = "${textContent}";
        
        var found = doc.findGrep();
        if (found.length === 0) {
          throw new Error("Text content not found: '${textContent}'");
        }
        
        // Select the first found instance
        app.selection = [found[0]];
        app.findGrepPreferences = NothingEnum.nothing;
        selectionResult = "Selected text content: first occurrence of '${textContent}'";
        break;
        
      case "story_range":
        if (doc.stories.length <= ${storyIndex}) {
          throw new Error("Story index out of range. Document has " + doc.stories.length + " stories.");
        }
        
        var targetStory = doc.stories[${storyIndex}];
        // Select the entire story by setting selection to the story's text range
        app.selection = [targetStory.texts.itemByRange(0, -1)];
        selectionResult = "Selected entire story " + ${storyIndex} + " (" + targetStory.contents.length + " characters)";
        break;
    }
    
    selectionResult;
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Successfully selected text: ${result.result}` : `Error selecting text: ${result.error}`
    }]
  };
}

async function handleListCharacterStyles(_args: any): Promise<{ content: TextContent[] }> {
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    var styleList = [];
    styleList.push("=== Character Styles in " + doc.name + " ===");
    styleList.push("");
    
    for (var i = 0; i < doc.characterStyles.length; i++) {
      var style = doc.characterStyles[i];
      var styleInfo = (i + 1) + ". " + style.name;
      
      try {
        if (style.pointSize !== undefined && style.pointSize !== "") {
          styleInfo += " (Size: " + style.pointSize + "pt)";
        }
      } catch(e) {
        // Skip property if not accessible
      }
      
      styleList.push(styleInfo);
    }
    
    styleList.join("\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? result.result! : `Error listing character styles: ${result.error}`
    }]
  };
}

async function handleApplyCharacterStyle(args: any): Promise<{ content: TextContent[] }> {
  if (!args.style_name) {
    throw new Error("style_name parameter is required");
  }
  if (!args.target_text) {
    throw new Error("target_text parameter is required");
  }
  
  const styleName = escapeExtendScriptString(args.style_name);
  const targetText = escapeExtendScriptString(args.target_text);
  const allOccurrences = args.all_occurrences || false;
  
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    // Find the character style
    var targetStyle = null;
    for (var i = 0; i < doc.characterStyles.length; i++) {
      if (doc.characterStyles[i].name === "${styleName}") {
        targetStyle = doc.characterStyles[i];
        break;
      }
    }
    
    if (!targetStyle) {
      throw new Error("Character style '" + "${styleName}" + "' not found.");
    }
    
    // Find and apply to specific text
    app.findGrepPreferences = NothingEnum.nothing;
    app.findGrepPreferences.findWhat = "${targetText}";
    
    var found = doc.findGrep(${allOccurrences});
    var appliedCount = 0;
    
    for (var k = 0; k < found.length; k++) {
      found[k].appliedCharacterStyle = targetStyle;
      appliedCount++;
    }
    
    app.findGrepPreferences = NothingEnum.nothing;
    
    "Applied character style '" + "${styleName}" + "' to " + appliedCount + " occurrence(s)";
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Successfully applied character style: ${result.result}` : `Error applying character style: ${result.error}`
    }]
  };
}

async function handleCreateCharacterStyle(args: any): Promise<{ content: TextContent[] }> {
  if (!args.style_name) {
    throw new Error("style_name parameter is required");
  }
  
  const styleName = escapeExtendScriptString(args.style_name);
  const fontSize = args.font_size || 12;
  const fontFamily = args.font_family ? escapeExtendScriptString(args.font_family) : "";
  const fontStyle: FontStyle = args.font_style || "Regular";
  const fillColor = escapeExtendScriptString(args.fill_color || "[Black]");
  const tracking = args.tracking || 0;
  
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    // Check if style already exists
    var existingStyle = null;
    for (var i = 0; i < doc.characterStyles.length; i++) {
      if (doc.characterStyles[i].name === "${styleName}") {
        existingStyle = doc.characterStyles[i];
        break;
      }
    }
    
    if (existingStyle) {
      throw new Error("A character style with name '" + "${styleName}" + "' already exists.");
    }
    
    // Create new style
    var newStyle = doc.characterStyles.add({ name: "${styleName}" });
    
    // Set properties
    newStyle.pointSize = ${fontSize};
    
    if ("${fontFamily}" !== "") {
      try {
        newStyle.appliedFont = "${fontFamily}";
      } catch(e) {
        // Font not available, skip
      }
    }
    
    newStyle.fontStyle = "${fontStyle}";
    newStyle.tracking = ${tracking};
    
    // Handle fill color properly
    if ("${fillColor}" !== "[Black]") {
      try {
        var targetColor = doc.colors.itemByName("${fillColor}");
        if (targetColor.isValid) {
          newStyle.fillColor = targetColor;
        }
      } catch(e) {
        // Color handling failed, continue without setting color
      }
    }
    
    "Created new character style '" + "${styleName}" + "'";
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Successfully created character style: ${result.result}` : `Error creating character style: ${result.error}`
    }]
  };
}

/**
 * Retrieves all installed system fonts, optionally filtered by substring
 */
async function handleListSystemFonts(args: any): Promise<{ content: TextContent[] }> {
  const filter = (args.filter || "").toString().toLowerCase();
  const statusFilter = args.status || "installed";
  const limit = args.limit || 1000;
  const jsx = `
    (function() {
      var results = [];
      for (var i = 0; i < app.fonts.length; i++) {
        var f = app.fonts[i];
        var rec = {
          fontFamily: f.fontFamily,
          fontStyle: f.fontStyle,
          fullName: f.fullName,
          status: f.status.toString()
        };
        var passesFilter = ("${filter}" === "" || (rec.fontFamily + " " + rec.fullName).toLowerCase().indexOf("${filter}") !== -1);
        if (passesFilter) {
          results.push(rec);
        }
      }
      return JSON.stringify(results);
    })();`;

  const result = await executeExtendScript(jsx);
  if (!result.success) {
    return { content: [{ type: "text", text: `Error listing fonts: ${result.error}` }] };
  }

  let fonts: any[] = [];
  try { fonts = JSON.parse(result.result || "[]"); } catch {
    // ignore parse errors
  }
  // Apply status filter and limit in JS side
  const filtered = fonts.filter(f => {
    if (statusFilter === "all") return true;
    const isInstalled = (f.status || "").toLowerCase().indexOf("installed") !== -1;
    return statusFilter === "installed" ? isInstalled : !isInstalled;
  }).slice(0, limit);

  const lines = [
    `📚 **System Fonts (${filtered.length})**`,
    ...filtered.map(f => `• ${f.fontFamily} – ${f.fontStyle} (${f.status})`)
  ];
  return { content: [{ type: "text", text: lines.join("\n") }] };
}

/**
 * Checks availability of specific fonts (family or family+style) in the system
 */
async function handleCheckFontAvailability(args: any): Promise<{ content: TextContent[] }> {
  const fontsArr: string[] = args.fonts || [];
  const failIfMissing = args.fail_if_missing || false;
  const listJson = JSON.stringify(fontsArr);
  const jsx = `
    (function() {
      var toCheck = ${listJson};
      var available = [], missing = [];
      for (var i = 0; i < toCheck.length; i++) {
        var name = toCheck[i];
        var fontObj;
        try {
          fontObj = app.fonts.itemByName(name);
        } catch(e) {
          fontObj = null;
        }
        if (fontObj && fontObj.isValid && fontObj.status === FontStatus.INSTALLED) {
          available.push(name);
        } else {
          missing.push(name);
        }
      }
      return JSON.stringify({ available: available, missing: missing });
    })();`;

  const result = await executeExtendScript(jsx);
  if (!result.success) {
    return { content: [{ type: "text", text: `Error checking fonts: ${result.error}` }] };
  }
  let payload: { available: string[]; missing: string[] } = { available: [], missing: [] };
  try { 
    payload = JSON.parse(result.result || "{}"); 
  } catch (e) {
    // If JSON parsing fails, return empty arrays
    payload = { available: [], missing: [] };
  }

  // Mark fonts checked in layout cache
  markFontsChecked();

  const lines: string[] = [];
  lines.push(`✅ Available: ${payload.available.length}`);
  if (payload.available.length) lines.push(...payload.available.map(f => `  • ${f}`));
  lines.push(`❌ Missing: ${payload.missing.length}`);
  if (payload.missing.length) lines.push(...payload.missing.map(f => `  • ${f}`));

  if (failIfMissing && payload.missing.length) {
    return { content: [{ type: "text", text: `❌ Missing fonts: ${payload.missing.join(", ")}` }] };
  }
  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleListObjectStyles(_args: any): Promise<{ content: TextContent[] }> {
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    var styleList = [];
    styleList.push("=== Object Styles in " + doc.name + " ===");
    styleList.push("");
    
    for (var i = 0; i < doc.objectStyles.length; i++) {
      var style = doc.objectStyles[i];
      var styleInfo = (i + 1) + ". " + style.name;
      
      try {
        // Try to get basic properties
        var properties = [];
        
        if (style.fillColor && style.fillColor.name !== "[None]") {
          properties.push("Fill: " + style.fillColor.name);
        }
        
        if (style.strokeColor && style.strokeColor.name !== "[None]") {
          properties.push("Stroke: " + style.strokeColor.name);
        }
        
        if (style.strokeWeight !== undefined && style.strokeWeight > 0) {
          properties.push("Weight: " + style.strokeWeight + "pt");
        }
        
        if (properties.length > 0) {
          styleInfo += " (" + properties.join(", ") + ")";
        }
      } catch(e) {
        // Skip property if not accessible
      }
      
      styleList.push(styleInfo);
    }
    
    styleList.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? result.result! : `Error listing object styles: ${result.error}`
    }]
  };
}

async function handleApplyObjectStyle(args: any): Promise<{ content: TextContent[] }> {
  const { 
    style_name, 
    page_range = "all", 
    target_selection = "selected",
    selection_criteria = {},
    verbose_logging = false,
    dry_run = false
  } = args;
  
  const styleName = escapeExtendScriptString(style_name);
  const pageRangeJson = page_range === "all" ? "all" : JSON.stringify(page_range);
  const criteriaJson = JSON.stringify(selection_criteria);
  
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    // Get the object style
    var objectStyle = doc.objectStyles.itemByName("${styleName}");
    if (!objectStyle.isValid) {
      // List available styles to help the user
      var availableStyles = [];
      for (var st = 0; st < doc.objectStyles.length; st++) {
        availableStyles.push((st + 1) + ". " + doc.objectStyles[st].name);
      }
      throw new Error("Object style '${styleName}' not found.\\n\\nAvailable object styles:\\n" + availableStyles.join("\\n"));
    }
    
    var applied = 0;
    var errors = 0;
    var skipped = 0;
    var results = [];
    var detailedLog = [];
    var skippedObjects = [];
    var verboseLogging = ${verbose_logging};
    var isDryRun = ${dry_run};
    
    // Add debug header
    results.push("=== OBJECT STYLE APPLICATION DEBUG ===");
    results.push("Style: '${styleName}'");
    results.push("Mode: " + (isDryRun ? "DRY RUN (preview only)" : "APPLY STYLES"));
    results.push("");
    
    // Helper function to check object type
    function getObjectType(obj) {
      try {
        if (obj.constructor.name === "Rectangle") return "rectangle";
        if (obj.constructor.name === "TextFrame") return "textFrame";
        if (obj.constructor.name === "Image") return "image";
        if (obj.constructor.name === "Oval") return "oval";
        if (obj.constructor.name === "Polygon") return "polygon";
        return obj.constructor.name.toLowerCase();
      } catch (e) {
        return "unknown";
      }
    }
    
    // Helper function to check if object matches criteria
    function matchesCriteria(obj, criteria, pageNum) {
      try {
        var objType = getObjectType(obj);
        
        // Check object type
        if (criteria.object_type !== "all" && criteria.object_type.length > 0) {
          var typeMatches = false;
          for (var t = 0; t < criteria.object_type.length; t++) {
            if (objType === criteria.object_type[t].toLowerCase()) {
              typeMatches = true;
              break;
            }
          }
          if (!typeMatches) {
            skippedObjects.push({
              page: pageNum,
              reason: "Object type '" + objType + "' not in allowed types",
              object_type: objType
            });
            return false;
          }
        }
        
        // Check layer
        if (criteria.layer_names && criteria.layer_names.length > 0) {
          var layerMatches = false;
          var objLayerName = obj.itemLayer ? obj.itemLayer.name : "";
          
          // First check if all specified layers exist
          for (var lc = 0; lc < criteria.layer_names.length; lc++) {
            var layerExists = false;
            for (var ld = 0; ld < doc.layers.length; ld++) {
              if (doc.layers[ld].name === criteria.layer_names[lc]) {
                layerExists = true;
                break;
              }
            }
            if (!layerExists) {
              // Prepare list of available layers for error message
              var availableLayers = [];
              for (var la = 0; la < doc.layers.length; la++) {
                availableLayers.push((la + 1) + ". " + doc.layers[la].name);
              }
              throw new Error("Layer '" + criteria.layer_names[lc] + "' not found.\\n\\nAvailable layers:\\n" + availableLayers.join("\\n"));
            }
          }
          
          for (var l = 0; l < criteria.layer_names.length; l++) {
            if (objLayerName === criteria.layer_names[l]) {
              layerMatches = true;
              break;
            }
          }
          if (!layerMatches) {
            skippedObjects.push({
              page: pageNum,
              reason: "Object layer '" + objLayerName + "' not in allowed layers",
              object_type: objType
            });
            return false;
          }
        }
        
        // Check position bounds
        if (criteria.position_bounds) {
          var bounds = obj.geometricBounds;
          var centerX = (bounds[1] + bounds[3]) / 2;
          var centerY = (bounds[0] + bounds[2]) / 2;
          
          if (centerX < criteria.position_bounds.x_min || centerX > criteria.position_bounds.x_max ||
              centerY < criteria.position_bounds.y_min || centerY > criteria.position_bounds.y_max) {
            skippedObjects.push({
              page: pageNum,
              reason: "Object position outside bounds",
              object_type: objType
            });
            return false;
          }
        }
        
        // Check fill property
        if (criteria.has_fill !== null && criteria.has_fill !== undefined) {
          var hasFill = false;
          try {
            hasFill = obj.fillColor && obj.fillColor.name !== "[None]";
          } catch (e) {
            // Ignore fill check errors
          }
          
          if (criteria.has_fill && !hasFill) {
            skippedObjects.push({
              page: pageNum,
              reason: "Object has no fill property",
              object_type: objType
            });
            return false;
          }
          if (!criteria.has_fill && hasFill) {
            skippedObjects.push({
              page: pageNum,
              reason: "Object has fill property when none expected",
              object_type: objType
            });
            return false;
          }
        }
        
        // Check stroke property
        if (criteria.has_stroke !== null && criteria.has_stroke !== undefined) {
          var hasStroke = false;
          try {
            hasStroke = obj.strokeColor && obj.strokeColor.name !== "[None]" && obj.strokeWeight > 0;
          } catch (e) {
            // Ignore stroke check errors
          }
          
          if (criteria.has_stroke && !hasStroke) {
            skippedObjects.push({
              page: pageNum,
              reason: "Object has no stroke property",
              object_type: objType
            });
            return false;
          }
          if (!criteria.has_stroke && hasStroke) {
            skippedObjects.push({
              page: pageNum,
              reason: "Object has stroke property when none expected", 
              object_type: objType
            });
            return false;
          }
        }
        
        return true;
      } catch (e) {
        skippedObjects.push({
          page: pageNum,
          reason: "Error checking criteria: " + e.message,
          object_type: getObjectType(obj)
        });
        return false;
      }
    }
    
    try {
      var criteria = ${criteriaJson};
      var targetPages = ${pageRangeJson};
      var pagesToProcess = [];
      var totalObjectsChecked = 0;
      
      // Build page list
      if (targetPages === "all") {
        for (var p = 0; p < doc.pages.length; p++) {
          pagesToProcess.push(doc.pages[p]);
        }
      } else {
        for (var p = 0; p < targetPages.length; p++) {
          var pageNum = targetPages[p];
          if (pageNum > 0 && pageNum <= doc.pages.length) {
            pagesToProcess.push(doc.pages[pageNum - 1]);
          }
        }
      }
      
      if ("${target_selection}" === "selected") {
        // Apply to current selection
        if (app.selection.length === 0) {
          throw new Error("No objects selected. Please select objects or choose a different target.");
        }
        
        for (var s = 0; s < app.selection.length; s++) {
          try {
            var obj = app.selection[s];
            if (obj.hasOwnProperty('appliedObjectStyle')) {
              if (!isDryRun) {
                obj.appliedObjectStyle = objectStyle;
              }
              applied++;
              if (verboseLogging) {
                detailedLog.push("Applied style to selected " + getObjectType(obj));
              }
            }
          } catch (e) {
            errors++;
            if (verboseLogging) {
              detailedLog.push("Error applying to selected object: " + e.message);
            }
          }
        }
        
        results.push((isDryRun ? "Would apply" : "Applied") + " '" + "${styleName}" + "' to " + applied + " selected objects");
        
      } else if ("${target_selection}" === "all_objects") {
        // Apply to all objects on specified pages
        results.push("Processing pages: " + (targetPages === "all" ? "all" : targetPages.join(", ")));
        results.push("");
        
        for (var p = 0; p < pagesToProcess.length; p++) {
          var page = pagesToProcess[p];
          var pageNum = page.name || (p + 1).toString();
          var allItems = page.allPageItems;
          var pageApplied = 0;
          var pageErrors = 0;
          var pageTypes = [];
          
          for (var i = 0; i < allItems.length; i++) {
            try {
              var item = allItems[i];
              var itemType = getObjectType(item);
              
              if (item.hasOwnProperty('appliedObjectStyle')) {
                if (!isDryRun) {
                  item.appliedObjectStyle = objectStyle;
                }
                applied++;
                pageApplied++;
                
                // Track object types on this page
                var typeFound = false;
                for (var t = 0; t < pageTypes.length; t++) {
                  if (pageTypes[t].type === itemType) {
                    pageTypes[t].count++;
                    typeFound = true;
                    break;
                  }
                }
                if (!typeFound) {
                  pageTypes.push({type: itemType, count: 1});
                }
                
                if (verboseLogging) {
                  detailedLog.push("  ✓ " + itemType + " styled");
                }
              }
            } catch (e) {
              errors++;
              pageErrors++;
              if (verboseLogging) {
                detailedLog.push("  ✗ Error on " + getObjectType(item) + ": " + e.message);
              }
            }
          }
          
          // Page summary
          if (pageApplied > 0 || pageErrors > 0 || verboseLogging) {
            var typeStrs = [];
            for (var t = 0; t < pageTypes.length; t++) {
              typeStrs.push(pageTypes[t].count + " " + pageTypes[t].type + "(s)");
            }
            
            if (typeStrs.length > 0) {
              results.push("Page " + pageNum + ": " + (isDryRun ? "Would apply to " : "Applied to ") + 
                           typeStrs.join(", "));
            } else if (allItems.length > 0) {
              results.push("Page " + pageNum + ": " + allItems.length + " objects found but none support object styles");
            } else {
              results.push("Page " + pageNum + ": No objects found");
            }
            
            if (pageErrors > 0) {
              results.push("  (Errors: " + pageErrors + ")");
            }
          }
        }
        
        results.push("");
        results.push((isDryRun ? "Would apply" : "Applied") + " '" + "${styleName}" + "' to " + applied + " objects across " + pagesToProcess.length + " pages");
        
      } else if ("${target_selection}" === "by_criteria") {
        // Apply based on selection criteria
        results.push("Processing with criteria:");
        if (criteria.object_type && criteria.object_type.length > 0) {
          results.push("  • Object types: " + criteria.object_type.join(", "));
        }
        if (criteria.layer_names && criteria.layer_names.length > 0) {
          results.push("  • Layers: " + criteria.layer_names.join(", "));
        }
        if (criteria.position_bounds) {
          results.push("  • Position bounds: x=" + criteria.position_bounds.x_min + "-" + criteria.position_bounds.x_max + 
                       ", y=" + criteria.position_bounds.y_min + "-" + criteria.position_bounds.y_max);
        }
        if (criteria.has_fill !== null && criteria.has_fill !== undefined) {
          results.push("  • Has fill: " + criteria.has_fill);
        }
        if (criteria.has_stroke !== null && criteria.has_stroke !== undefined) {
          results.push("  • Has stroke: " + criteria.has_stroke);
        }
        results.push("");
        
        for (var p = 0; p < pagesToProcess.length; p++) {
          var page = pagesToProcess[p];
          var pageNum = parseInt(page.name) || (p + 1);
          var allItems = page.allPageItems;
          var pageApplied = 0;
          var pageSkipped = 0;
          var pageErrors = 0;
          var pageTypes = {};
          
          totalObjectsChecked += allItems.length;
          
          for (var i = 0; i < allItems.length; i++) {
            try {
              var item = allItems[i];
              var itemType = getObjectType(item);
              
              if (item.hasOwnProperty('appliedObjectStyle')) {
                if (matchesCriteria(item, criteria, pageNum)) {
                  if (!isDryRun) {
                    item.appliedObjectStyle = objectStyle;
                  }
                  applied++;
                  pageApplied++;
                  
                  // Track applied types
                  if (!pageTypes[itemType]) {
                    pageTypes[itemType] = {applied: 0, skipped: 0};
                  }
                  pageTypes[itemType].applied++;
                  
                  if (verboseLogging) {
                    detailedLog.push("  ✓ " + itemType + " matched criteria and styled");
                  }
                } else {
                  skipped++;
                  pageSkipped++;
                  
                  // Track skipped types
                  if (!pageTypes[itemType]) {
                    pageTypes[itemType] = {applied: 0, skipped: 0};
                  }
                  pageTypes[itemType].skipped++;
                }
              }
            } catch (e) {
              errors++;
              pageErrors++;
              if (verboseLogging) {
                detailedLog.push("  ✗ Error on " + getObjectType(item) + ": " + e.message);
              }
            }
          }
          
          // Page summary with details
          if (pageApplied > 0 || pageSkipped > 0 || verboseLogging) {
            var summary = "Page " + pageNum + ": ";
            
            if (pageApplied > 0) {
              summary += (isDryRun ? "Would apply to " : "Applied to ") + pageApplied + " objects";
            }
            
            if (pageSkipped > 0) {
              summary += (pageApplied > 0 ? ", " : "") + pageSkipped + " skipped";
            }
            
            if (pageErrors > 0) {
              summary += ", " + pageErrors + " errors";
            }
            
            results.push(summary);
            
            // Object breakdown
            if (verboseLogging && Object.keys(pageTypes).length > 0) {
              results.push("  Object breakdown:");
              for (var type in pageTypes) {
                if (pageTypes.hasOwnProperty(type)) {
                  var stats = pageTypes[type];
                  results.push("    • " + type + ": " + stats.applied + " applied, " + stats.skipped + " skipped");
                }
              }
            }
          }
        }
        
        results.push("");
        results.push((isDryRun ? "Would apply" : "Applied") + " '" + "${styleName}" + "' to " + applied + " objects using criteria");
      }
      
      results.push("");
      
      // Summary statistics
      if (errors > 0) {
        results.push("⚠ Errors encountered: " + errors + " objects could not be processed");
      }
      
      if (skipped > 0) {
        results.push("⚠ Skipped: " + skipped + " objects did not match criteria");
        
        // Provide breakdown of skip reasons if available
        if (skippedObjects.length > 0 && verboseLogging) {
          var skipReasons = {};
          for (var sk = 0; sk < skippedObjects.length; sk++) {
            var reason = skippedObjects[sk].reason;
            if (!skipReasons[reason]) {
              skipReasons[reason] = 0;
            }
            skipReasons[reason]++;
          }
          
          results.push("  Skip reasons:");
          for (var reason in skipReasons) {
            if (skipReasons.hasOwnProperty(reason)) {
              results.push("    • " + reason + ": " + skipReasons[reason]);
            }
          }
        }
      }
      
      // Troubleshooting hints when nothing was styled
      if (applied === 0 && errors === 0) {
        results.push("");
        results.push("TROUBLESHOOTING:");
        results.push("• Check if the target objects support object styles");
        results.push("• Verify page range and layer names are correct");
        results.push("• For criteria-based selection, ensure criteria match your objects");
        results.push("• Try using verbose_logging: true for detailed information");
        results.push("• Consider using target_selection: 'selected' to test on specific objects first");
        
        if (totalObjectsChecked > 0) {
          results.push("");
          results.push("Note: " + totalObjectsChecked + " objects were checked but none matched criteria or supported object styles");
        }
      }
      
      // Build final output
      var output = [];
      output = output.concat(results);
      
      if (verboseLogging && detailedLog.length > 0) {
        output.push("");
        output.push("=== DETAILED LOG ===");
        output = output.concat(detailedLog);
      }
      
      // Add object breakdown for dry run or verbose mode
      if ((isDryRun || verboseLogging) && applied > 0) {
        output.push("");
        output.push("=== OBJECT BREAKDOWN ===");
        
        var overallTypes = {};
        for (var p = 0; p < pagesToProcess.length; p++) {
          var page = pagesToProcess[p];
          var allItems = page.allPageItems;
          
          for (var i = 0; i < allItems.length; i++) {
            try {
              var item = allItems[i];
              if (item.hasOwnProperty('appliedObjectStyle')) {
                var itemType = getObjectType(item);
                if (!overallTypes[itemType]) {
                  overallTypes[itemType] = 0;
                }
                overallTypes[itemType]++;
              }
            } catch(e) {
              // Skip
            }
          }
        }
        
        for (var type in overallTypes) {
          if (overallTypes.hasOwnProperty(type)) {
            output.push("• " + type + ": " + overallTypes[type]);
          }
        }
      }
      
      if (isDryRun) {
        output.push("");
        output.push("=== DRY RUN COMPLETE ===");
        output.push("No changes were made to the document.");
        output.push("Run with dry_run: false to apply the changes.");
      }
      
    } catch (mainError) {
      throw new Error("Apply object style failed: " + mainError.message);
    }
    
    output.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? result.result! : `Error applying object style: ${result.error}`
    }]
  };
}

async function handleUpdateObjectStyle(args: any): Promise<{ content: TextContent[] }> {
  const { style_name, properties } = args;
  
  const styleName = escapeExtendScriptString(style_name);
  const props = properties || {};
  
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    // Get the object style
    var objectStyle = doc.objectStyles.itemByName("${styleName}");
    if (!objectStyle.isValid) {
      throw new Error("Object style '${styleName}' not found.");
    }
    
    var results = [];
    var updated = 0;
    var errors = 0;
    
    results.push("Updating object style: '${styleName}'");
    results.push("==============================");
    
    try {
      // Update fill color
      ${props.fill_color ? `
        var fillSwatch = doc.swatches.itemByName("${escapeExtendScriptString(props.fill_color)}");
        if (fillSwatch.isValid) {
          objectStyle.fillColor = fillSwatch;
          results.push("✓ Fill color: ${escapeExtendScriptString(props.fill_color)}");
          updated++;
        } else {
          results.push("✗ Fill swatch not found: ${escapeExtendScriptString(props.fill_color)}");
          errors++;
        }
      ` : ''}
      
      // Update stroke color  
      ${props.stroke_color ? `
        var strokeSwatch = doc.swatches.itemByName("${escapeExtendScriptString(props.stroke_color)}");
        if (strokeSwatch.isValid) {
          objectStyle.strokeColor = strokeSwatch;
          results.push("✓ Stroke color: ${escapeExtendScriptString(props.stroke_color)}");
          updated++;
        } else {
          results.push("✗ Stroke swatch not found: ${escapeExtendScriptString(props.stroke_color)}");
          errors++;
        }
      ` : ''}
      
      // Update stroke width
      ${props.stroke_width !== undefined ? `
        objectStyle.strokeWeight = ${props.stroke_width};
        results.push("✓ Stroke width: ${props.stroke_width}pt");
        updated++;
      ` : ''}
      
      // Update transparency
      ${props.transparency !== undefined ? `
        objectStyle.transparency = ${props.transparency};
        results.push("✓ Transparency: ${props.transparency}%");
        updated++;
      ` : ''}
      
      // Update drop shadow
      ${props.drop_shadow !== undefined ? `
        try {
          objectStyle.enableDropShadow = ${props.drop_shadow ? "true" : "false"};
          results.push("✓ Drop shadow: ${props.drop_shadow ? "enabled" : "disabled"}");
          updated++;
        } catch (e) {
          results.push("✗ Drop shadow setting failed: " + e.message);
          errors++;
        }
      ` : ''}
      
      // Update corner radius (for rectangle frames)
      ${props.corner_radius !== undefined ? `
        try {
          objectStyle.topLeftCornerRadius = ${props.corner_radius};
          objectStyle.topRightCornerRadius = ${props.corner_radius};
          objectStyle.bottomLeftCornerRadius = ${props.corner_radius};
          objectStyle.bottomRightCornerRadius = ${props.corner_radius};
          results.push("✓ Corner radius: ${props.corner_radius}pt");
          updated++;
        } catch (e) {
          results.push("✗ Corner radius setting failed: " + e.message);
          errors++;
        }
      ` : ''}
      
      results.push("");
      results.push("Summary: " + updated + " properties updated, " + errors + " errors");
      
    } catch (updateError) {
      throw new Error("Update object style failed: " + updateError.message);
    }
    
    results.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? result.result! : `Error updating object style: ${result.error}`
    }]
  };
}