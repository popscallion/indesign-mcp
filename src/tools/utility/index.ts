/**
 * @fileoverview Advanced utility tools for InDesign MCP
 * Batch 6: Text threading, overset resolution, text flow management, frame info
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";
import type { FrameScope, TextFlowAction } from "../../types.js";

/**
 * Registers advanced utility tools with the MCP server
 */
export async function registerUtilityTools(server: McpServer): Promise<void> {
  // Register thread_text_frames tool
  server.tool(
    "thread_text_frames",
    {
      source_frame_index: z.number().int().describe("Index of the source text frame (0-based)"),
      target_frame_index: z.number().int().describe("Index of the target text frame to thread to (0-based)"),
      frame_scope: z.enum(["document", "page"]).default("document").describe("Whether to use document-wide or page-specific indexing"),
      page_number: z.number().int().default(1).describe("Page number for page-specific indexing (1-based)")
    },
    async (args) => {
      const sourceFrameIndex = args.source_frame_index || 0;
      const targetFrameIndex = args.target_frame_index || 1;
      const frameScope: FrameScope = args.frame_scope || "document";
      const pageNumber = args.page_number || 1;
      
      const script = `
        if (app.documents.length === 0) {
          throw new Error("No documents are open in InDesign. Please open a document first.");
        }
        
        var doc = app.activeDocument;
        if (!doc) {
          throw new Error("No active document found.");
        }
        
        var sourceFrame, targetFrame;
        
        if ("${frameScope}" === "document") {
          // Use document-wide text frame indexing
          if (doc.textFrames.length <= ${sourceFrameIndex}) {
            throw new Error("Source text frame index " + ${sourceFrameIndex} + " out of range. Document has " + doc.textFrames.length + " text frames.");
          }
          if (doc.textFrames.length <= ${targetFrameIndex}) {
            throw new Error("Target text frame index " + ${targetFrameIndex} + " out of range. Document has " + doc.textFrames.length + " text frames.");
          }
          
          sourceFrame = doc.textFrames[${sourceFrameIndex}];
          targetFrame = doc.textFrames[${targetFrameIndex}];
        } else {
          // Use page-specific text frame indexing
          if (doc.pages.length < ${pageNumber}) {
            throw new Error("Page number " + ${pageNumber} + " out of range. Document has " + doc.pages.length + " pages.");
          }
          
          var page = doc.pages[${pageNumber} - 1];
          if (page.textFrames.length <= ${sourceFrameIndex}) {
            throw new Error("Source text frame index " + ${sourceFrameIndex} + " out of range on page " + ${pageNumber} + ". Page has " + page.textFrames.length + " text frames.");
          }
          
          sourceFrame = page.textFrames[${sourceFrameIndex}];
          
          // For target, check if it's on same page or use document indexing
          if (page.textFrames.length > ${targetFrameIndex}) {
            targetFrame = page.textFrames[${targetFrameIndex}];
          } else {
            if (doc.textFrames.length <= ${targetFrameIndex}) {
              throw new Error("Target text frame index " + ${targetFrameIndex} + " out of range in document.");
            }
            targetFrame = doc.textFrames[${targetFrameIndex}];
          }
        }
        
        // Check and handle existing threads
        var warnings = [];
        
        if (sourceFrame.nextTextFrame && sourceFrame.nextTextFrame.isValid) {
          warnings.push("Breaking existing outgoing thread from source frame");
          sourceFrame.nextTextFrame = null;
        }
        
        if (targetFrame.previousTextFrame && targetFrame.previousTextFrame.isValid) {
          warnings.push("Breaking existing incoming thread to target frame");
          targetFrame.previousTextFrame.nextTextFrame = null;
        }
        
        // Perform the threading
        try {
          sourceFrame.nextTextFrame = targetFrame;
        } catch (e) {
          throw new Error("Failed to thread frames: " + e.message);
        }
        
        var result = "Successfully threaded text frames:\\n";
        result += "- Source: Frame " + ${sourceFrameIndex} + " (Has content: " + (sourceFrame.contents.length > 0) + ", Overflows: " + sourceFrame.overflows + ")\\n";
        result += "- Target: Frame " + ${targetFrameIndex} + " (Now receives overflow text)";
        
        if (warnings.length > 0) {
          result += "\\n\\nWarnings:\\n" + warnings.join("\\n");
        }
        
        result;
      `;
      
      const result = await executeExtendScript(script);
      
      return {
        content: [{
          type: "text",
          text: result.success ? `Successfully threaded text frames:\n${result.result}` : `Error threading text frames: ${result.error}`
        }]
      };
    }
  );

  // Register resolve_overset_text tool
  server.tool(
    "resolve_overset_text",
    {
      source_page: z.number().int().default(-1).describe("Page number with overset text (1-based)"),
      target_pages: z.array(z.number().int()).default([]).describe("Target page numbers to thread to (1-based)"),
      create_frames_if_needed: z.boolean().default(false).describe("Create new text frames if target pages don't have them")
    },
    async (args) => {
      return await handleResolveOversetText(args);
    }
  );

  // Register manage_text_flow tool
  server.tool(
    "manage_text_flow",
    {
      action: z.enum(["break_thread", "check_flow", "list_threaded", "thread_chain"]).describe("Action to perform"),
      frame_index: z.number().int().default(0).describe("Text frame index for the action"),
      frame_indices: z.array(z.number().int()).default([]).describe("Multiple frame indices for chain threading")
    },
    async (args) => {
      return await handleManageTextFlow(args);
    }
  );

  // Register get_textframe_info tool
  server.tool(
    "get_textframe_info",
    {
      page_number: z.number().int().default(-1).describe("Specific page number (1-based), or -1 for all pages"),
      include_threading: z.boolean().default(true).describe("Include threading information")
    },
    async (args) => {
      return await handleGetTextFrameInfo(args);
    }
  );

  // Register inspect_frame_bounds tool
  server.tool(
    "inspect_frame_bounds",
    {
      page_number: z.number().int().default(4).describe("Page number to inspect (1-based)"),
      include_all_properties: z.boolean().default(false).describe("Include additional frame properties")
    },
    async (args) => {
      return await handleInspectFrameBounds(args);
    }
  );

  // Register copy_textframe_properties tool
  server.tool(
    "copy_textframe_properties",
    {
      source_page: z.number().int().default(4).describe("Source page number (1-based) with existing text frames to copy from"),
      target_pages: z.array(z.number().int()).default([6, 7]).describe("Target page numbers where matching frames will be created"),
      source_frame_index: z.number().int().default(0).describe("Index of existing frame to copy (0-based) - use get_textframe_info first to see available frames"),
      replace_existing: z.boolean().default(false).describe("Remove existing frames on target pages before creating new ones")
    },
    async (args) => {
      return await handleCopyTextFrameProperties(args);
    }
  );

  // Register undo_last tool
  server.tool(
    "undo_last",
    {},
    async () => {
      const jsx = `
        if (app.documents.length === 0) { throw new Error('No active document'); }
        try { app.undo(); } catch(e) { throw new Error('Nothing to undo'); }
        'undone';
      `;
      const r = await executeExtendScript(jsx);
      return { content:[{ type:"text", text: r.success ? 'Last action undone' : `Error: ${r.error}` }] };
    }
  );

  // === validate_layout ==============================================
  server.tool(
    "validate_layout",
    {},
    async (): Promise<{ content: TextContent[] }> => {
      const jsx = `
        if (app.documents.length === 0) { throw new Error('No active document'); }
        var doc = app.activeDocument;
        var issues = [];
        // Overset check
        for (var i=0;i<doc.stories.length;i++){
          if(doc.stories[i].overflows) issues.push({ type:'overset_text', story:i });
        }
        // Empty frame check
        for (var p=0;p<doc.pages.length;p++){
          var page = doc.pages[p];
          for(var f=0;f<page.textFrames.length;f++){
            var tf = page.textFrames[f];
            if(tf.contents.length===0) issues.push({ type:'empty_frame', page:p+1, frame:f });
          }
        }
        var passed = issues.length === 0;
        JSON.stringify({ passed: passed, issues: issues });
      `;
      const r = await executeExtendScript(jsx);
      if(!r.success) return { content:[{ type:"text", text:`Error: ${r.error}` }] };
      return { content:[{ type:"text", text: r.result! }] };
    }
  );
}

