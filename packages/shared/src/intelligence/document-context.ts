/**
 * @fileoverview Document context intelligence for InDesign MCP
 * Provides document state awareness, error detection, and spatial layout intelligence
 */

import { InDesignStatus, TextFrameInfo, PageInfo, PageDimensions, ToolResult } from '../types.js';

/**
 * Comprehensive document state information
 */
export interface DocumentState {
  isValid: boolean;
  applicationStatus: InDesignStatus | null;
  pageInfo: PageInfo[];
  textFrames: TextFrameInfo[];
  textContent: string;
  hasOversetText: boolean;
  threadingIntegrity: boolean;
  documentType: DocumentType;
  spatialAnalysis: SpatialAnalysis;
  issues: DocumentIssue[];
}

/**
 * Document type classification for workflow optimization
 */
export enum DocumentType {
  EMPTY = "empty",
  MAGAZINE = "magazine", 
  REPORT = "report",
  BROCHURE = "brochure",
  BOOK = "book",
  NEWSLETTER = "newsletter",
  UNKNOWN = "unknown"
}

/**
 * Spatial analysis for layout operations
 */
export interface SpatialAnalysis {
  totalPages: number;
  averageTextDensity: number;
  frameDistribution: FrameDistribution[];
  marginUsage: MarginUsage;
  threadingMap: ThreadingConnection[];
  availableSpace: SpaceRegion[];
}

/**
 * Text frame distribution across pages
 */
export interface FrameDistribution {
  pageNumber: number;
  frameCount: number;
  textDensity: number;
  hasOverflow: boolean;
}

/**
 * Margin and white space usage analysis
 */
export interface MarginUsage {
  topMarginAverage: number;
  bottomMarginAverage: number;
  leftMarginAverage: number;
  rightMarginAverage: number;
  whiteSpaceRatio: number;
}

/**
 * Text frame threading connections
 */
export interface ThreadingConnection {
  sourceFrame: number;
  targetFrame: number;
  sourcePage: number;
  targetPage: number;
  isValid: boolean;
}

/**
 * Available space regions for new content
 */
export interface SpaceRegion {
  pageNumber: number;
  bounds: [number, number, number, number]; // [y1, x1, y2, x2]
  area: number;
  isOptimalForText: boolean;
}

/**
 * Document issues and validation problems
 */
export interface DocumentIssue {
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  location?: {
    page?: number;
    frame?: number;
  };
  suggestedFix: string;
}

export enum IssueType {
  OVERSET_TEXT = "overset_text",
  BROKEN_THREADING = "broken_threading",
  POOR_SPACING = "poor_spacing",
  INCONSISTENT_STYLES = "inconsistent_styles",
  SPATIAL_OVERLAP = "spatial_overlap",
  EMPTY_FRAMES = "empty_frames",
  MISSING_CONTENT = "missing_content"
}

export enum IssueSeverity {
  CRITICAL = "critical",
  WARNING = "warning", 
  INFO = "info"
}

/**
 * Main document state analysis function
 * Provides comprehensive document intelligence similar to BlenderMCP's scene analysis
 */
export async function analyzeDocumentState(): Promise<DocumentState> {
  // This would integrate with actual InDesign tools in real implementation
  // For now, providing structure and placeholder logic
  
  const state: DocumentState = {
    isValid: false,
    applicationStatus: null,
    pageInfo: [],
    textFrames: [],
    textContent: "",
    hasOversetText: false,
    threadingIntegrity: true,
    documentType: DocumentType.UNKNOWN,
    spatialAnalysis: {
      totalPages: 0,
      averageTextDensity: 0,
      frameDistribution: [],
      marginUsage: {
        topMarginAverage: 0,
        bottomMarginAverage: 0,
        leftMarginAverage: 0,
        rightMarginAverage: 0,
        whiteSpaceRatio: 0
      },
      threadingMap: [],
      availableSpace: []
    },
    issues: []
  };

  // In real implementation, this would call actual MCP tools:
  // const appStatus = await callTool('indesign_status');
  // const pageInfo = await callTool('get_page_info');
  // const textFrames = await callTool('get_textframe_info');
  // const textContent = await callTool('get_document_text');

  return state;
}

/**
 * Document type classification based on content and structure
 */
