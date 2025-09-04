/**
 * @fileoverview Bridge between evolutionary test runner and MCP tools
 * Provides methods to call MCP tools directly for test orchestration
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createInDesignMcpServer } from '../../index.js';
import { LayoutMetrics, ComparisonResult } from '../../types.js';
import { executeExtendScript } from '../../extendscript.js';
import * as os from 'os';
import * as path from 'path';
import { PeekabooAnalyzer, VisualAnalysis } from '../visual-testing/peekabooAnalyzer.js';

/**
 * MCP Bridge for test orchestration
 * Allows direct tool calls without going through the full MCP protocol
 */
export class McpBridge {
  private server: McpServer | null = null;
  private tools: Map<string, { schema: any; handler: Function }> = new Map();
  private telemetryEnabled: boolean = false;
  private peekabooAnalyzer: PeekabooAnalyzer | null = null;
  
  /**
   * Initialize the bridge with a telemetry-enabled server
   */
  async initialize(enableTelemetry: boolean = false): Promise<void> {
    this.telemetryEnabled = enableTelemetry;
    
    // CRITICAL: Set telemetry BEFORE creating server
    const { setTelemetryEnabled } = await import('../../tools/index.js');
    setTelemetryEnabled(enableTelemetry);
    
    // Initialize telemetry directory early
    if (enableTelemetry) {
      const { TelemetryCapture } = await import('../../tools/telemetry.js');
      await TelemetryCapture.initializeTelemetryDir();
    }
    
    // Now capture tool handlers with telemetry already enabled
    await this.captureToolHandlers();
  }
  
  /**
   * Capture tool handlers by intercepting registrations
   */
  private async captureToolHandlers(): Promise<void> {
    // Override the tool method temporarily to capture handlers
    const originalTool = McpServer.prototype.tool;
    const capturedTools = this.tools;
    
    // Override the tool method temporarily – accept variable arg shapes used by MCP
     
    // @ts-ignore: runtime monkey-patching for capture only
    McpServer.prototype.tool = function (this: any, ...args: any[]) {
      const name = args[0];
      const schema = args.length >= 3 ? args[1] : undefined;
      const handler = args.length >= 3 ? args[2] : args[1];
      capturedTools.set(name, { schema, handler });
      return originalTool.apply(this, args as unknown as Parameters<typeof originalTool>);
    } as any;
    
    try {
      // Create server with proper telemetry flag
      this.server = await createInDesignMcpServer(this.telemetryEnabled);
    } finally {
      // Restore original method
      McpServer.prototype.tool = originalTool;
    }
    
    // Suppress sendLoggingMessage for testing (no transport connected)
    if (this.server) {
      (this.server as any).sendLoggingMessage = () => Promise.resolve();
      // Some tools access server.server.sendLoggingMessage
      (this.server as any).server = { sendLoggingMessage: () => Promise.resolve() };
    }
    
    console.log(`Captured ${this.tools.size} MCP tools for direct execution`);
  }
  
  /**
   * Check InDesign state and ensure a document is open
   */
  async checkInDesignState(): Promise<void> {
    try {
      // Check if a document is open
      const status = await this.callTool('indesign_status', {});
      const statusText = status.content[0].text;
      
      if (statusText.includes('Documents open: 0')) {
        console.log('⚠️  No document open - please open a document in InDesign');
        throw new Error('No document open in InDesign');
      } else {
        console.log('✓ Document is open and ready');
      }
    } catch (e) {
      console.error('Failed to check InDesign status:', e);
      throw e;
    }
  }
  
  /**
   * Reset InDesign document to clean state
   */
  async resetDocument(): Promise<void> {
    const script = `
      if (app.documents.length === 0) {
        // Create a new document if none exists
        var doc = app.documents.add();
        "Created new document";
      } else {
        var doc = app.activeDocument;
        
        // Clear all page items (more thorough than just text frames)
        for (var p = doc.pages.length - 1; p >= 0; p--) {
          var page = doc.pages[p];
          
          // Remove all page items (includes text frames, images, shapes, etc.)
          for (var i = page.allPageItems.length - 1; i >= 0; i--) {
            try {
              page.allPageItems[i].remove();
            } catch (e) {
              // Some items might be locked or on master pages
            }
          }
        }
        
        // Also clear stories that might not be in frames
        for (var s = doc.stories.length - 1; s >= 0; s--) {
          try {
            if (doc.stories[s].textContainers.length === 0) {
              doc.stories[s].contents = "";
            }
          } catch (e) {
            // Some stories might be protected
          }
        }
        
        // Remove custom paragraph styles (keep built-in ones)
        for (var ps = doc.paragraphStyles.length - 1; ps >= 0; ps--) {
          var style = doc.paragraphStyles[ps];
          try {
            // Only remove custom styles, not built-in ones like [No Paragraph Style], [Basic Paragraph]
            if (style.name !== "[No Paragraph Style]" && 
                style.name !== "[Basic Paragraph]" &&
                style.name !== "NormalParagraphStyle" &&
                !style.name.match(/^\\[.*\\]$/)) {
              style.remove();
            }
          } catch (e) {
            // Style might be in use or protected
          }
        }
        
        // Remove custom character styles (keep built-in ones)
        for (var cs = doc.characterStyles.length - 1; cs >= 0; cs--) {
          var charStyle = doc.characterStyles[cs];
          try {
            // Only remove custom styles, not built-in ones like [None]
            if (charStyle.name !== "[None]" && 
                charStyle.name !== "NormalCharacterStyle" &&
                !charStyle.name.match(/^\\[.*\\]$/)) {
              charStyle.remove();
            }
          } catch (e) {
            // Style might be in use or protected
          }
        }
        
        "Document cleared successfully";
      }
    `;
    
    const result = await executeExtendScript(script);
    
    if (!result.success) {
      throw new Error(`Failed to reset document: ${result.error}`);
    }
    
    console.log('✓ Document reset to clean state');
  }
  