async function handleResolveOversetText(args: any): Promise<{ content: TextContent[] }> {
  const sourcePage = args.source_page || -1;
  const targetPages = JSON.stringify(args.target_pages || []);
  const createFrames = args.create_frames_if_needed || false;
  
  const script = `
    var doc = app.activeDocument;
    var resolvedFrames = [];
    var oversetFrames = [];
    
    // Find all frames with overset text
    if (${sourcePage} === -1) {
      // Check all pages
      for (var p = 0; p < doc.pages.length; p++) {
        var page = doc.pages[p];
        for (var f = 0; f < page.textFrames.length; f++) {
          if (page.textFrames[f].overflows) {
            oversetFrames.push({
              frame: page.textFrames[f],
              pageNum: p + 1,
              frameIndex: f
            });
          }
        }
      }
    } else {
      // Check specific page
      if (${sourcePage} > doc.pages.length) {
        throw new Error("Source page " + ${sourcePage} + " out of range.");
      }
      
      var page = doc.pages[${sourcePage} - 1];
      for (var f = 0; f < page.textFrames.length; f++) {
        if (page.textFrames[f].overflows) {
          oversetFrames.push({
            frame: page.textFrames[f],
            pageNum: ${sourcePage},
            frameIndex: f
          });
        }
      }
    }
    
    if (oversetFrames.length === 0) {
      "No overset text found" + (${sourcePage} === -1 ? " in document." : " on page " + ${sourcePage} + ".");
    } else {
      var targetPageArray = ${targetPages};
      var results = [];
      
      for (var i = 0; i < oversetFrames.length; i++) {
        var oversetFrame = oversetFrames[i];
        var resolved = false;
        
        // Try to thread to available frames on target pages
        for (var t = 0; t < targetPageArray.length && !resolved; t++) {
          var targetPageNum = targetPageArray[t];
          if (targetPageNum > doc.pages.length) continue;
          
          var targetPage = doc.pages[targetPageNum - 1];
          
          // Find available text frames on target page
          for (var tf = 0; tf < targetPage.textFrames.length; tf++) {
            var targetFrame = targetPage.textFrames[tf];
            
            // Check if frame is available (no content and not threaded)
            if (targetFrame.contents.length === 0 && 
                (!targetFrame.previousTextFrame || !targetFrame.previousTextFrame.isValid)) {
              
              // Thread the frames
              oversetFrame.frame.nextTextFrame = targetFrame;
              
              results.push("Threaded overset from page " + oversetFrame.pageNum + 
                          " to page " + targetPageNum);
              resolved = true;
              break;
            }
          }
        }
        
        if (!resolved) {
          results.push("Could not resolve overset on page " + oversetFrame.pageNum + 
                      " - no available target frames found");
        }
      }
      
      "Overset resolution results:\\n" + results.join("\\n");
    }
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Overset text resolution:\n${result.result}` : `Error resolving overset text: ${result.error}`
    }]
  };
}