export function classifyDocumentType(state: Partial<DocumentState>): DocumentType {
  if (!state.pageInfo || state.pageInfo.length === 0) {
    return DocumentType.EMPTY;
  }

  const pageCount = state.pageInfo.length;
  const frameCount = state.textFrames?.length || 0;
  const hasMultipleFrames = frameCount > 3;
  const hasThreading = state.spatialAnalysis?.threadingMap.length || 0 > 0;

  // Classification logic based on document characteristics
  if (pageCount === 1 && frameCount <= 2) {
    return DocumentType.BROCHURE;
  }
  
  if (pageCount > 1 && pageCount <= 4 && hasMultipleFrames) {
    return DocumentType.NEWSLETTER;
  }
  
  if (pageCount > 4 && pageCount <= 20 && hasThreading) {
    return DocumentType.MAGAZINE;
  }
  
  if (pageCount > 20) {
    return DocumentType.BOOK;
  }
  
  if (pageCount >= 2 && !hasMultipleFrames) {
    return DocumentType.REPORT;
  }

  return DocumentType.UNKNOWN;
}

/**
 * Spatial analysis for layout intelligence
 */
export function analyzeSpatialLayout(
  pageInfo: PageInfo[], 
  textFrames: TextFrameInfo[]
): SpatialAnalysis {
  const analysis: SpatialAnalysis = {
    totalPages: pageInfo.length,
    averageTextDensity: 0,
    frameDistribution: [],
    marginUsage: {
      topMarginAverage: 0,
      bottomMarginAverage: 0,
      leftMarginAverage: 0,
      rightMarginAverage: 0,
      whiteSpaceRatio: 0
    },
    threadingMap: [],
    availableSpace: []
  };

  // Calculate frame distribution per page
  pageInfo.forEach(page => {
    const pageFrames = textFrames.filter(frame => frame.pageNumber === page.number);
    const textDensity = pageFrames.reduce((sum, frame) => sum + frame.contentLength, 0);
    
    analysis.frameDistribution.push({
      pageNumber: page.number,
      frameCount: pageFrames.length,
      textDensity,
      hasOverflow: pageFrames.some(frame => frame.overflows)
    });
  });

  // Calculate average text density
  const totalTextLength = analysis.frameDistribution.reduce((sum, dist) => sum + dist.textDensity, 0);
  analysis.averageTextDensity = analysis.totalPages > 0 ? totalTextLength / analysis.totalPages : 0;

  // Analyze threading connections
  textFrames.forEach(frame => {
    if (frame.hasNext) {
      // In real implementation, would determine target frame
      analysis.threadingMap.push({
        sourceFrame: frame.index,
        targetFrame: frame.index + 1, // simplified
        sourcePage: frame.pageNumber,
        targetPage: frame.pageNumber, // would be calculated
        isValid: true
      });
    }
  });

  return analysis;
}

/**
 * Error detection and validation
 */
export function detectDocumentIssues(state: DocumentState): DocumentIssue[] {
  const issues: DocumentIssue[] = [];

  // Check for overset text
  if (state.hasOversetText) {
    issues.push({
      type: IssueType.OVERSET_TEXT,
      severity: IssueSeverity.CRITICAL,
      description: "Document contains overset text that is not visible",
      suggestedFix: "Use resolve_overset_text() to fix text overflow"
    });
  }

  // Check threading integrity
  if (!state.threadingIntegrity) {
    issues.push({
      type: IssueType.BROKEN_THREADING,
      severity: IssueSeverity.CRITICAL,
      description: "Text frame threading is broken",
      suggestedFix: "Use manage_text_flow() to repair threading connections"
    });
  }

  // Check for empty frames
  const emptyFrames = state.textFrames.filter(frame => frame.contentLength === 0);
  if (emptyFrames.length > 0) {
    issues.push({
      type: IssueType.EMPTY_FRAMES,
      severity: IssueSeverity.WARNING,
      description: `${emptyFrames.length} text frames are empty`,
      suggestedFix: "Add content to empty frames or remove unnecessary frames"
    });
  }

  // Check spatial overlaps
  const overlappingFrames = detectSpatialOverlaps(state.textFrames);
  if (overlappingFrames.length > 0) {
    issues.push({
      type: IssueType.SPATIAL_OVERLAP,
      severity: IssueSeverity.WARNING,
      description: "Some text frames overlap inappropriately",
      suggestedFix: "Use position_textframe() or transform_objects() to adjust positioning"
    });
  }

  return issues;
}

