# Strategic Workflow Enhancement Plan for InDesign MCP

## Overview

Based on analysis of BlenderMCP's successful workflow guidance system, this document outlines specific enhancements to make the InDesign MCP strategic workflow more prominent, enforceable, and user-friendly.

## Current State Analysis

### ✅ What We Have
- Comprehensive strategic prompt system (`document_creation_strategy`)
- Tool hierarchy definitions (`tool-hierarchy.ts`)
- Document intelligence framework (`document-context.ts`)
- Workflow chains for common operations

### ❌ What's Missing
- Tools don't actively enforce the strategic workflow
- Individual tool descriptions don't reference strategic guidance
- No automatic prerequisite checking
- Error messages lack next-step guidance
- Strategic prompts are "hidden" and not discoverable

## Enhancement Plan

---

## 1. Make Strategic Prompts More Prominent in Tool Descriptions

### **Problem**
Currently, tool descriptions are minimal and don't guide users to the strategic workflow:

```typescript
// Current (insufficient)
x: z.number().describe("X position in points")
```

### **Solution: Enhanced Tool Descriptions**

#### **A. Add Strategic Prompt References**
```typescript
// Enhanced with workflow guidance
server.tool("create_textframe", {
  x: z.number().describe("X position in points. 📋 WORKFLOW: Use document_creation_strategy prompt for complete positioning guidance"),
  y: z.number().describe("Y position in points. ⚠️  Check page dimensions first with get_page_dimensions()"),
  width: z.number().describe("Width in points. 💡 TIP: Verify available space before creating frames"),
  height: z.number().describe("Height in points")
}, /* ... */)
```

#### **B. Add Tool Category Headers**
```typescript
// Group tools with strategic context
server.tool("create_textframe", 
  "Layout Management Tool - Requires spatial context checking",
  {
    // Enhanced descriptions with workflow emojis and cross-references
  }
)
```

#### **C. Tool Description Templates**
Create standardized description patterns for each tool category:

```typescript
// Template for layout tools
const LAYOUT_TOOL_DESCRIPTION = (paramName: string, paramDescription: string) => 
  `${paramDescription}. 📋 See document_creation_strategy → Layout Operations for complete workflow.`;

// Template for text tools  
const TEXT_TOOL_DESCRIPTION = (paramName: string, paramDescription: string) =>
  `${paramDescription}. 📋 See document_creation_strategy → Text Operations for proper sequencing.`;
```

---

## 2. Add Workflow Enforcement to Layout Tools

### **Problem**
Layout tools (`create_textframe`, `position_textframe`) don't check prerequisites, leading to spatial errors.

### **Solution: Automated Prerequisite Checking**

#### **A. Pre-execution Validation**
```typescript
// Enhanced create_textframe with automatic checks
async function handleCreateTextFrame(args: any): Promise<{ content: TextContent[] }> {
  // STEP 1: Automatic prerequisite checking
  const validationResult = await validateLayoutPrerequisites(args);
  if (!validationResult.canProceed) {
    return {
      content: [{
        type: "text",
        text: `❌ WORKFLOW ERROR: ${validationResult.blockers.join(', ')}\n\n📋 NEXT STEPS:\n${validationResult.recommendations.map(r => `• ${r}`).join('\n')}\n\n💡 Use document_creation_strategy prompt for complete guidance.`
      }]
    };
  }

  // STEP 2: Proceed with validated operation
  // ... existing implementation
}

async function validateLayoutPrerequisites(args: any): Promise<ValidationResult> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check if page dimensions are known
  const pageInfo = await getLastPageDimensionsCheck();
  if (!pageInfo || isStale(pageInfo)) {
    issues.push("Page dimensions not verified");
    recommendations.push("Run get_page_dimensions() to understand available space");
  }

  // Check spatial constraints
  if (pageInfo && (args.x + args.width > pageInfo.width)) {
    issues.push(`Frame width ${args.width} exceeds page width ${pageInfo.width}`);
    recommendations.push("Reduce frame width or check page bounds with get_page_dimensions()");
  }

  return {
    canProceed: issues.length === 0,
    blockers: issues,
    recommendations
  };
}
```

#### **B. Smart Defaults with Context**
```typescript
// Auto-suggest optimal positioning based on page analysis
async function suggestOptimalFramePosition(requestedArgs: any): Promise<FramePositionSuggestion> {
  const pageInfo = await getPageDimensions();
  const existingFrames = await getTextFrameInfo();
  
  // Calculate optimal position avoiding overlaps
  const suggestions = {
    position: calculateOptimalPosition(pageInfo, existingFrames, requestedArgs),
    rationale: "Positioned to avoid existing content",
    alternatives: [/* ... */]
  };
  
  return suggestions;
}
```

