#!/usr/bin/env node

/**
 * Integration test for decision analysis tools
 * Tests basic functionality before complex test scenarios
 */

import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runIntegrationTest() {
  console.log(chalk.blue('\n🧪 Running Integration Test for Decision Analysis Tools\n'));
  
  const mcpServerPath = join(__dirname, '..', '..', 'dist', 'index.js');
  let client;
  
  try {
    // Step 1: Start MCP server
    console.log(chalk.gray('1. Starting MCP server...'));
    
    const transport = new StdioClientTransport({
      command: 'node',
      args: [mcpServerPath],
      env: process.env
    });

    client = new Client({
      name: 'integration-test',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await client.connect(transport);
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(chalk.green('   ✓ MCP server connected'));

    // Step 2: Test InDesign status
    console.log(chalk.gray('\n2. Testing InDesign status...'));
    try {
      const statusResult = await client.callTool('indesign_status', {});
      console.log(chalk.green('   ✓ InDesign status retrieved'));
      console.log(chalk.gray(`   Documents open: ${statusResult.content[0].text.includes('documents open') ? 'Yes' : 'No'}`));
    } catch (error) {
      console.log(chalk.yellow('   ⚠ InDesign status failed - is InDesign running?'));
    }

    // Step 3: Test record_decision
    console.log(chalk.gray('\n3. Testing record_decision tool...'));
    const decisionResult = await client.callTool('record_decision', {
      stage: 'layout',
      decision: 'Test decision for integration testing',
      alternatives: ['Option A', 'Option B'],
      reasoning: 'Testing the decision recording functionality'
    });
    
    if (decisionResult.content[0].text.includes('Decision recorded')) {
      console.log(chalk.green('   ✓ Decision recorded successfully'));
    } else {
      throw new Error('Decision recording failed');
    }

    // Step 4: Test extract_layout_metrics
    console.log(chalk.gray('\n4. Testing extract_layout_metrics tool...'));
    const metricsResult = await client.callTool('extract_layout_metrics', {
      page_number: -1,
      include_styles: true,
      include_visual_attributes: true
    });
    
    // Parse the response
    const metricsText = metricsResult.content[0].text;
    if (metricsText.includes('Layout Metrics Extracted')) {
      console.log(chalk.green('   ✓ Layout metrics extracted'));
      
      // Check what was found
      const hasFrames = metricsText.includes('Text Frames');
      const hasMargins = metricsText.includes('Margins');
      const hasTextRegions = metricsText.includes('Text Regions');
      
      console.log(chalk.gray(`   Found: ${hasFrames ? 'Frames' : ''} ${hasMargins ? 'Margins' : ''} ${hasTextRegions ? 'TextRegions' : ''}`));
    } else {
      throw new Error('Metrics extraction failed');
    }

    // Step 5: Test compare_to_reference with sample data
    console.log(chalk.gray('\n5. Testing compare_to_reference tool...'));
    const sampleReference = {
      frames: [{
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        hasText: true,
        contentLength: 50,
        overflows: false
      }],
      margins: {
        top: 72,
        left: 72,
        bottom: 72,
        right: 72
      },
      columns: 1,
      textRegions: [{
        frameIndex: 0,
        regions: [{
          textSnippet: "Sample text",
          visualAttributes: {
            fontSize: 12,
            leading: 14,
            fontFamily: "Times",
            fontStyle: "Regular",
            alignment: "left",
            firstLineIndent: 0,
            leftIndent: 0
          },
          description: "body_text"
        }]
      }],
      fontFallbacks: {
        "Times": ["Times New Roman", "Georgia"]
      }
    };
    
    const compareResult = await client.callTool('compare_to_reference', {
      reference_metrics: sampleReference,
      tolerance: 0.05,
      check_types: ["frames", "margins", "textRegions"]
    });
    
    const compareText = compareResult.content[0].text;
    if (compareText.includes('Layout Comparison Results')) {
      console.log(chalk.green('   ✓ Comparison completed'));
      
      // Check if it passed or failed
      const passed = compareText.includes('✅ PASS');
      const score = compareText.match(/Score: (\d+)%/)?.[1];
      
      console.log(chalk.gray(`   Result: ${passed ? 'PASS' : 'FAIL'}, Score: ${score || 'N/A'}%`));
    } else {
      throw new Error('Comparison failed');
    }

    // Step 6: Test get_decision_log
    console.log(chalk.gray('\n6. Testing get_decision_log tool...'));
    const logResult = await client.callTool('get_decision_log', {});
    
    const logText = logResult.content[0].text;
    if (logText.includes('Decision Log') || logText.includes('Test decision')) {
      console.log(chalk.green('   ✓ Decision log retrieved'));
      const hasDecisions = !logText.includes('No decisions recorded');
      console.log(chalk.gray(`   Decisions in log: ${hasDecisions ? 'Yes' : 'No'}`));
    } else {
      throw new Error('Decision log retrieval failed');
    }

    // Summary
    console.log(chalk.green('\n✅ All integration tests passed!'));
    console.log(chalk.gray('\nThe decision analysis tools are working correctly.'));
    console.log(chalk.gray('You can now run the full test suite with: node test-runner.js'));

  } catch (error) {
    console.error(chalk.red('\n❌ Integration test failed:'));
    console.error(chalk.red(error.message));
    console.error(chalk.gray('\nTroubleshooting:'));
    console.error(chalk.gray('1. Ensure InDesign is running with a document open'));
    console.error(chalk.gray('2. Check that npm run build completed successfully'));
    console.error(chalk.gray('3. Verify the MCP server path is correct'));
    
    if (error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  } finally {
    // Cleanup
    if (client) {
      await client.close();
    }
  }
}

// Run the test
runIntegrationTest().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});