import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeExtendScript, escapeExtendScriptString } from "@mcp/shared/extendscript.js";
import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { withChangeTracking } from "@mcp/shared/utils/changeSummary.js";

// Mock logger to prevent "logger.log is not a function" errors
const logger = {
  log: async (message: string, progress?: any) => {
    // No-op logger - could log to console if debugging needed
    // console.log(`[${progress?.current || 0}/${progress?.total || 0}] ${message}`);
  }
};

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
      // Create fallback progressLogger if not provided
      const logger = progressLogger || { 
        log: async (message: string, progress?: { current: number; total: number }) => {
          // No-op fallback logger
        } 
      };
      
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
      
      await logger.log("Starting text flow operation", { current: 0, total: 4 });
      
      const escText = escapeExtendScriptString(text);
      const escStyle = style ? escapeExtendScriptString(style) : "";
      
      await logger.log("Adding text to initial frame", { current: 1, total: 4 });
      
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
        
        // Build result manually instead of using JSON.stringify
        '{"pagesAdded":' + pagesAdded + 
        ',"overflowResolved":' + overflowResolved +
        ',"threadedFrames":' + totalThreadedFrames +
        ',"iterations":' + iterations +
        ',"warning":"' + warningMessage.replace(/"/g, '\\\\\\"') + '"}';
      `;
      
      await logger.log("Applying style and threading pages", { current: 2, total: 4 });
      
      const res = await executeExtendScript(jsx);
      if (!res.success) {
        return { content:[{ type:"text", text:`auto_flow_text failed: ${res.error}` }] };
      }
      
      await logger.log("Finalizing text flow", { current: 3, total: 4 });
      
      try {
        const result = JSON.parse(res.result!);
        
        // Enhanced result reporting
        let statusMessage = "";
        let successLevel = "success";
        
        if (result.overflowResolved) {
          if (result.pagesAdded > 0) {
            statusMessage = `Text flow completed successfully. Added ${result.pagesAdded} pages with ${result.threadedFrames} threaded frames.`;
            await logger.log(`Added ${result.pagesAdded} pages to resolve overflow`, { current: 4, total: 4 });
          } else {
            statusMessage = `Text flow completed successfully. Text fit in existing ${result.threadedFrames} frame(s).`;
            await logger.log("Text fit in existing frames", { current: 4, total: 4 });
          }
        } else {
          successLevel = "warning";
          if (result.pagesAdded > 0) {
            statusMessage = `Text flow partially completed. Added ${result.pagesAdded} pages but text still overflows after ${result.iterations} iterations.`;
          } else {
            statusMessage = `Text flow could not resolve overflow. Text may be too large for frame size or contain unsupported formatting.`;
          }
          await logger.log(`Overflow not fully resolved - ${result.warning || 'unknown issue'}`, { current: 4, total: 4 });
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
    withChangeTracking(server, "duplicate_layout")(async ({ fromPage, toPage, includeMasters, dry_run }: any, progressLogger: any) => {
      // Create fallback progressLogger if not provided
      const logger = progressLogger || { 
        log: async (message: string, progress?: { current: number; total: number }) => {
          // No-op fallback logger
        } 
      };
      
      if (dry_run) {
        return { content:[{ type:"text", text:`[dry_run] Would duplicate page ${fromPage} to ${toPage}` }] };
      }
      
      if (!fromPage || fromPage < 1) {
        return { content:[{ type:"text", text:"duplicate_layout error: fromPage must be a positive number" }] };
      }
      
      await logger.log("Starting layout duplication", { current: 0, total: 4 });
      
      const jsx = `
        if (app.documents.length === 0) {
          throw new Error('No active document');
        }
        
        var doc = app.activeDocument;
        var results = [];
        
        // Validate source page
        if (doc.pages.length < ${fromPage}) {
          throw new Error('Source page ${fromPage} out of range (document has ' + doc.pages.length + ' pages)');
        }
        
        var srcPage = doc.pages[${fromPage - 1}];
        results.push("Source page: " + srcPage.name + " (index ${fromPage - 1})");
        
        // Create or find destination page
        var dstPage;
        var createdNewPage = false;
        
        ${toPage === "end" ? `
        // Create new page at end
        try {
          dstPage = doc.pages.add(LocationOptions.AT_END);
          createdNewPage = true;
          results.push("Created new page at end: " + dstPage.name);
        } catch (pageCreateErr) {
          throw new Error("Failed to create new page: " + pageCreateErr.message);
        }
        ` : `
        // Use existing page or create if needed
        var targetPageIndex = ${toPage} - 1;
        if (targetPageIndex < doc.pages.length) {
          dstPage = doc.pages[targetPageIndex];
          results.push("Using existing page: " + dstPage.name);
        } else {
          // Create pages up to target index
          while (doc.pages.length <= targetPageIndex) {
            doc.pages.add(LocationOptions.AT_END);
          }
          dstPage = doc.pages[targetPageIndex];
          createdNewPage = true;
          results.push("Created page(s) up to index " + targetPageIndex + ": " + dstPage.name);
        }
        `}
        
        // Get source page items
        var sourceItems = [];
        var allPageItems = srcPage.allPageItems;
        
        for (var i = 0; i < allPageItems.length; i++) {
          var item = allPageItems[i];
          try {
            // Check if we should include this item
            var shouldInclude = true;
            
            if (!${includeMasters}) {
              // Skip master page items if includeMasters is false
              try {
                if (item.parent && item.parent.constructor && 
                    (item.parent.constructor.name === "MasterSpread" || 
                     (item.itemLayer && item.itemLayer.name.indexOf("Master") >= 0))) {
                  shouldInclude = false;
                }
              } catch (masterCheckErr) {
                // If we can't determine master status, include it
              }
            }
            
            if (shouldInclude) {
              sourceItems.push(item);
            }
          } catch (itemErr) {
            results.push("Warning: Error checking item " + i + ": " + itemErr.message);
          }
        }
        
        results.push("Found " + sourceItems.length + " items to duplicate");
        
        // Duplicate items
        var duplicatedCount = 0;
        var errorCount = 0;
        
        for (var j = 0; j < sourceItems.length; j++) {
          var item = sourceItems[j];
          try {
            var duplicatedItem = item.duplicate(dstPage);
            duplicatedCount++;
          } catch (dupErr) {
            errorCount++;
            results.push("Error duplicating item " + (j + 1) + ": " + dupErr.message);
          }
        }
        
        results.push("Successfully duplicated: " + duplicatedCount + " items");
        if (errorCount > 0) {
          results.push("Errors encountered: " + errorCount + " items");
        }
        
        // Build result manually to avoid JSON.stringify issues
        var resultParts = [];
        resultParts.push('{"duplicated":true');
        resultParts.push(',"source":"' + srcPage.name.replace(/"/g, '\\\\\\"') + '"');
        resultParts.push(',"target":"' + dstPage.name.replace(/"/g, '\\\\\\"') + '"');
        resultParts.push(',"itemCount":' + duplicatedCount);
        resultParts.push(',"errorCount":' + errorCount);
        resultParts.push(',"createdNewPage":' + (createdNewPage ? "true" : "false"));
        resultParts.push(',"details":[');
        for (var r = 0; r < results.length; r++) {
          if (r > 0) resultParts.push(',');
          resultParts.push('"' + results[r].replace(/"/g, '\\\\\\"') + '"');
        }
        resultParts.push(']}');
        
        resultParts.join('');
      `;
      
      await logger.log("Analyzing source page", { current: 1, total: 4 });
      await logger.log("Creating destination page", { current: 2, total: 4 });
      await logger.log("Duplicating page items", { current: 3, total: 4 });
      
      const result = await executeExtendScript(jsx);
      if (!result.success) {
        return { content:[{ type:"text", text:`duplicate_layout failed: ${result.error}` }] };
      }
      
      try {
        const duplicateResult = JSON.parse(result.result!);
        
        await logger.log(`Duplicated ${duplicateResult.itemCount} items to ${duplicateResult.target}`, { current: 4, total: 4 });
        
        let statusMessage = `duplicate_layout completed: ${duplicateResult.itemCount} items duplicated`;
        statusMessage += `\\nSource: ${duplicateResult.source}`;
        statusMessage += `\\nTarget: ${duplicateResult.target}`;
        
        if (duplicateResult.createdNewPage) {
          statusMessage += `\\nCreated new page: Yes`;
        }
        
        if (duplicateResult.errorCount > 0) {
          statusMessage += `\\nErrors encountered: ${duplicateResult.errorCount}`;
        }
        
        if (duplicateResult.details) {
          statusMessage += `\\n\\nDetails:\\n${duplicateResult.details.join('\\n')}`;
        }
        
        return { content:[{ type:"text", text: statusMessage }] };
        
      } catch (parseError) {
        return { content:[{ type:"text", text:`duplicate_layout completed but result parsing failed: ${result.result}` }] };
      }
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
      // Create fallback progressLogger if not provided
      const logger = progressLogger || { 
        log: async (message: string, progress?: { current: number; total: number }) => {
          // No-op fallback logger
        } 
      };
      
      if (dry_run) {
        return { content:[{ type:"text", text:`[dry_run] Would create page from reference ${fromPage}` }] };
      }
      
      await logger.log("Starting page creation from reference", { current: 0, total: 3 });
      
      await logger.log("Creating new page", { current: 1, total: 3 });
      
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
      
      await logger.log("Copying items from reference page", { current: 2, total: 3 });
      
      const res = await executeExtendScript(jsx);
      if (!res.success) return { content:[{ type:"text", text:`Error: ${res.error}` }] };
      
      const result = JSON.parse(res.result!);
      await logger.log(`Created page ${result.createdPage} with ${result.itemCount} items`, { current: 3, total: 3 });
      
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
    async ({ styles }) => {
      if (!styles || styles.length === 0) {
        return { content:[{ type:"text", text:"ensure_styles_exist error: styles array is required" }] };
      }

      // Escape style data for ExtendScript
      const styleData = styles.map(style => ({
        name: escapeExtendScriptString(style.name),
        fontFamily: style.fontFamily ? escapeExtendScriptString(style.fontFamily) : null,
        fontSize: style.fontSize || null,
        alignment: style.alignment || null
      }));
      
      const jsx = `
        if (app.documents.length === 0) {
          throw new Error('No active document');
        }
        
        var doc = app.activeDocument;
        var results = [];
        var created = [];
        var updated = [];
        var errors = [];
        
        // Style definitions - using individual variables instead of JSON
        var styleCount = ${styleData.length};
        ${styleData.map((style, index) => `
        var style${index} = {
          name: "${style.name}",
          fontFamily: ${style.fontFamily ? `"${style.fontFamily}"` : 'null'},
          fontSize: ${style.fontSize || 'null'},
          alignment: ${style.alignment ? `"${style.alignment}"` : 'null'}
        };`).join('')}
        
        for (var i = 0; i < styleCount; i++) {
          var styleData = eval('style' + i);
          
          try {
            var ps = doc.paragraphStyles.itemByName(styleData.name);
            var isNewStyle = !ps.isValid;
            
            if (isNewStyle) {
              ps = doc.paragraphStyles.add({ name: styleData.name });
              created.push(styleData.name);
            } else {
              updated.push(styleData.name);
            }
            
            // Apply font family if specified
            if (styleData.fontFamily) {
              try {
                ps.appliedFont = styleData.fontFamily;
              } catch (fontError) {
                errors.push("Font '" + styleData.fontFamily + "' not available for style '" + styleData.name + "'");
              }
            }
            
            // Apply font size if specified
            if (styleData.fontSize) {
              ps.pointSize = styleData.fontSize;
            }
            
            // Apply alignment if specified
            if (styleData.alignment) {
              var alignmentValue;
              switch (styleData.alignment) {
                case "left":
                  alignmentValue = Justification.LEFT_ALIGN;
                  break;
                case "center":
                  alignmentValue = Justification.CENTER_ALIGN;
                  break;
                case "right":
                  alignmentValue = Justification.RIGHT_ALIGN;
                  break;
                case "justify":
                  alignmentValue = Justification.FULLY_JUSTIFIED;
                  break;
              }
              if (alignmentValue) {
                ps.justification = alignmentValue;
              }
            }
            
          } catch (styleError) {
            errors.push("Error processing style '" + styleData.name + "': " + styleError.message);
          }
        }
        
        // Build result manually instead of using JSON.stringify
        var resultParts = [];
        resultParts.push('{"created":[');
        for (var c = 0; c < created.length; c++) {
          if (c > 0) resultParts.push(',');
          resultParts.push('"' + created[c] + '"');
        }
        resultParts.push('],"updated":[');
        for (var u = 0; u < updated.length; u++) {
          if (u > 0) resultParts.push(',');
          resultParts.push('"' + updated[u] + '"');
        }
        resultParts.push('],"errors":[');
        for (var e = 0; e < errors.length; e++) {
          if (e > 0) resultParts.push(',');
          resultParts.push('"' + errors[e].replace(/"/g, '\\\\\\"') + '"');
        }
        resultParts.push(']}');
        
        resultParts.join('');
      `;

      const result = await executeExtendScript(jsx);
      if (!result.success) {
        return { content:[{ type:"text", text:`ensure_styles_exist failed: ${result.error}` }] };
      }

      try {
        const styleResult = JSON.parse(result.result!);
        let statusMessage = `ensure_styles_exist completed:`;
        statusMessage += `\\nCreated: ${styleResult.created.length} styles`;
        statusMessage += `\\nUpdated: ${styleResult.updated.length} styles`;
        
        if (styleResult.errors.length > 0) {
          statusMessage += `\\nErrors: ${styleResult.errors.length}`;
          statusMessage += `\\nError details: ${styleResult.errors.join(', ')}`;
        }
        
        if (styleResult.created.length > 0) {
          statusMessage += `\\nNew styles: ${styleResult.created.join(', ')}`;
        }
        
        return { content:[{ type:"text", text: statusMessage }] };
      } catch (parseError) {
        return { content:[{ type:"text", text:`ensure_styles_exist completed but result parsing failed: ${result.result}` }] };
      }
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
        if(!ps.isValid) throw new Error('Paragraph style not found: ${escStyle}');
        
        var appliedCount = 0;
        
        if("${scope}" === "selection"){
          // Try current selection first
          if(app.selection.length > 0 && app.selection[0].hasOwnProperty('contents')) {
            app.selection[0].paragraphs.everyItem().appliedParagraphStyle = ps;
            appliedCount++;
          } else if(app.selection.length > 0 && app.selection[0].hasOwnProperty('parentStory')) {
            // Selection is text range
            app.selection[0].paragraphs.everyItem().appliedParagraphStyle = ps;
            appliedCount++;
          } else {
            // Fallback to first text frame if no selection
            if(doc.pages.length > 0 && doc.pages[0].textFrames.length > 0) {
              var firstFrame = doc.pages[0].textFrames[0];
              firstFrame.paragraphs.everyItem().appliedParagraphStyle = ps;
              appliedCount++;
            } else {
              throw new Error('No selection and no text frames found');
            }
          }
        } else if("${scope}" === "story") {
          var targetStory = null;
          
          // Try to get story from selection
          if(app.selection.length > 0) {
            if(app.selection[0].hasOwnProperty('parentStory')) {
              targetStory = app.selection[0].parentStory;
            } else if(app.selection[0].hasOwnProperty('contents')) {
              targetStory = app.selection[0].parentStory;
            }
          }
          
          // Fallback to first story if no selection
          if(!targetStory && doc.stories.length > 0) {
            targetStory = doc.stories[0];
          }
          
          if(targetStory) {
            targetStory.paragraphs.everyItem().appliedParagraphStyle = ps;
            appliedCount++;
          } else {
            throw new Error('No story found to apply style to');
          }
        } else {
          // Apply to all stories
          for(var i=0;i<doc.stories.length;i++){
            doc.stories[i].paragraphs.everyItem().appliedParagraphStyle = ps;
            appliedCount++;
          }
        }
        
        'Applied to ' + appliedCount + ' target(s)';
      `;
      const r = await executeExtendScript(jsx);
      if(!r.success) return { content:[{ type:"text", text:`Error: ${r.error}` }] };
      return { content:[{ type:"text", text:"apply_style_batch done" }] };
    }
  );

  // === bulk_place_linked_text ========================================
  server.tool(
    "bulk_place_linked_text",
    {
      filePath: z.string().describe("Path to the text file to place in multiple frames"),
      target_frames: z.array(z.object({
        page: z.number().describe("Page number (1-based)"),
        frame_index: z.number().describe("Text frame index on the page (0-based)")
      })).describe("Array of target frames to place the file into"),
      link_file: z.boolean().default(true).describe("Whether to link the file instead of embedding")
    },
    withChangeTracking(server, "bulk_place_linked_text")(async ({ filePath, target_frames, link_file }: any, progressLogger: any): Promise<{ content: TextContent[] }> => {
      // Create fallback progressLogger if not provided
      const logger = progressLogger || { 
        log: async (message: string, progress?: { current: number; total: number }) => {
          // No-op fallback logger
        } 
      };

      if (!filePath || !target_frames || target_frames.length === 0) {
        return { content:[{ type:"text", text:"bulk_place_linked_text error: filePath and target_frames are required" }] };
      }

      const escapedPath = escapeExtendScriptString(filePath);
      const targetFramesJson = JSON.stringify(target_frames);
      const shouldLink = link_file !== false;

      await logger.log(`Starting bulk file placement for ${target_frames.length} frames`, { current: 0, total: target_frames.length + 1 });

      const jsx = `
        if (app.documents.length === 0) {
          throw new Error('No active document');
        }
        
        var doc = app.activeDocument;
        var placeFile = new File("${escapedPath}");
        
        if (!placeFile.exists) {
          throw new Error("File does not exist: ${escapedPath}");
        }
        
        var targetFrames = ${targetFramesJson};
        var results = [];
        var successCount = 0;
        var errorCount = 0;
        
        for (var i = 0; i < targetFrames.length; i++) {
          var target = targetFrames[i];
          try {
            // Validate page exists
            if (doc.pages.length < target.page) {
              results.push("Error: Page " + target.page + " does not exist");
              errorCount++;
              continue;
            }
            
            var page = doc.pages[target.page - 1];
            
            // Validate frame exists
            if (page.textFrames.length <= target.frame_index) {
              results.push("Error: Frame index " + target.frame_index + " does not exist on page " + target.page + " (has " + page.textFrames.length + " frames)");
              errorCount++;
              continue;
            }
            
            var targetFrame = page.textFrames[target.frame_index];
            
            // Place the file in the frame
            var placedItems = targetFrame.place(placeFile, ${shouldLink ? "true" : "false"});
            
            results.push("Success: Placed " + placeFile.name + " in page " + target.page + ", frame " + target.frame_index);
            successCount++;
            
          } catch (frameError) {
            results.push("Error placing in page " + target.page + ", frame " + target.frame_index + ": " + frameError.message);
            errorCount++;
          }
        }
        
        JSON.stringify({
          success: successCount,
          errors: errorCount,
          total: targetFrames.length,
          details: results,
          filePlaced: placeFile.name
        });
      `;

      await logger.log("Placing file in target frames", { current: 1, total: target_frames.length + 1 });

      const result = await executeExtendScript(jsx);
      
      if (!result.success) {
        return { content:[{ type:"text", text:`bulk_place_linked_text failed: ${result.error}` }] };
      }

      try {
        const placementResult = JSON.parse(result.result!);
        
        await logger.log(`Completed placement: ${placementResult.success}/${placementResult.total} successful`, { 
          current: target_frames.length + 1, 
          total: target_frames.length + 1 
        });

        let statusMessage = `bulk_place_linked_text completed: ${placementResult.success}/${placementResult.total} frames updated successfully`;
        
        if (placementResult.errors > 0) {
          statusMessage += `\\nErrors encountered: ${placementResult.errors}`;
        }

        statusMessage += `\\nFile: ${placementResult.filePlaced}`;
        statusMessage += `\\nLinked: ${shouldLink ? 'Yes' : 'No'}`;
        
        // Include details if there were any errors
        if (placementResult.errors > 0) {
          statusMessage += `\\n\\nDetails:\\n${placementResult.details.join('\\n')}`;
        }

        return { content:[{ type:"text", text: statusMessage }] };
        
      } catch (parseError) {
        return { content:[{ type:"text", text:`bulk_place_linked_text completed but result parsing failed: ${result.result}` }] };
      }
    })
  );

  // === replicate_configured_frame ====================================
  server.tool(
    "replicate_configured_frame",
    {
      source_page: z.number().describe("Source page number containing the frame to copy (1-based)"),
      source_frame_index: z.number().default(0).describe("Index of the source frame on the page (0-based)"),
      target_pages: z.array(z.number()).describe("Array of target page numbers where frame should be replicated (1-based)"),
      include_transforms: z.boolean().default(true).describe("Preserve transforms like rotation, shear, scale"),
      include_styles: z.boolean().default(true).describe("Copy text formatting and paragraph styles"),
      then_place_file: z.string().optional().describe("Optional file path to place in all replicated frames after creation")
    },
    withChangeTracking(server, "replicate_configured_frame")(async ({ source_page, source_frame_index, target_pages, include_transforms, include_styles, then_place_file }: any, progressLogger: any): Promise<{ content: TextContent[] }> => {
      // Create fallback progressLogger if not provided
      const logger = progressLogger || { 
        log: async (message: string, progress?: { current: number; total: number }) => {
          // No-op fallback logger
        } 
      };

      if (!source_page || !target_pages || target_pages.length === 0) {
        return { content:[{ type:"text", text:"replicate_configured_frame error: source_page and target_pages are required" }] };
      }

      const sourceFrameIdx = source_frame_index || 0;
      const targetPagesJson = JSON.stringify(target_pages);
      const shouldIncludeTransforms = include_transforms !== false;
      const shouldIncludeStyles = include_styles !== false;
      const placeFilePath = then_place_file ? escapeExtendScriptString(then_place_file) : "";

      await logger.log(`Starting frame replication from page ${source_page}`, { current: 0, total: target_pages.length + 2 });

      const jsx = `
        if (app.documents.length === 0) {
          throw new Error('No active document');
        }
        
        var doc = app.activeDocument;
        var results = [];
        
        // Validate source page exists
        if (doc.pages.length < ${source_page}) {
          throw new Error("Source page ${source_page} does not exist");
        }
        
        var sourcePage = doc.pages[${source_page} - 1];
        
        // Validate source frame exists
        if (sourcePage.textFrames.length <= ${sourceFrameIdx}) {
          throw new Error("Source frame index ${sourceFrameIdx} does not exist on page ${source_page} (has " + sourcePage.textFrames.length + " frames)");
        }
        
        var sourceFrame = sourcePage.textFrames[${sourceFrameIdx}];
        
        // Capture source frame properties
        var sourceBounds = sourceFrame.geometricBounds;
        var sourceRotation = ${shouldIncludeTransforms} ? sourceFrame.rotationAngle : 0;
        var sourceShear = ${shouldIncludeTransforms} ? sourceFrame.shearAngle : 0;
        var sourceScaleX = ${shouldIncludeTransforms} ? sourceFrame.horizontalScale : 100;
        var sourceScaleY = ${shouldIncludeTransforms} ? sourceFrame.verticalScale : 100;
        
        results.push("Source frame properties captured:");
        results.push("  Bounds: [" + sourceBounds.join(", ") + "]");
        results.push("  Rotation: " + sourceRotation + "°");
        results.push("  Shear: " + sourceShear + "°");
        results.push("  Scale: " + sourceScaleX + "% × " + sourceScaleY + "%");
        results.push("");
        
        var targetPages = ${targetPagesJson};
        var successCount = 0;
        var errorCount = 0;
        
        // Optional file for placement
        var placeFile = null;
        if ("${placeFilePath}" !== "") {
          placeFile = new File("${placeFilePath}");
          if (!placeFile.exists) {
            results.push("Warning: Place file does not exist: ${placeFilePath}");
            placeFile = null;
          }
        }
        
        for (var i = 0; i < targetPages.length; i++) {
          var targetPageNum = targetPages[i];
          try {
            // Validate target page exists
            if (doc.pages.length < targetPageNum) {
              results.push("Error: Page " + targetPageNum + " does not exist");
              errorCount++;
              continue;
            }
            
            var targetPage = doc.pages[targetPageNum - 1];
            
            // Create new frame with exact same bounds
            var newFrame = targetPage.textFrames.add();
            newFrame.geometricBounds = sourceBounds.slice(); // Copy array
            
            // Apply transforms if requested
            if (${shouldIncludeTransforms}) {
              newFrame.rotationAngle = sourceRotation;
              newFrame.shearAngle = sourceShear;
              newFrame.horizontalScale = sourceScaleX;
              newFrame.verticalScale = sourceScaleY;
            }
            
            // Copy text formatting if requested
            if (${shouldIncludeStyles} && sourceFrame.contents.length > 0) {
              // Copy content and character/paragraph formatting
              try {
                newFrame.contents = sourceFrame.contents;
                
                // Copy paragraph styles
                if (sourceFrame.paragraphs.length > 0) {
                  for (var p = 0; p < sourceFrame.paragraphs.length; p++) {
                    if (newFrame.paragraphs.length > p) {
                      newFrame.paragraphs[p].appliedParagraphStyle = sourceFrame.paragraphs[p].appliedParagraphStyle;
                      newFrame.paragraphs[p].appliedCharacterStyle = sourceFrame.paragraphs[p].appliedCharacterStyle;
                    }
                  }
                }
                
              } catch (styleError) {
                results.push("Warning: Could not copy all styles to page " + targetPageNum + ": " + styleError.message);
              }
            }
            
            // Place file if specified
            if (placeFile != null) {
              try {
                newFrame.place(placeFile, true); // Link the file
                results.push("Success: Replicated frame and placed " + placeFile.name + " on page " + targetPageNum);
              } catch (placeError) {
                results.push("Success: Replicated frame on page " + targetPageNum + ", but failed to place file: " + placeError.message);
              }
            } else {
              results.push("Success: Replicated frame on page " + targetPageNum);
            }
            
            successCount++;
            
          } catch (frameError) {
            results.push("Error replicating to page " + targetPageNum + ": " + frameError.message);
            errorCount++;
          }
        }
        
        JSON.stringify({
          success: successCount,
          errors: errorCount,
          total: targetPages.length,
          details: results,
          sourceFrame: "Page " + ${source_page} + ", Frame " + ${sourceFrameIdx},
          includeTransforms: ${shouldIncludeTransforms},
          includeStyles: ${shouldIncludeStyles},
          placedFile: placeFile ? placeFile.name : null
        });
      `;

      await logger.log("Replicating frame to target pages", { current: 1, total: target_pages.length + 2 });

      const result = await executeExtendScript(jsx);
      
      if (!result.success) {
        return { content:[{ type:"text", text:`replicate_configured_frame failed: ${result.error}` }] };
      }

      try {
        const replicationResult = JSON.parse(result.result!);
        
        await logger.log(`Completed replication: ${replicationResult.success}/${replicationResult.total} successful`, { 
          current: target_pages.length + 2, 
          total: target_pages.length + 2 
        });

        let statusMessage = `replicate_configured_frame completed: ${replicationResult.success}/${replicationResult.total} frames replicated successfully`;
        
        statusMessage += `\\nSource: ${replicationResult.sourceFrame}`;
        statusMessage += `\\nTransforms included: ${replicationResult.includeTransforms}`;
        statusMessage += `\\nStyles included: ${replicationResult.includeStyles}`;
        
        if (replicationResult.placedFile) {
          statusMessage += `\\nFile placed: ${replicationResult.placedFile}`;
        }
        
        if (replicationResult.errors > 0) {
          statusMessage += `\\nErrors encountered: ${replicationResult.errors}`;
        }
        
        // Include detailed results
        statusMessage += `\\n\\nDetails:\\n${replicationResult.details.join('\\n')}`;

        return { content:[{ type:"text", text: statusMessage }] };
        
      } catch (parseError) {
        return { content:[{ type:"text", text:`replicate_configured_frame completed but result parsing failed: ${result.result}` }] };
      }
    })
  );

  // === link_content_to_frame_pattern ==================================
  server.tool(
    "link_content_to_frame_pattern",
    {
      pattern: z.string().describe("Pattern to match frames by (searches in frame names, layer names, or content)"),
      file_path: z.string().describe("Path to the file to place in matching frames"),
      apply_across_pages: z.string().default("all").describe("Pages to search: 'all' or comma-separated page numbers like '1,3,5'"),
      search_criteria: z.enum(["name", "layer", "content"]).default("content").describe("What to match pattern against")
    },
    withChangeTracking(server, "link_content_to_frame_pattern")(async ({ pattern, file_path, apply_across_pages, search_criteria }: any, progressLogger: any): Promise<{ content: TextContent[] }> => {
      // Create fallback progressLogger if not provided
      const logger = progressLogger || { 
        log: async (message: string, progress?: { current: number; total: number }) => {
          // No-op fallback logger
        } 
      };

      if (!pattern || !file_path) {
        return { content:[{ type:"text", text:"link_content_to_frame_pattern error: pattern and file_path are required" }] };
      }

      const searchPattern = escapeExtendScriptString(pattern);
      const filePath = escapeExtendScriptString(file_path);
      const pages = apply_across_pages === "all" ? "all" : JSON.stringify(apply_across_pages);
      const criteria = search_criteria || "content";

      await logger.log(`Starting pattern-based content linking`, { current: 0, total: 4 });

      const jsx = `
        if (app.documents.length === 0) {
          throw new Error('No active document');
        }
        
        var doc = app.activeDocument;
        var placeFile = new File("${filePath}");
        
        if (!placeFile.exists) {
          throw new Error("File does not exist: ${filePath}");
        }
        
        var results = [];
        var matchedFrames = [];
        var successCount = 0;
        var errorCount = 0;
        var pattern = "${searchPattern}";
        var searchCriteria = "${criteria}";
        
        // Determine which pages to search
        var pagesToSearch = [];
        if ("${pages}" === "all") {
          for (var p = 0; p < doc.pages.length; p++) {
            pagesToSearch.push(p);
          }
        } else {
          var pageNumbers = ${pages === "all" ? "[]" : pages};
          for (var p = 0; p < pageNumbers.length; p++) {
            var pageNum = pageNumbers[p] - 1; // Convert to 0-based
            if (pageNum >= 0 && pageNum < doc.pages.length) {
              pagesToSearch.push(pageNum);
            }
          }
        }
        
        results.push("Searching " + pagesToSearch.length + " pages for pattern: '" + pattern + "'");
        results.push("Search criteria: " + searchCriteria);
        results.push("");
        
        // Search through specified pages
        for (var pageIdx = 0; pageIdx < pagesToSearch.length; pageIdx++) {
          var page = doc.pages[pagesToSearch[pageIdx]];
          var pageNumber = pagesToSearch[pageIdx] + 1; // Convert back to 1-based for display
          
          // Check all text frames on this page
          for (var frameIdx = 0; frameIdx < page.textFrames.length; frameIdx++) {
            var frame = page.textFrames[frameIdx];
            var isMatch = false;
            var matchReason = "";
            
            try {
              switch (searchCriteria) {
                case "name":
                  // Check frame name/label
                  if (frame.name && frame.name.indexOf(pattern) >= 0) {
                    isMatch = true;
                    matchReason = "frame name: '" + frame.name + "'";
                  }
                  break;
                  
                case "layer":
                  // Check layer name
                  if (frame.itemLayer && frame.itemLayer.name && frame.itemLayer.name.indexOf(pattern) >= 0) {
                    isMatch = true;
                    matchReason = "layer name: '" + frame.itemLayer.name + "'";
                  }
                  break;
                  
                case "content":
                default:
                  // Check frame content/text
                  if (frame.contents && frame.contents.indexOf(pattern) >= 0) {
                    isMatch = true;
                    matchReason = "content contains pattern";
                  }
                  break;
              }
              
              if (isMatch) {
                matchedFrames.push({
                  page: pageNumber,
                  frameIndex: frameIdx,
                  reason: matchReason
                });
                
                // Place the file in this frame
                try {
                  frame.place(placeFile, true); // Link the file
                  results.push("✓ Placed file in page " + pageNumber + ", frame " + frameIdx + " (" + matchReason + ")");
                  successCount++;
                } catch (placeError) {
                  results.push("✗ Found match on page " + pageNumber + ", frame " + frameIdx + " (" + matchReason + ") but failed to place file: " + placeError.message);
                  errorCount++;
                }
              }
              
            } catch (searchError) {
              results.push("Warning: Error searching frame on page " + pageNumber + ", index " + frameIdx + ": " + searchError.message);
            }
          }
        }
        
        if (matchedFrames.length === 0) {
          results.push("No frames found matching pattern '" + pattern + "' using " + searchCriteria + " criteria");
        }
        
        JSON.stringify({
          success: successCount,
          errors: errorCount,
          totalMatches: matchedFrames.length,
          pattern: pattern,
          searchCriteria: searchCriteria,
          pagesSearched: pagesToSearch.length,
          details: results,
          placedFile: placeFile.name,
          matches: matchedFrames
        });
      `;

      await logger.log("Searching for frames matching pattern", { current: 1, total: 4 });

      const result = await executeExtendScript(jsx);
      
      if (!result.success) {
        return { content:[{ type:"text", text:`link_content_to_frame_pattern failed: ${result.error}` }] };
      }

      await logger.log("Processing placement results", { current: 2, total: 4 });

      try {
        const patternResult = JSON.parse(result.result!);
        
        await logger.log(`Pattern matching completed: ${patternResult.success} placements`, { current: 4, total: 4 });

        let statusMessage = `link_content_to_frame_pattern completed: ${patternResult.success}/${patternResult.totalMatches} matches had content placed successfully`;
        
        statusMessage += `\\nPattern: '${patternResult.pattern}'`;
        statusMessage += `\\nSearch criteria: ${patternResult.searchCriteria}`;
        statusMessage += `\\nPages searched: ${patternResult.pagesSearched}`;
        statusMessage += `\\nFile placed: ${patternResult.placedFile}`;
        
        if (patternResult.errors > 0) {
          statusMessage += `\\nErrors encountered: ${patternResult.errors}`;
        }
        
        if (patternResult.totalMatches === 0) {
          statusMessage += `\\n\\nNo frames found matching the pattern. Try:`;
          statusMessage += `\\n- Different search criteria (name, layer, content)`;
          statusMessage += `\\n- Broader pattern or check spelling`;
          statusMessage += `\\n- Verify frames exist on specified pages`;
        }
        
        // Include detailed results
        statusMessage += `\\n\\nDetails:\\n${patternResult.details.join('\\n')}`;

        return { content:[{ type:"text", text: statusMessage }] };
        
      } catch (parseError) {
        return { content:[{ type:"text", text:`link_content_to_frame_pattern completed but result parsing failed: ${result.result}` }] };
      }
    })
  );

  // === link_text_to_multiple_frames ===================================
  server.tool(
    "link_text_to_multiple_frames",
    {
      filePath: z.string().describe("Full path to external text file (.txt, .rtf, .docx)"),
      target_frames: z.array(z.object({
        page_number: z.number().describe("Page number (1-based)"),
        frame_index: z.number().optional().describe("Text frame index on that page (0-based)"),
        x: z.number().optional().describe("X position (optional - creates new frame if provided)"),
        y: z.number().optional().describe("Y position (optional)"),
        width: z.number().optional().describe("Width (optional)"),
        height: z.number().optional().describe("Height (optional)")
      })).describe("Array of text frame targets"),
      create_frames_if_missing: z.boolean().default(true).describe("Create text frames if they don't exist at target locations"),
      apply_style: z.string().optional().describe("Paragraph style to apply to all linked instances"),
      preserve_formatting: z.boolean().default(false).describe("Allow different formatting per frame while maintaining content link")
    },
    async ({ filePath, target_frames, create_frames_if_missing, apply_style, preserve_formatting }: any): Promise<{ content: TextContent[] }> => {
      if (!filePath || !target_frames || target_frames.length === 0) {
        return { content:[{ type:"text", text:"link_text_to_multiple_frames error: filePath and target_frames are required" }] };
      }

      const escapedPath = escapeExtendScriptString(filePath);
      const targetFramesJson = JSON.stringify(target_frames);
      const shouldCreateFrames = create_frames_if_missing !== false;
      const styleToApply = apply_style ? escapeExtendScriptString(apply_style) : "";
      const shouldPreserveFormatting = preserve_formatting === true;

      const jsx = `
        if (app.documents.length === 0) {
          throw new Error('No active document');
        }
        
        var doc = app.activeDocument;
        var placeFile = new File("${escapedPath}");
        
        if (!placeFile.exists) {
          throw new Error("File does not exist: ${escapedPath}");
        }
        
        var targetFrames = ${targetFramesJson};
        var results = [];
        var successCount = 0;
        var errorCount = 0;
        var createdFrames = 0;
        
        results.push("Linking External Text File");
        results.push("=========================");
        results.push("File: " + placeFile.name);
        results.push("Targets: " + targetFrames.length + " frames");
        results.push("");
        
        // First pass: Create frames if needed and validate
        for (var i = 0; i < targetFrames.length; i++) {
          var target = targetFrames[i];
          
          try {
            // Validate page exists
            if (doc.pages.length < target.page_number) {
              results.push("Error: Page " + target.page_number + " does not exist");
              errorCount++;
              continue;
            }
            
            var page = doc.pages[target.page_number - 1];
            var targetFrame = null;
            
            // Check if we need to create a new frame or use existing
            if (target.x !== undefined && target.y !== undefined && 
                target.width !== undefined && target.height !== undefined) {
              // Create new frame at specified position
              if (${shouldCreateFrames}) {
                targetFrame = page.textFrames.add();
                targetFrame.geometricBounds = [
                  target.y,
                  target.x,
                  target.y + target.height,
                  target.x + target.width
                ];
                createdFrames++;
                results.push("✓ Created frame on page " + target.page_number + 
                           " at [" + target.x + ", " + target.y + "]");
              } else {
                results.push("Error: Frame creation disabled but position specified for page " + target.page_number);
                errorCount++;
                continue;
              }
            } else {
              // Use existing frame by index
              var frameIndex = target.frame_index || 0;
              if (page.textFrames.length <= frameIndex) {
                if (${shouldCreateFrames}) {
                  // Create default-sized frame
                  targetFrame = page.textFrames.add();
                  var pageBounds = page.bounds;
                  targetFrame.geometricBounds = [
                    pageBounds[0] + 72,
                    pageBounds[1] + 72, 
                    pageBounds[2] - 72,
                    pageBounds[3] - 72
                  ];
                  createdFrames++;
                  results.push("✓ Created default frame on page " + target.page_number);
                } else {
                  results.push("Error: Frame " + frameIndex + " does not exist on page " + 
                             target.page_number + " (has " + page.textFrames.length + " frames)");
                  errorCount++;
                  continue;
                }
              } else {
                targetFrame = page.textFrames[frameIndex];
              }
            }
            
            // Store reference for second pass
            target.resolvedFrame = targetFrame;
            
          } catch (frameError) {
            results.push("Error preparing frame for page " + target.page_number + ": " + frameError.message);
            errorCount++;
          }
        }
        
        results.push("");
        results.push("Frame Preparation Complete:");
        results.push("  Created: " + createdFrames);
        results.push("  Errors: " + errorCount);
        results.push("");
        
        // Second pass: Link content to all frames
        var linkedFrames = [];
        
        for (var i = 0; i < targetFrames.length; i++) {
          var target = targetFrames[i];
          
          if (target.resolvedFrame) {
            try {
              var frame = target.resolvedFrame;
              
              // Place/link the external file
              // Note: InDesign will link the same external file across multiple frames
              var placedItems = frame.place(placeFile, true); // true = create link
              
              // Apply paragraph style if specified
              if ("${styleToApply}" !== "" && !${shouldPreserveFormatting}) {
                try {
                  var paragraphStyle = doc.paragraphStyles.itemByName("${styleToApply}");
                  if (paragraphStyle.isValid) {
                    frame.paragraphs.everyItem().appliedParagraphStyle = paragraphStyle;
                  }
                } catch (styleError) {
                  results.push("Warning: Could not apply style '${styleToApply}' to page " + target.page_number);
                }
              }
              
              linkedFrames.push({
                page: target.page_number,
                frameIndex: target.frame_index || "new"
              });
              
              results.push("✓ Linked content to page " + target.page_number + 
                         (target.frame_index !== undefined ? ", frame " + target.frame_index : ", new frame"));
              successCount++;
              
            } catch (linkError) {
              results.push("✗ Error linking to page " + target.page_number + ": " + linkError.message);
              errorCount++;
            }
          }
        }
        
        results.push("");
        results.push("Content Linking Summary:");
        results.push("  Successfully linked: " + successCount);
        results.push("  Frames created: " + createdFrames);
        results.push("  Errors: " + errorCount);
        results.push("");
        results.push("IMPORTANT: All frames now share the same external file link.");
        results.push("Updating the external file will automatically update all linked instances.");
        
        JSON.stringify({
          success: successCount,
          created: createdFrames,
          errors: errorCount,
          total: targetFrames.length,
          filePath: placeFile.name,
          linkedFrames: linkedFrames,
          preserveFormatting: ${shouldPreserveFormatting},
          styleApplied: "${styleToApply}",
          details: results
        });
      `;

      const result = await executeExtendScript(jsx);
      
      if (!result.success) {
        return { content:[{ type:"text", text:`link_text_to_multiple_frames failed: ${result.error}` }] };
      }

      try {
        const linkResult = JSON.parse(result.result!);

        let statusMessage = `link_text_to_multiple_frames completed: ${linkResult.success}/${linkResult.total} frames successfully linked`;
        
        if (linkResult.created > 0) {
          statusMessage += `\\nFrames created: ${linkResult.created}`;
        }
        
        if (linkResult.errors > 0) {
          statusMessage += `\\nErrors encountered: ${linkResult.errors}`;
        }
        
        statusMessage += `\\nLinked file: ${linkResult.filePath}`;
        
        if (linkResult.styleApplied) {
          statusMessage += `\\nStyle applied: ${linkResult.styleApplied}`;
        }
        
        if (linkResult.preserveFormatting) {
          statusMessage += `\\nFormatting preserved per frame`;
        }
        
        statusMessage += `\\n\\n⚠️  IMPORTANT: All frames now share the same external file link.`;
        statusMessage += `\\nUpdating the external file will automatically update ALL linked instances.`;
        
        // Include detailed results
        statusMessage += `\\n\\nDetails:\\n${linkResult.details.join('\\n')}`;

        return { content:[{ type:"text", text: statusMessage }] };
        
      } catch (parseError) {
        return { content:[{ type:"text", text:`link_text_to_multiple_frames completed but result parsing failed: ${result.result}` }] };
      }
    }
  );

  // === batch_link_event_text ======================================
  server.tool(
    "batch_link_event_text",
    {
      event_files: z.array(z.object({
        filePath: z.string().describe("Path to the text file"),
        target_pages: z.array(z.number()).describe("Pages where this file should be linked (1-based)"),
        frame_positions: z.array(z.object({
          x: z.number().describe("X coordinate for frame placement"),
          y: z.number().describe("Y coordinate for frame placement"), 
          width: z.number().describe("Frame width"),
          height: z.number().describe("Frame height")
        })).optional().describe("Optional array of frame positions (creates frames if provided)")
      })).describe("Array of event text files with their target locations"),
      base_style: z.string().optional().describe("Base paragraph style to apply to all event text"),
      link_files: z.boolean().default(true).describe("Whether to link files (true) or embed them (false)"),
      create_consistent_layout: z.boolean().default(true).describe("Maintain consistent frame positioning across pages")
    },
    withChangeTracking(server, "batch_link_event_text")(async ({ event_files, base_style, link_files, create_consistent_layout }: any, progressLogger: any): Promise<{ content: TextContent[] }> => {
      // Create fallback progressLogger if not provided
      const logger = progressLogger || { 
        log: async (message: string, progress?: { current: number; total: number }) => {
          // No-op fallback logger
        } 
      };

      if (!event_files || event_files.length === 0) {
        return { content:[{ type:"text", text:"batch_link_event_text error: event_files array is required" }] };
      }

      const eventFilesJson = JSON.stringify(event_files);
      const shouldLink = link_files !== false;
      const styleToApply = base_style ? escapeExtendScriptString(base_style) : "";
      const shouldCreateConsistentLayout = create_consistent_layout !== false;

      // Calculate total operations for progress tracking
      let totalOperations = 0;
      for (const eventFile of event_files) {
        totalOperations += eventFile.target_pages.length;
      }

      await logger.log(`Starting batch event text linking for ${event_files.length} files`, { current: 0, total: totalOperations + 3 });

      const jsx = `
        if (app.documents.length === 0) {
          throw new Error('No active document');
        }
        
        var doc = app.activeDocument;
        var eventFiles = ${eventFilesJson};
        var results = [];
        var overallSuccessCount = 0;
        var overallErrorCount = 0;
        var filesProcessed = 0;
        var framesCreated = 0;
        
        results.push("Batch Event Text Linking");
        results.push("========================");
        results.push("Files to process: " + eventFiles.length);
        results.push("");
        
        // Helper function to create consistent frame positioning
        function calculateFramePosition(page, positions, index, basePosition) {
          if (positions && positions[index]) {
            return positions[index];
          } else if (${shouldCreateConsistentLayout} && basePosition) {
            return basePosition;
          } else {
            // Default positioning based on page margins
            var pageBounds = page.bounds;
            var pageMargins = page.marginPreferences;
            var topMargin = pageMargins.top || 72;
            var leftMargin = pageMargins.left || 72;
            var rightMargin = pageMargins.right || 72;
            var bottomMargin = pageMargins.bottom || 72;
            
            return {
              x: pageBounds[1] + leftMargin,
              y: pageBounds[0] + topMargin,
              width: pageBounds[3] - pageBounds[1] - leftMargin - rightMargin,
              height: 200 // Default height for event text
            };
          }
        }
        
        // Process each event file
        for (var fileIdx = 0; fileIdx < eventFiles.length; fileIdx++) {
          var eventFile = eventFiles[fileIdx];
          var currentFile = new File(eventFile.filePath);
          
          results.push("Processing File " + (fileIdx + 1) + "/" + eventFiles.length + ": " + currentFile.name);
          results.push("-".repeat(50));
          
          if (!currentFile.exists) {
            results.push("✗ Error: File does not exist - " + eventFile.filePath);
            overallErrorCount += eventFile.target_pages.length;
            continue;
          }
          
          var fileSuccessCount = 0;
          var fileErrorCount = 0;
          var baseFramePosition = null;
          
          // Process each target page for this file
          for (var pageIdx = 0; pageIdx < eventFile.target_pages.length; pageIdx++) {
            var pageNumber = eventFile.target_pages[pageIdx];
            
            try {
              // Validate page exists
              if (doc.pages.length < pageNumber) {
                results.push("✗ Error: Page " + pageNumber + " does not exist");
                fileErrorCount++;
                overallErrorCount++;
                continue;
              }
              
              var page = doc.pages[pageNumber - 1];
              
              // Calculate frame position
              var framePos = calculateFramePosition(
                page, 
                eventFile.frame_positions, 
                pageIdx, 
                baseFramePosition
              );
              
              // Store first position as base for consistency
              if (baseFramePosition === null && ${shouldCreateConsistentLayout}) {
                baseFramePosition = framePos;
              }
              
              // Create text frame
              var textFrame = page.textFrames.add();
              textFrame.geometricBounds = [
                framePos.y,
                framePos.x,
                framePos.y + framePos.height,
                framePos.x + framePos.width
              ];
              
              framesCreated++;
              
              // Place the file content
              var placedItems = textFrame.place(currentFile, ${shouldLink});
              
              // Apply base style if specified
              if ("${styleToApply}" !== "") {
                try {
                  var paragraphStyle = doc.paragraphStyles.itemByName("${styleToApply}");
                  if (paragraphStyle.isValid) {
                    textFrame.paragraphs.everyItem().appliedParagraphStyle = paragraphStyle;
                  }
                } catch (styleError) {
                  results.push("  Warning: Could not apply style '${styleToApply}' to page " + pageNumber);
                }
              }
              
              results.push("  ✓ Linked to page " + pageNumber + " at [" + 
                          Math.round(framePos.x) + ", " + Math.round(framePos.y) + "]");
              fileSuccessCount++;
              overallSuccessCount++;
              
            } catch (pageError) {
              results.push("  ✗ Error linking to page " + pageNumber + ": " + pageError.message);
              fileErrorCount++;
              overallErrorCount++;
            }
          }
          
          results.push("  File Summary: " + fileSuccessCount + "/" + eventFile.target_pages.length + " successful");
          results.push("");
          filesProcessed++;
        }
        
        results.push("Overall Summary:");
        results.push("===============");
        results.push("Files processed: " + filesProcessed + "/" + eventFiles.length);
        results.push("Total placements: " + overallSuccessCount);
        results.push("Frames created: " + framesCreated);
        results.push("Errors: " + overallErrorCount);
        results.push("Link mode: " + (${shouldLink} ? "Linked" : "Embedded"));
        
        if ("${styleToApply}" !== "") {
          results.push("Base style applied: ${styleToApply}");
        }
        
        if (${shouldCreateConsistentLayout}) {
          results.push("Consistent layout: Enabled");
        }
        
        JSON.stringify({
          filesProcessed: filesProcessed,
          totalFiles: eventFiles.length,
          totalPlacements: overallSuccessCount,
          framesCreated: framesCreated,
          errors: overallErrorCount,
          linkedFiles: ${shouldLink},
          styleApplied: "${styleToApply}",
          consistentLayout: ${shouldCreateConsistentLayout},
          details: results
        });
      `;

      await logger.log("Processing batch event text linking", { current: 1, total: totalOperations + 3 });

      const result = await executeExtendScript(jsx);
      
      if (!result.success) {
        return { content:[{ type:"text", text:`batch_link_event_text failed: ${result.error}` }] };
      }

      await logger.log("Finalizing batch linking results", { current: totalOperations + 2, total: totalOperations + 3 });

      try {
        const batchResult = JSON.parse(result.result!);
        
        await logger.log(`Batch linking completed: ${batchResult.totalPlacements} placements`, { 
          current: totalOperations + 3, 
          total: totalOperations + 3 
        });

        let statusMessage = `batch_link_event_text completed: ${batchResult.totalPlacements} total placements across ${batchResult.filesProcessed}/${batchResult.totalFiles} files`;
        
        if (batchResult.framesCreated > 0) {
          statusMessage += `\\nFrames created: ${batchResult.framesCreated}`;
        }
        
        if (batchResult.errors > 0) {
          statusMessage += `\\nErrors encountered: ${batchResult.errors}`;
        }
        
        statusMessage += `\\nLink mode: ${batchResult.linkedFiles ? 'Files linked' : 'Files embedded'}`;
        
        if (batchResult.styleApplied) {
          statusMessage += `\\nBase style applied: ${batchResult.styleApplied}`;
        }
        
        if (batchResult.consistentLayout) {
          statusMessage += `\\nConsistent layout maintained across pages`;
        }
        
        statusMessage += `\\n\\n⚡ Batch Processing Benefits:`;
        statusMessage += `\\n- All event files processed in single operation`;
        statusMessage += `\\n- Consistent positioning across pages`;
        statusMessage += `\\n- Efficient frame creation and content linking`;
        
        // Include detailed results
        statusMessage += `\\n\\nDetails:\\n${batchResult.details.join('\\n')}`;

        return { content:[{ type:"text", text: statusMessage }] };
        
      } catch (parseError) {
        return { content:[{ type:"text", text:`batch_link_event_text completed but result parsing failed: ${result.result}` }] };
      }
    })
  );
} 