#### **C. Progressive Workflow Enforcement**
```typescript
// Configurable enforcement levels
enum WorkflowEnforcementLevel {
  GUIDANCE_ONLY = "guidance",     // Show tips but allow operation
  SMART_DEFAULTS = "smart",       // Auto-fix common issues
  STRICT_VALIDATION = "strict"    // Require prerequisites
}

const CURRENT_ENFORCEMENT_LEVEL = WorkflowEnforcementLevel.SMART_DEFAULTS;
```

---

## 3. Enhance Error Messages with Next-Step Guidance

### **Problem**
Current error messages are generic and don't guide users toward solutions:

```typescript
// Current (unhelpful)
throw new Error("Text frame index out of range.");
```

### **Solution: Contextual Error Messages with Guidance**

#### **A. Structured Error Response System**
```typescript
interface GuidedErrorResponse {
  error: string;
  category: ErrorCategory;
  nextSteps: string[];
  relatedTools: string[];
  strategicGuidance: string;
}

enum ErrorCategory {
  SPATIAL_CONSTRAINT = "spatial",
  MISSING_PREREQUISITE = "prerequisite", 
  DOCUMENT_STATE = "document_state",
  WORKFLOW_ORDER = "workflow"
}
```

#### **B. Enhanced Error Messages**
```typescript
// Enhanced error handling
if (doc.textFrames.length <= textFrameIndex) {
  return {
    content: [{
      type: "text",
      text: `❌ ERROR: Text frame index ${textFrameIndex} out of range (document has ${doc.textFrames.length} frames).

📋 IMMEDIATE ACTIONS:
• Use get_textframe_info() to see available text frames
• Check frame indices with get_page_info() 
• Consider creating new frames with create_textframe()

💡 WORKFLOW GUIDANCE:
Use document_creation_strategy prompt → Text Frame Management section for proper frame management workflow.

🔗 RELATED TOOLS: get_textframe_info, create_textframe, get_page_info`
    }]
  };
}
```

#### **C. Error Recovery Suggestions**
```typescript
// Auto-suggest recovery actions
function generateRecoveryPlan(error: InDesignError, context: DocumentContext): RecoveryPlan {
  const plan: RecoveryPlan = {
    immediateActions: [],
    toolSuggestions: [],
    workflowReference: ""
  };

  switch (error.type) {
    case "OVERSET_TEXT":
      plan.immediateActions = [
        "Use resolve_overset_text() to fix text overflow",
        "Add more pages with add_pages() if needed",
        "Create additional text frames with create_textframe()"
      ];
      plan.workflowReference = "document_creation_strategy → Text Flow and Threading";
      break;
      
    case "SPATIAL_OVERLAP":
      plan.immediateActions = [
        "Use get_page_dimensions() to check available space",
        "Adjust frame position with position_textframe()",
        "Use transform_objects() for precise positioning"
      ];
      plan.workflowReference = "document_creation_strategy → Layout Operations";
      break;
  }

  return plan;
}
```

---

## 4. Add State Checking to Tools That Need Context

### **Problem**
Tools operate without awareness of document state, leading to workflow violations.

### **Solution: Context-Aware Tool Behavior**

#### **A. Document State Tracking**
```typescript
// Global document state cache
interface DocumentStateCache {
  lastPageDimensionsCheck: Date | null;
  lastTextFrameInfo: Date | null;
  lastDocumentAnalysis: Date | null;
  knownIssues: DocumentIssue[];
  workflowStepsCompleted: Set<string>;
}

let documentState: DocumentStateCache = {
  lastPageDimensionsCheck: null,
  lastTextFrameInfo: null,
  lastDocumentAnalysis: null,
  knownIssues: [],
  workflowStepsCompleted: new Set()
};
```

#### **B. State-Aware Tool Execution**
```typescript
// Tools automatically check and update state
async function executeWithStateChecking<T>(
  toolName: string,
  operation: () => Promise<T>,
  requiredChecks: string[] = []
): Promise<T | GuidedErrorResponse> {
  
  // Check prerequisites
  const missingChecks = requiredChecks.filter(check => !isRecentlyCompleted(check));
  
  if (missingChecks.length > 0) {
    return {
      error: `Missing required context checks: ${missingChecks.join(', ')}`,
      category: ErrorCategory.MISSING_PREREQUISITE,
      nextSteps: missingChecks.map(check => `Run ${check} to gather required context`),
      relatedTools: missingChecks,
      strategicGuidance: "See document_creation_strategy → Document State Verification"
    };
  }

  // Execute operation
  const result = await operation();
  
  // Update state tracking
  documentState.workflowStepsCompleted.add(toolName);
  updateLastExecution(toolName);
  
  return result;
}

// Usage in tools
async function handleCreateTextFrame(args: any) {
  return executeWithStateChecking(
    "create_textframe",
    () => performTextFrameCreation(args),
    ["get_page_dimensions", "indesign_status"] // Required context
  );
}
```

