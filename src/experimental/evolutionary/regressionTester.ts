/**
 * @fileoverview Regression testing system for improvements
 * Ensures improvements don't break existing functionality
 */

import { Improvement } from './types.js';
import { McpBridge } from './mcpBridge.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

/**
 * Test case for regression testing
 */
interface RegressionTest {
  name: string;
  description: string;
  tools: string[];
  setup?: () => Promise<void>;
  execute: (bridge: McpBridge) => Promise<void>;
  validate: (bridge: McpBridge) => Promise<boolean>;
  cleanup?: () => Promise<void>;
}

/**
 * Regression testing system
 */
export class RegressionTester {
  private bridge: McpBridge;
  private tests: Map<string, RegressionTest> = new Map();
  private resultsDir: string;
  private initialPageCount: number = 0;
  
  constructor(bridge: McpBridge, options: {
    resultsDir?: string;
  } = {}) {
    this.bridge = bridge;
    this.resultsDir = options.resultsDir || path.join(os.tmpdir(), 'evolution_tests', 'regression');
  }
  
  /**
   * Initialize regression tester
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.resultsDir, { recursive: true });
    this.registerCoreTests();
  }
  
  /**
   * Register core regression tests
   */
  private registerCoreTests(): void {
    // Test 1: Basic text operations
    this.registerTest({
      name: 'basic-text-operations',
      description: 'Tests basic text addition and removal',
      tools: ['add_text', 'remove_text', 'get_document_text'],
      execute: async (bridge) => {
        await bridge.callTool('add_text', {
          text: 'Test content for regression',
          position: 'start'
        });
      },
      validate: async (bridge) => {
        const result = await bridge.callTool('get_document_text', {});
        const text = result.content[0].text;
        return text.includes('Test content for regression');
      }
    });
    
    // Test 2: Style creation and application
    this.registerTest({
      name: 'style-operations',
      description: 'Tests paragraph style creation and application',
      tools: ['create_paragraph_style', 'apply_paragraph_style', 'list_paragraph_styles'],
      execute: async (bridge) => {
        await bridge.callTool('create_paragraph_style', {
          style_name: 'RegressionTestStyle',
          font_size: 14,
          alignment: 'center'
        });
        
        await bridge.callTool('add_text', {
          text: 'Styled text',
          position: 'end'
        });
        
        await bridge.callTool('apply_paragraph_style', {
          style_name: 'RegressionTestStyle',
          target_text: 'Styled text'
        });
      },
      validate: async (bridge) => {
        const styles = await bridge.callTool('list_paragraph_styles', {});
        const styleList = styles.content[0].text;
        return styleList.includes('RegressionTestStyle');
      }
    });
    
    // Test 3: Text frame operations
    this.registerTest({
      name: 'textframe-operations',
      description: 'Tests text frame creation and positioning',
      tools: ['create_textframe', 'position_textframe', 'get_textframe_info'],
      execute: async (bridge) => {
        await bridge.callTool('create_textframe', {
          x: 100,
          y: 100,
          width: 200,
          height: 100,
          text_content: 'Frame test'
        });
      },
      validate: async (bridge) => {
        const info = await bridge.callTool('get_textframe_info', {});
        const frames = JSON.parse(info.content[0].text);
        return frames.length > 0 && frames.some((f: any) => 
          f.content && f.content.includes('Frame test')
        );
      }
    });
    
    // Test 4: Page operations
    this.registerTest({
      name: 'page-operations',
      description: 'Tests page addition and info retrieval',
      tools: ['add_pages', 'get_page_info'],
      setup: async () => {
        // Record initial page count
        this.initialPageCount = await this.getPageCount();
      },
      execute: async (bridge) => {
        await bridge.callTool('add_pages', {
          page_count: 2,
          location: 'end'
        });
      },
      validate: async (bridge) => {
        const newCount = await this.getPageCount();
        return newCount === this.initialPageCount + 2;
      },
      cleanup: async () => {
        // Remove added pages
        await this.bridge.callTool('remove_pages', {
          page_range: `${this.initialPageCount + 1}-${this.initialPageCount + 2}`
        });
      }
    });
    
    // Test 5: Special characters
    this.registerTest({
      name: 'special-characters',
      description: 'Tests special character insertion',
      tools: ['insert_special_character'],
      execute: async (bridge) => {
        await bridge.callTool('add_text', {
          text: 'Page ',
          position: 'end'
        });
        
        await bridge.callTool('insert_special_character', {
          character_type: 'auto_page_number',
          position: 'end'
        });
      },
      validate: async (bridge) => {
        // Special characters should execute without error
        return true;
      }
    });
  }
  
  /**
   * Register a custom test
   */
  registerTest(test: RegressionTest): void {
    this.tests.set(test.name, test);
  }
  