/**
 * Detect spatial overlaps between text frames
 */
function detectSpatialOverlaps(frames: TextFrameInfo[]): TextFrameInfo[] {
  const overlapping: TextFrameInfo[] = [];
  
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      if (frames[i].pageNumber === frames[j].pageNumber) {
        if (boundsOverlap(frames[i].bounds, frames[j].bounds)) {
          overlapping.push(frames[i], frames[j]);
        }
      }
    }
  }
  
  return [...new Set(overlapping)]; // Remove duplicates
}

/**
 * Check if two bounding boxes overlap
 */
function boundsOverlap(
  bounds1: [number, number, number, number], 
  bounds2: [number, number, number, number]
): boolean {
  const [y1a, x1a, y2a, x2a] = bounds1;
  const [y1b, x1b, y2b, x2b] = bounds2;
  
  return !(x2a < x1b || x2b < x1a || y2a < y1b || y2b < y1a);
}

/**
 * Find optimal locations for new content
 */
export function findOptimalContentLocations(
  state: DocumentState,
  contentType: 'text' | 'image' | 'table',
  requiredSize?: { width: number; height: number }
): SpaceRegion[] {
  const optimalRegions: SpaceRegion[] = [];
  
  // Analyze each page for available space
  state.pageInfo.forEach(page => {
    const pageFrames = state.textFrames.filter(frame => frame.pageNumber === page.number);
    
    // Simple algorithm to find empty space
    // In real implementation, would use actual page dimensions and frame bounds
    const estimatedAvailableArea = 500 * 700; // placeholder calculation
    
    if (estimatedAvailableArea > 0) {
      optimalRegions.push({
        pageNumber: page.number,
        bounds: [100, 100, 600, 800], // placeholder bounds
        area: estimatedAvailableArea,
        isOptimalForText: contentType === 'text'
      });
    }
  });
  
  return optimalRegions.sort((a, b) => b.area - a.area); // Sort by area, largest first
}

/**
 * Validate document readiness for specific operations
 */
export function validateOperationReadiness(
  operation: string,
  state: DocumentState
): { ready: boolean; blockers: string[]; recommendations: string[] } {
  const blockers: string[] = [];
  const recommendations: string[] = [];

  // Common validation rules
  if (!state.isValid) {
    blockers.push("Document state is invalid");
    recommendations.push("Run document state analysis first");
  }

  // Operation-specific validation
  switch (operation.toLowerCase()) {
    case 'add_text':
      if (state.hasOversetText) {
        blockers.push("Existing overset text must be resolved first");
        recommendations.push("Use resolve_overset_text() before adding new content");
      }
      break;
      
    case 'thread_text_frames':
      if (state.textFrames.length < 2) {
        blockers.push("Need at least 2 text frames to establish threading");
        recommendations.push("Create additional text frames first");
      }
      break;
      
    case 'apply_paragraph_style':
      if (!state.textContent || state.textContent.trim().length === 0) {
        blockers.push("No text content to apply styles to");
        recommendations.push("Add text content before applying styles");
      }
      break;
  }

  return {
    ready: blockers.length === 0,
    blockers,
    recommendations
  };
}

/**
 * Smart document state checking workflow
 * Mandatory function that should be called before any major operation
 */
export async function performMandatoryStateCheck(): Promise<{
  state: DocumentState;
  canProceed: boolean;
  criticalIssues: DocumentIssue[];
  nextRecommendedAction: string;
}> {
  const state = await analyzeDocumentState();
  const issues = detectDocumentIssues(state);
  const criticalIssues = issues.filter(issue => issue.severity === IssueSeverity.CRITICAL);
  
  const canProceed = criticalIssues.length === 0 && state.isValid;
  
  let nextRecommendedAction = "Proceed with intended operation";
  
  if (!canProceed) {
    if (criticalIssues.length > 0) {
      nextRecommendedAction = criticalIssues[0].suggestedFix;
    } else if (!state.isValid) {
      nextRecommendedAction = "Check InDesign application and document status";
    }
  }
  
  return {
    state,
    canProceed,
    criticalIssues,
    nextRecommendedAction
  };
}