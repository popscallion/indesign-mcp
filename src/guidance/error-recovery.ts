/**
 * @fileoverview Enhanced error recovery system for InDesign MCP
 * Provides specific error pattern recognition, automated recovery sequences, and prevention guidance
 */

import { ToolResult, ExtendScriptResult } from '../types.js';
import { DocumentIssue, IssueType, IssueSeverity } from '../intelligence/document-context.js';

/**
 * Error pattern definitions with specific recognition criteria
 */
export interface ErrorPattern {
  pattern: string;
  errorType: ErrorType;
  severity: ErrorSeverity;
  recognitionKeywords: string[];
  commonCauses: string[];
  recoverySequence: RecoveryStep[];
  preventionGuidance: string[];
}

/**
 * Error classification system
 */
export enum ErrorType {
  APPLICATION_NOT_RUNNING = "application_not_running",
  NO_ACTIVE_DOCUMENT = "no_active_document", 
  OVERSET_TEXT = "overset_text",
  THREADING_BROKEN = "threading_broken",
  STYLE_NOT_FOUND = "style_not_found",
  FRAME_POSITIONING_ERROR = "frame_positioning_error",
  EXTENDSCRIPT_SYNTAX_ERROR = "extendscript_syntax_error",
  PERMISSION_DENIED = "permission_denied",
  INVALID_PARAMETERS = "invalid_parameters",
  SPATIAL_CONFLICT = "spatial_conflict",
  EXPORT_FAILURE = "export_failure"
}

export enum ErrorSeverity {
  CRITICAL = "critical",    // Blocks all operations
  MAJOR = "major",         // Blocks specific workflows
  MINOR = "minor",         // Degrades functionality
  WARNING = "warning"      // Potential issues
}

/**
 * Recovery step instructions
 */
export interface RecoveryStep {
  stepNumber: number;
  action: string;
  tool?: string;
  parameters?: Record<string, any>;
  validationCheck: string;
  fallbackAction?: string;
}

/**
 * Master error pattern registry
 */
