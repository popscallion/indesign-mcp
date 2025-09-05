/**
 * @fileoverview Advanced utility tools for InDesign MCP
 * Batch 6: Text threading, overset resolution, text flow management, frame info
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { executeExtendScript, escapeExtendScriptString } from "@mcp/shared/extendscript.js";
import type { FrameScope, TextFlowAction } from "@mcp/shared/types.js";

/**
 * Registers advanced utility tools with the MCP server
 */
export async function registerUtilityTools(server: McpServer): Promise<void> {
  // Register telemetry_end_session tool (for Task agents in evolutionary testing)
  server.tool(
    "telemetry_end_session",
    {},
    async () => {
      try {
        const { TelemetryCapture } = await import('@mcp/shared/telemetry.js');
        const { isTelemetryEnabled } = await import('@mcp/shared/telemetryFlag.js');
        
        // Detailed diagnostics before ending session
        console.log('📊 Telemetry End Session Diagnostics:');
        console.log(`   Telemetry Enabled: ${isTelemetryEnabled()}`);
        
        const health = TelemetryCapture.getHealthStatus();
        console.log(`   System Status: ${health.systemStatus}`);
        console.log(`   Current Session: ${health.currentSession ? health.currentSession.id : 'None'}`);
        console.log(`   Captured Calls: ${health.callsCount}`);
        console.log(`   Pending Writes: ${health.pendingWrites}`);
        
        // Environment variable diagnostics
        console.log('📊 Environment Variables:');
        console.log(`   EVOLUTION_SESSION_ID: ${process.env.EVOLUTION_SESSION_ID || 'None'}`);
        console.log(`   TELEMETRY_SESSION_ID: ${process.env.TELEMETRY_SESSION_ID || 'None'}`);
        console.log(`   TELEMETRY_AGENT_ID: ${process.env.TELEMETRY_AGENT_ID || 'None'}`);
        
        const session = await TelemetryCapture.endSession();
        
        if (session) {
          console.log(`📊 Session ended successfully: ${session.id} with ${session.calls.length} calls`);
          return {
            content: [{
              type: "text",
              text: `Telemetry session ended successfully. Session ID: ${session.id}, Tool calls captured: ${session.calls.length}`
            }]
          };
        } else {
          console.warn('📊 No active telemetry session found to end');
          return {
            content: [{
              type: "text",
              text: "No active telemetry session to end. Check that telemetry was properly enabled with set_environment_variable."
            }]
          };
        }
      } catch (error) {
        console.error('📊 Error ending telemetry session:', error);
        return {
          content: [{
            type: "text",
            text: `Error ending telemetry session: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // Register set_environment_variable tool for runtime telemetry control
  server.tool(
    "set_environment_variable",
    {
      name: z.string().describe("Environment variable name"),
      value: z.string().describe("Environment variable value (takes effect for subsequent tool calls)")
    },
    async (args) => {
      // Set the environment variable
      process.env[args.name] = args.value;
      
      // CRITICAL: Also flip the in-memory telemetry flag when enabling telemetry
      if (args.name === 'TELEMETRY_ENABLED' && args.value === 'true') {
        const { setTelemetryEnabled } = await import('@mcp/shared/telemetryFlag.js');
        const { TelemetryCapture } = await import('@mcp/shared/telemetry.js');
        
        // Enable telemetry system
        setTelemetryEnabled(true);
        
        // Auto-start session if evolution context detected
        const sessionId = process.env.EVOLUTION_SESSION_ID || 
                         process.env.TELEMETRY_SESSION_ID;
        const agentId = process.env.TELEMETRY_AGENT_ID || 'task-agent';
        const generation = parseInt(process.env.TELEMETRY_GENERATION || '0');
        
        if (sessionId) {
          // Check if session already exists to prevent double-start
          const existingSession = TelemetryCapture.getCurrentSession();
          if (!existingSession) {
            if (process.env.DEBUG_TELEMETRY) {
              console.log(`📊 Evolution context detected - starting telemetry session: ${sessionId}`);
            }
            await TelemetryCapture.startSession(agentId, generation);
            if (process.env.DEBUG_TELEMETRY) {
              console.log(`📊 Telemetry session started for agent: ${agentId}, generation: ${generation}`);
            }
          } else {
            if (process.env.DEBUG_TELEMETRY) {
              console.log(`📊 Telemetry session already exists: ${existingSession.id}`);
            }
          }
        } else {
          if (process.env.DEBUG_TELEMETRY) {
            console.log(`📊 Telemetry enabled but no evolution session ID found - will start session on first tool call`);
          }
        }
      }
      
      return {
        content: [{
          type: "text",
          text: `Environment variable ${args.name} set to: ${args.value}${
            args.name === 'TELEMETRY_ENABLED' ? ' (telemetry capture enabled for subsequent tool calls)' : ''
          }`
        }]
      };
    }
  );

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

  // === close_document =============================================
  server.tool(
    "close_document",
    {
      save: z.boolean().default(false).describe("Save the document before closing"),
      filePath: z.string().optional().describe("Path to save the document copy (required if save = true)"),
      force: z.boolean().default(false).describe("Force close without dialogs (SaveOptions.YES/NO)"),
    },
    async (args) => {
      const saveFlag = args.save || false;
      const forceFlag = args.force || false;
      const filePath = args.filePath || "";

      // Basic validation
      if (saveFlag && !filePath) {
        throw new Error("filePath is required when save is true");
      }

      // Build ExtendScript using join() pattern
      const scriptLines = [
        "try {",
        "  if (app.documents.length === 0) {",
        "    \"No documents are open\";",
        "  } else {",
        "    var doc = app.activeDocument;",
        "    // Perform save if requested",
        `    if ("${saveFlag}" === "true") {`,
        `      var targetFile = new File("${filePath.replace(/\\/g, "/")}");`,
        "      doc.save(targetFile);",
        "    }",
        "    // Determine save option",
        `    var saveOpt = ("${saveFlag}" === "true") ? SaveOptions.YES : SaveOptions.NO;`,
        `    if (!${forceFlag}) { saveOpt = SaveOptions.ASK; }`,
        "    doc.close(saveOpt);",
        "    \"Document closed\";",
        "  }",
        "} catch(e) { throw new Error(e); }",
      ].join("\n");

      const result = await executeExtendScript(scriptLines);

      return {
        content: [
          {
            type: "text",
            text: result.success ? (result.result || "Document closed") : `Error closing document: ${result.error}`,
          },
        ],
      };
    }
  );

  // === validate_layout ==============================================
  server.tool(
    "validate_layout",
    {},
    async (): Promise<{ content: TextContent[] }> => {
      const jsx = `
        // JSON shim for older ExtendScript engines
        if (typeof JSON === 'undefined' || !JSON.stringify) {
          JSON = { stringify: function(v) { try { return v.toSource(); } catch(e) { return ''; } } };
        }

        if (app.documents.length === 0) { throw new Error('No active document'); }
        var doc = app.activeDocument;
        var issues = [];
        var warnings = [];
        
        // Overset check
        for (var i=0;i<doc.stories.length;i++){
          if(doc.stories[i].overflows) {
            issues.push({ 
              type:'overset_text', 
              story:i, 
              severity: 'error',
              message: 'Story ' + i + ' has overset text that may be lost'
            });
          }
        }
        
        // Empty frame check
        for (var p=0;p<doc.pages.length;p++){
          var page = doc.pages[p];
          for(var f=0;f<page.textFrames.length;f++){
            var tf = page.textFrames[f];
            if(tf.contents.length===0) {
              warnings.push({ 
                type:'empty_frame', 
                page:p+1, 
                frame:f,
                severity: 'warning',
                message: 'Text frame ' + f + ' on page ' + (p+1) + ' is empty'
              });
            }
          }
        }
        
        // Check for unthreaded frames with overflow potential
        for (var p=0;p<doc.pages.length;p++){
          var page = doc.pages[p];
          for(var f=0;f<page.textFrames.length;f++){
            var tf = page.textFrames[f];
            if(tf.contents.length > 0 && !tf.nextTextFrame && tf.overflows) {
              issues.push({
                type: 'unthreaded_overflow',
                page: p+1,
                frame: f,
                severity: 'error',
                message: 'Frame ' + f + ' on page ' + (p+1) + ' has overflow but no threading'
              });
            }
          }
        }
        
        var allIssues = issues.concat(warnings);
        var passed = issues.length === 0; // Only errors affect pass/fail
        var report = { 
          passed: passed, 
          issues: allIssues,
          errorCount: issues.length,
          warningCount: warnings.length
        };
        report.toSource();
      `;
      const r = await executeExtendScript(jsx);
      if(!r.success) return { content:[{ type:"text", text:`Error: ${r.error}` }] };
      
      // Parse validation result and convert to changeSummary patches
      const validation = eval(r.result!);
      if (!validation.passed && validation.issues.length > 0) {
        const patches = validation.issues.map((issue: any, index: number) => ({
          op: "add",
          path: `/validation/warnings/${index}`,
          value: issue
        }));
        
        // Log validation warnings as changeSummary patches
        await (server as any).server.sendLoggingMessage({
          level: "warning",
          logger: "validation",
          data: {
            tool: "validate_layout",
            patches: patches,
            summary: `Found ${validation.issues.length} layout issues`,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      return { content:[{ type:"text", text: r.result! }] };
    }
  );

  // === scenario_summary =============================================
  server.tool(
    "scenario_summary",
    {
      include_validation: z.boolean().default(true).describe("Include layout validation in summary"),
      include_content_stats: z.boolean().default(true).describe("Include content statistics"),
      include_recommendations: z.boolean().default(true).describe("Include workflow recommendations")
    },
    async (args): Promise<{ content: TextContent[] }> => {
      const includeValidation = args.include_validation !== false;
      const includeContentStats = args.include_content_stats !== false;
      const includeRecommendations = args.include_recommendations !== false;
      
      const jsx = `
        if (typeof JSON === 'undefined' || !JSON.stringify) {
          JSON = { stringify: function(v){ try{return v.toSource();}catch(e){return ''; } } };
        }

        if (app.documents.length === 0) { throw new Error('No active document'); }
        var doc = app.activeDocument;
        var summary = {
          document: {
            name: doc.name,
            pages: doc.pages.length,
            stories: doc.stories.length,
            textFrames: doc.textFrames.length
          },
          validation: {
            issues: [],
            warnings: [],
            passed: true
          },
          contentStats: {
            totalCharacters: 0,
            threaded: 0,
            oversetStories: 0,
            emptyFrames: 0
          },
          recommendations: []
        };
        
        // Content statistics
        if (${includeContentStats}) {
          for (var i = 0; i < doc.stories.length; i++) {
            var story = doc.stories[i];
            summary.contentStats.totalCharacters += story.contents.length;
            if (story.overflows) summary.contentStats.oversetStories++;
          }
          
          for (var p = 0; p < doc.pages.length; p++) {
            var page = doc.pages[p];
            for (var f = 0; f < page.textFrames.length; f++) {
              var tf = page.textFrames[f];
              if (tf.contents.length === 0) summary.contentStats.emptyFrames++;
              if (tf.nextTextFrame && tf.nextTextFrame.isValid) summary.contentStats.threaded++;
            }
          }
        }
        
        // Validation
        if (${includeValidation}) {
          // Overset check
          for (var i = 0; i < doc.stories.length; i++) {
            if (doc.stories[i].overflows) {
              summary.validation.issues.push({
                type: 'overset_text',
                story: i,
                severity: 'error',
                message: 'Story ' + i + ' has overset text'
              });
              summary.validation.passed = false;
            }
          }
          
          // Empty frames
          for (var p = 0; p < doc.pages.length; p++) {
            var page = doc.pages[p];
            for (var f = 0; f < page.textFrames.length; f++) {
              var tf = page.textFrames[f];
              if (tf.contents.length === 0) {
                summary.validation.warnings.push({
                  type: 'empty_frame',
                  page: p + 1,
                  frame: f,
                  severity: 'warning',
                  message: 'Frame ' + f + ' on page ' + (p + 1) + ' is empty'
                });
              }
            }
          }
          
          // Unthreaded overflow
          for (var p = 0; p < doc.pages.length; p++) {
            var page = doc.pages[p];
            for (var f = 0; f < page.textFrames.length; f++) {
              var tf = page.textFrames[f];
              if (tf.contents.length > 0 && !tf.nextTextFrame && tf.overflows) {
                summary.validation.issues.push({
                  type: 'unthreaded_overflow',
                  page: p + 1,
                  frame: f,
                  severity: 'error',
                  message: 'Frame has overflow but no threading'
                });
                summary.validation.passed = false;
              }
            }
          }
        }
        
        // Recommendations
        if (${includeRecommendations}) {
          if (summary.contentStats.oversetStories > 0) {
            summary.recommendations.push('Use auto_flow_text or resolve_overset_text to handle overflow');
          }
          if (summary.contentStats.emptyFrames > 0) {
            summary.recommendations.push('Consider removing empty frames or adding content');
          }
          if (summary.contentStats.threaded === 0 && doc.textFrames.length > 1) {
            summary.recommendations.push('Consider threading text frames for better text flow');
          }
          if (doc.pages.length === 1 && summary.contentStats.oversetStories > 0) {
            summary.recommendations.push('Add more pages to accommodate all content');
          }
        }
        
        summary.toSource();
      `;
      
      const r = await executeExtendScript(jsx);
      if(!r.success) return { content:[{ type:"text", text:`Error: ${r.error}` }] };
      
      const summary = eval(r.result!);
      
      // Log scenario summary as changeSummary patches
      const summaryPatches = [
        {
          op: "replace",
          path: "/scenario/summary",
          value: summary
        }
      ];
      
      await (server as any).server.sendLoggingMessage({
        level: "info",
        logger: "scenario",
        data: {
          tool: "scenario_summary",
          patches: summaryPatches,
          summary: `Document: ${summary.document.pages} pages, ${summary.validation.issues.length} errors, ${summary.validation.warnings.length} warnings`,
          timestamp: new Date().toISOString()
        }
      });
      
      // Format summary for display
      let displayText = `📊 **SCENARIO SUMMARY**\n\n`;
      displayText += `📄 **Document**: ${summary.document.name}\n`;
      displayText += `📖 **Pages**: ${summary.document.pages} | **Stories**: ${summary.document.stories} | **Frames**: ${summary.document.textFrames}\n\n`;
      
      if (includeContentStats) {
        displayText += `📝 **Content Stats**:\n`;
        displayText += `• Characters: ${summary.contentStats.totalCharacters.toLocaleString()}\n`;
        displayText += `• Threaded frames: ${summary.contentStats.threaded}\n`;
        displayText += `• Overset stories: ${summary.contentStats.oversetStories}\n`;
        displayText += `• Empty frames: ${summary.contentStats.emptyFrames}\n\n`;
      }
      
      if (includeValidation) {
        if (summary.validation.passed) {
          displayText += `✅ **Validation**: All checks passed\n`;
        } else {
          displayText += `❌ **Validation**: ${summary.validation.issues.length} errors found\n`;
          summary.validation.issues.forEach((issue: any) => {
            displayText += `   • ${issue.message}\n`;
          });
        }
        
        if (summary.validation.warnings.length > 0) {
          displayText += `⚠️  **Warnings**: ${summary.validation.warnings.length} warnings\n`;
          summary.validation.warnings.slice(0, 3).forEach((warning: any) => {
            displayText += `   • ${warning.message}\n`;
          });
          if (summary.validation.warnings.length > 3) {
            displayText += `   • ... and ${summary.validation.warnings.length - 3} more\n`;
          }
        }
        displayText += `\n`;
      }
      
      if (includeRecommendations && summary.recommendations.length > 0) {
        displayText += `💡 **Recommendations**:\n`;
        summary.recommendations.forEach((rec: string) => {
          displayText += `• ${rec}\n`;
        });
      }
      
      return { content:[{ type:"text", text: displayText }] };
    }
  );

  // Register update_all_links tool
  server.tool(
    "update_all_links",
    {
      relink_missing: z.boolean().default(true).describe("Attempt to relink missing assets automatically"),
      report_only: z.boolean().default(false).describe("Only report link status without updating")
    },
    async (args) => {
      return await handleUpdateAllLinks(args);
    }
  );

  // Register relink_assets tool
  server.tool(
    "relink_assets",
    {
      link_mappings: z.record(z.string()).describe("Object mapping old file paths to new file paths"),
      search_directories: z.array(z.string()).optional().describe("Directories to search for missing assets"),
      update_all_instances: z.boolean().default(true).describe("Update all instances of each asset")
    },
    async (args) => {
      return await handleRelinkAssets(args);
    }
  );

  // Register copy_object_across_pages tool
  server.tool(
    "copy_object_across_pages",
    {
      source_page: z.number().describe("Source page number (1-based)"),
      target_pages: z.array(z.number()).describe("Target page numbers (1-based)"),
      selection_criteria: z.object({
        object_type: z.enum(["all", "text_frames", "images", "rectangles", "selected"]).default("selected").describe("Type of objects to copy"),
        layer_name: z.string().optional().describe("Layer name to filter objects"),
        position_filter: z.object({
          x_range: z.object({ min: z.number(), max: z.number() }).optional().describe("X position range"),
          y_range: z.object({ min: z.number(), max: z.number() }).optional().describe("Y position range")
        }).optional().describe("Position-based filtering")
      }).describe("Criteria for selecting objects to copy"),
      positioning: z.object({
        maintain_position: z.boolean().default(true).describe("Keep objects at same position"),
        offset: z.object({
          x: z.number().default(0),
          y: z.number().default(0)
        }).optional().describe("Offset to apply to copied objects")
      }).default({ maintain_position: true }).describe("How to position copied objects")
    },
    async (args) => {
      return await handleCopyObjectAcrossPages(args);
    }
  );

  // Register create_master_page tool
  server.tool(
    "create_master_page",
    {
      master_name: z.string().describe("Name for the new master page spread"),
      based_on: z.string().optional().describe("Name of existing master page to base this on (optional)"),
      page_size: z.object({
        width: z.number().describe("Page width in points"),
        height: z.number().describe("Page height in points")
      }).optional().describe("Custom page dimensions (uses document default if not specified)"),
      margins: z.object({
        top: z.number().describe("Top margin in points"),
        left: z.number().describe("Left margin in points"),
        bottom: z.number().describe("Bottom margin in points"),
        right: z.number().describe("Right margin in points")
      }).optional().describe("Master page margins")
    },
    async (args) => handleCreateMasterPage(args)
  );

  // Register apply_master_to_pages tool
  server.tool(
    "apply_master_to_pages",
    {
      master_name: z.string().describe("Name of the master page to apply"),
      page_range: z.string().describe("Page range to apply master to (e.g., '1-5', '3,7,9', or 'all')"),
      override_existing: z.boolean().default(false).describe("Override existing master page assignments")
    },
    async (args) => handleApplyMasterToPages(args)
  );

  // Register modify_master_page_elements tool
  server.tool(
    "modify_master_page_elements",
    {
      master_name: z.string().describe("Name of the master page to modify"),
      operation: z.enum(["add_text", "add_image_placeholder", "add_rectangle", "modify_element", "remove_element"]).describe("Type of modification to perform"),
      element_data: z.object({
        type: z.enum(["text", "image", "rectangle"]).optional(),
        x: z.number().optional().describe("X position in points"),
        y: z.number().optional().describe("Y position in points"),
        width: z.number().optional().describe("Width in points"),
        height: z.number().optional().describe("Height in points"),
        content: z.string().optional().describe("Text content for text elements"),
        element_index: z.number().optional().describe("Index of element to modify/remove (0-based)"),
        style_name: z.string().optional().describe("Style name to apply")
      }).describe("Data for the element to add, modify, or remove")
    },
    async (args) => handleModifyMasterPageElements(args)
  );

  // Register apply_operation_to_all_pages tool
  server.tool(
    "apply_operation_to_all_pages",
    {
      operation: z.enum(["apply_style", "resize_objects", "reposition_objects", "change_layer", "apply_object_style"]).describe("Type of operation to apply"),
      target_criteria: z.object({
        object_type: z.enum(["all", "text_frames", "rectangles", "images", "groups"]).optional().describe("Type of objects to target"),
        layer_name: z.string().optional().describe("Target specific layer"),
        style_name: z.string().optional().describe("Target objects with specific style"),
        has_content: z.boolean().optional().describe("Target objects with/without content")
      }).describe("Criteria for selecting target objects"),
      operation_data: z.object({
        style_to_apply: z.string().optional().describe("Style name to apply"),
        object_style_to_apply: z.string().optional().describe("Object style name to apply"),
        resize_factor: z.number().optional().describe("Scale factor for resizing (1.0 = no change)"),
        position_offset: z.object({
          x: z.number(),
          y: z.number()
        }).optional().describe("Offset to apply to object positions"),
        target_layer: z.string().optional().describe("Layer name to move objects to")
      }).describe("Data for the operation to perform"),
      page_range: z.string().default("all").describe("Page range to process (e.g., 'all', '1-5', '3,7,9')")
    },
    async (args) => handleApplyOperationToAllPages(args)
  );

  // Register select_objects_by_criteria tool
  server.tool(
    "select_objects_by_criteria",
    {
      criteria: z.object({
        object_type: z.enum(["all", "text_frames", "rectangles", "images", "groups", "lines"]).optional().describe("Type of objects to select"),
        layer_name: z.string().optional().describe("Select from specific layer"),
        has_content: z.boolean().optional().describe("Select objects with/without content"),
        style_name: z.string().optional().describe("Select objects with specific style"),
        object_style_name: z.string().optional().describe("Select objects with specific object style"),
        size_range: z.object({
          min_width: z.number().optional(),
          max_width: z.number().optional(),
          min_height: z.number().optional(),
          max_height: z.number().optional()
        }).optional().describe("Size constraints for selection"),
        position_range: z.object({
          min_x: z.number().optional(),
          max_x: z.number().optional(),
          min_y: z.number().optional(),
          max_y: z.number().optional()
        }).optional().describe("Position constraints for selection")
      }).describe("Criteria for object selection"),
      page_range: z.string().default("all").describe("Page range to search (e.g., 'all', '1-5', '3,7,9')"),
      select_objects: z.boolean().default(true).describe("Actually select the objects in InDesign (false = just report)")
    },
    async (args) => handleSelectObjectsByCriteria(args)
  );

  // Register batch_apply_styles tool
  server.tool(
    "batch_apply_styles",
    {
      style_mappings: z.array(z.object({
        target_criteria: z.object({
          object_type: z.enum(["text_frames", "paragraphs", "characters", "objects"]).describe("Type of objects to target"),
          current_style: z.string().optional().describe("Current style name to replace"),
          layer_name: z.string().optional().describe("Target specific layer"),
          content_match: z.string().optional().describe("Text content pattern to match")
        }),
        new_style: z.string().describe("New style name to apply"),
        style_type: z.enum(["paragraph", "character", "object"]).describe("Type of style being applied")
      })).describe("Array of style mapping rules"),
      page_range: z.string().default("all").describe("Page range to process"),
      preview_mode: z.boolean().default(false).describe("Preview changes without applying them")
    },
    async (args) => handleBatchApplyStyles(args)
  );

  // Register data_merge_setup tool
  server.tool(
    "data_merge_setup",
    {
      csv_path: z.string().describe("Path to CSV file containing data merge fields"),
      field_mappings: z.array(z.object({
        csv_column: z.string().describe("CSV column name"),
        target_frames: z.array(z.object({
          page: z.number().describe("Page number (1-based)"),
          frame_index: z.number().describe("Text frame index on page (0-based)")
        })).describe("Target text frames for this field")
      })).describe("Mapping of CSV columns to text frames"),
      auto_create_records: z.boolean().default(true).describe("Automatically create data merge records"),
      preview_record: z.number().default(1).describe("Record number to preview (1-based)")
    },
    async (args) => handleDataMergeSetup(args)
  );
}

async function handleResolveOversetText(args: any): Promise<{ content: TextContent[] }> {
  const sourcePage = args.source_page || -1;
  const targetPages = JSON.stringify(args.target_pages || []);
  
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

    // Helper to test intersection
    function intersects(b){
      var y1=b[0], x1=b[1], y2=b[2], x2=b[3];
      var py1=page.bounds[0], px1=page.bounds[1], py2=page.bounds[2], px2=page.bounds[3];
      return !(x2 < px1 || x1 > px2 || y2 < py1 || y1 > py2);
    }

    var allFrames = doc.textFrames.everyItem().getElements();
    var hit = [];
    for(var ai=0;ai<allFrames.length;ai++){
      var fr=allFrames[ai];
      try{ if(intersects(fr.geometricBounds)){ hit.push(fr); } }catch(e){}
    }

    info.push("=== Text Frame Bounds on Page " + ${pageNumber} + " ===");
    info.push("");
    info.push("Total text frames intersecting this page: " + hit.length);
    info.push("");
    
    for (var i = 0; i < hit.length; i++) {
      var frame = hit[i];
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

async function handleCopyTextFrameProperties(args: any) {
  const sourcePage = args.source_page || 4;
  const targetPages = JSON.stringify(args.target_pages || [6, 7]);
  const sourceFrameIndex = args.source_frame_index;
  const replaceExisting = args.replace_existing || false;
  const copyAllFrames = sourceFrameIndex === undefined || sourceFrameIndex === -1;
  
  const script = `
    var doc = app.activeDocument;
    var results = [];
    var totalCreated = 0;
    
    // Get source page
    if (doc.pages.length < ${sourcePage}) {
      throw new Error("Source page " + ${sourcePage} + " does not exist.");
    }
    
    var sourcePage = doc.pages[${sourcePage} - 1];
    if (sourcePage.textFrames.length === 0) {
      throw new Error("No text frames found on page " + ${sourcePage} + " to copy properties from. Check other pages using get_textframe_info to find available frames.");
    }
    
    var sourceFrames = [];
    
    ${copyAllFrames ? `
    // Copy ALL frames from source page
    for (var f = 0; f < sourcePage.textFrames.length; f++) {
      sourceFrames.push({
        frame: sourcePage.textFrames[f],
        bounds: sourcePage.textFrames[f].geometricBounds,
        index: f
      });
    }
    results.push("Will copy ALL " + sourceFrames.length + " frames from source page");
    ` : `
    // Copy specific frame by index
    if (sourcePage.textFrames.length <= ${sourceFrameIndex}) {
      throw new Error("Source frame index " + ${sourceFrameIndex} + " does not exist on page " + ${sourcePage} + ". Page has " + sourcePage.textFrames.length + " frame(s). Use index 0 to " + (sourcePage.textFrames.length - 1) + ".");
    }
    
    sourceFrames.push({
      frame: sourcePage.textFrames[${sourceFrameIndex}],
      bounds: sourcePage.textFrames[${sourceFrameIndex}].geometricBounds,
      index: ${sourceFrameIndex}
    });
    results.push("Will copy frame " + ${sourceFrameIndex} + " from source page");
    `}
    
    // Display source frame information
    for (var s = 0; s < sourceFrames.length; s++) {
      var srcInfo = sourceFrames[s];
      results.push("Frame " + srcInfo.index + " bounds: [" + srcInfo.bounds.join(", ") + "]");
      results.push("  Position: x=" + srcInfo.bounds[1] + ", y=" + srcInfo.bounds[0]);
      results.push("  Size: " + (srcInfo.bounds[3] - srcInfo.bounds[1]) + " × " + (srcInfo.bounds[2] - srcInfo.bounds[0]));
    }
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
      var frameCountBefore = targetPage.textFrames.length;
      
      // Remove existing frames if requested
      if (${replaceExisting}) {
        while (targetPage.textFrames.length > 0) {
          targetPage.textFrames[0].remove();
        }
        results.push("Cleared " + frameCountBefore + " existing frames on page " + targetPageNum);
      }
      
      // Create matching frames for each source frame
      var createdOnThisPage = 0;
      for (var j = 0; j < sourceFrames.length; j++) {
        var sourceFrameInfo = sourceFrames[j];
        
        try {
          // Create new frame with exact same bounds
          var newFrame = targetPage.textFrames.add();
          newFrame.geometricBounds = [
            sourceFrameInfo.bounds[0],  // y1
            sourceFrameInfo.bounds[1],  // x1  
            sourceFrameInfo.bounds[2],  // y2
            sourceFrameInfo.bounds[3]   // x2
          ];
          
          // Try to copy additional properties if possible
          try {
            var sourceFrame = sourceFrameInfo.frame;
            if (sourceFrame.contents && sourceFrame.contents.length > 0) {
              // Copy text content as placeholder
              newFrame.contents = sourceFrame.contents;
            }
            
            // Copy text frame preferences
            if (sourceFrame.textFramePreferences) {
              newFrame.textFramePreferences.verticalJustification = sourceFrame.textFramePreferences.verticalJustification;
              newFrame.textFramePreferences.firstBaselineOffset = sourceFrame.textFramePreferences.firstBaselineOffset;
              newFrame.textFramePreferences.autoSizingReferencePoint = sourceFrame.textFramePreferences.autoSizingReferencePoint;
            }
          } catch (propErr) {
            // Properties copying failed, continue with basic frame
            results.push("  Note: Could not copy all properties for frame " + sourceFrameInfo.index + ": " + propErr.message);
          }
          
          createdOnThisPage++;
          totalCreated++;
          
        } catch (createErr) {
          results.push("  Error creating frame " + sourceFrameInfo.index + " on page " + targetPageNum + ": " + createErr.message);
        }
      }
      
      results.push("Created " + createdOnThisPage + " matching frames on page " + targetPageNum);
    }
    
    results.push("");
    results.push("Summary: Created " + totalCreated + " frames across " + targetPageArray.length + " target pages");
    
    results.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? `Successfully copied frame properties:\\n${result.result}` : `Error copying frame properties: ${result.error}`
    }]
  };
}

async function handleUpdateAllLinks(args: any): Promise<{ content: TextContent[] }> {
  const { relink_missing = true, report_only = false } = args;
  
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    var results = [];
    var updated = 0;
    var missing = 0;
    var errors = 0;
    
    results.push("Link Status Report");
    results.push("=================");
    
    try {
      var links = doc.links;
      results.push("Total links found: " + links.length);
      results.push("");
      
      for (var i = 0; i < links.length; i++) {
        try {
          var link = links[i];
          var linkName = link.name || ("Link_" + (i + 1));
          var status = "Unknown";
          
          // Check link status
          try {
            status = link.status.toString();
          } catch (e) {
            status = "Cannot determine";
          }
          
          if (status.indexOf("LINK_MISSING") >= 0 || status.indexOf("Missing") >= 0) {
            results.push("❌ " + linkName + " - MISSING");
            missing++;
            
            if (${relink_missing ? "true" : "false"} && !${report_only ? "true" : "false"}) {
              // Attempt to relink by searching in same directory or common locations
              try {
                link.update();
                results.push("   ✓ Successfully relinked");
                updated++;
              } catch (relinkError) {
                results.push("   ✗ Relink failed: " + relinkError.message);
                errors++;
              }
            }
          } else if (status.indexOf("LINK_OUT_OF_DATE") >= 0 || status.indexOf("Modified") >= 0) {
            results.push("🔄 " + linkName + " - OUT OF DATE");
            
            if (!${report_only ? "true" : "false"}) {
              try {
                link.update();
                results.push("   ✓ Updated to latest version");
                updated++;
              } catch (updateError) {
                results.push("   ✗ Update failed: " + updateError.message);
                errors++;
              }
            }
          } else {
            results.push("✅ " + linkName + " - OK");
          }
        } catch (linkError) {
          results.push("❌ Error processing link " + (i + 1) + ": " + linkError.message);
          errors++;
        }
      }
      
      results.push("");
      results.push("Summary:");
      results.push("  Links processed: " + links.length);
      if (!${report_only ? "true" : "false"}) {
        results.push("  Successfully updated: " + updated);
      }
      results.push("  Missing links: " + missing);
      if (errors > 0) {
        results.push("  Errors encountered: " + errors);
      }
      
    } catch (mainError) {
      throw new Error("Link update failed: " + mainError.message);
    }
    
    results.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? result.result! : `Error updating links: ${result.error}`
    }]
  };
}

