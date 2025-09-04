/**
 * @fileoverview Tool hierarchy and selection guidance for InDesign MCP
 * Provides intelligent tool selection recommendations based on operation type and context
 */

import { InDesignStatus, TextFrameInfo, PageInfo, StyleInfo } from '../types.js';

/**
 * Tool selection priority definitions for different operation categories
 */
export interface ToolHierarchy {
  category: string;
  priority: number;
  tools: string[];
  contextChecks: string[];
  preconditions: string[];
}

/**
 * Master tool hierarchy for InDesign operations
 * Defines clear priority order for tool selection based on operation type
 */
export const TOOL_HIERARCHIES: ToolHierarchy[] = [
  {
    category: "Document State Checking",
    priority: 1,
    tools: [
      "indesign_status",
      "get_document_text", 
      "get_page_info",
      "get_textframe_info"
    ],
    contextChecks: [
      "Verify InDesign is running",
      "Confirm active document exists",
      "Check document has content"
    ],
    preconditions: []
  },
  {
    category: "Text Content Operations",
    priority: 2,
    tools: [
      "add_text",
      "update_text",
      "remove_text",
      "select_text_range"
    ],
    contextChecks: [
      "Check existing text content",
      "Verify text frame capacity",
      "Check for overset text"
    ],
    preconditions: [
      "Document state verified",
      "Text frame locations known"
    ]
  },
  {
    category: "Style Management",
    priority: 3,
    tools: [
      "list_paragraph_styles",
      "list_character_styles",
      "apply_paragraph_style",
      "apply_character_style",
      "create_paragraph_style",
      "create_character_style"
    ],
    contextChecks: [
      "List existing styles first",
      "Check style properties",
      "Verify text selection"
    ],
    preconditions: [
      "Text content exists",
      "Text range selected if needed"
    ]
  },
  {
    category: "Text Frame Management",
    priority: 4,
    tools: [
      "create_textframe",
      "position_textframe",
      "get_textframe_info"
    ],
    contextChecks: [
      "Check page dimensions",
      "Verify available space",
      "Check existing frame positions"
    ],
    preconditions: [
      "Page structure understood",
      "Spatial requirements calculated"
    ]
  },
  {
    category: "Text Flow and Threading",
    priority: 5,
    tools: [
      "thread_text_frames",
      "resolve_overset_text",
      "manage_text_flow"
    ],
    contextChecks: [
      "Check threading relationships",
      "Identify overset text",
      "Verify frame connections"
    ],
    preconditions: [
      "Multiple text frames exist",
      "Text flow requirements identified"
    ]
  },
  {
    category: "Page Management", 
    priority: 6,
    tools: [
      "add_pages",
      "remove_pages",
      "get_page_info",
      "get_page_dimensions"
    ],
    contextChecks: [
      "Check current page count",
      "Verify page content",
      "Check master page settings"
    ],
    preconditions: [
      "Document structure planned",
      "Content flow requirements known"
    ]
  },
  {
    category: "Object Transformation",
    priority: 7,
    tools: [
      "transform_objects",
      "duplicate_objects", 
      "align_distribute_objects"
    ],
    contextChecks: [
      "Check object selection",
      "Verify object bounds",
      "Check spatial relationships"
    ],
    preconditions: [
      "Objects exist and are selectable",
      "Transformation requirements defined"
    ]
  },
  {
    category: "Special Features",
    priority: 8,
    tools: [
      "insert_special_character",
      "manage_layers",
      "create_table"
    ],
    contextChecks: [
      "Check insertion point",
      "Verify layer structure",
      "Check table requirements"
    ],
    preconditions: [
      "Basic document structure in place",
      "Specific feature requirements identified"
    ]
  },
  {
    category: "Document Export/Import",
    priority: 9,
    tools: [
      "save_document",
      "test_export_document",
      "import_content",
      "place_file"
    ],
    contextChecks: [
      "Verify document completeness",
      "Check export requirements",
      "Validate file paths"
    ],
    preconditions: [
      "Document ready for export/import",
      "File paths and formats confirmed"
    ]
  }
];

/**
 * Intelligent tool selection guidance based on operation type
 */
