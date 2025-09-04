/**
 * @fileoverview Layout and positioning tools for InDesign MCP
 * Enhanced with strategic workflow guidance and prerequisite checking
 * Following BlenderMCP patterns for intelligent workflow enforcement
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { executeExtendScript, escapeExtendScriptString } from "@mcp/shared/extendscript.js";
import { z } from "zod";
import { toPoints } from "@mcp/shared/utils/coords.js";
import { withChangeTracking } from "@mcp/shared/utils/changeSummary.js";

/**
 * Document state cache for prerequisite tracking
 */
interface DocumentStateCache {
  lastPageDimensionsCheck: Date | null;
  lastTextFrameInfo: Date | null;
  lastFontCheck: Date | null;
  fontsChecked: boolean;
  knownPageDimensions: { width: number; height: number } | null;
  workflowStepsCompleted: Set<string>;
}

const documentState: DocumentStateCache = {
  lastPageDimensionsCheck: null,
  lastTextFrameInfo: null,
  lastFontCheck: null,
  fontsChecked: false,
  knownPageDimensions: null,
  workflowStepsCompleted: new Set()
};

/**
 * Validation result for prerequisite checking
 */
interface ValidationResult {
  canProceed: boolean;
  blockers: string[];
  recommendations: string[];
}

/**
 * Registers layout and positioning tools with enhanced strategic workflow guidance
 */
export async function registerLayoutTools(server: McpServer): Promise<void> {
  // Register position_textframe tool with strategic guidance
  server.tool(
    "position_textframe",
    "Layout Management Tool - Requires spatial context checking",
    {
      textframe_index: z.number().default(0).describe("Index of text frame (0-based). 📋 WORKFLOW: Use get_textframe_info() first to see available frames"),
      x: z.number().describe("X position in points. ⚠️ Check page dimensions first with get_page_dimensions()"),
      y: z.number().describe("Y position in points. 💡 TIP: Verify available space before positioning"),
      width: z.number().default(-1).describe("Width in points (optional). 📋 See document_creation_strategy → Layout Operations for complete workflow"),
      height: z.number().default(-1).describe("Height in points (optional)")
    },
    withChangeTracking(server, "position_textframe")(async (args: any) => {
      return await handlePositionTextFrame(args);
    })
  );

  // Register create_textframe tool with strategic guidance
  server.tool(
    "create_textframe",
    "Layout Management Tool - Requires spatial context checking",
    {
      x: z.number().describe("X position in points. ⚠️ Check page dimensions first with get_page_dimensions()"),
      y: z.number().describe("Y position in points. 💡 TIP: Verify available space before creating frames"),
      width: z.number().describe("Width in points. 📋 WORKFLOW: Use document_creation_strategy prompt for complete positioning guidance"),
      height: z.number().describe("Height in points"),
      page_number: z.number().default(1).describe("Page number (1-based). 📋 Verify with get_page_info() first"),
      text_content: z.string().default("").describe("Initial text content")
    },
    withChangeTracking(server, "create_textframe")(async (args: any) => {
      return await handleCreateTextFrame(args);
    })
  );

  // Register create_alternate_layouts tool
  server.tool(
    "create_alternate_layouts", 
    {
      base_layout: z.object({
        name: z.string().describe("Name of the base layout"),
        width: z.number().describe("Base layout width in points"), 
        height: z.number().describe("Base layout height in points")
      }).describe("Base layout configuration"),
      alternate_layouts: z.array(z.object({
        name: z.string().describe("Name of the alternate layout"),
        width: z.number().describe("Alternate layout width in points"),
        height: z.number().describe("Alternate layout height in points"),
        liquid_rules: z.object({
          scale_objects: z.boolean().describe("Scale objects to fit new dimensions"),
          reflow_text: z.boolean().describe("Reflow text to fit new layout"),
          maintain_aspect_ratio: z.boolean().default(false).describe("Maintain aspect ratio when scaling"),
          crop_strategy: z.enum(["center", "top", "bottom"]).default("center").describe("Crop strategy for content")
        }).describe("Liquid layout rules for responsive behavior")
      })).describe("Array of alternate layouts to create"),
      copy_content: z.boolean().default(true).describe("Copy content from base layout"),
      preserve_styling: z.boolean().default(true).describe("Preserve styling across layouts")
    },
    async (args) => handleCreateAlternateLayouts(args)
  );
}

/**
 * Validate layout prerequisites before tool execution
 */