async function handleRelinkAssets(args: any): Promise<{ content: TextContent[] }> {
  const { link_mappings, search_directories = [], update_all_instances = true } = args;
  
  if (!link_mappings || Object.keys(link_mappings).length === 0) {
    return {
      content: [{
        type: "text" as const,
        text: "Error: link_mappings parameter is required and cannot be empty"
      }]
    };
  }
  
  const mappingsJson = JSON.stringify(link_mappings);
  const searchDirsJson = JSON.stringify(search_directories);
  
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    var mappings = ${mappingsJson};
    var searchDirs = ${searchDirsJson};
    var results = [];
    var relinked = 0;
    var notFound = 0;
    var errors = 0;
    
    results.push("Asset Relinking Report");
    results.push("====================");
    results.push("Mappings to process: " + Object.keys(mappings).length);
    results.push("");
    
    try {
      var links = doc.links;
      
      for (var oldPath in mappings) {
        var newPath = mappings[oldPath];
        var foundLinks = [];
        
        results.push("Processing: " + oldPath + " → " + newPath);
        
        // Find links that match the old path
        for (var i = 0; i < links.length; i++) {
          try {
            var link = links[i];
            var linkPath = "";
            
            try {
              linkPath = link.filePath || "";
            } catch (e) {
              linkPath = link.name || "";
            }
            
            // Check if this link matches the old path pattern
            if (linkPath.indexOf(oldPath) >= 0 || linkPath === oldPath) {
              foundLinks.push(link);
            }
          } catch (e) {
            // Skip problematic links
          }
        }
        
        results.push("  Found " + foundLinks.length + " matching links");
        
        // Relink each found link
        for (var j = 0; j < foundLinks.length; j++) {
          try {
            var linkToRelink = foundLinks[j];
            var newFile = new File(newPath);
            
            if (newFile.exists) {
              linkToRelink.relink(newFile);
              results.push("  ✓ Relinked: " + linkToRelink.name);
              relinked++;
              
              if (!${update_all_instances ? "true" : "false"}) {
                break; // Only relink first instance if update_all_instances is false
              }
            } else {
              results.push("  ✗ New file not found: " + newPath);
              notFound++;
            }
          } catch (relinkError) {
            results.push("  ✗ Relink error: " + relinkError.message);
            errors++;
          }
        }
        
        if (foundLinks.length === 0) {
          results.push("  ⚠ No matching links found for: " + oldPath);
        }
        
        results.push("");
      }
      
      results.push("Summary:");
      results.push("  Successfully relinked: " + relinked);
      results.push("  Files not found: " + notFound);
      if (errors > 0) {
        results.push("  Errors encountered: " + errors);
      }
      
    } catch (mainError) {
      throw new Error("Asset relinking failed: " + mainError.message);
    }
    
    results.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? result.result! : `Error relinking assets: ${result.error}`
    }]
  };
}

