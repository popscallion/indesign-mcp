import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";
import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { withChangeTracking } from "../../utils/changeSummary.js";

export async function registerCompositeTools(server: McpServer): Promise<void> {
  server.tool(
    "auto_flow_text",
    {
      text: z.string().min(1).describe("Text to flow into document (must not be empty)"),
      startPage: z.number().int().min(1).default(1).describe("Page number to start flow (1-based, must be positive integer)"),
      style: z.string().optional().describe("Paragraph style to apply to newly added text only (preserves existing formatting)"),
      addPages: z.boolean().default(true).describe("Automatically add pages with consistent margins/layout until overflow resolved"),
      maxPages: z.number().int().min(1).max(50).default(20).describe("Maximum number of pages to add (safety limit, 1-50)"),
      preserveExisting: z.boolean().default(true).describe("If true, append to existing text; if false, replace frame content"),
      dry_run: z.boolean().default(false).describe("If true, simulate without changing the document")
    },
    withChangeTracking(server, "auto_flow_text")(async ({ text, startPage, style, addPages, maxPages, preserveExisting, dry_run }: any, progressLogger: any): Promise<{ content: TextContent[] }> => {
      // Enhanced parameter validation
      if (!text || text.trim().length === 0) {
        return { content:[{ type:"text", text:"auto_flow_text error: text parameter cannot be empty" }] };
      }
      
      if (startPage < 1 || !Number.isInteger(startPage)) {
        return { content:[{ type:"text", text:"auto_flow_text error: startPage must be a positive integer" }] };
      }
      
      if (dry_run) {
        const preview = text.length > 100 ? text.substring(0, 100) + "..." : text;
        return { content:[{ type:"text", text:`[dry_run] Would flow ${text.length} characters starting at page ${startPage}${style ? ` with style "${style}"` : ""}. Max pages: ${maxPages}. ${preserveExisting ? "Append to" : "Replace"} existing text. Preview: "${preview}"` }] };
      }
      
      await progressLogger.log("Starting text flow operation", { current: 0, total: 4 });
      
      const escText = escapeExtendScriptString(text);
      const escStyle = style ? escapeExtendScriptString(style) : "";
      
      await progressLogger.log("Adding text to initial frame", { current: 1, total: 4 });
      
      const jsx = `
        if (app.documents.length === 0) { throw new Error('No active document'); }
        var doc = app.activeDocument;
        if (doc.pages.length < ${startPage}) { throw new Error('startPage out of range'); }

        // Helper to calculate smart frame bounds based on page margins
        function calculateFrameBounds(page) {
          var pageMargins = page.marginPreferences;
          var pageBounds = page.bounds; // [y1,x1,y2,x2]
          
          // Use page margins if available, otherwise fallback to reasonable defaults
          var topMargin = pageMargins.top || 36; // 0.5 inches default
          var leftMargin = pageMargins.left || 36;
          var bottomMargin = pageMargins.bottom || 36;  
          var rightMargin = pageMargins.right || 36;
          
          return [
            pageBounds[0] + topMargin,    // top
            pageBounds[1] + leftMargin,   // left  
            pageBounds[2] - bottomMargin, // bottom
            pageBounds[3] - rightMargin   // right
          ];
        }

        // Helper to get or create a text frame on a page with smart sizing
        function ensureFrame(p, referenceBounds) {
          // Look for existing threaded frames first
          for (var i = 0; i < p.textFrames.length; i++) {
            var existingFrame = p.textFrames[i];
            if (existingFrame.previousTextFrame || existingFrame.nextTextFrame) {
              return existingFrame; // Use existing threaded frame
            }
          }
          
          // Look for empty frames that can be used
          for (var i = 0; i < p.textFrames.length; i++) {
            var existingFrame = p.textFrames[i];
            if (existingFrame.contents.length === 0) {
              return existingFrame;
            }
          }
          
          // Create new frame with smart bounds
          var frameBounds = referenceBounds || calculateFrameBounds(p);
          var tf = p.textFrames.add({ geometricBounds: frameBounds });
          return tf;
        }

        var page = doc.pages[${startPage-1}];
        var initialFrameBounds = calculateFrameBounds(page);
        var frame = ensureFrame(page, initialFrameBounds);
        
        // Handle existing content based on preserveExisting setting
        var originalContent = ${preserveExisting} ? frame.contents : "";
        frame.contents = originalContent + "${escText}";
        
        if ("${escStyle}" !== "") {
          try { 
            // Apply style only to newly added text, not existing content
            var style = doc.paragraphStyles.itemByName("${escStyle}");
            if (style.isValid) {
              // Apply to last paragraph(s) that contain the new text
              var textLength = "${escText}".length;
              if (textLength > 0 && frame.contents.length >= textLength) {
                var startPos = frame.contents.length - textLength;
                var textRange = frame.characters.itemByRange(startPos, -1);
                textRange.paragraphs.everyItem().appliedParagraphStyle = style;
              }
            }
          } catch(e) {
            // Style application failed, continue without styling
          }
        }

        var pagesAdded = 0;
        var iterations = 0;
        var maxIterations = Math.min(${maxPages || 20}, 20); // Use maxPages parameter with safety limit
        var threadedFrames = [frame]; // Track all frames in the chain
        
        while (frame.overflows && ${addPages} && iterations < maxIterations) {
          iterations++;
          
          // Insert new page after current page sequence (not at end)
          var currentPageIndex = page.documentOffset;
          var insertIndex = currentPageIndex + pagesAdded;
          var newPage;
          
          try {
            if (insertIndex >= doc.pages.length - 1) {
              newPage = doc.pages.add(LocationOptions.AT_END);
            } else {
              newPage = doc.pages.add(LocationOptions.AFTER, doc.pages[insertIndex]);
            }
            pagesAdded++;
          } catch (e) {
            // Page creation failed
            break;
          }
          
          // Copy page setup from original page
          try {
            newPage.marginPreferences.top = page.marginPreferences.top;
            newPage.marginPreferences.left = page.marginPreferences.left;
            newPage.marginPreferences.bottom = page.marginPreferences.bottom;
            newPage.marginPreferences.right = page.marginPreferences.right;
          } catch (e) {
            // Margin copying failed, continue with defaults
          }
          
          // Create new frame with consistent bounds
          var newFrame;
          try {
            // Recalculate bounds per new page in case of different margins
            var newBounds = calculateFrameBounds(newPage);
            newFrame = ensureFrame(newPage, newBounds);
            
            // Verify threading compatibility before linking
            if (frame.nextTextFrame === null && newFrame.previousTextFrame === null) {
              frame.nextTextFrame = newFrame;
              threadedFrames.push(newFrame);
              
              // Verify threading worked
              if (frame.nextTextFrame !== newFrame) {
                // Threading failed, break the loop
                break;
              }
              
              frame = newFrame;
            } else {
              // Cannot thread, frame already has connections
              break;
            }
          } catch (e) {
            // Frame creation or threading failed
            break;
          }
          
          // Break out early if we keep adding pages but the story still oversets after a few iterations
          if (iterations >= 3 && frame.parentStory.overflows) {
              break;
          }
        }
        
        // Final validation
        var totalThreadedFrames = threadedFrames.length;
        var overflowResolved = !frame.overflows;
        var warningMessage = "";
        
        if (iterations >= maxIterations) {
          warningMessage = "Reached maximum iteration limit";
        }
        if (!overflowResolved && pagesAdded > 0) {
          warningMessage = warningMessage ? warningMessage + "; Text still overflows after adding pages" : "Text still overflows after adding pages";
        }
        
        JSON.stringify({ 
          pagesAdded: pagesAdded, 
          overflowResolved: overflowResolved,
          threadedFrames: totalThreadedFrames,
          iterations: iterations,
          warning: warningMessage
        });
      `;
      
      await progressLogger.log("Applying style and threading pages", { current: 2, total: 4 });
      
      const res = await executeExtendScript(jsx);
      if (!res.success) {
        return { content:[{ type:"text", text:`auto_flow_text failed: ${res.error}` }] };
      }
      
      await progressLogger.log("Finalizing text flow", { current: 3, total: 4 });
      
      try {
        const result = JSON.parse(res.result!);
        
        // Enhanced result reporting
        let statusMessage = "";
        let successLevel = "success";
        
        if (result.overflowResolved) {
          if (result.pagesAdded > 0) {
            statusMessage = `Text flow completed successfully. Added ${result.pagesAdded} pages with ${result.threadedFrames} threaded frames.`;
            await progressLogger.log(`Added ${result.pagesAdded} pages to resolve overflow`, { current: 4, total: 4 });
          } else {
            statusMessage = `Text flow completed successfully. Text fit in existing ${result.threadedFrames} frame(s).`;
            await progressLogger.log("Text fit in existing frames", { current: 4, total: 4 });
          }
        } else {
          successLevel = "warning";
          if (result.pagesAdded > 0) {
            statusMessage = `Text flow partially completed. Added ${result.pagesAdded} pages but text still overflows after ${result.iterations} iterations.`;
          } else {
            statusMessage = `Text flow could not resolve overflow. Text may be too large for frame size or contain unsupported formatting.`;
          }
          await progressLogger.log(`Overflow not fully resolved - ${result.warning || 'unknown issue'}`, { current: 4, total: 4 });
        }
        
        if (result.warning) {
          statusMessage += ` Warning: ${result.warning}`;
        }
        
        // Return detailed status
        const detailedResult = {
          status: successLevel,
          message: statusMessage,
          pagesAdded: result.pagesAdded,
          threadedFrames: result.threadedFrames,
          overflowResolved: result.overflowResolved,
          iterations: result.iterations
        };
        
        return { content:[{ type:"text", text:`auto_flow_text ${successLevel}: ${JSON.stringify(detailedResult, null, 2)}` }] };
        
      } catch (parseError) {
        return { content:[{ type:"text", text:`auto_flow_text completed but result parsing failed: ${res.result}. Parse error: ${parseError}` }] };
      }
    })
  );

  // === duplicate_layout =============================================
  server.tool(
    "duplicate_layout",
    {
      fromPage: z.number().describe("Source page number (1-based)"),
      toPage: z.union([z.number(), z.literal("end")]).default("end").describe("Target page number or 'end'"),
      includeMasters: z.boolean().default(true),
      dry_run: z.boolean().default(false)
    },
    withChangeTracking(server, "duplicate_layout")(async ({ fromPage, toPage, includeMasters, dry_run }: any, progressLogger: any): Promise<{ content: TextContent[] }> => {
      if (dry_run) {
        return { content:[{ type:"text", text:`[dry_run] Would duplicate page ${fromPage} to ${toPage}` }] };
      }
      
      await progressLogger.log("Starting layout duplication", { current: 0, total: 3 });
      
      const destExpr = toPage === "end" ? "doc.pages.add(LocationOptions.AT_END)" : `doc.pages[${toPage - 1}]`;
      
      await progressLogger.log("Creating destination page", { current: 1, total: 3 });
      
      const jsx = `
        if (app.documents.length === 0) { throw new Error('No active document'); }
        var doc = app.activeDocument;
        if (doc.pages.length < ${fromPage}) { throw new Error('fromPage out of range'); }
        var srcPage = doc.pages[${fromPage - 1}];
        var dstPage = ${destExpr};
        var items = srcPage.pageItems;
        var duplicatedCount = 0;
        
        for (var i = 0; i < items.length; i++) {
          var itm = items[i];
          if (!${includeMasters} && itm.parentPage !== srcPage) continue; // skip master items
          itm.duplicate(dstPage);
          duplicatedCount++;
        }
        JSON.stringify({ duplicated:true, target: dstPage.name, itemCount: duplicatedCount });
      `;
      
      await progressLogger.log("Duplicating page items", { current: 2, total: 3 });
      
      const res = await executeExtendScript(jsx);
      if(!res.success) return { content:[{ type:"text", text:`Error: ${res.error}` }] };
      
      const result = JSON.parse(res.result!);
      await progressLogger.log(`Duplicated ${result.itemCount} items to ${result.target}`, { current: 3, total: 3 });
      
      return { content:[{ type:"text", text:`duplicate_layout done: ${res.result}` }] };
    })
  );

  // === create_page_from_reference ===================================
  server.tool(
    "create_page_from_reference",
    {
      fromPage: z.number().describe("Page to reference (1-based)"),
      includeMasters: z.boolean().default(true),
      dry_run: z.boolean().default(false)
    },
    withChangeTracking(server, "create_page_from_reference")(async ({ fromPage, includeMasters, dry_run }: any, progressLogger: any): Promise<{ content: TextContent[] }> => {
      if (dry_run) {
        return { content:[{ type:"text", text:`[dry_run] Would create page from reference ${fromPage}` }] };
      }
      
      await progressLogger.log("Starting page creation from reference", { current: 0, total: 3 });
      
      await progressLogger.log("Creating new page", { current: 1, total: 3 });
      
      const jsx = `
        if (app.documents.length === 0) { throw new Error('No active document'); }
        var doc = app.activeDocument;
        if (doc.pages.length < ${fromPage}) { throw new Error('fromPage out of range'); }
        var srcPage = doc.pages[${fromPage - 1}];
        var dstPage = doc.pages.add(LocationOptions.AT_END);
        var items = srcPage.pageItems;
        var copiedCount = 0;
        
        for (var i = 0; i < items.length; i++) {
          var itm = items[i];
          if (!${includeMasters} && itm.parentPage !== srcPage) continue;
          itm.duplicate(dstPage);
          copiedCount++;
        }
        JSON.stringify({ createdPage: dstPage.name, itemCount: copiedCount });
      `;
      
      await progressLogger.log("Copying items from reference page", { current: 2, total: 3 });
      
      const res = await executeExtendScript(jsx);
      if (!res.success) return { content:[{ type:"text", text:`Error: ${res.error}` }] };
      
      const result = JSON.parse(res.result!);
      await progressLogger.log(`Created page ${result.createdPage} with ${result.itemCount} items`, { current: 3, total: 3 });
      
      return { content:[{ type:"text", text:`create_page_from_reference: ${res.result}` }] };
    })
  );

  // === ensure_styles_exist ========================================
  server.tool(
    "ensure_styles_exist",
    {
      styles: z.array(z.object({
        name: z.string(),
        fontFamily: z.string().optional(),
        fontSize: z.number().optional(),
        alignment: z.enum(["left","center","right","justify"]).optional()
      }))
    },
    async ({ styles }): Promise<{ content: TextContent[] }> => {
      const stylesJson = JSON.stringify(styles);
      const jsx = `
        var doc = app.activeDocument;
        var defs = ${stylesJson};
        var created = [];
        for (var i=0;i<defs.length;i++){
          var d = defs[i];
          var ps = doc.paragraphStyles.itemByName(d.name);
          if (!ps.isValid){
            ps = doc.paragraphStyles.add({ name:d.name });
            if(d.fontFamily) ps.appliedFont = d.fontFamily;
            if(d.fontSize) ps.pointSize = d.fontSize;
            if(d.alignment){ ps.justification = Justification[d.alignment.charAt(0).toUpperCase()+d.alignment.slice(1)]; }
            created.push(d.name);
          }
        }
        JSON.stringify({ created:created });
      `;
      const r = await executeExtendScript(jsx);
      if(!r.success) return { content:[{ type:"text", text:`Error: ${r.error}` }] };
      return { content:[{ type:"text", text:`ensure_styles_exist: ${r.result}` }] };
    }
  );

  // === apply_style_batch ==========================================
  server.tool(
    "apply_style_batch",
    {
      style: z.string(),
      scope: z.enum(["selection","story","all"]).default("selection")
    },
    async ({ style, scope }): Promise<{ content: TextContent[] }> => {
      const escStyle = escapeExtendScriptString(style);
      const jsx = `
        if(app.documents.length===0) throw new Error('No active document');
        var doc = app.activeDocument;
        var ps = doc.paragraphStyles.itemByName("${escStyle}");
        if(!ps.isValid) throw new Error('Paragraph style not found');
        if("${scope}" === "selection"){
          if(app.selection.length===0) throw new Error('No selection');
          app.selection[0].paragraphs.everyItem().appliedParagraphStyle = ps;
        } else if("${scope}" === "story") {
          if(app.selection.length===0) throw new Error('No selection');
          var story = app.selection[0].parentStory;
          story.paragraphs.everyItem().appliedParagraphStyle = ps;
        } else {
          for(var i=0;i<doc.stories.length;i++){
            doc.stories[i].paragraphs.everyItem().appliedParagraphStyle = ps;
          }
        }
        'styled';
      `;
      const r = await executeExtendScript(jsx);
      if(!r.success) return { content:[{ type:"text", text:`Error: ${r.error}` }] };
      return { content:[{ type:"text", text:"apply_style_batch done" }] };
    }
  );
} 