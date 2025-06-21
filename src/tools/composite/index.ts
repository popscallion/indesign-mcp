import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";
import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { withChangeTracking } from "../../utils/changeSummary.js";

export async function registerCompositeTools(server: McpServer): Promise<void> {
  server.tool(
    "auto_flow_text",
    {
      text: z.string().describe("Text to flow into document"),
      startPage: z.number().default(1).describe("Page number to start flow (1-based)"),
      style: z.string().optional().describe("Paragraph style to apply to story"),
      addPages: z.boolean().default(true).describe("Automatically add pages until overset resolved"),
      dry_run: z.boolean().default(false).describe("If true, simulate without changing the document")
    },
    withChangeTracking(server, "auto_flow_text")(async ({ text, startPage, style, addPages, dry_run }: any, progressLogger: any): Promise<{ content: TextContent[] }> => {
      if (dry_run) {
        return { content:[{ type:"text", text:`[dry_run] Would flow text starting at page ${startPage}` }] };
      }
      
      await progressLogger.log("Starting text flow operation", { current: 0, total: 4 });
      
      const escText = escapeExtendScriptString(text);
      const escStyle = style ? escapeExtendScriptString(style) : "";
      
      await progressLogger.log("Adding text to initial frame", { current: 1, total: 4 });
      
      const jsx = `
        if (app.documents.length === 0) { throw new Error('No active document'); }
        var doc = app.activeDocument;
        if (doc.pages.length < ${startPage}) { throw new Error('startPage out of range'); }

        // Helper to get or create a text frame on a page
        function ensureFrame(p) {
          if (p.textFrames.length > 0) return p.textFrames[0];
          var b = p.bounds; // [y1,x1,y2,x2]
          var tf = p.textFrames.add({ geometricBounds:[b[0]+24, b[1]+24, b[2]-24, b[3]-24] });
          return tf;
        }

        var page = doc.pages[${startPage-1}];
        var frame = ensureFrame(page);
        frame.contents = "${escText}";
        if ("${escStyle}" !== "") {
          try { frame.paragraphs.everyItem().appliedParagraphStyle = doc.paragraphStyles.itemByName("${escStyle}"); } catch(e) {}
        }

        var pagesAdded = 0;
        var iterations = 0;
        while (frame.overflows && ${addPages} && iterations < 50) {
          var newPage = doc.pages.add(LocationOptions.AT_END);
          pagesAdded++;
          iterations++;
          var newFrame = newPage.textFrames.add({ geometricBounds: frame.geometricBounds });
          frame.nextTextFrame = newFrame;
          frame = newFrame;
        }
        JSON.stringify({ pagesAdded: pagesAdded, overflowResolved: !frame.overflows });
      `;
      
      await progressLogger.log("Applying style and threading pages", { current: 2, total: 4 });
      
      const res = await executeExtendScript(jsx);
      if (!res.success) {
        return { content:[{ type:"text", text:`Error: ${res.error}` }] };
      }
      
      await progressLogger.log("Finalizing text flow", { current: 3, total: 4 });
      
      const result = JSON.parse(res.result!);
      if (result.pagesAdded > 0) {
        await progressLogger.log(`Added ${result.pagesAdded} pages to resolve overflow`, { current: 4, total: 4 });
      } else {
        await progressLogger.log("Text fit in existing frames", { current: 4, total: 4 });
      }
      
      return { content:[{ type:"text", text:`auto_flow_text completed: ${res.result}` }] };
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