async function handleCopyObjectAcrossPages(args: any): Promise<{ content: TextContent[] }> {
  const { source_page, target_pages, selection_criteria, positioning } = args;
  
  if (!source_page || !target_pages || target_pages.length === 0) {
    return {
      content: [{
        type: "text" as const,
        text: "Error: source_page and target_pages are required"
      }]
    };
  }
  
  const targetPagesJson = JSON.stringify(target_pages);
  const criteriaJson = JSON.stringify(selection_criteria || { object_type: "selected" });
  const positioningJson = JSON.stringify(positioning || { maintain_position: true });
  
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    var sourcePageNum = ${source_page};
    var targetPages = ${targetPagesJson};
    var criteria = ${criteriaJson};
    var positioning = ${positioningJson};
    var results = [];
    var totalCopied = 0;
    
    results.push("Copying Objects Across Pages");
    results.push("===========================");
    results.push("Source page: " + sourcePageNum);
    results.push("Target pages: " + targetPages.join(", "));
    results.push("");
    
    try {
      // Validate source page
      if (sourcePageNum < 1 || sourcePageNum > doc.pages.length) {
        throw new Error("Source page " + sourcePageNum + " out of range");
      }
      
      var sourcePage = doc.pages[sourcePageNum - 1];
      var objectsToCopy = [];
      
      // Select objects based on criteria
      if (criteria.object_type === "selected") {
        if (app.selection.length === 0) {
          throw new Error("No objects selected. Please select objects or choose a different object_type.");
        }
        
        for (var s = 0; s < app.selection.length; s++) {
          objectsToCopy.push(app.selection[s]);
        }
        
        results.push("Using " + objectsToCopy.length + " selected objects");
        
      } else if (criteria.object_type === "all") {
        var allItems = sourcePage.allPageItems;
        for (var i = 0; i < allItems.length; i++) {
          objectsToCopy.push(allItems[i]);
        }
        
        results.push("Found " + objectsToCopy.length + " objects on source page");
        
      } else if (criteria.object_type === "text_frames") {
        var textFrames = sourcePage.textFrames;
        for (var i = 0; i < textFrames.length; i++) {
          objectsToCopy.push(textFrames[i]);
        }
        
        results.push("Found " + objectsToCopy.length + " text frames");
        
      } else if (criteria.object_type === "images") {
        var allItems = sourcePage.allPageItems;
        for (var i = 0; i < allItems.length; i++) {
          var item = allItems[i];
          try {
            if (item.hasOwnProperty('images') && item.images.length > 0) {
              objectsToCopy.push(item);
            }
          } catch (e) {
            // Skip items that don't support images property
          }
        }
        
        results.push("Found " + objectsToCopy.length + " image containers");
        
      } else if (criteria.object_type === "rectangles") {
        var rectangles = sourcePage.rectangles;
        for (var i = 0; i < rectangles.length; i++) {
          objectsToCopy.push(rectangles[i]);
        }
        
        results.push("Found " + objectsToCopy.length + " rectangles");
      }
      
      // Apply layer filtering if specified
      if (criteria.layer_name) {
        var targetLayer = doc.layers.itemByName(criteria.layer_name);
        if (!targetLayer.isValid) {
          throw new Error("Layer '" + criteria.layer_name + "' not found");
        }
        
        var filteredObjects = [];
        for (var i = 0; i < objectsToCopy.length; i++) {
          try {
            if (objectsToCopy[i].itemLayer === targetLayer) {
              filteredObjects.push(objectsToCopy[i]);
            }
          } catch (e) {
            // Skip objects that don't have layer property
          }
        }
        
        objectsToCopy = filteredObjects;
        results.push("After layer filtering: " + objectsToCopy.length + " objects");
      }
      
      if (objectsToCopy.length === 0) {
        throw new Error("No objects found matching the specified criteria");
      }
      
      results.push("");
      
      // Copy objects to each target page
      for (var p = 0; p < targetPages.length; p++) {
        var targetPageNum = targetPages[p];
        
        if (targetPageNum < 1 || targetPageNum > doc.pages.length) {
          results.push("❌ Target page " + targetPageNum + " out of range, skipping");
          continue;
        }
        
        var targetPage = doc.pages[targetPageNum - 1];
        var copiedOnThisPage = 0;
        
        for (var i = 0; i < objectsToCopy.length; i++) {
          try {
            var sourceObject = objectsToCopy[i];
            var duplicatedObject = sourceObject.duplicate(targetPage);
            
            // Apply positioning
            if (!positioning.maintain_position && positioning.offset) {
              var bounds = duplicatedObject.geometricBounds;
              duplicatedObject.geometricBounds = [
                bounds[0] + positioning.offset.y,
                bounds[1] + positioning.offset.x,
                bounds[2] + positioning.offset.y,
                bounds[3] + positioning.offset.x
              ];
            }
            
            copiedOnThisPage++;
            totalCopied++;
          } catch (copyError) {
            results.push("  ✗ Failed to copy object " + (i + 1) + " to page " + targetPageNum + ": " + copyError.message);
          }
        }
        
        results.push("✓ Page " + targetPageNum + ": " + copiedOnThisPage + " objects copied");
      }
      
      results.push("");
      results.push("Summary: " + totalCopied + " objects copied across " + targetPages.length + " target pages");
      
    } catch (mainError) {
      throw new Error("Copy objects failed: " + mainError.message);
    }
    
    results.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? result.result! : `Error copying objects: ${result.error}`
    }]
  };
}