#### **C. Intelligent Context Suggestions**
```typescript
// Suggest missing context based on operation type
function suggestMissingContext(toolName: string, args: any): ContextSuggestion[] {
  const suggestions: ContextSuggestion[] = [];

  if (toolName.includes("textframe") && !hasRecentPageDimensions()) {
    suggestions.push({
      tool: "get_page_dimensions",
      reason: "Text frame operations require spatial context",
      urgency: "high"
    });
  }

  if (toolName.includes("style") && !hasRecentStyleInfo()) {
    suggestions.push({
      tool: "list_paragraph_styles",
      reason: "Style operations work better with existing style awareness",
      urgency: "medium"
    });
  }

  return suggestions;
}
```

---

## 5. Cross-Reference the Strategy in Individual Tool Descriptions

### **Problem**
Strategic prompts exist but aren't discoverable from individual tools.

### **Solution: Integrated Strategic References**

#### **A. Tool Schema Enhancement**
```typescript
// Extended tool schema with strategic references
interface EnhancedToolSchema extends ToolSchema {
  strategicCategory: string;
  workflowStep: number;
  prerequisites: string[];
  relatedPrompts: string[];
  examples: WorkflowExample[];
}

// Enhanced tool registration
server.tool("create_textframe", {
  // Standard parameters
  x: z.number().describe("X position in points"),
  y: z.number().describe("Y position in points"),
  width: z.number().describe("Width in points"),
  height: z.number().describe("Height in points"),
  
  // Strategic context (in tool metadata)
  _strategic: {
    category: "Text Frame Management",
    workflowStep: 4,
    prerequisites: ["get_page_dimensions", "indesign_status"],
    relatedPrompts: ["document_creation_strategy"],
    description: "Creates text frames with proper spatial validation. Part of Layout Operations workflow.",
    examples: [
      {
        scenario: "Creating first text frame",
        sequence: ["indesign_status", "get_page_dimensions", "create_textframe"]
      }
    ]
  }
})
```

#### **B. Dynamic Tool Help System**
```typescript
// Add help information to tool responses
function addStrategicContext(toolName: string, response: ToolResponse): ToolResponse {
  const strategicInfo = getStrategicInfo(toolName);
  
  if (strategicInfo) {
    response.content.push({
      type: "text",
      text: `\n📋 WORKFLOW CONTEXT: This is step ${strategicInfo.workflowStep} in ${strategicInfo.category}. See ${strategicInfo.relatedPrompts.join(', ')} for complete guidance.`
    });
  }
  
  return response;
}
```

#### **C. Cross-Referenced Documentation**
```typescript
// Auto-generate workflow documentation
function generateWorkflowDocumentation(): string {
  return `
# InDesign MCP Workflow Guide

## Quick Start
1. 📋 **Always start with**: \`document_creation_strategy\` prompt
2. 🔍 **Check status**: \`indesign_status\` → \`get_document_text\` → \`get_page_info\`
3. 📐 **Layout operations**: \`get_page_dimensions\` → \`create_textframe\` → \`position_textframe\`

## Tool Categories & Strategic Context

${TOOL_HIERARCHIES.map(category => `
### ${category.category}
**Tools**: ${category.tools.join(', ')}
**Prerequisites**: ${category.preconditions.join(', ')}
**Context Checks**: ${category.contextChecks.join(', ')}
`).join('\n')}

## Common Workflows
${Object.entries(WORKFLOW_CHAINS).map(([name, tools]) => `
### ${name}
\`\`\`
${tools.map((tool, i) => `${i + 1}. ${tool}`).join('\n')}
\`\`\`
`).join('\n')}
  `;
}
```

---

## Implementation Strategy

### **Phase 1: Foundation (Week 1)**
1. ✅ Enhance tool descriptions with strategic references
2. ✅ Add basic prerequisite checking to layout tools
3. ✅ Implement enhanced error messages

### **Phase 2: Intelligence (Week 2)**
1. ✅ Add document state tracking
2. ✅ Implement context-aware tool behavior
3. ✅ Create intelligent workflow suggestions

### **Phase 3: Integration (Week 3)**
1. ✅ Full strategic prompt integration
2. ✅ Advanced workflow enforcement
3. ✅ Dynamic help and guidance system

## Success Metrics

### **Workflow Compliance**
- ✅ Users check page dimensions before layout operations (target: 90%)
- ✅ Users utilize strategic prompts (target: 70%)
- ✅ Reduced spatial constraint errors (target: 80% reduction)

### **User Experience**
- ✅ Clear error messages with actionable guidance
- ✅ Discoverable strategic workflow from any tool
- ✅ Intelligent context suggestions prevent common mistakes

### **System Intelligence**
- ✅ Tools automatically validate prerequisites
- ✅ Context-aware behavior based on document state
- ✅ Progressive workflow enforcement adapts to user needs

---

## Conclusion

By implementing these enhancements, the InDesign MCP will transform from a collection of individual tools into an **intelligent, workflow-aware system** that actively guides users toward successful document automation, similar to BlenderMCP's proven approach.

The key insight is making the strategic workflow **unavoidable rather than optional** by building enforcement and guidance directly into the tools themselves, while maintaining flexibility for advanced users.