export const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: "InDesign is not running",
    errorType: ErrorType.APPLICATION_NOT_RUNNING,
    severity: ErrorSeverity.CRITICAL,
    recognitionKeywords: ["not running", "application not found", "connection failed"],
    commonCauses: [
      "InDesign application is closed",
      "InDesign is not installed",
      "AppleScript permissions denied"
    ],
    recoverySequence: [
      {
        stepNumber: 1,
        action: "Launch InDesign application",
        validationCheck: "Check if InDesign process is running",
        fallbackAction: "Notify user to manually launch InDesign"
      },
      {
        stepNumber: 2,
        action: "Wait for application to fully load",
        validationCheck: "Verify application responds to status check",
        fallbackAction: "Increase wait time and retry"
      },
      {
        stepNumber: 3,
        action: "Test connection with indesign_status",
        tool: "indesign_status",
        validationCheck: "Successful status response received",
        fallbackAction: "Check AppleScript permissions"
      }
    ],
    preventionGuidance: [
      "Always check indesign_status() before other operations",
      "Include InDesign launch check in automation scripts",
      "Verify AppleScript permissions are granted"
    ]
  },
  {
    pattern: "No document is currently open",
    errorType: ErrorType.NO_ACTIVE_DOCUMENT,
    severity: ErrorSeverity.CRITICAL,
    recognitionKeywords: ["no document", "no active document", "document not open"],
    commonCauses: [
      "No InDesign document is open",
      "Document was closed during operation",
      "Multiple documents open but none active"
    ],
    recoverySequence: [
      {
        stepNumber: 1,
        action: "Check if any documents are open",
        tool: "indesign_status",
        validationCheck: "Document count > 0",
        fallbackAction: "Create new document or open existing"
      },
      {
        stepNumber: 2,
        action: "Activate most recent document",
        validationCheck: "Active document confirmed",
        fallbackAction: "Prompt user to open document manually"
      }
    ],
    preventionGuidance: [
      "Always verify active document exists before operations",
      "Include document checks in workflow initialization",
      "Handle document creation as part of automation"
    ]
  },
  {
    pattern: "Text is overset",
    errorType: ErrorType.OVERSET_TEXT,
    severity: ErrorSeverity.MAJOR,
    recognitionKeywords: ["overset", "text overflow", "not all text fits"],
    commonCauses: [
      "Text frame too small for content",
      "Font size increased after text placement",
      "Text frame threading broken"
    ],
    recoverySequence: [
      {
        stepNumber: 1,
        action: "Identify overset text frames",
        tool: "get_textframe_info",
        validationCheck: "Overset frames identified",
        fallbackAction: "Manual text frame inspection required"
      },
      {
        stepNumber: 2,
        action: "Resolve overset automatically",
        tool: "resolve_overset_text",
        validationCheck: "No overset text remains",
        fallbackAction: "Manual frame adjustment needed"
      },
      {
        stepNumber: 3,
        action: "Verify text flow integrity",
        tool: "manage_text_flow",
        parameters: { action: "check_flow" },
        validationCheck: "Text flow is continuous",
        fallbackAction: "Repair threading manually"
      }
    ],
    preventionGuidance: [
      "Check text frame capacity before adding content",
      "Monitor text length vs frame size",
      "Use threading to handle longer content",
      "Test with longer text samples during design"
    ]
  },
  {
    pattern: "Style not found",
    errorType: ErrorType.STYLE_NOT_FOUND,
    severity: ErrorSeverity.MAJOR,
    recognitionKeywords: ["style not found", "style does not exist", "unknown style"],
    commonCauses: [
      "Style name misspelled",
      "Style deleted after reference created",
      "Case sensitivity mismatch"
    ],
    recoverySequence: [
      {
        stepNumber: 1,
        action: "List available styles",
        tool: "list_paragraph_styles",
        validationCheck: "Style list retrieved",
        fallbackAction: "Check character styles as alternative"
      },
      {
        stepNumber: 2,
        action: "Find closest matching style name",
        validationCheck: "Similar style found",
        fallbackAction: "Create missing style"
      },
      {
        stepNumber: 3,
        action: "Create missing style or use alternative",
        tool: "create_paragraph_style",
        validationCheck: "Style successfully created",
        fallbackAction: "Apply default formatting"
      }
    ],
    preventionGuidance: [
      "Always list existing styles before applying",
      "Use exact style names from list operations",
      "Create required styles before applying them",
      "Implement style existence checks in workflows"
    ]
  },
  {
    pattern: "Threading connection failed",
    errorType: ErrorType.THREADING_BROKEN,
    severity: ErrorSeverity.MAJOR,
    recognitionKeywords: ["thread", "connection failed", "linking failed"],
    commonCauses: [
      "Source or target frame doesn't exist",
      "Frames already connected",
      "Circular threading attempted"
    ],
    recoverySequence: [
      {
        stepNumber: 1,
        action: "Check frame threading status",
        tool: "manage_text_flow",
        parameters: { action: "list_threaded" },
        validationCheck: "Threading relationships mapped",
        fallbackAction: "Manual threading inspection"
      },
      {
        stepNumber: 2,
        action: "Break existing problematic threads",
        tool: "manage_text_flow",
        parameters: { action: "break_thread" },
        validationCheck: "Problem threads cleared",
        fallbackAction: "Recreate frames if necessary"
      },
      {
        stepNumber: 3,
        action: "Establish new threading sequence",
        tool: "thread_text_frames",
        validationCheck: "Threading successfully established",
        fallbackAction: "Use manual text placement"
      }
    ],
    preventionGuidance: [
      "Check frame existence before threading",
      "Map existing threading before modifications",
      "Avoid circular threading patterns",
      "Test threading with sample content"
    ]
  },
  {
    pattern: "ExtendScript execution error",
    errorType: ErrorType.EXTENDSCRIPT_SYNTAX_ERROR,
    severity: ErrorSeverity.CRITICAL,
    recognitionKeywords: ["syntax error", "execution error", "script error"],
    commonCauses: [
      "Invalid ExtendScript syntax",
      "String concatenation issues",
      "Boolean conversion problems",
      "Newline escaping errors"
    ],
    recoverySequence: [
      {
        stepNumber: 1,
        action: "Check string building patterns",
        validationCheck: "Array.join() used instead of += concatenation",
        fallbackAction: "Rewrite string construction"
      },
      {
        stepNumber: 2,
        action: "Verify boolean parameters",
        validationCheck: "TypeScript booleans converted to ExtendScript strings",
        fallbackAction: "Fix boolean parameter passing"
      },
      {
        stepNumber: 3,
        action: "Check newline escaping",
        validationCheck: "Newlines properly escaped as \\\\n",
        fallbackAction: "Fix template literal escaping"
      }
    ],
    preventionGuidance: [
      "Always use array.join() for string concatenation",
      "Convert TypeScript true/false to 'true'/'false' strings",
      "Use \\\\n for newlines in template literals",
      "Wrap all ExtendScript in try/catch blocks"
    ]
  }
];

/**
 * Error recognition and classification
 */
export function recognizeError(
  error: string | Error,
  context?: any
): { pattern: ErrorPattern | null; confidence: number } {
  const errorText = typeof error === 'string' ? error.toLowerCase() : error.message.toLowerCase();
  
  let bestMatch: ErrorPattern | null = null;
  let highestConfidence = 0;
  
  for (const pattern of ERROR_PATTERNS) {
    let confidence = 0;
    const keywordMatches = pattern.recognitionKeywords.filter(keyword => 
      errorText.includes(keyword.toLowerCase())
    );
    
    if (keywordMatches.length > 0) {
      confidence = keywordMatches.length / pattern.recognitionKeywords.length;
      
      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        bestMatch = pattern;
      }
    }
  }
  
  return { pattern: bestMatch, confidence: highestConfidence };
}

/**
 * Automated recovery execution
 */