async function handleCreateMasterPage(args: any): Promise<{ content: TextContent[] }> {
  const masterName = args.master_name || "New Master";
  const basedOn = args.based_on || "";
  const pageSize = args.page_size ? JSON.stringify(args.page_size) : "null";
  const margins = args.margins ? JSON.stringify(args.margins) : "null";
  
  const script = `
    if (!app.documents.length) {
      throw new Error("No document open");
    }
    
    var doc = app.activeDocument;
    var masterName = "${masterName}";
    var basedOn = "${basedOn}";
    var pageSize = ${pageSize};
    var margins = ${margins};
    var result = [];
    
    try {
      // Check if master page name already exists
      for (var i = 0; i < doc.masterSpreads.length; i++) {
        if (doc.masterSpreads[i].namePrefix === masterName) {
          throw new Error("Master page with name '" + masterName + "' already exists");
        }
      }
      
      var newMaster;
      
      if (basedOn !== "" && basedOn !== null) {
        // Base on existing master
        var baseMaster = null;
        for (var j = 0; j < doc.masterSpreads.length; j++) {
          if (doc.masterSpreads[j].namePrefix === basedOn) {
            baseMaster = doc.masterSpreads[j];
            break;
          }
        }
        
        if (baseMaster) {
          newMaster = doc.masterSpreads.add(1, baseMaster);
          result.push("✓ Created master page '" + masterName + "' based on '" + basedOn + "'");
        } else {
          throw new Error("Base master page '" + basedOn + "' not found");
        }
      } else {
        // Create from scratch
        newMaster = doc.masterSpreads.add();
        result.push("✓ Created new master page '" + masterName + "' from scratch");
      }
      
      // Set the name
      newMaster.namePrefix = masterName;
      
      // Apply custom page size if specified
      if (pageSize !== null) {
        for (var k = 0; k < newMaster.pages.length; k++) {
          var page = newMaster.pages[k];
          page.resize(
            CoordinateSpaces.INNER_COORDINATES,
            AnchorPoint.TOP_LEFT_ANCHOR,
            ResizeMethods.REPLACING_CURRENT_DIMENSIONS_WITH,
            [pageSize.width, pageSize.height]
          );
        }
        result.push("✓ Applied custom page size: " + pageSize.width + "x" + pageSize.height + " points");
      }
      
      // Apply custom margins if specified
      if (margins !== null) {
        for (var m = 0; m < newMaster.pages.length; m++) {
          var page = newMaster.pages[m];
          page.marginPreferences.top = margins.top;
          page.marginPreferences.left = margins.left;
          page.marginPreferences.bottom = margins.bottom;
          page.marginPreferences.right = margins.right;
        }
        result.push("✓ Applied custom margins: T:" + margins.top + " L:" + margins.left + " B:" + margins.bottom + " R:" + margins.right);
      }
      
      result.push("Master page created successfully with " + newMaster.pages.length + " page(s)");
      
    } catch (e) {
      throw new Error("Failed to create master page: " + e.message);
    }
    
    result.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? result.result! : `Error creating master page: ${result.error}`
    }]
  };
}

async function handleApplyMasterToPages(args: any): Promise<{ content: TextContent[] }> {
  const masterName = args.master_name || "";
  const pageRange = args.page_range || "all";
  const overrideExisting = args.override_existing || false;
  
  const script = `
    if (!app.documents.length) {
      throw new Error("No document open");
    }
    
    var doc = app.activeDocument;
    var masterName = "${masterName}";
    var pageRange = "${pageRange}";
    var overrideExisting = ${overrideExisting};
    var result = [];
    var applied = 0;
    var skipped = 0;
    
    try {
      // Find the master page
      var targetMaster = null;
      for (var i = 0; i < doc.masterSpreads.length; i++) {
        if (doc.masterSpreads[i].namePrefix === masterName) {
          targetMaster = doc.masterSpreads[i];
          break;
        }
      }
      
      if (!targetMaster) {
        throw new Error("Master page '" + masterName + "' not found");
      }
      
      // Parse page range
      var pagesToApply = [];
      
      if (pageRange === "all") {
        for (var j = 0; j < doc.pages.length; j++) {
          pagesToApply.push(j + 1);
        }
      } else {
        // Parse ranges like "1-5,7,9-12"
        var ranges = pageRange.split(",");
        for (var r = 0; r < ranges.length; r++) {
          var range = ranges[r].replace(/\\s/g, "");
          if (range.indexOf("-") !== -1) {
            var parts = range.split("-");
            var start = parseInt(parts[0]);
            var end = parseInt(parts[1]);
            for (var p = start; p <= end; p++) {
              if (p > 0 && p <= doc.pages.length) {
                pagesToApply.push(p);
              }
            }
          } else {
            var pageNum = parseInt(range);
            if (pageNum > 0 && pageNum <= doc.pages.length) {
              pagesToApply.push(pageNum);
            }
          }
        }
      }
      
      // Apply master to pages
      for (var k = 0; k < pagesToApply.length; k++) {
        var pageNum = pagesToApply[k];
        var page = doc.pages[pageNum - 1];
        
        // Check if page already has a master applied
        if (!overrideExisting && page.appliedMaster !== doc.masterSpreads[0]) {
          result.push("⚠ Page " + pageNum + ": skipped (already has master '" + page.appliedMaster.namePrefix + "')");
          skipped++;
          continue;
        }
        
        try {
          page.appliedMaster = targetMaster;
          result.push("✓ Page " + pageNum + ": applied master '" + masterName + "'");
          applied++;
        } catch (applyError) {
          result.push("✗ Page " + pageNum + ": failed to apply master (" + applyError.message + ")");
        }
      }
      
      result.push("");
      result.push("Summary: Applied master to " + applied + " pages, skipped " + skipped + " pages");
      
    } catch (e) {
      throw new Error("Failed to apply master pages: " + e.message);
    }
    
    result.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? result.result! : `Error applying master to pages: ${result.error}`
    }]
  };
}