async function handleManageTextFlow(args: any): Promise<{ content: TextContent[] }> {
  const action: TextFlowAction = args.action;
  const frameIndex = args.frame_index || 0;
  const frameIndices = JSON.stringify(args.frame_indices || []);
  
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign. Please open a document first.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    var result = "";
    
    switch ("${action}") {
      case "break_thread":
        if (doc.textFrames.length <= ${frameIndex}) {
          throw new Error("Frame index out of range.");
        }
        
        var frame = doc.textFrames[${frameIndex}];
        if (frame.nextTextFrame && frame.nextTextFrame.isValid) {
          frame.nextTextFrame = null;
          result = "Broke thread from frame " + ${frameIndex};
        } else {
          result = "Frame " + ${frameIndex} + " is not threaded to another frame";
        }
        break;
        
      case "check_flow":
        if (doc.textFrames.length <= ${frameIndex}) {
          throw new Error("Frame index out of range.");
        }
        
        var frame = doc.textFrames[${frameIndex}];
        result = "Text Flow Info for Frame " + ${frameIndex} + ":\\n";
        result += "- Has content: " + (frame.contents.length > 0) + "\\n";
        result += "- Overflows: " + frame.overflows + "\\n";
        result += "- Has previous frame: " + (frame.previousTextFrame && frame.previousTextFrame.isValid) + "\\n";
        result += "- Has next frame: " + (frame.nextTextFrame && frame.nextTextFrame.isValid) + "\\n";
        
        if (frame.parentStory && frame.parentStory.isValid) {
          result += "- Story length: " + frame.parentStory.contents.length + " characters\\n";
          result += "- Story frames: " + frame.parentStory.textFrames.length;
        }
        break;
        
      case "list_threaded":
        var threadedInfo = [];
        for (var i = 0; i < doc.textFrames.length; i++) {
          var frame = doc.textFrames[i];
          if ((frame.previousTextFrame && frame.previousTextFrame.isValid) || 
              (frame.nextTextFrame && frame.nextTextFrame.isValid)) {
            
            var info = "Frame " + i + ": ";
            if (frame.previousTextFrame && frame.previousTextFrame.isValid) {
              info += "← threaded from previous ";
            }
            if (frame.nextTextFrame && frame.nextTextFrame.isValid) {
              info += "→ threads to next ";
            }
            threadedInfo.push(info);
          }
        }
        
        result = threadedInfo.length > 0 ? 
          "Threaded Frames:\\n" + threadedInfo.join("\\n") : 
          "No threaded frames found in document";
        break;
        
      case "thread_chain":
        var indices = ${frameIndices};
        if (indices.length < 2) {
          throw new Error("Need at least 2 frame indices for chain threading.");
        }
        
        var chainResults = [];
        for (var c = 0; c < indices.length - 1; c++) {
          var sourceIdx = indices[c];
          var targetIdx = indices[c + 1];
          
          if (sourceIdx >= doc.textFrames.length || targetIdx >= doc.textFrames.length) {
            chainResults.push("Skipped invalid index pair: " + sourceIdx + " → " + targetIdx);
            continue;
          }
          
          var sourceFrame = doc.textFrames[sourceIdx];
          var targetFrame = doc.textFrames[targetIdx];
          
          sourceFrame.nextTextFrame = targetFrame;
          chainResults.push("Threaded frame " + sourceIdx + " → " + targetIdx);
        }
        
        result = "Chain Threading Results:\\n" + chainResults.join("\\n");
        break;
        
      default:
        throw new Error("Unknown action: " + "${action}");
    }
    
    result;
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Text flow management result:\n${result.result}` : `Error managing text flow: ${result.error}`
    }]
  };
}

async function handleGetTextFrameInfo(args: any): Promise<{ content: TextContent[] }> {
  const pageNumber = args.page_number || -1;
  const includeThreading = args.include_threading !== false; // Default to true
  
  const script = `
    var doc = app.activeDocument;
    var info = [];
    
    if (${pageNumber} === -1) {
      // Get info for all text frames in document
      info.push("=== All Text Frames in " + doc.name + " ===");
      info.push("");
      info.push("Total text frames: " + doc.textFrames.length);
      info.push("");
      
      for (var i = 0; i < doc.textFrames.length; i++) {
        var frame = doc.textFrames[i];
        var frameInfo = "Frame " + i + ":";
        
        // Basic info
        frameInfo += " Content: " + frame.contents.length + " chars";
        frameInfo += ", Overflows: " + frame.overflows;
        
        // Threading info
        if (${includeThreading}) {
          if (frame.previousTextFrame && frame.previousTextFrame.isValid) {
            frameInfo += ", ← Prev";
          }
          if (frame.nextTextFrame && frame.nextTextFrame.isValid) {
            frameInfo += ", Next →";
          }
        }
        
        // Page location
        try {
          if (frame.parent && frame.parent.constructor.name === "Page") {
            frameInfo += ", Page: " + (frame.parent.name || "Unknown");
          }
        } catch(e) {
          // Skip if can't determine page
        }
        
        info.push(frameInfo);
      }
    } else {
      // Get info for specific page
      if (${pageNumber} > doc.pages.length) {
        throw new Error("Page number out of range.");
      }
      
      var page = doc.pages[${pageNumber} - 1];
      info.push("=== Text Frames on Page " + ${pageNumber} + " ===");
      info.push("");
      info.push("Text frames on this page: " + page.textFrames.length);
      info.push("");
      
      for (var i = 0; i < page.textFrames.length; i++) {
        var frame = page.textFrames[i];
        var frameInfo = "Frame " + i + ":";
        
        // Detailed info for specific page
        frameInfo += " Content: " + frame.contents.length + " chars";
        frameInfo += ", Overflows: " + frame.overflows;
        
        // Bounds info
        try {
          var bounds = frame.geometricBounds;
          frameInfo += ", Position: [" + Math.round(bounds[1]) + "," + Math.round(bounds[0]) + "]";
          frameInfo += ", Size: " + Math.round(bounds[3] - bounds[1]) + "×" + Math.round(bounds[2] - bounds[0]);
        } catch(e) {
          // Skip bounds if error
        }
        
        // Threading info
        if (${includeThreading}) {
          if (frame.previousTextFrame && frame.previousTextFrame.isValid) {
            frameInfo += ", ← Threaded from previous";
          }
          if (frame.nextTextFrame && frame.nextTextFrame.isValid) {
            frameInfo += ", Threads to next →";
          }
          if (!frame.previousTextFrame && !frame.nextTextFrame) {
            frameInfo += ", Not threaded";
          }
        }
        
        info.push(frameInfo);
      }
    }
    
    info.join("\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? result.result! : `Error getting text frame info: ${result.error}`
    }]
  };
}