  /**
   * Reset InDesign to clean state
   * Actually resets the document, not just checks it
   */
  async resetInDesignState(): Promise<void> {
    await this.checkInDesignState();
    await this.resetDocument();  // Actually reset!
  }
  
  /**
   * Save the current document state
   */
  async saveDocumentState(filename: string): Promise<void> {
    const filePath = path.join(os.tmpdir(), 'evolution_tests', 'documents', `${filename}.indd`);
    
    await this.callTool('save_document', {
      filePath,
      copy: true // Save as copy to not change current document
    });
  }
  
  /**
   * Extract layout metrics from current document
   */
  async extractLayoutMetrics(pageNumber: number = -1): Promise<LayoutMetrics> {
    // We need to get the raw metrics data, not the formatted output
    // Let's use the ExtendScript template directly
    const { generateVisualAttributesExtraction } = await import('../../tools/analysis/extendscript-templates.js');
    const script = generateVisualAttributesExtraction(pageNumber, true, true);
    
    // Debug: Log the generated script
    console.log('Generated ExtendScript:', script.substring(0, 500) + '...');
    
    const result = await executeExtendScript(script);
    
    if (!result.success) {
      throw new Error(`Failed to extract layout metrics: ${result.error}`);
    }
    
    // Parse the JSON result directly
    try {
      const metrics: LayoutMetrics = JSON.parse(result.result!);
      return metrics;
    } catch (e) {
      console.error('Failed to parse metrics JSON:', result.result);
      throw new Error('Invalid metrics JSON from ExtendScript');
    }
  }
  
  /**
   * Compare layout metrics to reference
   */
  async compareToReference(
    referenceMetrics: LayoutMetrics,
    tolerance: number = 0.05
  ): Promise<ComparisonResult> {
    // The tool extracts current metrics internally
    const result = await this.callTool('compare_to_reference', {
      reference_metrics: referenceMetrics,
      tolerance,
      check_types: ['frames', 'margins', 'styles', 'textRegions']
    });
    
    // Parse the comparison result
    return this.parseComparisonResult(result);
  }
  
  /**
   * Enable visual testing with Peekaboo
   */
  async enableVisualTesting(): Promise<void> {
    const provider = process.env.PEEKABOO_AI_PROVIDER || 'anthropic';
    const model = process.env.PEEKABOO_AI_MODEL || 'claude-3-5-sonnet';
    this.peekabooAnalyzer = new PeekabooAnalyzer(provider, model);
    
    // Check if Peekaboo is available
    const isAvailable = await this.peekabooAnalyzer.isAvailable();
    if (!isAvailable) {
      console.warn('⚠️  Peekaboo not available - visual analysis will use fallback mode');
    } else {
      console.log('✓ Peekaboo visual testing enabled');
    }
  }
  
  /**
   * Compare with visual analysis using Peekaboo
   */
  async compareWithVisualAnalysis(
    referenceMetrics: LayoutMetrics,
    referenceImage: string,
    tolerance: number = 0.05
  ): Promise<ComparisonResult> {
    // First get metrics-based comparison
    const metricsComparison = await this.compareToReference(referenceMetrics, tolerance);
    
    // Generate high-quality preview
    const previewResult = await this.callTool('preview_document', {
      quality: 'high',  // 300 DPI for detailed comparison
      auto_cleanup: false
    });
    
    // Extract file path from preview result
    const previewText = previewResult.content?.[0]?.text || '';
    const filePathMatch = previewText.match(/FILE LOCATION.*?: (.+?)(?:\n|$)/);
    const previewPath = filePathMatch?.[1]?.trim();
    
    if (!previewPath) {
      console.warn('⚠️  Could not extract preview path from result');
      return metricsComparison;
    }
    
    // If visual testing is enabled, add visual analysis
    if (this.peekabooAnalyzer) {
      try {
        const visualAnalysis = await this.peekabooAnalyzer.analyzePreview(
          previewPath,
          referenceImage
        );
        
        // Merge visual analysis with metrics comparison
        return this.mergeAnalysisResults(metricsComparison, visualAnalysis);
      } catch (error) {
        console.warn('⚠️  Visual analysis failed:', error);
        return metricsComparison;
      }
    }
    
    return metricsComparison;
  }
  