async function handleModifyMasterPageElements(args: any): Promise<{ content: TextContent[] }> {
  const masterName = args.master_name || "";
  const operation = args.operation || "add_text";
  const elementData = args.element_data ? JSON.stringify(args.element_data) : "{}";
  
  const script = `
    if (!app.documents.length) {
      throw new Error("No document open");
    }
    
    var doc = app.activeDocument;
    var masterName = "${masterName}";
    var operation = "${operation}";
    var elementData = ${elementData};
    var result = [];
    
    try {
      // Find the master page
      var targetMaster = null;
      for (var i = 0; i < doc.masterSpreads.length; i++) {
        if (doc.masterSpreads[i].namePrefix === masterName) {
          targetMaster = doc.masterSpreads[i];
          break;
        }
      }
      
      if (!targetMaster) {
        throw new Error("Master page '" + masterName + "' not found");
      }
      
      // Get the first page of the master spread for element operations
      var masterPage = targetMaster.pages[0];
      
      if (operation === "add_text") {
        if (!elementData.x || !elementData.y || !elementData.width || !elementData.height) {
          throw new Error("Text element requires x, y, width, and height properties");
        }
        
        var textFrame = masterPage.textFrames.add();
        textFrame.geometricBounds = [
          elementData.y,
          elementData.x,
          elementData.y + elementData.height,
          elementData.x + elementData.width
        ];
        
        if (elementData.content) {
          textFrame.contents = elementData.content;
        }
        
        if (elementData.style_name) {
          // Apply paragraph style if it exists
          for (var s = 0; s < doc.paragraphStyles.length; s++) {
            if (doc.paragraphStyles[s].name === elementData.style_name) {
              textFrame.paragraphs[0].appliedParagraphStyle = doc.paragraphStyles[s];
              break;
            }
          }
        }
        
        result.push("✓ Added text frame at (" + elementData.x + "," + elementData.y + ") size " + elementData.width + "x" + elementData.height);
        
      } else if (operation === "add_image_placeholder") {
        if (!elementData.x || !elementData.y || !elementData.width || !elementData.height) {
          throw new Error("Image placeholder requires x, y, width, and height properties");
        }
        
        var rectangle = masterPage.rectangles.add();
        rectangle.geometricBounds = [
          elementData.y,
          elementData.x,
          elementData.y + elementData.height,
          elementData.x + elementData.width
        ];
        
        // Make it an image placeholder by setting fill to None and adding a stroke
        rectangle.fillColor = doc.swatches.itemByName("[None]");
        rectangle.strokeColor = doc.swatches.itemByName("[Black]");
        rectangle.strokeWeight = 1;
        
        result.push("✓ Added image placeholder at (" + elementData.x + "," + elementData.y + ") size " + elementData.width + "x" + elementData.height);
        
      } else if (operation === "add_rectangle") {
        if (!elementData.x || !elementData.y || !elementData.width || !elementData.height) {
          throw new Error("Rectangle requires x, y, width, and height properties");
        }
        
        var rectangle = masterPage.rectangles.add();
        rectangle.geometricBounds = [
          elementData.y,
          elementData.x,
          elementData.y + elementData.height,
          elementData.x + elementData.width
        ];
        
        result.push("✓ Added rectangle at (" + elementData.x + "," + elementData.y + ") size " + elementData.width + "x" + elementData.height);
        
      } else if (operation === "remove_element") {
        if (elementData.element_index === undefined) {
          throw new Error("Remove operation requires element_index");
        }
        
        var allItems = masterPage.allPageItems;
        if (elementData.element_index >= allItems.length) {
          throw new Error("Element index " + elementData.element_index + " out of range (0-" + (allItems.length - 1) + ")");
        }
        
        var elementToRemove = allItems[elementData.element_index];
        var elementType = "unknown";
        
        // Determine element type for better feedback
        if (elementToRemove.hasOwnProperty('contents')) {
          elementType = "text frame";
        } else if (elementToRemove.constructor.name) {
          elementType = elementToRemove.constructor.name.toLowerCase();
        }
        
        elementToRemove.remove();
        result.push("✓ Removed " + elementType + " at index " + elementData.element_index);
        
      } else {
        throw new Error("Unsupported operation: " + operation);
      }
      
      result.push("Master page '" + masterName + "' modified successfully");
      
    } catch (e) {
      throw new Error("Failed to modify master page: " + e.message);
    }
    
    result.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? result.result! : `Error modifying master page: ${result.error}`
    }]
  };
}

async function handleApplyOperationToAllPages(args: any): Promise<{ content: TextContent[] }> {
  const operation = args.operation || "apply_style";
  const targetCriteria = args.target_criteria ? JSON.stringify(args.target_criteria) : "{}";
  const operationData = args.operation_data ? JSON.stringify(args.operation_data) : "{}";
  const pageRange = args.page_range || "all";
  
  const script = `
    if (!app.documents.length) {
      throw new Error("No document open");
    }
    
    var doc = app.activeDocument;
    var operation = "${operation}";
    var targetCriteria = ${targetCriteria};
    var operationData = ${operationData};
    var pageRange = "${pageRange}";
    var result = [];
    var totalProcessed = 0;
    var totalPages = 0;
    
    try {
      // Parse page range
      var pagesToProcess = [];
      if (pageRange === "all") {
        for (var i = 0; i < doc.pages.length; i++) {
          pagesToProcess.push(i);
        }
      } else {
        var ranges = pageRange.split(",");
        for (var r = 0; r < ranges.length; r++) {
          var range = ranges[r].replace(/\\s/g, "");
          if (range.indexOf("-") !== -1) {
            var parts = range.split("-");
            var start = parseInt(parts[0]) - 1;
            var end = parseInt(parts[1]) - 1;
            for (var p = start; p <= end && p < doc.pages.length; p++) {
              if (p >= 0) pagesToProcess.push(p);
            }
          } else {
            var pageNum = parseInt(range) - 1;
            if (pageNum >= 0 && pageNum < doc.pages.length) {
              pagesToProcess.push(pageNum);
            }
          }
        }
      }
      
      // Process each page
      for (var pageIdx = 0; pageIdx < pagesToProcess.length; pageIdx++) {
        var page = doc.pages[pagesToProcess[pageIdx]];
        var pageNum = pagesToProcess[pageIdx] + 1;
        var pageProcessed = 0;
        
        // Get all items on the page
        var allItems = page.allPageItems;
        
        for (var i = 0; i < allItems.length; i++) {
          var item = allItems[i];
          
          try {
            // Check if item matches criteria
            if (!matchesCriteria(item, targetCriteria)) {
              continue;
            }
            
            // Apply the operation
            var operationResult = applyOperation(item, operation, operationData, doc);
            if (operationResult.success) {
              pageProcessed++;
              totalProcessed++;
            }
            
          } catch (itemError) {
            // Skip items that can't be processed
          }
        }
        
        if (pageProcessed > 0) {
          result.push("✓ Page " + pageNum + ": " + pageProcessed + " objects processed");
          totalPages++;
        }
      }
      
      result.push("");
      result.push("Summary: Processed " + totalProcessed + " objects across " + totalPages + " pages");
      
    } catch (e) {
      throw new Error("Bulk operation failed: " + e.message);
    }
    
    // Helper function to check if item matches criteria
    function matchesCriteria(item, criteria) {
      try {
        // Object type filtering
        if (criteria.object_type && criteria.object_type !== "all") {
          var itemType = getItemType(item);
          if (criteria.object_type === "text_frames" && itemType !== "TextFrame") return false;
          if (criteria.object_type === "rectangles" && itemType !== "Rectangle") return false;
          if (criteria.object_type === "images" && itemType !== "ImageFrame") return false;
          if (criteria.object_type === "groups" && itemType !== "Group") return false;
        }
        
        // Layer filtering
        if (criteria.layer_name && criteria.layer_name !== "") {
          if (!item.itemLayer || item.itemLayer.name !== criteria.layer_name) {
            return false;
          }
        }
        
        // Content filtering
        if (criteria.has_content !== undefined) {
          var hasContent = false;
          if (item.hasOwnProperty('contents')) {
            hasContent = item.contents !== "";
          }
          if (criteria.has_content !== hasContent) {
            return false;
          }
        }
        
        return true;
      } catch (e) {
        return false;
      }
    }
    
    // Helper function to apply operation
    function applyOperation(item, operation, data, doc) {
      try {
        if (operation === "apply_style" && data.style_to_apply) {
          if (item.hasOwnProperty('contents') && item.paragraphs.length > 0) {
            for (var s = 0; s < doc.paragraphStyles.length; s++) {
              if (doc.paragraphStyles[s].name === data.style_to_apply) {
                item.paragraphs[0].appliedParagraphStyle = doc.paragraphStyles[s];
                return { success: true };
              }
            }
          }
        } else if (operation === "apply_object_style" && data.object_style_to_apply) {
          for (var os = 0; os < doc.objectStyles.length; os++) {
            if (doc.objectStyles[os].name === data.object_style_to_apply) {
              if (item.hasOwnProperty('appliedObjectStyle')) {
                item.appliedObjectStyle = doc.objectStyles[os];
                return { success: true };
              }
            }
          }
        } else if (operation === "resize_objects" && data.resize_factor) {
          var bounds = item.geometricBounds;
          var centerX = (bounds[1] + bounds[3]) / 2;
          var centerY = (bounds[0] + bounds[2]) / 2;
          var newWidth = (bounds[3] - bounds[1]) * data.resize_factor;
          var newHeight = (bounds[2] - bounds[0]) * data.resize_factor;
          
          item.geometricBounds = [
            centerY - newHeight / 2,
            centerX - newWidth / 2,
            centerY + newHeight / 2,
            centerX + newWidth / 2
          ];
          return { success: true };
        } else if (operation === "reposition_objects" && data.position_offset) {
          var bounds = item.geometricBounds;
          item.geometricBounds = [
            bounds[0] + data.position_offset.y,
            bounds[1] + data.position_offset.x,
            bounds[2] + data.position_offset.y,
            bounds[3] + data.position_offset.x
          ];
          return { success: true };
        } else if (operation === "change_layer" && data.target_layer) {
          for (var l = 0; l < doc.layers.length; l++) {
            if (doc.layers[l].name === data.target_layer) {
              item.itemLayer = doc.layers[l];
              return { success: true };
            }
          }
        }
        
        return { success: false };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    
    // Helper function to determine item type
    function getItemType(item) {
      try {
        if (item.hasOwnProperty('contents')) return "TextFrame";
        if (item.hasOwnProperty('images') && item.images.length > 0) return "ImageFrame";
        if (item.hasOwnProperty('groupItems')) return "Group";
        if (item.constructor.name) return item.constructor.name;
        return "Unknown";
      } catch (e) {
        return "Unknown";
      }
    }
    
    result.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? result.result! : `Error applying bulk operation: ${result.error}`
    }]
  };
}

