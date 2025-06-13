/**
 * @fileoverview Layout and positioning tools for InDesign MCP
 * Enhanced with strategic workflow guidance and prerequisite checking
 * Following BlenderMCP patterns for intelligent workflow enforcement
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { executeExtendScript, escapeExtendScriptString } from "../../extendscript.js";
import { z } from "zod";

/**
 * Document state cache for prerequisite tracking
 */
interface DocumentStateCache {
  lastPageDimensionsCheck: Date | null;
  lastTextFrameInfo: Date | null;
  knownPageDimensions: { width: number; height: number } | null;
  workflowStepsCompleted: Set<string>;
}

let documentState: DocumentStateCache = {
  lastPageDimensionsCheck: null,
  lastTextFrameInfo: null,
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
    async (args) => {
      return await handlePositionTextFrame(args);
    }
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
    async (args) => {
      return await handleCreateTextFrame(args);
    }
  );
}

/**
 * Validate layout prerequisites before tool execution
 */
async function validateLayoutPrerequisites(args: any, operation: string): Promise<ValidationResult> {
  const issues: string[] = [];
  const recommendations: string[] = [];

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
  const x = args.x;
  const y = args.y;
  const width = args.width || -1;
  const height = args.height || -1;
  
  const script = `
    var doc = app.activeDocument;
    if (doc.textFrames.length <= ${textFrameIndex}) {
      throw new Error("Text frame index out of range.");
    }
    
    // Store original script measurement unit
    var originalScriptUnit = app.scriptPreferences.measurementUnit;
    
    try {
      // Force script to interpret values as points for consistency
      app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;
      
      var textFrame = doc.textFrames[${textFrameIndex}];
      var currentBounds = textFrame.geometricBounds;
      
      // Set new bounds [y1, x1, y2, x2] in points
      var newBounds = [
        ${y},
        ${x},
        ${height > 0 ? y + height : 'currentBounds[2]'},
        ${width > 0 ? x + width : 'currentBounds[3]'}
      ];
      
      textFrame.geometricBounds = newBounds;
      
      "Text frame repositioned successfully";
      
    } finally {
      // Always restore original script measurement unit
      app.scriptPreferences.measurementUnit = originalScriptUnit;
    }
  `;
  
  const result = await executeExtendScript(script);
  
  // Update workflow tracking on success
  if (result.success) {
    markStepCompleted("position_textframe");
  }
  
  if (result.success) {
    return {
      content: [{
        type: "text",
        text: `✅ ${result.result}

📋 WORKFLOW CONTEXT: Text frame positioning completed. This is part of Layout Operations workflow.
💡 NEXT STEPS: Consider using get_textframe_info() to verify positioning or continue with text content operations.`
      }]
    };
  } else {
    // Enhanced error handling with context
    if (result.error && result.error.includes("out of range")) {
      return createGuidedErrorResponse(
        result.error,
        "position_textframe",
        [
          "Use get_textframe_info() to see available text frames",
          "Check frame indices with get_page_info()",
          "Consider creating new frames with create_textframe()"
        ]
      );
    }
    
    return createGuidedErrorResponse(
      result.error || "Unknown error during text frame positioning",
      "position_textframe",
      ["Check InDesign status with indesign_status", "Verify document state"]
    );
  }
}

async function handleCreateTextFrame(args: any): Promise<{ content: TextContent[] }> {
  // STEP 1: Automatic prerequisite checking
  const validationResult = await validateLayoutPrerequisites(args, "create_textframe");
  if (!validationResult.canProceed) {
    return createGuidedErrorResponse(
      validationResult.blockers.join(', '),
      "create_textframe", 
      validationResult.recommendations
    );
  }

  if (args.x === undefined || args.x === null) {
    return createGuidedErrorResponse(
      "x parameter is required",
      "create_textframe",
      ["Provide X position in points", "Check page dimensions first with get_page_dimensions()"]
    );
  }
  if (args.y === undefined || args.y === null) {
    return createGuidedErrorResponse(
      "y parameter is required",
      "create_textframe", 
      ["Provide Y position in points", "Check page dimensions first with get_page_dimensions()"]
    );
  }
  if (args.width === undefined || args.width === null) {
    return createGuidedErrorResponse(
      "width parameter is required",
      "create_textframe",
      ["Provide width in points", "Use get_page_dimensions() to understand available space"]
    );
  }
  if (args.height === undefined || args.height === null) {
    return createGuidedErrorResponse(
      "height parameter is required",
      "create_textframe",
      ["Provide height in points", "Use get_page_dimensions() to understand available space"]
    );
  }
  
  const x = args.x;
  const y = args.y;
  const width = args.width;
  const height = args.height;
  const pageNumber = args.page_number || 1;
  const textContent = args.text_content ? escapeExtendScriptString(args.text_content) : "";
  
  const script = `
    var doc = app.activeDocument;
    if (doc.pages.length < ${pageNumber}) {
      throw new Error("Page number " + ${pageNumber} + " out of range. Document has " + doc.pages.length + " pages.");
    }
    
    // Store original script measurement unit
    var originalScriptUnit = app.scriptPreferences.measurementUnit;
    
    try {
      // Force script to interpret values as points for consistency
      app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;
      
      var page = doc.pages[${pageNumber} - 1];
      var textFrame = page.textFrames.add();
      
      // Set bounds [y1, x1, y2, x2] in points
      textFrame.geometricBounds = [${y}, ${x}, ${y + height}, ${x + width}];
      
      if ("${textContent}" !== "") {
        textFrame.contents = "${textContent}";
      }
      
      "Text frame created successfully on page " + (page.name || ${pageNumber});
      
    } finally {
      // Always restore original script measurement unit
      app.scriptPreferences.measurementUnit = originalScriptUnit;
    }
  `;
  
  const result = await executeExtendScript(script);
  
  // Update workflow tracking on success
  if (result.success) {
    markStepCompleted("create_textframe");
  }
  
  if (result.success) {
    return {
      content: [{
        type: "text",
        text: `✅ ${result.result}

📋 WORKFLOW CONTEXT: Text frame creation completed. This is step 4 in Text Frame Management workflow.
💡 NEXT STEPS: Consider adding text content with add_text() or positioning with position_textframe().
🔗 RELATED TOOLS: add_text, position_textframe, get_textframe_info`
      }]
    };
  } else {
    // Enhanced error handling with context
    if (result.error && result.error.includes("out of range")) {
      return createGuidedErrorResponse(
        result.error,
        "create_textframe",
        [
          "Check document page count with get_page_info()",
          "Add pages with add_pages() if needed",
          "Verify page number is within document range"
        ]
      );
    }
    
    if (result.error && result.error.includes("bounds")) {
      return createGuidedErrorResponse(
        result.error,
        "create_textframe",
        [
          "Check page dimensions with get_page_dimensions()",
          "Adjust frame size to fit within page bounds",
          "Use smaller dimensions or different positioning"
        ]
      );
    }
    
    return createGuidedErrorResponse(
      result.error || "Unknown error during text frame creation",
      "create_textframe",
      ["Check InDesign status with indesign_status", "Verify document is open and editable"]
    );
  }
}