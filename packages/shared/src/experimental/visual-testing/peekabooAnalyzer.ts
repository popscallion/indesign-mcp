/**
 * @fileoverview Peekaboo visual analysis integration for InDesign MCP
 * Provides semantic visual comparison using AI-powered image analysis
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Visual analysis result from Peekaboo
 */
export interface VisualAnalysis {
  similarity: number;      // 0-100 similarity score
  feedback: string;        // Full semantic description
  differences: string[];   // List of key differences
  rawOutput?: string;      // Raw Peekaboo output for debugging
}

/**
 * Peekaboo analyzer for visual testing
 * Uses Peekaboo CLI to analyze InDesign preview images
 */
export class PeekabooAnalyzer {
  private aiProvider: string;
  private aiModel: string;
  private useJsonOutput: boolean;
  
  constructor(
    provider = 'anthropic',
    model = 'claude-3-5-sonnet',
    useJsonOutput = true
  ) {
    this.aiProvider = provider;
    this.aiModel = model;
    this.useJsonOutput = useJsonOutput;
  }
  
  /**
   * Check if Peekaboo is installed and available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('which peekaboo');
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }
  
  /**
   * Analyze a preview image against a reference
   */
  async analyzePreview(
    previewPath: string,
    referenceImage: string
  ): Promise<VisualAnalysis> {
    // Verify files exist
    try {
      await fs.access(previewPath);
    } catch (error) {
      throw new Error(`Preview image not found: ${previewPath}`);
    }
    
    try {
      await fs.access(referenceImage);
    } catch (error) {
      throw new Error(`Reference image not found: ${referenceImage}`);
    }
    
    // Build Peekaboo command
    const jsonFlag = this.useJsonOutput ? '--json-output' : '';
    const question = this.buildAnalysisQuestion();
    
    const command = `peekaboo image \\
      --path "${previewPath}" \\
      --analyze "${question}" \\
      --ai-provider ${this.aiProvider} \\
      --ai-model ${this.aiModel} \\
      ${jsonFlag}`.replace(/\s+/g, ' ');
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30 second timeout for AI analysis
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      if (stderr && !stderr.includes('Warning')) {
        console.warn('Peekaboo stderr:', stderr);
      }
      
      return this.parseAnalysis(stdout, referenceImage);
    } catch (error: any) {
      // Fallback for when Peekaboo is not available
      console.warn(`Peekaboo analysis failed: ${error.message}`);
      return this.createFallbackAnalysis();
    }
  }
  
  /**
   * Build the analysis question for Peekaboo
   */
  private buildAnalysisQuestion(): string {
    return `Compare this InDesign layout to a reference design. 
    Analyze these aspects:
    1. Text hierarchy and sizes - are headings, body text sized correctly?
    2. Positioning and alignment - are elements in the right places?
    3. Spacing and margins - are gaps between elements correct?
    4. Overall visual similarity - rate 0-100 where 100 is perfect match.
    
    Provide:
    - A similarity score (0-100)
    - List of key differences
    - Specific measurements where possible`;
  }
  
  /**
   * Parse Peekaboo output into structured analysis
   */
  private parseAnalysis(output: string, referenceImage: string): VisualAnalysis {
    let similarity = 50; // Default middle score
    const differences: string[] = [];
    let feedback = output;
    
    // Try to parse JSON output if available
    if (this.useJsonOutput) {
      try {
        const json = JSON.parse(output);
        if (json.similarity !== undefined) {
          similarity = json.similarity;
        }
        if (json.differences) {
          differences.push(...json.differences);
        }
        if (json.analysis) {
          feedback = json.analysis;
        }
      } catch {
        // Fall back to text parsing
      }
    }
    
    // Text-based parsing fallback
    if (!this.useJsonOutput || differences.length === 0) {
      // Look for similarity score
      const scoreMatch = output.match(/similarity:?\s*(\d+)/i) ||
                        output.match(/(\d+)%?\s*similar/i) ||
                        output.match(/score:?\s*(\d+)/i);
      if (scoreMatch) {
        similarity = parseInt(scoreMatch[1]);
      }
      
      // Extract differences
      const diffPatterns = [
        /difference:?\s*(.+)/gi,
        /- (.+differs?.+)/gi,
        /- (.+incorrect.+)/gi,
        /- (.+should be.+)/gi
      ];
      
      for (const pattern of diffPatterns) {
        const matches = output.matchAll(pattern);
        for (const match of matches) {
          differences.push(match[1].trim());
        }
      }
    }
    
    // Ensure similarity is in valid range
    similarity = Math.max(0, Math.min(100, similarity));
    
    return {
      similarity,
      feedback,
      differences: differences.length > 0 ? differences : ['Unable to extract specific differences'],
      rawOutput: output
    };
  }
  
  /**
   * Create fallback analysis when Peekaboo is unavailable
   */
  private createFallbackAnalysis(): VisualAnalysis {
    return {
      similarity: -1,
      feedback: 'Peekaboo visual analysis unavailable - using metrics-only comparison',
      differences: ['Visual analysis not performed'],
      rawOutput: 'Peekaboo not available or command failed'
    };
  }
  
  /**
   * Compare two images directly for visual differences
   */
  async compareImages(
    image1Path: string,
    image2Path: string
  ): Promise<VisualAnalysis> {
    const question = `Compare these two InDesign layouts.
      Rate their visual similarity 0-100.
      List all visual differences in:
      - Text size and positioning
      - Layout and alignment
      - Spacing and margins
      - Any missing or extra elements`;
    
    const jsonFlag = this.useJsonOutput ? '--json-output' : '';
    const command = `peekaboo image \\
      --path "${image1Path}" \\
      --analyze "${question}" \\
      --reference "${image2Path}" \\
      --ai-provider ${this.aiProvider} \\
      --ai-model ${this.aiModel} \\
      ${jsonFlag}`.replace(/\s+/g, ' ');
    
    try {
      const { stdout } = await execAsync(command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 10
      });
      
      return this.parseAnalysis(stdout, image2Path);
    } catch (error: any) {
      console.warn(`Image comparison failed: ${error.message}`);
      return this.createFallbackAnalysis();
    }
  }
}

/**
 * Factory function to create analyzer with environment config
 */
export function createPeekabooAnalyzer(): PeekabooAnalyzer {
  const provider = process.env.PEEKABOO_AI_PROVIDER || 'anthropic';
  const model = process.env.PEEKABOO_AI_MODEL || 'claude-3-5-sonnet';
  const useJson = process.env.PEEKABOO_JSON_OUTPUT !== 'false';
  
  return new PeekabooAnalyzer(provider, model, useJson);
}