async function handleSelectObjectsByCriteria(args: any): Promise<{ content: TextContent[] }> {
  const criteria = args.criteria ? JSON.stringify(args.criteria) : "{}";
  const pageRange = args.page_range || "all";
  const selectObjects = args.select_objects !== false;
  
  const script = `
    if (!app.documents.length) {
      throw new Error("No document open");
    }
    
    var doc = app.activeDocument;
    var criteria = ${criteria};
    var pageRange = "${pageRange}";
    var selectObjects = ${selectObjects};
    var result = [];
    var matchingObjects = [];
    var totalMatches = 0;
    
    try {
      // Parse page range
      var pagesToProcess = [];
      if (pageRange === "all") {
        for (var i = 0; i < doc.pages.length; i++) {
          pagesToProcess.push(i);
        }
      } else {
        var ranges = pageRange.split(",");
        for (var r = 0; r < ranges.length; r++) {
          var range = ranges[r].replace(/\\s/g, "");
          if (range.indexOf("-") !== -1) {
            var parts = range.split("-");
            var start = parseInt(parts[0]) - 1;
            var end = parseInt(parts[1]) - 1;
            for (var p = start; p <= end && p < doc.pages.length; p++) {
              if (p >= 0) pagesToProcess.push(p);
            }
          } else {
            var pageNum = parseInt(range) - 1;
            if (pageNum >= 0 && pageNum < doc.pages.length) {
              pagesToProcess.push(pageNum);
            }
          }
        }
      }
      
      // Search through pages
      for (var pageIdx = 0; pageIdx < pagesToProcess.length; pageIdx++) {
        var page = doc.pages[pagesToProcess[pageIdx]];
        var pageNum = pagesToProcess[pageIdx] + 1;
        var pageMatches = 0;
        
        var allItems = page.allPageItems;
        
        for (var i = 0; i < allItems.length; i++) {
          var item = allItems[i];
          
          try {
            if (matchesCriteria(item, criteria)) {
              matchingObjects.push(item);
              pageMatches++;
              totalMatches++;
            }
          } catch (itemError) {
            // Skip items that can't be evaluated
          }
        }
        
        if (pageMatches > 0) {
          result.push("✓ Page " + pageNum + ": " + pageMatches + " objects match criteria");
        }
      }
      
      // Select the objects if requested
      if (selectObjects && matchingObjects.length > 0) {
        app.selection = matchingObjects;
        result.push("");
        result.push("✓ Selected " + matchingObjects.length + " matching objects in InDesign");
      }
      
      result.push("");
      result.push("Summary: Found " + totalMatches + " objects matching criteria");
      
    } catch (e) {
      throw new Error("Object selection failed: " + e.message);
    }
    
    // Helper function to check if item matches criteria
    function matchesCriteria(item, criteria) {
      try {
        // Object type filtering
        if (criteria.object_type && criteria.object_type !== "all") {
          var itemType = getItemType(item);
          if (criteria.object_type === "text_frames" && itemType !== "TextFrame") return false;
          if (criteria.object_type === "rectangles" && itemType !== "Rectangle") return false;
          if (criteria.object_type === "images" && itemType !== "ImageFrame") return false;
          if (criteria.object_type === "groups" && itemType !== "Group") return false;
          if (criteria.object_type === "lines" && itemType !== "GraphicLine") return false;
        }
        
        // Layer filtering
        if (criteria.layer_name && criteria.layer_name !== "") {
          if (!item.itemLayer || item.itemLayer.name !== criteria.layer_name) {
            return false;
          }
        }
        
        // Content filtering
        if (criteria.has_content !== undefined) {
          var hasContent = false;
          if (item.hasOwnProperty('contents')) {
            hasContent = item.contents !== "";
          }
          if (criteria.has_content !== hasContent) {
            return false;
          }
        }
        
        // Size filtering
        if (criteria.size_range) {
          var bounds = item.geometricBounds;
          var width = bounds[3] - bounds[1];
          var height = bounds[2] - bounds[0];
          
          if (criteria.size_range.min_width && width < criteria.size_range.min_width) return false;
          if (criteria.size_range.max_width && width > criteria.size_range.max_width) return false;
          if (criteria.size_range.min_height && height < criteria.size_range.min_height) return false;
          if (criteria.size_range.max_height && height > criteria.size_range.max_height) return false;
        }
        
        // Position filtering
        if (criteria.position_range) {
          var bounds = item.geometricBounds;
          var x = bounds[1];
          var y = bounds[0];
          
          if (criteria.position_range.min_x && x < criteria.position_range.min_x) return false;
          if (criteria.position_range.max_x && x > criteria.position_range.max_x) return false;
          if (criteria.position_range.min_y && y < criteria.position_range.min_y) return false;
          if (criteria.position_range.max_y && y > criteria.position_range.max_y) return false;
        }
        
        return true;
      } catch (e) {
        return false;
      }
    }
    
    // Helper function to determine item type
    function getItemType(item) {
      try {
        if (item.hasOwnProperty('contents')) return "TextFrame";
        if (item.hasOwnProperty('images') && item.images.length > 0) return "ImageFrame";
        if (item.hasOwnProperty('groupItems')) return "Group";
        if (item.constructor.name) return item.constructor.name;
        return "Unknown";
      } catch (e) {
        return "Unknown";
      }
    }
    
    result.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? result.result! : `Error selecting objects by criteria: ${result.error}`
    }]
  };
}

async function handleBatchApplyStyles(args: any): Promise<{ content: TextContent[] }> {
  const styleMappings = args.style_mappings ? JSON.stringify(args.style_mappings) : "[]";
  const pageRange = args.page_range || "all";
  const previewMode = args.preview_mode || false;
  
  const script = `
    if (!app.documents.length) {
      throw new Error("No document open");
    }
    
    var doc = app.activeDocument;
    var styleMappings = ${styleMappings};
    var pageRange = "${pageRange}";
    var previewMode = ${previewMode};
    var result = [];
    var totalChanges = 0;
    var totalPages = 0;
    
    try {
      // Parse page range
      var pagesToProcess = [];
      if (pageRange === "all") {
        for (var i = 0; i < doc.pages.length; i++) {
          pagesToProcess.push(i);
        }
      } else {
        var ranges = pageRange.split(",");
        for (var r = 0; r < ranges.length; r++) {
          var range = ranges[r].replace(/\\s/g, "");
          if (range.indexOf("-") !== -1) {
            var parts = range.split("-");
            var start = parseInt(parts[0]) - 1;
            var end = parseInt(parts[1]) - 1;
            for (var p = start; p <= end && p < doc.pages.length; p++) {
              if (p >= 0) pagesToProcess.push(p);
            }
          } else {
            var pageNum = parseInt(range) - 1;
            if (pageNum >= 0 && pageNum < doc.pages.length) {
              pagesToProcess.push(pageNum);
            }
          }
        }
      }
      
      if (previewMode) {
        result.push("PREVIEW MODE - No changes will be applied");
        result.push("");
      }
      
      // Process each style mapping
      for (var m = 0; m < styleMappings.length; m++) {
        var mapping = styleMappings[m];
        var mappingChanges = 0;
        
        result.push("Processing mapping " + (m + 1) + ": Apply '" + mapping.new_style + "' (" + mapping.style_type + ")");
        
        // Process each page
        for (var pageIdx = 0; pageIdx < pagesToProcess.length; pageIdx++) {
          var page = doc.pages[pagesToProcess[pageIdx]];
          var pageChanges = 0;
          
          // Apply mapping based on target criteria
          if (mapping.target_criteria.object_type === "text_frames") {
            pageChanges += applyToTextFrames(page, mapping, doc, previewMode);
          } else if (mapping.target_criteria.object_type === "paragraphs") {
            pageChanges += applyToParagraphs(page, mapping, doc, previewMode);
          } else if (mapping.target_criteria.object_type === "characters") {
            pageChanges += applyToCharacters(page, mapping, doc, previewMode);
          } else if (mapping.target_criteria.object_type === "objects") {
            pageChanges += applyToObjects(page, mapping, doc, previewMode);
          }
          
          mappingChanges += pageChanges;
        }
        
        result.push("  → " + mappingChanges + " items affected");
        totalChanges += mappingChanges;
      }
      
      result.push("");
      if (previewMode) {
        result.push("Preview Summary: " + totalChanges + " items would be changed");
      } else {
        result.push("Summary: " + totalChanges + " style changes applied");
      }
      
    } catch (e) {
      throw new Error("Batch style application failed: " + e.message);
    }
    
    // Helper functions for different object types
    function applyToTextFrames(page, mapping, doc, preview) {
      var changes = 0;
      for (var i = 0; i < page.textFrames.length; i++) {
        var frame = page.textFrames[i];
        
        if (matchesTextFrameCriteria(frame, mapping.target_criteria)) {
          if (!preview && mapping.style_type === "paragraph") {
            var style = findParagraphStyle(doc, mapping.new_style);
            if (style && frame.paragraphs.length > 0) {
              frame.paragraphs[0].appliedParagraphStyle = style;
              changes++;
            }
          } else if (!preview && mapping.style_type === "object") {
            var objStyle = findObjectStyle(doc, mapping.new_style);
            if (objStyle && frame.hasOwnProperty('appliedObjectStyle')) {
              frame.appliedObjectStyle = objStyle;
              changes++;
            }
          } else if (preview) {
            changes++;
          }
        }
      }
      return changes;
    }
    
    function applyToParagraphs(page, mapping, doc, preview) {
      var changes = 0;
      for (var i = 0; i < page.textFrames.length; i++) {
        var frame = page.textFrames[i];
        for (var p = 0; p < frame.paragraphs.length; p++) {
          var paragraph = frame.paragraphs[p];
          
          if (matchesParagraphCriteria(paragraph, mapping.target_criteria)) {
            if (!preview && mapping.style_type === "paragraph") {
              var style = findParagraphStyle(doc, mapping.new_style);
              if (style) {
                paragraph.appliedParagraphStyle = style;
                changes++;
              }
            } else if (preview) {
              changes++;
            }
          }
        }
      }
      return changes;
    }
    
    function applyToCharacters(page, mapping, doc, preview) {
      var changes = 0;
      for (var i = 0; i < page.textFrames.length; i++) {
        var frame = page.textFrames[i];
        for (var c = 0; c < frame.characters.length; c++) {
          var character = frame.characters[c];
          
          if (matchesCharacterCriteria(character, mapping.target_criteria)) {
            if (!preview && mapping.style_type === "character") {
              var style = findCharacterStyle(doc, mapping.new_style);
              if (style) {
                character.appliedCharacterStyle = style;
                changes++;
              }
            } else if (preview) {
              changes++;
            }
          }
        }
      }
      return changes;
    }
    
    function applyToObjects(page, mapping, doc, preview) {
      var changes = 0;
      var allItems = page.allPageItems;
      
      for (var i = 0; i < allItems.length; i++) {
        var item = allItems[i];
        
        if (matchesObjectCriteria(item, mapping.target_criteria)) {
          if (!preview && mapping.style_type === "object") {
            var style = findObjectStyle(doc, mapping.new_style);
            if (style && item.hasOwnProperty('appliedObjectStyle')) {
              item.appliedObjectStyle = style;
              changes++;
            }
          } else if (preview) {
            changes++;
          }
        }
      }
      return changes;
    }
    
    // Helper functions to find styles
    function findParagraphStyle(doc, styleName) {
      for (var i = 0; i < doc.paragraphStyles.length; i++) {
        if (doc.paragraphStyles[i].name === styleName) {
          return doc.paragraphStyles[i];
        }
      }
      return null;
    }
    
    function findCharacterStyle(doc, styleName) {
      for (var i = 0; i < doc.characterStyles.length; i++) {
        if (doc.characterStyles[i].name === styleName) {
          return doc.characterStyles[i];
        }
      }
      return null;
    }
    
    function findObjectStyle(doc, styleName) {
      for (var i = 0; i < doc.objectStyles.length; i++) {
        if (doc.objectStyles[i].name === styleName) {
          return doc.objectStyles[i];
        }
      }
      return null;
    }
    
    // Criteria matching functions
    function matchesTextFrameCriteria(frame, criteria) {
      if (criteria.layer_name && (!frame.itemLayer || frame.itemLayer.name !== criteria.layer_name)) {
        return false;
      }
      if (criteria.content_match && frame.contents.indexOf(criteria.content_match) === -1) {
        return false;
      }
      return true;
    }
    
    function matchesParagraphCriteria(paragraph, criteria) {
      if (criteria.current_style) {
        if (!paragraph.appliedParagraphStyle || paragraph.appliedParagraphStyle.name !== criteria.current_style) {
          return false;
        }
      }
      if (criteria.content_match && paragraph.contents.indexOf(criteria.content_match) === -1) {
        return false;
      }
      return true;
    }
    
    function matchesCharacterCriteria(character, criteria) {
      if (criteria.current_style) {
        if (!character.appliedCharacterStyle || character.appliedCharacterStyle.name !== criteria.current_style) {
          return false;
        }
      }
      if (criteria.content_match && character.contents.indexOf(criteria.content_match) === -1) {
        return false;
      }
      return true;
    }
    
    function matchesObjectCriteria(item, criteria) {
      if (criteria.layer_name && (!item.itemLayer || item.itemLayer.name !== criteria.layer_name)) {
        return false;
      }
      if (criteria.current_style) {
        if (!item.appliedObjectStyle || item.appliedObjectStyle.name !== criteria.current_style) {
          return false;
        }
      }
      return true;
    }
    
    result.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? result.result! : `Error applying batch styles: ${result.error}`
    }]
  };
}