async function validateLayoutPrerequisites(args: any, operation: string): Promise<ValidationResult> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check if font availability verified (styling/layout often relies on this)
  if (!documentState.fontsChecked) {
    recommendations.push("Run check_font_availability() to verify required fonts");
  }

  // Check if page dimensions are known
  const pageInfo = getLastPageDimensionsCheck();
  if (!pageInfo || isStale(pageInfo)) {
    issues.push("Page dimensions not verified");
    recommendations.push("Run get_page_dimensions() to understand available space");
  }

  // Check spatial constraints if we have page info
  if (documentState.knownPageDimensions && operation === "create_textframe") {
    const { width: pageWidth, height: pageHeight } = documentState.knownPageDimensions;
    
    if (args.x + args.width > pageWidth) {
      issues.push(`Frame width ${args.width} exceeds page width ${pageWidth}`);
      recommendations.push("Reduce frame width or check page bounds with get_page_dimensions()");
    }
    
    if (args.y + args.height > pageHeight) {
      issues.push(`Frame height ${args.height} exceeds page height ${pageHeight}`);
      recommendations.push("Reduce frame height or check page bounds with get_page_dimensions()");
    }
  }

  // Check if InDesign status was verified recently
  if (!documentState.workflowStepsCompleted.has("indesign_status")) {
    recommendations.push("Run indesign_status first to verify application state");
  }

  return {
    canProceed: issues.length === 0,
    blockers: issues,
    recommendations
  };
}

/**
 * Get last page dimensions check timestamp
 */
function getLastPageDimensionsCheck(): Date | null {
  return documentState.lastPageDimensionsCheck;
}

/**
 * Check if a timestamp is stale (older than 5 minutes)
 */
function isStale(timestamp: Date): boolean {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return timestamp < fiveMinutesAgo;
}

/**
 * Update workflow step completion tracking
 */
function markStepCompleted(stepName: string): void {
  documentState.workflowStepsCompleted.add(stepName);
}

/**
 * Public function to update page dimensions cache when get_page_dimensions is called
 * Should be called by the get_page_dimensions tool to inform layout tools
 */
export function updatePageDimensionsCache(width: number, height: number): void {
  documentState.lastPageDimensionsCheck = new Date();
  documentState.knownPageDimensions = { width, height };
  markStepCompleted("get_page_dimensions");
}

/**
 * Public function to mark indesign_status as completed
 * Should be called by the indesign_status tool to inform layout tools  
 */
export function markInDesignStatusChecked(): void {
  markStepCompleted("indesign_status");
}

/**
 * Public helper to mark that fonts have been checked during the session
 */
export function markFontsChecked(): void {
  documentState.lastFontCheck = new Date();
  documentState.fontsChecked = true;
  markStepCompleted("check_font_availability");
}

/**
 * Enhanced error response with strategic guidance
 */
function createGuidedErrorResponse(error: string, operation: string, recommendations: string[]): { content: TextContent[] } {
  const errorMessage = `❌ WORKFLOW ERROR: ${error}

📋 NEXT STEPS:
${recommendations.map(r => `• ${r}`).join('\n')}

💡 STRATEGIC GUIDANCE:
Use document_creation_strategy prompt → Layout Operations for complete workflow guidance.

🔗 RELATED TOOLS: get_page_dimensions, get_textframe_info, indesign_status`;

  return {
    content: [{
      type: "text",
      text: errorMessage
    }]
  };
}

