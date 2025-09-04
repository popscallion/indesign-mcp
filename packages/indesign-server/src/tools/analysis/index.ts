/**
 * @fileoverview Decision analysis tools for InDesign MCP
 * Tools for tracking LLM decision-making and comparing layouts
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeExtendScript } from "../../extendscript.js";
import type { DecisionCheckpoint, LayoutMetrics, ComparisonResult } from "../../types.js";
import { generateVisualAttributesExtraction } from "./extendscript-templates.js";

// In-memory storage for decision checkpoints
const decisionLog: DecisionCheckpoint[] = [];

/**
 * Registers decision analysis tools with the MCP server
 */
export async function registerAnalysisTools(server: McpServer): Promise<void> {
  // Register record_decision tool
  server.tool(
    "record_decision",
    {
      stage: z.enum(["layout", "styling", "threading", "final"]).describe("Decision stage"),
      decision: z.string().describe("What was decided"),
      alternatives: z.array(z.string()).describe("Other options considered"),
      reasoning: z.string().describe("Why this choice was made")
    },
    async (args) => {
      const checkpoint: DecisionCheckpoint = {
        stage: args.stage,
        decision: args.decision,
        alternatives: args.alternatives,
        reasoning: args.reasoning,
        timestamp: new Date().toISOString()
      };
      
      decisionLog.push(checkpoint);
      
      // Log decision as changeSummary patch for tracking
      await (server as any).server.sendLoggingMessage({
        level: "info",
        logger: "decision-analysis",
        data: {
          tool: "record_decision",
          patches: [{
            op: "add",
            path: `/decisions/${decisionLog.length - 1}`,
            value: checkpoint
          }],
          summary: `Recorded ${args.stage} decision: ${args.decision}`,
          timestamp: checkpoint.timestamp
        }
      });
      
      return {
        content: [{
          type: "text",
          text: `✓ Decision recorded at ${args.stage} stage:\n${args.decision}\n\nTimestamp: ${checkpoint.timestamp}`
        }]
      };
    }
  );

  // Register extract_layout_metrics tool
  server.tool(
    "extract_layout_metrics",
    {
      page_number: z.number().int().default(-1).describe("Page number (1-based), or -1 for current page"),
      include_styles: z.boolean().default(true).describe("Include style information"),
      include_visual_attributes: z.boolean().default(true).describe("Include detailed visual formatting")
    },
    async (args) => {
      const pageNumber = args.page_number || -1;
      const includeStyles = args.include_styles !== false;
      const includeVisualAttributes = args.include_visual_attributes !== false;
      
      const script = generateVisualAttributesExtraction(pageNumber, includeStyles, includeVisualAttributes);
      
      const result = await executeExtendScript(script);
      
      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: `Error extracting layout metrics: ${result.error}`
          }]
        };
      }
      
      // Parse the metrics
      const metrics: LayoutMetrics = JSON.parse(result.result!);
      
      // Format output
      let output = "📏 **Layout Metrics Extracted**\n\n";
      output += `**Page**: ${pageNumber === -1 ? "Current" : pageNumber}\n`;
      output += `**Margins**: Top: ${metrics.margins.top}pt, Left: ${metrics.margins.left}pt, `;
      output += `Bottom: ${metrics.margins.bottom}pt, Right: ${metrics.margins.right}pt\n`;
      output += `**Columns**: ${metrics.columns}\n\n`;
      
      output += `**Text Frames** (${metrics.frames.length} total):\n`;
      metrics.frames.forEach((frame, idx) => {
        output += `  ${idx + 1}. Position: (${frame.x}, ${frame.y}), `;
        output += `Size: ${frame.width}×${frame.height}pt`;
        if (frame.hasText) {
          output += `, ${frame.contentLength} chars`;
          if (frame.overflows) output += " ⚠️ OVERFLOWS";
        } else {
          output += ", Empty";
        }
        output += "\n";
      });
      
      if (includeStyles && metrics.styles && metrics.styles.length > 0) {
        output += `\n**Styles Used**:\n`;
        metrics.styles.forEach(style => {
          output += `  • ${style.name}: ${style.fontSize}pt, ${style.fontFamily}\n`;
        });
      }
      
      if (includeVisualAttributes && metrics.textRegions && metrics.textRegions.length > 0) {
        output += `\n**Text Regions** (Visual Formatting):\n`;
        metrics.textRegions.forEach(region => {
          output += `\n  Frame ${region.frameIndex}:\n`;
          region.regions.forEach((segment, idx) => {
            const va = segment.visualAttributes;
            output += `    ${idx + 1}. "${segment.textSnippet}"\n`;
            output += `       Font: ${va.fontFamily} ${va.fontStyle}, ${va.fontSize}/${va.leading}pt\n`;
            output += `       Align: ${va.alignment}`;
            if (va.firstLineIndent > 0) output += `, First indent: ${va.firstLineIndent}pt`;
            if (va.leftIndent > 0) output += `, Left indent: ${va.leftIndent}pt`;
            output += "\n";
          });
        });
      }
      
      return {
        content: [{
          type: "text",
          text: output
        }]
      };
    }
  );

  // Register compare_to_reference tool
  server.tool(
    "compare_to_reference",
    {
      reference_metrics: z.object({
        frames: z.array(z.object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number(),
          hasText: z.boolean().optional(),
          contentLength: z.number().optional(),
          overflows: z.boolean().optional()
        })),
        margins: z.object({
          top: z.number(),
          left: z.number(),
          bottom: z.number(),
          right: z.number()
        }),
        columns: z.number(),
        styles: z.array(z.object({
          name: z.string(),
          fontSize: z.number(),
          fontFamily: z.string()
        })).optional(),
        textRegions: z.array(z.object({
          frameIndex: z.number(),
          regions: z.array(z.object({
            textSnippet: z.string(),
            visualAttributes: z.object({
              fontSize: z.number(),
              leading: z.number(),
              fontFamily: z.string(),
              fontStyle: z.string(),
              alignment: z.enum(['left', 'center', 'right', 'justify']),
              firstLineIndent: z.number(),
              leftIndent: z.number()
            }),
            description: z.string()
          }))
        })).optional(),
        fontFallbacks: z.record(z.string(), z.array(z.string())).optional().describe("Font fallback mappings")
      }).describe("Reference metrics to compare against"),
      tolerance: z.number().default(0.05).describe("Allowed deviation percentage (0.05 = 5%)"),
      check_types: z.array(z.enum(["frames", "margins", "styles", "textRegions"])).default(["frames", "margins", "styles"])
    },
    async (args) => {
      const tolerance = args.tolerance;
      const checkTypes = args.check_types;
      const reference = args.reference_metrics;
      
      // Extract current metrics using shared template
      const extractScript = generateVisualAttributesExtraction(-1, true, true);
      
      const result = await executeExtendScript(extractScript);
      
      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: `Error getting current metrics: ${result.error}`
          }]
        };
      }
      
      const current: LayoutMetrics = JSON.parse(result.result!);
      
      // Perform comparison
      const comparisonResult: ComparisonResult = {
        match: true,
        score: 100,
        deviations: []
      };
      
      // Helper function to check numeric deviation
      const checkDeviation = (type: string, field: string, expected: number, actual: number) => {
        const deviation = Math.abs(actual - expected) / expected;
        if (deviation > tolerance) {
          comparisonResult.match = false;
          comparisonResult.deviations.push({
            type,
            field,
            expected,
            actual,
            deviation: Math.round(deviation * 100)
          });
        }
        return deviation;
      };
      
      // Compare frames
      if (checkTypes.includes("frames")) {
        if (current.frames.length !== reference.frames.length) {
          comparisonResult.match = false;
          comparisonResult.deviations.push({
            type: "frames",
            field: "count",
            expected: reference.frames.length,
            actual: current.frames.length,
            deviation: 100
          });
        } else {
          reference.frames.forEach((refFrame, idx) => {
            if (idx < current.frames.length) {
              const curFrame = current.frames[idx];
              checkDeviation("frame", `frame[${idx}].x`, refFrame.x, curFrame.x);
              checkDeviation("frame", `frame[${idx}].y`, refFrame.y, curFrame.y);
              checkDeviation("frame", `frame[${idx}].width`, refFrame.width, curFrame.width);
              checkDeviation("frame", `frame[${idx}].height`, refFrame.height, curFrame.height);
            }
          });
        }
      }
      
      // Compare margins
      if (checkTypes.includes("margins")) {
        checkDeviation("margins", "top", reference.margins.top, current.margins.top);
        checkDeviation("margins", "left", reference.margins.left, current.margins.left);
        checkDeviation("margins", "bottom", reference.margins.bottom, current.margins.bottom);
        checkDeviation("margins", "right", reference.margins.right, current.margins.right);
      }
      
      // Compare styles
      if (checkTypes.includes("styles") && reference.styles && current.styles) {
        const curStyleMap = new Map(current.styles.map(s => [s.name, s]));
        
        reference.styles.forEach(refStyle => {
          const curStyle = curStyleMap.get(refStyle.name);
          if (!curStyle) {
            comparisonResult.match = false;
            comparisonResult.deviations.push({
              type: "style",
              field: "missing",
              expected: refStyle.name,
              actual: "not found",
              deviation: 100
            });
          } else {
            checkDeviation("style", `${refStyle.name}.fontSize`, refStyle.fontSize, curStyle.fontSize);
          }
        });
      }
      
      // Compare textRegions (visual attributes)
      if (checkTypes.includes("textRegions") && reference.textRegions && current.textRegions) {
        const currentTextRegions = current.textRegions;
        // Compare each frame's text regions
        reference.textRegions.forEach(refRegion => {
          const curRegion = currentTextRegions.find(r => r.frameIndex === refRegion.frameIndex);
          
          if (!curRegion) {
            comparisonResult.match = false;
            comparisonResult.deviations.push({
              type: "textRegion",
              field: `frame[${refRegion.frameIndex}]`,
              expected: `${refRegion.regions.length} regions`,
              actual: "no regions found",
              deviation: 100
            });
          } else {
            // Compare region count
            if (curRegion.regions.length !== refRegion.regions.length) {
              comparisonResult.match = false;
              comparisonResult.deviations.push({
                type: "textRegion",
                field: `frame[${refRegion.frameIndex}].regionCount`,
                expected: refRegion.regions.length,
                actual: curRegion.regions.length,
                deviation: Math.abs(curRegion.regions.length - refRegion.regions.length) / refRegion.regions.length * 100
              });
            }
            
            // Compare each region's visual attributes
            refRegion.regions.forEach((refSeg, idx) => {
              if (idx < curRegion.regions.length) {
                const curSeg = curRegion.regions[idx];
                const va = refSeg.visualAttributes;
                const curVa = curSeg.visualAttributes;
                
                // Check font size
                checkDeviation("textRegion", `frame[${refRegion.frameIndex}].region[${idx}].fontSize`, 
                  va.fontSize, curVa.fontSize);
                
                // Check leading
                checkDeviation("textRegion", `frame[${refRegion.frameIndex}].region[${idx}].leading`, 
                  va.leading, curVa.leading);
                
                // Check alignment
                if (va.alignment !== curVa.alignment) {
                  comparisonResult.match = false;
                  comparisonResult.deviations.push({
                    type: "textRegion",
                    field: `frame[${refRegion.frameIndex}].region[${idx}].alignment`,
                    expected: va.alignment,
                    actual: curVa.alignment,
                    deviation: 100
                  });
                }
                
                // Check font family (allow fallbacks)
                const fontFallbacks = reference.fontFallbacks;
                let fontMatch = va.fontFamily === curVa.fontFamily;
                if (!fontMatch && fontFallbacks && fontFallbacks[va.fontFamily]) {
                  fontMatch = fontFallbacks[va.fontFamily].includes(curVa.fontFamily);
                }
                
                if (!fontMatch) {
                  comparisonResult.match = false;
                  comparisonResult.deviations.push({
                    type: "textRegion",
                    field: `frame[${refRegion.frameIndex}].region[${idx}].fontFamily`,
                    expected: va.fontFamily,
                    actual: curVa.fontFamily,
                    deviation: 100
                  });
                }
                
                // Check indentation
                checkDeviation("textRegion", `frame[${refRegion.frameIndex}].region[${idx}].firstLineIndent`, 
                  va.firstLineIndent, curVa.firstLineIndent);
                checkDeviation("textRegion", `frame[${refRegion.frameIndex}].region[${idx}].leftIndent`, 
                  va.leftIndent, curVa.leftIndent);
              }
            });
          }
        });
      }
      
      // Calculate overall score
      if (comparisonResult.deviations.length > 0) {
        const avgDeviation = comparisonResult.deviations.reduce((sum, d) => sum + d.deviation, 0) / 
                           comparisonResult.deviations.length;
        comparisonResult.score = Math.max(0, Math.round(100 - avgDeviation));
      }
      
      // Format output
      let output = "📊 **Layout Comparison Results**\n\n";
      output += `**Overall Match**: ${comparisonResult.match ? "✅ PASS" : "❌ FAIL"}\n`;
      output += `**Score**: ${comparisonResult.score}%\n`;
      output += `**Tolerance**: ±${tolerance * 100}%\n\n`;
      
      if (comparisonResult.deviations.length > 0) {
        output += `**Deviations Found** (${comparisonResult.deviations.length}):\n`;
        comparisonResult.deviations.forEach(dev => {
          output += `  • ${dev.type} - ${dev.field}: `;
          output += `Expected ${dev.expected}, Got ${dev.actual} `;
          output += `(${dev.deviation}% off)\n`;
        });
      } else {
        output += "✨ Layout matches reference within tolerance!\n";
      }
      
      // Log comparison result
      await (server as any).server.sendLoggingMessage({
        level: comparisonResult.match ? "info" : "warning",
        logger: "decision-analysis",
        data: {
          tool: "compare_to_reference",
          patches: [{
            op: "add",
            path: "/comparison/latest",
            value: comparisonResult
          }],
          summary: `Comparison ${comparisonResult.match ? "passed" : "failed"} with score ${comparisonResult.score}%`,
          timestamp: new Date().toISOString()
        }
      });
      
      return {
        content: [{
          type: "text",
          text: output
        }]
      };
    }
  );

  // Register get_decision_log tool (bonus for debugging)
  server.tool(
    "get_decision_log",
    {},
    async () => {
      if (decisionLog.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No decisions recorded yet. Use record_decision to track LLM decision-making."
          }]
        };
      }
      
      let output = "📝 **Decision Log**\n\n";
      decisionLog.forEach((decision, idx) => {
        output += `**${idx + 1}. ${decision.stage.toUpperCase()} Stage**\n`;
        output += `Time: ${decision.timestamp}\n`;
        output += `Decision: ${decision.decision}\n`;
        output += `Reasoning: ${decision.reasoning}\n`;
        if (decision.alternatives.length > 0) {
          output += `Alternatives considered: ${decision.alternatives.join(", ")}\n`;
        }
        output += "\n";
      });
      
      return {
        content: [{
          type: "text",
          text: output
        }]
      };
    }
  );
}