async function handleInspectFrameBounds(args: any): Promise<{ content: TextContent[] }> {
  const pageNumber = args.page_number || 4;
  const includeAll = args.include_all_properties || false;
  
  const script = `
    var doc = app.activeDocument;
    if (doc.pages.length < ${pageNumber}) {
      throw new Error("Page " + ${pageNumber} + " does not exist. Document has " + doc.pages.length + " pages.");
    }
    
    var page = doc.pages[${pageNumber} - 1];  // Convert to 0-based index
    var info = [];
    
    info.push("=== Text Frame Bounds on Page " + ${pageNumber} + " ===");
    info.push("");
    info.push("Total text frames on this page: " + page.textFrames.length);
    info.push("");
    
    for (var i = 0; i < page.textFrames.length; i++) {
      var frame = page.textFrames[i];
      var bounds = frame.geometricBounds;  // [y1, x1, y2, x2]
      
      var frameInfo = "Frame " + i + ":";
      frameInfo += "\\n  Position: x=" + Math.round(bounds[1]) + ", y=" + Math.round(bounds[0]);
      frameInfo += "\\n  Size: width=" + Math.round(bounds[3] - bounds[1]) + ", height=" + Math.round(bounds[2] - bounds[0]);
      frameInfo += "\\n  Bounds: [" + Math.round(bounds[0]) + ", " + Math.round(bounds[1]) + ", " + Math.round(bounds[2]) + ", " + Math.round(bounds[3]) + "]";
      
      // Content info
      frameInfo += "\\n  Content: " + frame.contents.length + " characters";
      frameInfo += "\\n  Overflows: " + frame.overflows;
      
      // Threading info
      if (frame.previousTextFrame && frame.previousTextFrame.isValid) {
        frameInfo += "\\n  ← Threaded FROM previous frame";
      }
      if (frame.nextTextFrame && frame.nextTextFrame.isValid) {
        frameInfo += "\\n  Threads TO next frame →";
      }
      if (!frame.previousTextFrame && !frame.nextTextFrame) {
        frameInfo += "\\n  Threading: Not threaded";
      }
      
      // Additional properties if requested
      if (${includeAll}) {
        try {
          frameInfo += "\\n  Layer: " + frame.itemLayer.name;
        } catch(e) {
          frameInfo += "\\n  Layer: Unknown";
        }
        
        try {
          frameInfo += "\\n  Rotation: " + Math.round(frame.rotationAngle) + "°";
        } catch(e) {
          // Skip if not available
        }
      }
      
      info.push(frameInfo);
      info.push("");  // Add spacing between frames
    }
    
    info.join("\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? result.result! : `Error inspecting frame bounds: ${result.error}`
    }]
  };
}

async function handleCopyTextFrameProperties(args: any): Promise<{ content: TextContent[] }> {
  const sourcePage = args.source_page || 4;
  const targetPages = JSON.stringify(args.target_pages || [6, 7]);
  const sourceFrameIndex = args.source_frame_index || 0;
  const replaceExisting = args.replace_existing || false;
  
  const script = `
    var doc = app.activeDocument;
    var results = [];
    
    // Get source frame
    if (doc.pages.length < ${sourcePage}) {
      throw new Error("Source page " + ${sourcePage} + " does not exist.");
    }
    
    var sourcePage = doc.pages[${sourcePage} - 1];
    if (sourcePage.textFrames.length === 0) {
      throw new Error("No text frames found on page " + ${sourcePage} + " to copy properties from. Check other pages using get_textframe_info to find available frames.");
    }
    if (sourcePage.textFrames.length <= ${sourceFrameIndex}) {
      throw new Error("Source frame index " + ${sourceFrameIndex} + " does not exist on page " + ${sourcePage} + ". Page has " + sourcePage.textFrames.length + " frame(s). Use index 0 to " + (sourcePage.textFrames.length - 1) + ".");
    }
    
    var sourceFrame = sourcePage.textFrames[${sourceFrameIndex}];
    var sourceBounds = sourceFrame.geometricBounds;
    
    results.push("Source frame bounds: [" + sourceBounds.join(", ") + "]");
    results.push("Position: x=" + sourceBounds[1] + ", y=" + sourceBounds[0]);
    results.push("Size: " + (sourceBounds[3] - sourceBounds[1]) + " × " + (sourceBounds[2] - sourceBounds[0]));
    results.push("");
    
    // Create matching frames on target pages
    var targetPageArray = ${targetPages};
    for (var i = 0; i < targetPageArray.length; i++) {
      var targetPageNum = targetPageArray[i];
      
      if (doc.pages.length < targetPageNum) {
        results.push("Skipping page " + targetPageNum + " - does not exist");
        continue;
      }
      
      var targetPage = doc.pages[targetPageNum - 1];
      
      // Remove existing frames if requested
      if (${replaceExisting}) {
        while (targetPage.textFrames.length > 0) {
          targetPage.textFrames[0].remove();
        }
        results.push("Cleared existing frames on page " + targetPageNum);
      }
      
      // Create new frame with exact same bounds
      var newFrame = targetPage.textFrames.add();
      newFrame.geometricBounds = [
        sourceBounds[0],  // y1
        sourceBounds[1],  // x1  
        sourceBounds[2],  // y2
        sourceBounds[3]   // x2
      ];
      
      results.push("Created matching frame on page " + targetPageNum);
    }
    
    results.join("\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text",
      text: result.success ? `Successfully copied frame properties:\n${result.result}` : `Error copying frame properties: ${result.error}`
    }]
  };
}