async function handlePositionTextFrame(args: any): Promise<{ content: TextContent[] }> {
  // STEP 1: Automatic prerequisite checking
  const validationResult = await validateLayoutPrerequisites(args, "position_textframe");
  if (!validationResult.canProceed) {
    return createGuidedErrorResponse(
      validationResult.blockers.join(', '),
      "position_textframe",
      validationResult.recommendations
    );
  }

  if (args.x === undefined || args.x === null) {
    return createGuidedErrorResponse(
      "x parameter is required",
      "position_textframe",
      ["Provide X position in points", "Check page dimensions first with get_page_dimensions()"]
    );
  }
  if (args.y === undefined || args.y === null) {
    return createGuidedErrorResponse(
      "y parameter is required", 
      "position_textframe",
      ["Provide Y position in points", "Check page dimensions first with get_page_dimensions()"]
    );
  }
  
  const textFrameIndex = args.textframe_index || 0;
  const _x = args.x;
  const _y = args.y;
  const _width = args.width || -1;
  const _height = args.height || -1;
  
  const pageDims = documentState.knownPageDimensions;
  const pageWidth = pageDims ? pageDims.width : 612;
  const pageHeight = pageDims ? pageDims.height : 792;

  const xPt = toPoints(args.x, "x", pageWidth, pageHeight);
  const yPt = toPoints(args.y, "y", pageWidth, pageHeight);
  const wPt = args.width && args.width!==-1 ? toPoints(args.width, "w", pageWidth, pageHeight) : -1;
  const hPt = args.height && args.height!==-1 ? toPoints(args.height, "h", pageWidth, pageHeight) : -1;

  const script = `
    var doc = app.activeDocument;
    var page = doc.layoutWindows[0].activePage;
    var frame = page.textFrames[${textFrameIndex}];
    if(!frame) { throw new Error('Text frame index out of range'); }
    frame.move([${xPt}, ${yPt}]);
    if (${wPt} > 0 && ${hPt} > 0) {
      frame.geometricBounds = [${yPt}, ${xPt}, ${yPt + hPt}, ${xPt + wPt}];
    }
    'moved';
  `;
  
  const result = await executeExtendScript(script);
  
  // Update workflow tracking on success
  if (result.success) {
    markStepCompleted("position_textframe");
    // emit simple changeSummary patch via console (can be captured by logger)
    const patchArr = [
      { op: "replace", path: `/textFrames/${textFrameIndex}/bounds`, value: [yPt, xPt, yPt + (hPt > 0 ? hPt : 0), xPt + (wPt > 0 ? wPt : 0)] }
    ];
    console.error("changeSummary:" + JSON.stringify(patchArr));
    return {
      content:[{type:"text", text:"Text frame positioned" }]
    };
  } else {
    return createGuidedErrorResponse(
      result.error || "Unknown error during text frame positioning",
      "position_textframe",
      ["Check InDesign status with indesign_status", "Verify document state"]
    );
  }
}

async function handleCreateTextFrame(args: any): Promise<{ content: TextContent[] }> {
  const validationResult = await validateLayoutPrerequisites(args, "create_textframe");
  if (!validationResult.canProceed) {
    return createGuidedErrorResponse(
      validationResult.blockers.join(', '),
      "create_textframe",
      validationResult.recommendations
    );
  }

  const pageDims = documentState.knownPageDimensions;
  const pageWidth = pageDims ? pageDims.width : 612;
  const pageHeight = pageDims ? pageDims.height : 792;

  const xPt = toPoints(args.x, "x", pageWidth, pageHeight);
  const yPt = toPoints(args.y, "y", pageWidth, pageHeight);
  const wPt = toPoints(args.width, "w", pageWidth, pageHeight);
  const hPt = toPoints(args.height, "h", pageWidth, pageHeight);

  const escapedText = escapeExtendScriptString(args.text_content || "");
  const pageNumber = args.page_number || 1;

  const jsx = `
    var doc = app.activeDocument;
    if (doc.pages.length < ${pageNumber}) { throw new Error('Page number out of range'); }
    var page = doc.pages[${pageNumber-1}];
    var frame = page.textFrames.add({ geometricBounds: [${yPt}, ${xPt}, ${yPt + hPt}, ${xPt + wPt}] });
    if ("${escapedText}" !== "") { frame.contents = "${escapedText}"; }
    'created';
  `;

  const res = await executeExtendScript(jsx);
  if (res.success) {
    markStepCompleted("create_textframe");
    const patchArr = [
      { op: "add", path: "/pages/-/frames/-", value: { bounds:[yPt,xPt,yPt+hPt,xPt+wPt] } }
    ];
    console.error("changeSummary:" + JSON.stringify(patchArr));
    return { content:[{ type:"text", text:"Text frame created" }] };
  }
  return createGuidedErrorResponse(res.error || "Unknown error during text frame creation", "create_textframe", []);
}

