/**
 * @fileoverview Loader for reference metrics from test case files
 * Maps test case format to LayoutMetrics format
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { LayoutMetrics } from '../../types.js';

/**
 * Test case file structure
 */
interface TestCase {
  name: string;
  description: string;
  referenceImage: string;
  tolerance: number;
  expectedMetrics: LayoutMetrics;
  fontFallbacks?: Record<string, string[]>;
  pageInfo?: {
    width: number;
    height: number;
  };
  layoutOperations?: Array<{
    tool: string;
    stage: string;
    params: Record<string, any>;
    reasoning: string;
    alternatives: string[];
  }>;
}

/**
 * Load reference metrics from a test case file
 */
export async function loadReferenceMetrics(testCase: string): Promise<LayoutMetrics> {
  const testCasePath = path.join(
    process.cwd(),
    'tests/decision-analysis/test-cases',
    `${testCase}.json`
  );
  
  try {
    const content = await fs.readFile(testCasePath, 'utf-8');
    const data: TestCase = JSON.parse(content);
    
    if (!data.expectedMetrics) {
      throw new Error(`Test case ${testCase} missing expectedMetrics`);
    }
    
    // Return the expected metrics directly
    return data.expectedMetrics;
  } catch (error) {
    console.error(`Failed to load reference metrics for ${testCase}:`, error);
    throw new Error(`Could not load test case: ${testCase}`);
  }
}

/**
 * Load full test case data
 */
export async function loadTestCase(testCase: string): Promise<TestCase> {
  const testCasePath = path.join(
    process.cwd(),
    'tests/decision-analysis/test-cases',
    `${testCase}.json`
  );
  
  try {
    const content = await fs.readFile(testCasePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load test case ${testCase}:`, error);
    throw new Error(`Could not load test case: ${testCase}`);
  }
}

/**
 * Get reference image path for a test case
 */
export async function getReferenceImagePath(testCase: string): Promise<string> {
  const data = await loadTestCase(testCase);
  
  // Handle relative paths
  if (data.referenceImage.startsWith('../')) {
    return path.join(
      process.cwd(),
      'tests/decision-analysis/test-cases',
      data.referenceImage
    );
  }
  
  return data.referenceImage;
}

/**
 * Get font fallbacks for a test case
 */
export async function getFontFallbacks(testCase: string): Promise<Record<string, string[]> | undefined> {
  const data = await loadTestCase(testCase);
  return data.fontFallbacks;
}