  /**
   * Merge metrics comparison with visual analysis
   */
  private mergeAnalysisResults(
    metricsComparison: ComparisonResult,
    visualAnalysis: VisualAnalysis
  ): ComparisonResult {
    // If visual analysis failed (similarity -1), use metrics only
    if (visualAnalysis.similarity < 0) {
      return {
        ...metricsComparison,
        visualFeedback: visualAnalysis.feedback
      };
    }
    
    // Calculate combined score (50/50 weight)
    const combinedScore = Math.round(
      (metricsComparison.score + visualAnalysis.similarity) / 2
    );
    
    // Add visual differences to deviations
    const visualDeviations = visualAnalysis.differences.map(diff => ({
      type: 'visual',
      field: 'appearance',
      expected: 'matches reference',
      actual: diff,
      deviation: 100 - visualAnalysis.similarity
    }));
    
    return {
      match: combinedScore >= 85,
      score: combinedScore,
      deviations: [...(metricsComparison.deviations || []), ...visualDeviations],
      visualFeedback: visualAnalysis.feedback,
      visualSimilarity: visualAnalysis.similarity,
      metricsScore: metricsComparison.score
    };
  }
  
  /**
   * Create a document from reference metrics
   */
  async createDocumentFromReference(metrics: LayoutMetrics): Promise<void> {
    // Since we don't have a create_document tool, we'll work with existing document
    // and set up the margins/columns using available tools
    
    // For now, we assume a document is already open
    // In the future, we might need to create a custom ExtendScript for document creation
    
    console.log('Note: createDocumentFromReference assumes a document is already open');
    console.log('Reference metrics:', {
      margins: metrics.margins,
      columns: metrics.columns
    });
  }
  
  /**
   * Apply a batch of improvements to the document
   */
  async applyStyleImprovements(improvements: Array<{
    styleName: string;
    fontSize?: number;
    fontFamily?: string;
    alignment?: string;
  }>): Promise<void> {
    for (const improvement of improvements) {
      await this.callTool('create_paragraph_style', {
        style_name: improvement.styleName,
        font_size: improvement.fontSize,
        font_family: improvement.fontFamily,
        alignment: improvement.alignment
      });
    }
  }
  
  /**
   * Call an MCP tool directly
   */
  async callTool(toolName: string, params: any): Promise<any> {
    const tool = this.tools.get(toolName);
    
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found. Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
    }
    
    try {
      // Execute the tool handler directly
      console.log(`Executing tool: ${toolName}`);
      const result = await tool.handler(params);
      
      // Tools return content in MCP format
      return result;
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      throw error;
    }
  }
  
  /**
   * Parse comparison result from tool output
   */
  private parseComparisonResult(toolOutput: any): ComparisonResult {
    try {
      const content = toolOutput.content?.[0]?.text || '';
      
      // The compare_to_reference tool returns formatted text
      // Extract the key information
      const result: ComparisonResult = {
        match: false,
        score: 0,
        deviations: []
      };
      
      // Look for the match status
      if (content.includes('✅ PASS')) {
        result.match = true;
      }
      
      // Extract score
      const scoreMatch = content.match(/Score:\s*(\d+)%/);
      if (scoreMatch) {
        result.score = parseInt(scoreMatch[1]);
      }
      
      // Extract deviations (simplified for now)
      const deviationMatches = content.matchAll(/•\s*(\w+)\s*-\s*([^:]+):\s*Expected\s*([^,]+),\s*Got\s*([^\s]+)\s*\((\d+)%/g);
      for (const match of deviationMatches) {
        result.deviations.push({
          type: match[1],
          field: match[2].trim(),
          expected: match[3].trim(),
          actual: match[4].trim(),
          deviation: parseInt(match[5])
        });
      }
      
      return result;
    } catch (error) {
      console.error('Failed to parse comparison result:', error);
      return {
        match: false,
        score: 0,
        deviations: []
      };
    }
  }
  
  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.server = null;
    this.tools.clear();
  }
}

/**
 * Singleton instance for test usage
 */
let bridgeInstance: McpBridge | null = null;

/**
 * Get or create MCP bridge instance
 */
export function getMcpBridge(): McpBridge {
  if (!bridgeInstance) {
    bridgeInstance = new McpBridge();
  }
  return bridgeInstance;
}