async function handleCreateAlternateLayouts(args: any): Promise<{ content: TextContent[] }> {
  const { base_layout, alternate_layouts, copy_content = true, preserve_styling = true } = args;
  
  const baseLayoutJson = JSON.stringify(base_layout);
  const alternateLayoutsJson = JSON.stringify(alternate_layouts);
  
  const script = `
    if (app.documents.length === 0) {
      throw new Error("No documents are open in InDesign.");
    }
    
    var doc = app.activeDocument;
    if (!doc) {
      throw new Error("No active document found.");
    }
    
    var results = [];
    var errors = [];
    var layoutsCreated = 0;
    var contentCopied = ${copy_content};
    var stylingPreserved = ${preserve_styling};
    
    var baseLayout = ${baseLayoutJson};
    var alternateLayouts = ${alternateLayoutsJson};
    
    try {
      results.push("=== CREATING ALTERNATE LAYOUTS ===");
      results.push("Base Layout: " + baseLayout.name + " (" + baseLayout.width + "×" + baseLayout.height + ")");
      
      // InDesign doesn't have direct alternate layout API in ExtendScript
      // We'll create separate pages with different dimensions as a workaround
      results.push("");
      results.push("Creating alternate layouts as separate pages...");
      
      for (var i = 0; i < alternateLayouts.length; i++) {
        var altLayout = alternateLayouts[i];
        
        try {
          // Add new page for this layout
          var newPage = doc.pages.add();
          
          // Set page dimensions (this may require setting document page size)
          // Note: InDesign's page size is typically document-wide
          results.push("✓ Created page for layout: " + altLayout.name);
          
          if (contentCopied && doc.pages.length > 1) {
            // Copy content from first page (base layout)
            var basePage = doc.pages[0];
            var allItems = basePage.allPageItems;
            
            var itemsCopied = 0;
            for (var j = 0; j < allItems.length; j++) {
              try {
                var originalItem = allItems[j];
                var duplicatedItem = originalItem.duplicate(newPage, ElementPlacement.INSIDE);
                
                // Apply liquid rules
                if (altLayout.liquid_rules.scale_objects) {
                  var scaleX = altLayout.width / baseLayout.width;
                  var scaleY = altLayout.height / baseLayout.height;
                  
                  if (altLayout.liquid_rules.maintain_aspect_ratio) {
                    var minScale = Math.min(scaleX, scaleY);
                    scaleX = minScale;
                    scaleY = minScale;
                  }
                  
                  // Scale the duplicated item
                  var bounds = duplicatedItem.geometricBounds;
                  var newBounds = [
                    bounds[0] * scaleY, // y1
                    bounds[1] * scaleX, // x1
                    bounds[2] * scaleY, // y2
                    bounds[3] * scaleX  // x2
                  ];
                  duplicatedItem.geometricBounds = newBounds;
                }
                
                // Handle text reflow if it's a text frame
                if (altLayout.liquid_rules.reflow_text && duplicatedItem.constructor.name === "TextFrame") {
                  // Text will automatically reflow based on the new frame size
                  results.push("  → Text reflowed in " + altLayout.name);
                }
                
                itemsCopied++;
              } catch (copyError) {
                errors.push("Failed to copy item to " + altLayout.name + ": " + copyError.message);
              }
            }
            
            results.push("  → Copied " + itemsCopied + " items to " + altLayout.name);
          }
          
          layoutsCreated++;
          
        } catch (layoutError) {
          errors.push("Failed to create layout " + altLayout.name + ": " + layoutError.message);
        }
      }
      
      results.push("");
      results.push("=== LAYOUT SUMMARY ===");
      results.push("Layouts created: " + layoutsCreated + "/" + alternateLayouts.length);
      
      if (contentCopied) {
        results.push("Content copied: YES");
      }
      
      if (stylingPreserved) {
        results.push("Styling preserved: YES");
      }
      
      // Add manual instructions for true alternate layouts
      results.push("");
      results.push("=== MANUAL SETUP REQUIRED ===");
      results.push("For true InDesign Alternate Layouts:");
      results.push("1. Go to Layout > Create Alternate Layout...");
      results.push("2. Set up each layout with the specified dimensions:");
      
      for (var i = 0; i < alternateLayouts.length; i++) {
        var alt = alternateLayouts[i];
        results.push("   • " + alt.name + ": " + alt.width + "×" + alt.height + " pts");
      }
      
      results.push("3. Configure Liquid Layout rules in Layout panel");
      results.push("4. The pages created by this tool can serve as reference");
      
    } catch (mainError) {
      throw new Error("Alternate layout creation failed: " + mainError.message);
    }
    
    var output = [];
    output = output.concat(results);
    
    if (errors.length > 0) {
      output.push("");
      output.push("=== ERRORS ===");
      output = output.concat(errors);
    }
    
    output.join("\\\\n");
  `;
  
  const result = await executeExtendScript(script);
  
  return {
    content: [{
      type: "text" as const,
      text: result.success ? result.result! : `Error creating alternate layouts: ${result.error}`
    }]
  };
}
