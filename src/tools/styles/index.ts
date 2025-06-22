/**
 * @fileoverview Style management tools for InDesign MCP
 * Batch 2: Paragraph and character style operations
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";
import type { TextAlignment, FontStyle, SelectionType } from "../../types.js";
import { z } from "zod";

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
    async (args) => {
      return await handleApplyParagraphStyle(args);
    }
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

async function handleApplyParagraphStyle(args: any): Promise<{ content: TextContent[] }> {
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
    for (var i = 0; i < doc.paragraphStyles.length; i++) {
      if (doc.paragraphStyles[i].name === "${styleName}") {
        targetStyle = doc.paragraphStyles[i];
        break;
      }
    }
    
    if (!targetStyle) {
      throw new Error("Paragraph style '" + "${styleName}" + "' not found.");
    }
    
    var appliedCount = 0;
    
    if (${storyIndex} >= 0) {
      // Apply to an entire story or range without selection
      if (app.documents.length === 0) { throw new Error('No active doc'); }
      var s = doc.stories[${storyIndex}];
      if (!s) { throw new Error('Story index out of range'); }
      var paraIndices = [];
      if ("${paragraphRange}" !== "") {
        if ("${paragraphRange}".indexOf('-') !== -1) {
          var pr = "${paragraphRange}".split('-');
          var start = parseInt(pr[0],10)-1; var end = parseInt(pr[1],10)-1;
          for(var pi=start; pi<=end; pi++){ paraIndices.push(pi); }
        } else { paraIndices.push(parseInt("${paragraphRange}",10)-1); }
      } else {
        for(var pi=0; pi<s.paragraphs.length; pi++){ paraIndices.push(pi); }
      }
      for(var k=0;k<paraIndices.length;k++){
        var idx = paraIndices[k];
        if (idx>=0 && idx < s.paragraphs.length) {
          s.paragraphs[idx].appliedParagraphStyle = targetStyle;
          appliedCount++;
        }
      }
    } else if ("${targetText}" === "") {
      // Apply to current selection
      if (app.selection.length > 0 && app.selection[0].hasOwnProperty("paragraphs")) {
        var selection = app.selection[0];
        for (var j = 0; j < selection.paragraphs.length; j++) {
          selection.paragraphs[j].appliedParagraphStyle = targetStyle;
          appliedCount++;
        }
      } else {
        throw new Error("No text selection found. Provide target_text or story_index/paragraph_range.");
      }
    } else {
      // Find and apply to specific text
      app.findGrepPreferences = NothingEnum.nothing;
      app.findGrepPreferences.findWhat = "${targetText}";
      
      var found = doc.findGrep(${allOccurrences});
      
      for (var k = 0; k < found.length; k++) {
        found[k].paragraphs[0].appliedParagraphStyle = targetStyle;
        appliedCount++;
      }
      
      app.findGrepPreferences = NothingEnum.nothing;
    }
    
    "Applied paragraph style '" + "${styleName}" + "' to " + appliedCount + " paragraph(s)";
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
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
    
    var selection;
    
    switch("${selectionType}") {
      case "paragraph_number":
        if (doc.stories.length <= ${storyIndex}) {
          throw new Error("Story index out of range.");
        }
        
        var story = doc.stories[${storyIndex}];
        var paragraphs = story.paragraphs;
        
        if (${paragraphNumber} < 1 || ${paragraphNumber} > paragraphs.length) {
          throw new Error("Paragraph number out of range.");
        }
        
        selection = paragraphs[${paragraphNumber} - 1];
        selection.select();
        break;
        
      case "text_content":
        app.findGrepPreferences = NothingEnum.nothing;
        app.findGrepPreferences.findWhat = "${textContent}";
        
        var found = doc.findGrep();
        if (found.length === 0) {
          throw new Error("Text content not found.");
        }
        
        found[0].select();
        app.findGrepPreferences = NothingEnum.nothing;
        break;
        
      case "story_range":
        if (doc.stories.length <= ${storyIndex}) {
          throw new Error("Story index out of range.");
        }
        
        doc.stories[${storyIndex}].select();
        break;
    }
    
    "Text selection successful.";
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