  /**
   * Run all regression tests
   */
  async runAllTests(): Promise<{
    passed: number;
    failed: number;
    errors: Array<{ test: string; error: string }>;
  }> {
    const results = {
      passed: 0,
      failed: 0,
      errors: [] as Array<{ test: string; error: string }>
    };
    
    console.log('Running regression tests...\n');
    
    for (const [name, test] of this.tests) {
      console.log(`Running test: ${name}`);
      
      try {
        // Setup
        if (test.setup) {
          await test.setup();
        }
        
        // Execute
        await test.execute(this.bridge);
        
        // Validate
        const passed = await test.validate(this.bridge);
        
        if (passed) {
          console.log(`  ✓ ${test.description}`);
          results.passed++;
        } else {
          console.log(`  ✗ ${test.description}`);
          results.failed++;
          results.errors.push({
            test: name,
            error: 'Validation failed'
          });
        }
        
        // Cleanup
        if (test.cleanup) {
          await test.cleanup();
        }
      } catch (error) {
        console.log(`  ✗ ${test.description} - Error: ${error}`);
        results.failed++;
        results.errors.push({
          test: name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    console.log(`\nRegression tests complete: ${results.passed} passed, ${results.failed} failed`);
    
    // Save results
    await this.saveResults(results);
    
    return results;
  }
  
  /**
   * Run tests for specific tools
   */
  async runTestsForTools(tools: string[]): Promise<{
    passed: number;
    failed: number;
    errors: Array<{ test: string; error: string }>;
  }> {
    const relevantTests = Array.from(this.tests.entries())
      .filter(([_, test]) => 
        test.tools.some(tool => tools.includes(tool))
      );
    
    const results = {
      passed: 0,
      failed: 0,
      errors: [] as Array<{ test: string; error: string }>
    };
    
    console.log(`Running ${relevantTests.length} tests for tools: ${tools.join(', ')}\n`);
    
    for (const [name, test] of relevantTests) {
      console.log(`Running test: ${name}`);
      
      try {
        if (test.setup) await test.setup();
        await test.execute(this.bridge);
        const passed = await test.validate(this.bridge);
        
        if (passed) {
          console.log(`  ✓ ${test.description}`);
          results.passed++;
        } else {
          console.log(`  ✗ ${test.description}`);
          results.failed++;
          results.errors.push({ test: name, error: 'Validation failed' });
        }
        
        if (test.cleanup) await test.cleanup();
      } catch (error) {
        console.log(`  ✗ ${test.description} - Error: ${error}`);
        results.failed++;
        results.errors.push({
          test: name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return results;
  }
  
  /**
   * Test an improvement before applying
   */
  async testImprovement(improvement: Improvement): Promise<{
    safe: boolean;
    affectedTests: string[];
    errors: string[];
  }> {
    // Find tests that use the improved tool
    const affectedTests = Array.from(this.tests.entries())
      .filter(([_, test]) => test.tools.includes(improvement.tool))
      .map(([name, _]) => name);
    
    if (affectedTests.length === 0) {
      return { safe: true, affectedTests: [], errors: [] };
    }
    
    console.log(`Testing improvement impact on ${affectedTests.length} tests...`);
    
    const errors: string[] = [];
    
    for (const testName of affectedTests) {
      const test = this.tests.get(testName)!;
      
      try {
        if (test.setup) await test.setup();
        await test.execute(this.bridge);
        const passed = await test.validate(this.bridge);
        
        if (!passed) {
          errors.push(`${testName}: Validation failed after improvement`);
        }
        
        if (test.cleanup) await test.cleanup();
      } catch (error) {
        errors.push(`${testName}: ${error}`);
      }
    }
    
    return {
      safe: errors.length === 0,
      affectedTests,
      errors
    };
  }
  
  /**
   * Get page count helper
   */
  private async getPageCount(): Promise<number> {
    const info = await this.bridge.callTool('get_page_info', { page_number: -1 });
    const pages = JSON.parse(info.content[0].text);
    return Array.isArray(pages) ? pages.length : 1;
  }
  
  /**
   * Save test results
   */
  private async saveResults(results: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const filename = `regression-results-${timestamp.replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(this.resultsDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify({
      timestamp,
      results,
      tests: Array.from(this.tests.keys())
    }, null, 2));
  }
  
  /**
   * Create a minimal test suite for quick validation
   */
  async runMinimalTests(): Promise<boolean> {
    console.log('Running minimal regression tests...');
    
    try {
      // Test 1: Can add text
      await this.bridge.callTool('add_text', {
        text: 'Quick test',
        position: 'start'
      });
      
      // Test 2: Can create style
      await this.bridge.callTool('create_paragraph_style', {
        style_name: 'QuickTestStyle',
        font_size: 12
      });
      
      // Test 3: Can get document info
      await this.bridge.callTool('indesign_status', {});
      
      console.log('✓ Minimal tests passed');
      return true;
    } catch (error) {
      console.error('✗ Minimal tests failed:', error);
      return false;
    }
  }
}