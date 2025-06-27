#!/usr/bin/env node

/**
 * Decision Analysis Test Runner for InDesign MCP
 * Automates testing of LLM decision-making patterns
 */

import { spawn } from 'child_process';
import { readFile, writeFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import chalk from 'chalk';

const __dirname = dirname(fileURLToPath(import.meta.url));

class DecisionTestRunner {
  constructor() {
    this.resultsDir = join(__dirname, 'results');
    this.testCasesDir = join(__dirname, 'test-cases');
    this.mcpServerPath = join(__dirname, '..', '..', 'dist', 'index.js');
  }

  /**
   * Run a single test case
   */
  async runTest(testCaseName) {
    console.log(chalk.blue(`\n🧪 Running test: ${testCaseName}`));
    
    try {
      // Load test case
      const testCase = await this.loadTestCase(testCaseName);
      console.log(chalk.gray(`  Description: ${testCase.description}`));
      
      // Start MCP server and connect
      const client = await this.connectToMCP();
      
      // Execute test scenario
      const startTime = Date.now();
      const results = await this.executeTestScenario(client, testCase);
      const duration = Date.now() - startTime;
      
      // Analyze results
      const analysis = this.analyzeDecisions(results);
      
      // Generate report
      const report = this.generateReport(testCase, results, analysis, duration);
      
      // Save results
      await this.saveResults(testCaseName, report);
      
      // Display summary
      this.displaySummary(analysis);
      
      // Cleanup
      await client.close();
      
      return { success: analysis.overallMatch, analysis };
      
    } catch (error) {
      console.error(chalk.red(`  ❌ Test failed: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  /**
   * Load test case configuration
   */
  async loadTestCase(name) {
    const testPath = join(this.testCasesDir, `${name}.json`);
    const content = await readFile(testPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Connect to MCP server
   */
  async connectToMCP() {
    console.log(chalk.gray('  Starting MCP server...'));
    
    const serverProcess = spawn('node', [this.mcpServerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    const transport = new StdioClientTransport({
      command: 'node',
      args: [this.mcpServerPath],
      env: process.env
    });

    const client = new Client({
      name: 'decision-test-runner',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await client.connect(transport);
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(chalk.green('  ✓ Connected to MCP server'));
    return client;
  }

  /**
   * Execute the test scenario
   */
  async executeTestScenario(client, testCase) {
    const results = {
      decisions: [],
      toolCalls: [],
      metrics: null,
      comparison: null
    };

    console.log(chalk.gray('  Executing test scenario...'));

    // Step 1: Check InDesign status
    const statusResult = await client.callTool('indesign_status', {});
    results.toolCalls.push({ tool: 'indesign_status', result: statusResult });

    // Step 2: Record initial decision
    await client.callTool('record_decision', {
      stage: 'layout',
      decision: 'Starting layout recreation from reference image',
      alternatives: ['Use existing frames', 'Clear and rebuild', 'Modify current layout'],
      reasoning: 'Test case requires recreation from scratch to match reference'
    });

    // Step 3: Create layout based on test case
    if (testCase.layoutOperations) {
      for (const operation of testCase.layoutOperations) {
        console.log(chalk.gray(`    Executing: ${operation.tool}`));
        
        // Record decision for this operation
        await client.callTool('record_decision', {
          stage: operation.stage || 'layout',
          decision: `Using ${operation.tool} with parameters: ${JSON.stringify(operation.params)}`,
          alternatives: operation.alternatives || [],
          reasoning: operation.reasoning || 'Following test case specification'
        });
        
        // Execute the operation
        const result = await client.callTool(operation.tool, operation.params);
        results.toolCalls.push({ 
          tool: operation.tool, 
          params: operation.params,
          result: result 
        });
      }
    }

    // Step 4: Extract current metrics
    console.log(chalk.gray('  Extracting layout metrics...'));
    const metricsResult = await client.callTool('extract_layout_metrics', {});
    results.metrics = this.parseMetricsResult(metricsResult);

    // Step 5: Compare to reference
    if (testCase.expectedMetrics) {
      console.log(chalk.gray('  Comparing to reference metrics...'));
      const comparisonResult = await client.callTool('compare_to_reference', {
        reference_metrics: {
          ...testCase.expectedMetrics,
          fontFallbacks: testCase.fontFallbacks || {}
        },
        tolerance: testCase.tolerance || 0.05,
        check_types: ["frames", "margins", "textRegions"]
      });
      results.comparison = this.parseComparisonResult(comparisonResult);
    }

    // Step 6: Get decision log
    const decisionLog = await client.callTool('get_decision_log', {});
    results.decisions = this.parseDecisionLog(decisionLog);

    return results;
  }

  /**
   * Analyze test results
   */
  analyzeDecisions(results) {
    const analysis = {
      totalDecisions: results.decisions.length,
      decisionsByStage: {},
      toolCallCount: results.toolCalls.length,
      overallMatch: results.comparison?.match || false,
      score: results.comparison?.score || 0,
      deviations: results.comparison?.deviations || [],
      patterns: []
    };

    // Analyze decisions by stage
    results.decisions.forEach(decision => {
      if (!analysis.decisionsByStage[decision.stage]) {
        analysis.decisionsByStage[decision.stage] = 0;
      }
      analysis.decisionsByStage[decision.stage]++;
    });

    // Identify patterns
    if (analysis.deviations.length > 0) {
      // Frame positioning errors
      const frameErrors = analysis.deviations.filter(d => d.type === 'frame');
      if (frameErrors.length > 0) {
        analysis.patterns.push({
          type: 'frame-positioning',
          count: frameErrors.length,
          avgDeviation: frameErrors.reduce((sum, e) => sum + e.deviation, 0) / frameErrors.length
        });
      }

      // Style errors
      const styleErrors = analysis.deviations.filter(d => d.type === 'style');
      if (styleErrors.length > 0) {
        analysis.patterns.push({
          type: 'style-mismatch',
          count: styleErrors.length,
          details: styleErrors.map(e => e.field)
        });
      }

      // Text region errors (visual attributes)
      const textRegionErrors = analysis.deviations.filter(d => d.type === 'textRegion');
      if (textRegionErrors.length > 0) {
        // Group by error type
        const fontErrors = textRegionErrors.filter(e => e.field.includes('fontFamily'));
        const sizeErrors = textRegionErrors.filter(e => e.field.includes('fontSize'));
        const alignmentErrors = textRegionErrors.filter(e => e.field.includes('alignment'));
        
        if (fontErrors.length > 0) {
          analysis.patterns.push({
            type: 'font-selection',
            count: fontErrors.length,
            details: fontErrors.map(e => ({ expected: e.expected, actual: e.actual }))
          });
        }
        
        if (sizeErrors.length > 0) {
          analysis.patterns.push({
            type: 'text-sizing',
            count: sizeErrors.length,
            avgDeviation: sizeErrors.reduce((sum, e) => sum + e.deviation, 0) / sizeErrors.length
          });
        }
        
        if (alignmentErrors.length > 0) {
          analysis.patterns.push({
            type: 'text-alignment',
            count: alignmentErrors.length,
            details: alignmentErrors.map(e => ({ expected: e.expected, actual: e.actual }))
          });
        }
      }
    }

    return analysis;
  }

  /**
   * Generate test report
   */
  generateReport(testCase, results, analysis, duration) {
    const report = {
      testCase: testCase.name,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      summary: {
        success: analysis.overallMatch,
        score: analysis.score,
        toolCalls: analysis.toolCallCount,
        decisions: analysis.totalDecisions
      },
      analysis: analysis,
      recommendations: this.generateRecommendations(analysis),
      fullResults: results
    };

    return report;
  }

  /**
   * Generate improvement recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    // Frame positioning recommendations
    const framePattern = analysis.patterns.find(p => p.type === 'frame-positioning');
    if (framePattern && framePattern.avgDeviation > 10) {
      recommendations.push({
        type: 'tool-description',
        tool: 'create_textframe',
        suggestion: 'Add clearer guidance about coordinate system and measurement units'
      });
      recommendations.push({
        type: 'prompt',
        suggestion: 'Emphasize checking page dimensions before positioning frames'
      });
    }

    // Style recommendations
    const stylePattern = analysis.patterns.find(p => p.type === 'style-mismatch');
    if (stylePattern) {
      recommendations.push({
        type: 'workflow',
        suggestion: 'Add intermediate validation after style application'
      });
    }

    // Font selection recommendations
    const fontPattern = analysis.patterns.find(p => p.type === 'font-selection');
    if (fontPattern) {
      recommendations.push({
        type: 'tool-enhancement',
        tool: 'fonts://system resource',
        suggestion: 'Provide better font discovery and fallback guidance'
      });
      recommendations.push({
        type: 'prompt',
        suggestion: 'Add font fallback mapping to help LLMs choose appropriate alternatives'
      });
    }

    // Text sizing recommendations
    const sizePattern = analysis.patterns.find(p => p.type === 'text-sizing');
    if (sizePattern && sizePattern.avgDeviation > 20) {
      recommendations.push({
        type: 'visual-recognition',
        suggestion: 'Emphasize visual hierarchy detection in prompts'
      });
    }

    // Alignment recommendations
    const alignPattern = analysis.patterns.find(p => p.type === 'text-alignment');
    if (alignPattern) {
      recommendations.push({
        type: 'tool-description',
        tool: 'apply_paragraph_style',
        suggestion: 'Clarify alignment options and their visual effects'
      });
    }

    // General recommendations based on score
    if (analysis.score < 80) {
      recommendations.push({
        type: 'validation',
        suggestion: 'Implement stricter validation rules for layout consistency'
      });
    }

    return recommendations;
  }

  /**
   * Save test results
   */
  async saveResults(testName, report) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${testName}_${timestamp}.json`;
    const filepath = join(this.resultsDir, filename);
    
    await writeFile(filepath, JSON.stringify(report, null, 2));
    console.log(chalk.gray(`  Results saved to: ${filename}`));
  }

  /**
   * Display test summary
   */
  displaySummary(analysis) {
    console.log(chalk.blue('\n📊 Test Summary:'));
    console.log(chalk.white(`  Overall Match: ${analysis.overallMatch ? chalk.green('✓ PASS') : chalk.red('✗ FAIL')}`));
    console.log(chalk.white(`  Score: ${analysis.score}%`));
    console.log(chalk.white(`  Decisions Made: ${analysis.totalDecisions}`));
    console.log(chalk.white(`  Tool Calls: ${analysis.toolCallCount}`));
    
    if (analysis.deviations.length > 0) {
      console.log(chalk.yellow(`  Deviations: ${analysis.deviations.length}`));
      analysis.deviations.slice(0, 3).forEach(dev => {
        console.log(chalk.gray(`    - ${dev.type}.${dev.field}: ${dev.deviation}% off`));
      });
    }
    
    if (analysis.patterns.length > 0) {
      console.log(chalk.yellow('\n  Patterns Detected:'));
      analysis.patterns.forEach(pattern => {
        console.log(chalk.gray(`    - ${pattern.type}: ${pattern.count} occurrences`));
      });
    }
  }

  /**
   * Parse metrics result from MCP tool response
   */
  parseMetricsResult(result) {
    try {
      // MCP tool responses have a content array with text
      const text = result.content?.[0]?.text || '';
      
      // Try to extract JSON from the response
      // Look for JSON between "Extracted metrics:" or similar markers
      const jsonMatch = text.match(/\{[\s\S]*\}/m);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, try to build metrics from the formatted text
      const metrics = {
        frames: [],
        margins: {},
        columns: 1,
        styles: [],
        textRegions: []
      };
      
      // Extract margins from text like "Margins: Top: 72pt, Left: 72pt..."
      const marginMatch = text.match(/Margins:.*Top: (\d+)pt.*Left: (\d+)pt.*Bottom: (\d+)pt.*Right: (\d+)pt/);
      if (marginMatch) {
        metrics.margins = {
          top: parseInt(marginMatch[1]),
          left: parseInt(marginMatch[2]),
          bottom: parseInt(marginMatch[3]),
          right: parseInt(marginMatch[4])
        };
      }
      
      // Extract columns
      const columnMatch = text.match(/Columns: (\d+)/);
      if (columnMatch) {
        metrics.columns = parseInt(columnMatch[1]);
      }
      
      return metrics;
    } catch (error) {
      console.error(chalk.yellow('  Warning: Could not parse metrics result'));
      return { frames: [], margins: {}, columns: 1, styles: [], textRegions: [] };
    }
  }

  /**
   * Parse comparison result from MCP tool response
   */
  parseComparisonResult(result) {
    try {
      const text = result.content?.[0]?.text || '';
      
      const comparison = {
        match: false,
        score: 0,
        deviations: []
      };
      
      // Extract match status
      comparison.match = text.includes('✅ PASS');
      
      // Extract score
      const scoreMatch = text.match(/Score: (\d+)%/);
      if (scoreMatch) {
        comparison.score = parseInt(scoreMatch[1]);
      }
      
      // Extract deviations count
      const deviationMatch = text.match(/Deviations Found.*\((\d+)\)/);
      if (deviationMatch) {
        const deviationCount = parseInt(deviationMatch[1]);
        
        // Parse individual deviations
        const deviationRegex = /• (\w+) - ([^:]+): Expected ([^,]+), Got ([^\s]+) \((\d+)% off\)/g;
        let match;
        while ((match = deviationRegex.exec(text)) !== null) {
          comparison.deviations.push({
            type: match[1],
            field: match[2],
            expected: match[3],
            actual: match[4],
            deviation: parseInt(match[5])
          });
        }
      }
      
      return comparison;
    } catch (error) {
      console.error(chalk.yellow('  Warning: Could not parse comparison result'));
      return { match: false, score: 0, deviations: [] };
    }
  }

  /**
   * Parse decision log from MCP tool response
   */
  parseDecisionLog(result) {
    try {
      const text = result.content?.[0]?.text || '';
      const decisions = [];
      
      // Parse decisions from formatted text
      // Format: "1. LAYOUT Stage\nTime: ...\nDecision: ...\nReasoning: ...\nAlternatives: ..."
      const decisionBlocks = text.split(/\d+\. /).slice(1);
      
      decisionBlocks.forEach(block => {
        const stageMatch = block.match(/(\w+) Stage/);
        const timeMatch = block.match(/Time: ([^\n]+)/);
        const decisionMatch = block.match(/Decision: ([^\n]+)/);
        const reasoningMatch = block.match(/Reasoning: ([^\n]+)/);
        const alternativesMatch = block.match(/Alternatives considered: ([^\n]+)/);
        
        if (stageMatch && decisionMatch) {
          decisions.push({
            stage: stageMatch[1].toLowerCase(),
            timestamp: timeMatch ? timeMatch[1] : new Date().toISOString(),
            decision: decisionMatch[1],
            reasoning: reasoningMatch ? reasoningMatch[1] : '',
            alternatives: alternativesMatch ? alternativesMatch[1].split(', ') : []
          });
        }
      });
      
      return decisions;
    } catch (error) {
      console.error(chalk.yellow('  Warning: Could not parse decision log'));
      return [];
    }
  }

  /**
   * Run all test cases
   */
  async runAllTests() {
    const testFiles = await readdir(this.testCasesDir);
    const testCases = testFiles
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));

    console.log(chalk.blue(`\n🔬 Running ${testCases.length} test cases...\n`));

    const results = [];
    for (const testCase of testCases) {
      const result = await this.runTest(testCase);
      results.push({ testCase, ...result });
      
      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Summary
    const passed = results.filter(r => r.success).length;
    console.log(chalk.blue('\n📈 Overall Results:'));
    console.log(chalk.white(`  Total Tests: ${results.length}`));
    console.log(chalk.green(`  Passed: ${passed}`));
    console.log(chalk.red(`  Failed: ${results.length - passed}`));
    console.log(chalk.white(`  Success Rate: ${Math.round(passed / results.length * 100)}%`));
  }
}

// CLI handling
async function main() {
  const runner = new DecisionTestRunner();
  const args = process.argv.slice(2);

  if (args.includes('--all')) {
    await runner.runAllTests();
  } else if (args.includes('--case')) {
    const caseIndex = args.indexOf('--case');
    const caseName = args[caseIndex + 1];
    if (!caseName) {
      console.error(chalk.red('Please specify a test case name'));
      process.exit(1);
    }
    await runner.runTest(caseName);
  } else {
    // Default: run book-page test
    await runner.runTest('book-page');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}