async function handleDataMergeSetup(args: any): Promise<{ content: TextContent[] }> {
  const { csv_path, field_mappings, auto_create_records = true, preview_record = 1 } = args;
  
  const csvPath = escapeExtendScriptString(csv_path);
  const mappingsJson = JSON.stringify(field_mappings);
  
  const script = `
    // JSON2 polyfill for ExtendScript
    if (typeof JSON === 'undefined') {
      var JSON = {
        parse: function(text) {
          return eval('(' + text + ')');
        },
        stringify: function(value) {
          if (typeof value === 'string') return '"' + value + '"';
          if (typeof value === 'number') return value.toString();
          if (typeof value === 'boolean') return value.toString();
          if (value === null) return 'null';
          if (value instanceof Array) {
            var result = [];
            for (var i = 0; i < value.length; i++) {
              result.push(JSON.stringify(value[i]));
            }
            return '[' + result.join(',') + ']';
          }
          if (typeof value === 'object') {
            var result = [];
            for (var key in value) {
              result.push('"' + key + '":' + JSON.stringify(value[key]));
            }
            return '{' + result.join(',') + '}';
          }
          return 'null';
        }
      };
    }
    
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    var results = [];
    var errors = [];
    var csvData = [];
    var fieldMappings = ${mappingsJson};
    var recordsCreated = 0;
    var textFramesCreated = 0;
    
    try {
      // Read CSV file
      results.push("=== READING CSV FILE ===");
      var csvFile = File("${csvPath}");
      if (!csvFile.exists) {
        throw new Error("CSV file not found: ${csvPath}");
      }
      
      csvFile.open('r');
      var csvContent = csvFile.read();
      csvFile.close();
      
      if (!csvContent || csvContent.length === 0) {
        throw new Error("CSV file is empty or could not be read");
      }
      
      // Parse CSV content
      var lines = csvContent.split('\\\\n');
      if (lines.length < 2) {
        throw new Error("CSV file must have at least a header row and one data row");
      }
      
      // Parse header
      var headers = [];
      var headerLine = lines[0];
      var inQuotes = false;
      var currentField = "";
      var chars = headerLine.split('');
      
      for (var c = 0; c < chars.length; c++) {
        var char = chars[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          headers.push(currentField.replace(/^"|"$/g, ''));
          currentField = "";
        } else {
          currentField += char;
        }
      }
      if (currentField) {
        headers.push(currentField.replace(/^"|"$/g, ''));
      }
      
      results.push("CSV headers found: " + headers.join(", "));
      
      // Parse data rows
      for (var r = 1; r < lines.length; r++) {
        if (lines[r].trim() === "") continue;
        
        var values = [];
        var dataLine = lines[r];
        inQuotes = false;
        currentField = "";
        chars = dataLine.split('');
        
        for (var c = 0; c < chars.length; c++) {
          var char = chars[c];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentField.replace(/^"|"$/g, ''));
            currentField = "";
          } else {
            currentField += char;
          }
        }
        if (currentField) {
          values.push(currentField.replace(/^"|"$/g, ''));
        }
        
        var record = {};
        for (var h = 0; h < headers.length; h++) {
          record[headers[h]] = values[h] || "";
        }
        csvData.push(record);
      }
      
      results.push("Records parsed: " + csvData.length);
      
      // Validate field mappings
      results.push("");
      results.push("=== VALIDATING FIELD MAPPINGS ===");
      for (var m = 0; m < fieldMappings.length; m++) {
        var mapping = fieldMappings[m];
        var columnExists = false;
        for (var h = 0; h < headers.length; h++) {
          if (headers[h] === mapping.csv_column) {
            columnExists = true;
            break;
          }
        }
        if (!columnExists) {
          errors.push("CSV column '" + mapping.csv_column + "' not found in headers");
        } else {
          results.push("✓ Column '" + mapping.csv_column + "' found");
        }
      }
      
      if (errors.length > 0) {
        throw new Error("Field mapping validation failed: " + errors.join("; "));
      }
      
      // Create/verify text frames
      results.push("");
      results.push("=== CREATING/VERIFYING TEXT FRAMES ===");
      for (var m = 0; m < fieldMappings.length; m++) {
        var mapping = fieldMappings[m];
        var targetFrames = mapping.target_frames;
        
        for (var t = 0; t < targetFrames.length; t++) {
          var target = targetFrames[t];
          var pageNum = target.page;
          var frameIndex = target.frame_index;
          
          if (pageNum > doc.pages.length) {
            errors.push("Page " + pageNum + " does not exist (document has " + doc.pages.length + " pages)");
            continue;
          }
          
          var page = doc.pages[pageNum - 1];
          
          // Check if text frame exists at the specified index
          if (frameIndex >= page.textFrames.length) {
            // Create new text frame at default position
            try {
              var bounds = [100, 100, 200, 300]; // Default bounds: [y1, x1, y2, x2]
              var newFrame = page.textFrames.add();
              newFrame.geometricBounds = bounds;
              newFrame.contents = "<<" + mapping.csv_column + ">>";
              textFramesCreated++;
              results.push("✓ Created text frame for '" + mapping.csv_column + "' on page " + pageNum);
            } catch (e) {
              errors.push("Failed to create text frame on page " + pageNum + ": " + e.message);
            }
          } else {
            // Frame exists, add placeholder text
            var frame = page.textFrames[frameIndex];
            frame.contents = "<<" + mapping.csv_column + ">>";
            results.push("✓ Updated existing frame for '" + mapping.csv_column + "' on page " + pageNum);
          }
        }
      }
      
      // Set up Data Merge panel (simplified approach - set placeholder text)
      results.push("");
      results.push("=== DATA MERGE SETUP ===");
      results.push("Text frames configured with Data Merge placeholders");
      results.push("Manual step required: Open Window > Utilities > Data Merge");
      results.push("Select data source: ${csvPath}");
      results.push("Preview configured for record ${preview_record}");
      
      // Show preview of first record
      if (csvData.length > 0 && ${preview_record} <= csvData.length) {
        var previewIndex = ${preview_record} - 1;
        var previewRecord = csvData[previewIndex];
        results.push("");
        results.push("=== PREVIEW RECORD " + ${preview_record} + " ===");
        for (var key in previewRecord) {
          results.push(key + ": " + previewRecord[key]);
        }
      }
      
    } catch (mainError) {
      throw new Error("Data merge setup failed: " + mainError.message);
    }
    
    var output = [];
    output = output.concat(results);
    
    if (errors.length > 0) {
      output.push("");
      output.push("=== ERRORS ===");
      output = output.concat(errors);
    }
    
    output.push("");
    output.push("=== SUMMARY ===");
    output.push("Records found: " + csvData.length);
    output.push("Fields mapped: " + fieldMappings.length);
    output.push("Text frames created: " + textFramesCreated);
    output.push("Status: " + (errors.length === 0 ? "SUCCESS" : "COMPLETED WITH ERRORS"));
    
    output.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? result.result! : `Error setting up data merge: ${result.error}`
    }]
  };
}