/**
 * @fileoverview TypeScript type definitions for InDesign MCP server
 * Provides strongly-typed interfaces for ExtendScript execution and tool parameters
 */

/**
 * Result type for ExtendScript execution
 */
export interface ExtendScriptResult {
  success: boolean;
  result?: string;
  error?: string;
}

/**
 * Base interface for all tool execution results
 */
export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * InDesign application status information
 */
export interface InDesignStatus {
  applicationName: string;
  version: string;
  documentsOpen: number;
  activeDocument?: {
    name: string;
    stories: number;
    pages: number;
    textFrames: number;
  };
}

/**
 * Text frame information structure
 */
export interface TextFrameInfo {
  index: number;
  pageNumber: number;
  bounds: [number, number, number, number]; // [y1, x1, y2, x2]
  contentLength: number;
  overflows: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  layerName?: string;
}

/**
 * Page information structure
 */
export interface PageInfo {
  number: number;
  name: string;
  masterPage?: string;
  textFrames: number;
  allItems: number;
}

/**
 * Style information structure
 */
export interface StyleInfo {
  name: string;
  fontSize?: number;
  fontFamily?: string;
  properties: Record<string, any>;
}

/**
 * Alignment options for paragraph styles
 */
export type TextAlignment = "left" | "center" | "right" | "justify";

/**
 * Position options for text insertion
 */
export type TextPosition = "start" | "end" | "after_selection" | "cursor";

/**
 * Selection types for text range selection
 */
export type SelectionType = "paragraph_number" | "text_content" | "story_range";

/**
 * Page location options for adding pages
 */
export type PageLocation = "beginning" | "end" | "after_current";

/**
 * Frame scope options for threading
 */
export type FrameScope = "document" | "page";

/**
 * Special character types that can be inserted
 */
export type SpecialCharacterType = 
  | "auto_page_number"
  | "next_page_number" 
  | "previous_page_number"
  | "em_dash"
  | "en_dash"
  | "copyright"
  | "registered"
  | "trademark"
  | "section_symbol"
  | "paragraph_symbol"
  | "bullet"
  | "ellipsis"
  | "forced_line_break"
  | "column_break"
  | "frame_break"
  | "page_break";

/**
 * Layer management actions
 */
export type LayerAction = "create" | "delete" | "rename" | "list";

/**
 * Text flow management actions  
 */
export type TextFlowAction = "break_thread" | "check_flow" | "list_threaded" | "thread_chain";

/**
 * Font style options
 */
export type FontStyle = "Regular" | "Bold" | "Italic" | "Bold Italic";

/**
 * Common layer colors available in InDesign
 */
export type LayerColor = "Light Blue" | "Red" | "Green" | "Blue" | "Yellow" | "Magenta" | "Cyan" | "Gray" | "Black" | "Orange" | "Dark Green" | "Teal" | "Tan" | "Brown" | "Violet" | "Gold" | "Dark Blue" | "Pink" | "Lavender" | "Brick Red" | "Olive Green" | "Peach" | "Burgundy" | "Grass Green" | "Ochre" | "Purple" | "Light Gray" | "Charcoal";

/**
 * Document export formats supported by InDesign
 */
export type ExportFormat = "PDF" | "EPUB" | "HTML" | "IDML" | "JPEG" | "PNG" | "EPS";

/**
 * Export quality options
 */
export type ExportQuality = "high" | "medium" | "low";

/**
 * Document export options
 */
export interface DocumentExportOptions {
  format: ExportFormat;
  path: string;
  quality?: ExportQuality;
  pages?: string; // "all", "1-5", "3,7,9"
  spreads?: boolean;
}

/**
 * File import options
 */
export interface ImportOptions {
  path: string;
  linkFile?: boolean;
  showOptions?: boolean;
  retainFormat?: boolean;
}

/**
 * Page dimensions information
 */
export interface PageDimensions {
  width: number;
  height: number;
  bounds: [number, number, number, number]; // [y1, x1, y2, x2]
  margins: {
    top: number;
    left: number;
    bottom: number;
    right: number;
  };
  orientation: "portrait" | "landscape";
}

/**
 * Object transformation types
 */
export type TransformationType = "move" | "scale" | "rotate" | "skew";

/**
 * Alignment options for objects
 */
export type AlignmentType = "left" | "center" | "right" | "top" | "middle" | "bottom";

/**
 * Distribution options for objects  
 */
export type DistributionType = "horizontal" | "vertical";

/**
 * Transform values for different transformation types
 */
export interface TransformValues {
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  skewAngle?: number;
}

/**
 * Object selection criteria
 */
export interface ObjectSelection {
  type?: "all" | "text" | "image" | "shape";
  layer?: string;
  page?: number;
}

/**
 * Strategic prompt response structure
 */
export interface PromptResult {
  strategy: string;
  metadata?: {
    promptType: string;
    version: string;
    applicableContext: string[];
  };
}

/**
 * Document workflow context for strategic guidance
 */
export interface WorkflowContext {
  documentType?: "magazine" | "report" | "brochure" | "book" | "newsletter";
  currentOperation?: string;
  documentState?: {
    pageCount: number;
    hasOversetText: boolean;
    textFrameCount: number;
    threadingIntegrity: boolean;
  };
  userExperience?: "beginner" | "intermediate" | "advanced";
}

/**
 * Decision checkpoint for tracking LLM reasoning
 */
export interface DecisionCheckpoint {
  stage: 'layout' | 'styling' | 'threading' | 'final';
  decision: string;
  alternatives: string[];
  reasoning: string;
  timestamp: string;
}

/**
 * Frame metrics for layout analysis
 */
export interface FrameMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
  hasText: boolean;
  contentLength: number;
  overflows: boolean;
}

/**
 * Margin metrics for layout analysis
 */
export interface MarginMetrics {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/**
 * Style metrics for layout analysis
 */
export interface StyleMetrics {
  name: string;
  fontSize: number;
  fontFamily: string;
}

/**
 * Complete layout metrics for a page
 */
export interface LayoutMetrics {
  frames: FrameMetrics[];
  margins: MarginMetrics;
  columns: number;
  styles?: StyleMetrics[];  // Optional for backward compatibility
  textRegions?: TextRegion[];  // Visual formatting regions
}

/**
 * Layout deviation information
 */
export interface Deviation {
  type: string;
  field: string;
  expected: any;
  actual: any;
  deviation: number;
}

/**
 * Result of layout comparison
 */
export interface ComparisonResult {
  match: boolean;
  score: number;
  deviations: Deviation[];
}

/**
 * Visual attributes for text formatting
 */
export interface VisualAttributes {
  fontSize: number;
  leading: number;
  fontFamily: string;
  fontStyle: string;
  alignment: 'left' | 'center' | 'right' | 'justify';
  firstLineIndent: number;
  leftIndent: number;
}

/**
 * Text region containing multiple formatted segments
 */
export interface TextRegion {
  frameIndex: number;
  regions: TextSegment[];
}

/**
 * Individual text segment with formatting
 */
export interface TextSegment {
  textSnippet: string;
  visualAttributes: VisualAttributes;
  description: string;
}

/**
 * Information about a system font available to InDesign
 */
export interface SystemFont {
  fontFamily: string;
  fontStyle: string;
  fullName: string;
  status: string; // e.g., "INSTALLED", "MISSING", etc.
}