export async function executeRecovery(
  errorPattern: ErrorPattern,
  context?: any
): Promise<RecoveryResult> {
  const result: RecoveryResult = {
    success: false,
    stepsCompleted: 0,
    errors: [],
    recommendations: []
  };
  
  for (const step of errorPattern.recoverySequence) {
    try {
      // In real implementation, would execute the actual recovery tool
      const stepResult = await executeRecoveryStep(step, context);
      
      if (stepResult.success) {
        result.stepsCompleted++;
      } else {
        result.errors.push(`Step ${step.stepNumber} failed: ${stepResult.error}`);
        
        if (step.fallbackAction) {
          result.recommendations.push(`Try fallback: ${step.fallbackAction}`);
        }
        break;
      }
    } catch (error) {
      result.errors.push(`Step ${step.stepNumber} exception: ${error}`);
      break;
    }
  }
  
  result.success = result.stepsCompleted === errorPattern.recoverySequence.length;
  return result;
}

/**
 * Recovery result information
 */
export interface RecoveryResult {
  success: boolean;
  stepsCompleted: number;
  errors: string[];
  recommendations: string[];
}

/**
 * Execute individual recovery step
 */
async function executeRecoveryStep(
  step: RecoveryStep,
  context?: any
): Promise<{ success: boolean; error?: string }> {
  // Placeholder implementation - would integrate with actual MCP tools
  // For now, simulate success/failure based on step type
  
  if (step.tool) {
    // Would call actual MCP tool here
    // const result = await callMcpTool(step.tool, step.parameters);
    // return { success: result.success, error: result.error };
  }
  
  // Simplified simulation
  return { success: true };
}

/**
 * Error prevention guidance
 */
export function getPreventionGuidance(errorType: ErrorType): string[] {
  const pattern = ERROR_PATTERNS.find(p => p.errorType === errorType);
  return pattern ? pattern.preventionGuidance : [];
}

/**
 * Error context analysis
 */
export interface ErrorContext {
  operation: string;
  parameters: any;
  documentState?: any;
  previousErrors: string[];
  timestamp: Date;
}

/**
 * Enhanced error handling with context analysis
 */
export async function handleErrorWithContext(
  error: string | Error,
  context: ErrorContext
): Promise<{
  recognized: boolean;
  pattern?: ErrorPattern;
  recovery?: RecoveryResult;
  guidance: string[];
  severity: ErrorSeverity;
}> {
  const { pattern, confidence } = recognizeError(error, context);
  
  if (!pattern || confidence < 0.5) {
    return {
      recognized: false,
      guidance: [
        "Error not recognized - check basic prerequisites",
        "Verify InDesign is running and document is open",
        "Check tool parameters for validity",
        "Review recent operations for conflicts"
      ],
      severity: ErrorSeverity.MAJOR
    };
  }
  
  const recovery = await executeRecovery(pattern, context);
  
  return {
    recognized: true,
    pattern,
    recovery,
    guidance: [
      ...pattern.preventionGuidance,
      ...(recovery.recommendations || [])
    ],
    severity: pattern.severity
  };
}

/**
 * Common error recovery workflows
 */
export const RECOVERY_WORKFLOWS = {
  /**
   * Complete application recovery sequence
   */
  applicationRecovery: async (): Promise<boolean> => {
    const steps = [
      "Check InDesign application status",
      "Launch InDesign if not running", 
      "Verify document is open",
      "Test basic connectivity"
    ];
    
    // Implementation would execute each step
    return true; // Placeholder
  },
  
  /**
   * Document state recovery sequence
   */
  documentRecovery: async (): Promise<boolean> => {
    const steps = [
      "Check document structure",
      "Resolve overset text issues",
      "Repair text threading",
      "Validate spatial layout"
    ];
    
    return true; // Placeholder
  },
  
  /**
   * Text flow recovery sequence
   */
  textFlowRecovery: async (): Promise<boolean> => {
    const steps = [
      "Map existing text threading",
      "Identify broken connections",
      "Clear problematic threads",
      "Re-establish proper flow"
    ];
    
    return true; // Placeholder
  }
};

/**
 * Error threshold monitoring (enhanced beyond current implementation)
 */
export class ErrorThresholdMonitor {
  private errorHistory: Array<{ error: string; timestamp: Date; context: any }> = [];
  private readonly maxErrors = 10;
  private readonly timeWindow = 300000; // 5 minutes
  
  recordError(error: string, context?: any): void {
    this.errorHistory.push({
      error,
      timestamp: new Date(),
      context
    });
    
    // Clean old errors outside time window
    const cutoff = new Date(Date.now() - this.timeWindow);
    this.errorHistory = this.errorHistory.filter(e => e.timestamp > cutoff);
  }
  
  shouldStopOperation(): boolean {
    return this.errorHistory.length >= this.maxErrors;
  }
  
  getErrorPatterns(): { pattern: string; count: number }[] {
    const patterns = new Map<string, number>();
    
    this.errorHistory.forEach(error => {
      const pattern = error.error.split(':')[0]; // Simplified pattern extraction
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    });
    
    return Array.from(patterns.entries()).map(([pattern, count]) => ({ pattern, count }));
  }
  
  getRecommendations(): string[] {
    if (this.shouldStopOperation()) {
      return [
        "Too many errors in short time period",
        "Review document state and tool parameters",
        "Consider restarting InDesign application",
        "Check for systematic issues in workflow"
      ];
    }
    
    return [];
  }
}