import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScript, escapeExtendScriptString } from "../extendscript.js";

/**
 * Registers read-only resources with the MCP server.
 * Currently implements:
 *   • style_catalog – list of paragraph & character styles with basic properties
 */
export async function registerResources(server: McpServer): Promise<void> {
  // === style_catalog ======================================================
  server.resource(
    "style_catalog",
    "styles://current",
    {
      title: "Style Catalog",
      description: "List of paragraph & character styles in the active document",
      mimeType: "application/json"
    },
    async () => {
      const jsx = `
        if (app.documents.length === 0) {
          throw new Error("No active document");
        }
        var doc = app.activeDocument;
        var result = { paragraphStyles: [], characterStyles: [] };
        // Skip the first style as it's the built-in [No Paragraph Style]/[None]
        for (var i = 1; i < doc.paragraphStyles.length; i++) {
          var ps = doc.paragraphStyles[i];
          result.paragraphStyles.push({
            name: ps.name,
            fontFamily: (ps.appliedFont && ps.appliedFont.name) || undefined,
            pointSize: ps.pointSize,
            alignment: ps.justification.toString().replace("Justification.", "").toLowerCase()
          });
        }
        for (var j = 1; j < doc.characterStyles.length; j++) {
          var cs = doc.characterStyles[j];
          result.characterStyles.push({
            name: cs.name,
            fontFamily: (cs.appliedFont && cs.appliedFont.name) || undefined,
            pointSize: cs.pointSize,
            fontStyle: cs.fontStyle || undefined
          });
        }
        JSON.stringify(result);
      `;

      const exec = await executeExtendScript(jsx);
      if (!exec.success) {
        throw new Error(exec.error || "Failed to fetch styles");
      }

      return {
        contents: [
          {
            uri: "styles://current",
            text: exec.result || "{}"
          }
        ]
      };
    }
  );

  // === document_snapshot (enhanced with threading, overset, content) =========================================
  server.resource(
    "document_snapshot",
    "snapshot://current",
    {
      title: "Document Snapshot",
      description: "Comprehensive JSON description of pages, frames, threads, styles, overset flags (schemaVersion 2)",
      mimeType: "application/json"
    },
    async () => {
      const jsx = `
        if (app.documents.length === 0) { throw new Error('No active document'); }
        var d = app.activeDocument;
        var snapshot = {
          schemaVersion: 2,
          document: {
            name: d.name,
            pages: d.pages.length,
            units: d.viewPreferences.horizontalMeasurementUnits.toString(),
            columns: d.documentPreferences.pageColumns || 1,
            baselineGrid: {
              increment: d.gridPreferences.baselineDivision,
              start: d.gridPreferences.baselineStart
            },
            bleed: {
              top: d.documentPreferences.documentBleedTopOffset,
              inside: d.documentPreferences.documentBleedInsideOrLeftOffset,
              bottom: d.documentPreferences.documentBleedBottomOffset,
              outside: d.documentPreferences.documentBleedOutsideOrRightOffset
            }
          },
          pages: [],
          threads: [],
          overset: false,
          warnings: []
        };
        
        // Track frame IDs globally for threading relationships
        var frameIdMap = {};
        var globalFrameId = 0;
        
        // First pass: collect all frames and assign IDs
        for (var i = 0; i < d.pages.length; i++) {
          var p = d.pages[i];
          var pageData = {
            number: i + 1,
            bounds: p.bounds, // returns [y1,x1,y2,x2] in points
            appliedMaster: p.appliedMaster ? p.appliedMaster.name : null,
            frames: []
          };
          
          // Process all text frames on this page
          for (var f = 0; f < p.textFrames.length; f++) {
            var frame = p.textFrames[f];
            var frameId = globalFrameId++;
            frameIdMap[frame.id] = frameId;
            
            // Get content sample (first 200 chars max)
            var contentSample = "";
            if (frame.contents && frame.contents.length > 0) {
              contentSample = frame.contents.substring(0, 200);
              if (frame.contents.length > 200) {
                contentSample += "...";
              }
            }
            
            // Get applied paragraph style
            var appliedStyle = "[None]";
            try {
              if (frame.paragraphs.length > 0) {
                appliedStyle = frame.paragraphs[0].appliedParagraphStyle.name;
              }
            } catch(e) {
              // Keep default
            }
            
            var frameData = {
              id: frameId,
              type: "text",
              bounds: frame.geometricBounds,
              overflows: frame.overflows,
              storyIndex: -1, // Will be set later
              appliedStyle: appliedStyle,
              contentSample: contentSample
            };
            
            pageData.frames.push(frameData);
            
            // Track overset frames
            if (frame.overflows) {
              snapshot.overset = true;
              snapshot.warnings.push("Frame #" + frameId + " on page " + (i + 1) + " overflows");
            }
          }
          
          snapshot.pages.push(pageData);
        }
        
        // Second pass: identify threading relationships and story indices
        var storyIndex = 0;
        var processedFrames = {};
        
        for (var i = 0; i < d.textFrames.length; i++) {
          var frame = d.textFrames[i];
          if (processedFrames[frame.id]) continue;
          
          // Find the start of this story (frame with no previous)
          var storyStart = frame;
          while (storyStart.previousTextFrame && storyStart.previousTextFrame.isValid) {
            storyStart = storyStart.previousTextFrame;
          }
          
          // Process the entire story chain
          var currentFrame = storyStart;
          var currentStoryIndex = storyIndex++;
          
          while (currentFrame && currentFrame.isValid) {
            processedFrames[currentFrame.id] = true;
            
            // Update story index in our snapshot data
            var frameId = frameIdMap[currentFrame.id];
            if (frameId !== undefined) {
              // Find and update this frame in our pages data
              for (var p = 0; p < snapshot.pages.length; p++) {
                for (var f = 0; f < snapshot.pages[p].frames.length; f++) {
                  if (snapshot.pages[p].frames[f].id === frameId) {
                    snapshot.pages[p].frames[f].storyIndex = currentStoryIndex;
                  }
                }
              }
            }
            
            // Record threading relationship
            if (currentFrame.nextTextFrame && currentFrame.nextTextFrame.isValid) {
              var fromId = frameIdMap[currentFrame.id];
              var toId = frameIdMap[currentFrame.nextTextFrame.id];
              if (fromId !== undefined && toId !== undefined) {
                snapshot.threads.push({
                  fromFrame: fromId,
                  toFrame: toId
                });
              }
            }
            
            currentFrame = currentFrame.nextTextFrame;
          }
        }
        
        JSON.stringify(snapshot);
      `;
      const res = await executeExtendScript(jsx);
      if (!res.success) throw new Error(res.error || "snapshot failed");
      return { contents:[{ uri:"snapshot://current", text: res.result! }] };
    }
  );

  // === system_fonts ========================================================
  server.resource(
    "system_fonts",
    "fonts://system",
    {
      title: "System Fonts",
      description: "PostScript names & families available to InDesign",
      mimeType: "application/json"
    },
    async () => {
      const jsx = `
        var fonts = app.fonts.everyItem().getElements();
        var list = [];
        for (var i=0;i<fonts.length;i++){
          var f = fonts[i];
          list.push({ postScriptName:f.postscriptName, family:f.family, style:f.styleName });
        }
        JSON.stringify({ fonts:list });
      `;
      const r = await executeExtendScript(jsx);
      if(!r.success) throw new Error(r.error||"fonts failed");
      return { contents:[{ uri:"fonts://system", text:r.result! }] };
    }
  );

  // === document_settings ===================================================
  server.resource(
    "document_settings",
    "settings://current",
    {
      title: "Document Settings",
      description: "Units, columns, gutters, baseline grid, bleed/slug",
      mimeType: "application/json"
    },
    async () => {
      const jsx = `
        if(app.documents.length===0){throw new Error('No active document');}
        var v = app.activeDocument.viewPreferences;
        var pb = app.activeDocument.documentPreferences;
        var base = app.activeDocument.gridPreferences;
        var settings = {
          horizontalUnits: v.horizontalMeasurementUnits.toString(),
          verticalUnits: v.verticalMeasurementUnits.toString(),
          columns: pb.pageColumns,
          columnGutter: pb.columnGutter,
          baselineGrid:{ increment: base.baselineDivision, start: base.baselineStart },
          bleed:{ top:pb.documentBleedTopOffset, inside:pb.documentBleedInsideOrLeftOffset, bottom:pb.documentBleedBottomOffset, outside:pb.documentBleedOutsideOrRightOffset }
        };
        JSON.stringify(settings);
      `;
      const r = await executeExtendScript(jsx);
      if(!r.success) throw new Error(r.error||"settings failed");
      return { contents:[{ uri:"settings://current", text:r.result! }] };
    }
  );

  // === preview_page ========================================================
  server.resource(
    "preview_page",
    "preview://{page}",
    {
      title: "Page Preview",
      description: "PNG screenshot of given page number (or first page if not specified)",
      mimeType: "image/png"
    },
    async (uri) => {
      // Extract page number from URI (e.g., "preview://3" -> 3)
      const pageMatch = uri.href.match(/preview:\/\/(\d+)/);
      const pageNumber = pageMatch ? parseInt(pageMatch[1]) : 1;
      
      const jsx = `
        if (app.documents.length === 0) { throw new Error('No active document'); }
        var doc = app.activeDocument;
        
        // Validate page number
        var pageNum = ${pageNumber};
        if (pageNum < 1 || pageNum > doc.pages.length) {
          throw new Error("Page " + pageNum + " out of range. Document has " + doc.pages.length + " pages.");
        }
        
        // Create temp file path
        var tempFolder = Folder.temp;
        var timestamp = new Date().getTime();
        var tempFile = new File(tempFolder + "/indesign_preview_" + timestamp + ".png");
        
        // Set export preferences
        app.pngExportPreferences.exportResolution = 72; // Preview quality
        app.pngExportPreferences.antiAlias = true;
        app.pngExportPreferences.transparentBackground = false;
        app.pngExportPreferences.pageString = pageNum.toString();
        
        // Export the page
        try {
          doc.exportFile(ExportFormat.PNG_FORMAT, tempFile, false);
          
          // Read the file as binary
          tempFile.open("r");
          tempFile.encoding = "BINARY";
          var binaryData = tempFile.read();
          tempFile.close();
          
          // Convert to base64
          var base64 = File.encode(binaryData);
          
          // Clean up temp file
          tempFile.remove();
          
          // Return result
          JSON.stringify({
            success: true,
            page: pageNum,
            data: base64,
            width: Math.round(doc.pages[pageNum-1].bounds[3] - doc.pages[pageNum-1].bounds[1]),
            height: Math.round(doc.pages[pageNum-1].bounds[2] - doc.pages[pageNum-1].bounds[0])
          });
        } catch (e) {
          if (tempFile.exists) tempFile.remove();
          throw new Error("Failed to export page: " + e.message);
        }
      `;
      
      const res = await executeExtendScript(jsx);
      if (!res.success) throw new Error(res.error || "Preview generation failed");
      
      const result = JSON.parse(res.result!);
      
      // Return base64-encoded PNG data
      return {
        contents: [{
          uri: uri.href,
          blob: result.data, // base64 string
          mimeType: "image/png"
        }]
      };
    }
  );
} 