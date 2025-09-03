// src/illustrator/types.ts

/**
 * @fileoverview Type definitions for Illustrator MCP tools
 */

/**
 * Represents a point in 2D space
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Represents dimensions
 */
export interface Dimensions {
  width?: number;
  height?: number;
  radius?: number;
}

/**
 * Color representation
 */
export interface ColorValue {
  type: 'RGB' | 'CMYK' | 'HEX' | 'SPOT';
  value: number[] | string;
}

/**
 * Style attributes for shapes
 */
export interface StyleAttributes {
  fill?: ColorValue | string;
  stroke?: ColorValue | string;
  strokeWidth?: number;
  opacity?: number;
}

/**
 * Shape types supported by Illustrator
 */
export type ShapeType = 'rectangle' | 'ellipse' | 'polygon' | 'star' | 'line' | 'bezier';

/**
 * Element selection criteria
 */
export interface SelectionCriteria {
  type?: 'path' | 'text' | 'group' | 'symbol' | 'all';
  layer?: string;
  name?: string;
  hasAttribute?: string;
  withinBounds?: {
    top: number;
    left: number;
    bottom: number;
    right: number;
  };
}

/**
 * Transformation parameters
 */
export interface TransformParams {
  position?: Point;
  scale?: { x: number; y: number } | number;
  rotation?: number;
  skew?: { x: number; y: number };
}

/**
 * Export options
 */
export interface ExportOptions {
  format: 'PNG' | 'JPEG' | 'SVG' | 'PDF' | 'AI' | 'EPS';
  resolution?: number;
  quality?: number;
  artboard?: number | 'all' | 'range';
  embedImages?: boolean;
  preserveEditability?: boolean;
}

/**
 * Document information returned by read_illustrator_document
 */
export interface DocumentInfo {
  name: string;
  path?: string;
  artboards: Array<{
    name: string;
    index: number;
    bounds: number[];
  }>;
  layers: Array<{
    name: string;
    visible: boolean;
    locked: boolean;
    sublayers?: any[];
  }>;
  colors: ColorValue[];
  fonts?: string[];
  symbols?: string[];
  pageItems: number;
}

/**
 * Result from measure_relationships
 */
export interface MeasurementResult {
  distance?: number;
  angle?: number;
  overlap?: boolean;
  bounds1?: number[];
  bounds2?: number[];
}

/**
 * Grid layout options
 */
export interface GridLayoutOptions {
  rows: number;
  columns: number;
  spacing: { x: number; y: number };
  startPosition?: Point;
}

/**
 * Path point with bezier handles
 */
export interface PathPoint {
  anchor: Point;
  leftDirection?: Point;
  rightDirection?: Point;
  pointType?: 'smooth' | 'corner';
}

/**
 * Data binding configuration
 */
export interface DataBindingConfig {
  dataSource: 'csv' | 'json' | 'external';
  dataPath: string;
  mappings: Array<{
    dataField: string;
    targetElement: string;
    updateStrategy: 'replace' | 'append' | 'merge';
  }>;
}

/**
 * Generic result type for Illustrator operations
 */
export interface IllustratorResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}