export function getToolRecommendations(operationType: string, context?: any): ToolHierarchy | null {
  const normalized = operationType.toLowerCase();
  
  // Map common operation requests to tool categories
  const operationMap: Record<string, string> = {
    "add text": "Text Content Operations",
    "edit text": "Text Content Operations", 
    "format text": "Style Management",
    "apply style": "Style Management",
    "create style": "Style Management",
    "position frame": "Text Frame Management",
    "create frame": "Text Frame Management",
    "thread frames": "Text Flow and Threading",
    "fix overset": "Text Flow and Threading",
    "add page": "Page Management",
    "transform object": "Object Transformation",
    "align objects": "Object Transformation",
    "export document": "Document Export/Import",
    "import content": "Document Export/Import"
  };

  const category = operationMap[normalized];
  return TOOL_HIERARCHIES.find(h => h.category === category) || null;
}

/**
 * Get prerequisite tools that should be called before a specific operation
 */
export function getPrerequisiteTools(targetCategory: string): string[] {
  const targetHierarchy = TOOL_HIERARCHIES.find(h => h.category === targetCategory);
  if (!targetHierarchy) return [];

  // Always require document state checking first
  const prerequisites = ["indesign_status", "get_document_text", "get_page_info"];

  // Add category-specific prerequisites
  switch (targetCategory) {
    case "Text Content Operations":
      prerequisites.push("get_textframe_info");
      break;
    case "Style Management":
      prerequisites.push("list_paragraph_styles", "list_character_styles");
      break;
    case "Text Frame Management":
      prerequisites.push("get_page_dimensions");
      break;
    case "Text Flow and Threading":
      prerequisites.push("get_textframe_info");
      break;
    case "Object Transformation":
      prerequisites.push("get_textframe_info");
      break;
  }

  return prerequisites;
}

/**
 * Tool chaining recommendations for common workflows
 */
export const WORKFLOW_CHAINS: Record<string, string[]> = {
  "create_formatted_text": [
    "indesign_status",
    "get_document_text", 
    "get_page_info",
    "list_paragraph_styles",
    "create_paragraph_style", // if needed
    "add_text",
    "apply_paragraph_style"
  ],
  
  "setup_multipage_document": [
    "indesign_status",
    "get_page_info",
    "add_pages", // if needed
    "get_page_dimensions",
    "create_textframe",
    "thread_text_frames"
  ],
  
  "fix_text_overflow": [
    "indesign_status",
    "get_textframe_info",
    "resolve_overset_text",
    "manage_text_flow"
  ],
  
  "apply_consistent_formatting": [
    "indesign_status",
    "get_document_text",
    "list_paragraph_styles",
    "select_text_range",
    "apply_paragraph_style"
  ],
  
  "export_final_document": [
    "indesign_status",
    "get_document_text",
    "get_page_info", 
    "manage_text_flow", // verify flow integrity
    "save_document",
    "test_export_document"
  ]
};

/**
 * Context checking requirements for each tool category
 */
export function getContextRequirements(category: string): string[] {
  const hierarchy = TOOL_HIERARCHIES.find(h => h.category === category);
  return hierarchy ? hierarchy.contextChecks : [];
}

/**
 * Validate that preconditions are met before tool execution
 */
export function validatePreconditions(category: string, context: any): boolean {
  const hierarchy = TOOL_HIERARCHIES.find(h => h.category === category);
  if (!hierarchy) return false;

  // Basic validation logic - in real implementation, this would check context object
  // For now, return true if basic requirements seem met
  return hierarchy.preconditions.length === 0 || Boolean(context);
}

/**
 * Get next recommended tool in a workflow chain
 */
export function getNextToolInChain(workflowName: string, currentTool: string): string | null {
  const chain = WORKFLOW_CHAINS[workflowName];
  if (!chain) return null;
  
  const currentIndex = chain.indexOf(currentTool);
  if (currentIndex === -1 || currentIndex === chain.length - 1) return null;
  
  return chain[currentIndex + 1];
}

/**
 * Tool selection decision matrix for complex scenarios
 */
export interface ToolDecision {
  tool: string;
  rationale: string;
  prerequisites: string[];
  alternatives: string[];
}

export function recommendTool(
  operation: string, 
  documentState: any,
  constraints?: string[]
): ToolDecision {
  // Simplified decision logic - real implementation would be more sophisticated
  const baseRecommendation = getToolRecommendations(operation);
  
  if (!baseRecommendation) {
    return {
      tool: "indesign_status",
      rationale: "Unknown operation - start with document state check",
      prerequisites: [],
      alternatives: ["get_document_text", "get_page_info"]
    };
  }

  return {
    tool: baseRecommendation.tools[0],
    rationale: `Primary tool for ${baseRecommendation.category}`,
    prerequisites: getPrerequisiteTools(baseRecommendation.category),
    alternatives: baseRecommendation.tools.slice(1)
  };
}