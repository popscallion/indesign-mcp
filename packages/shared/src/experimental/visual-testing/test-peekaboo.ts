#!/usr/bin/env node
/**
 * Test script for Peekaboo analyzer
 * Run with: npx tsx src/experimental/visual-testing/test-peekaboo.ts
 */

import { PeekabooAnalyzer, createPeekabooAnalyzer } from './peekabooAnalyzer.js';
import * as path from 'path';
import * as fs from 'fs/promises';

async function testPeekabooAnalyzer() {
  console.log('🧪 Testing Peekaboo Analyzer...\n');
  
  const analyzer = createPeekabooAnalyzer();
  
  // Test 1: Check availability
  console.log('Test 1: Checking Peekaboo availability...');
  const isAvailable = await analyzer.isAvailable();
  console.log(`  Peekaboo available: ${isAvailable}`);
  
  if (!isAvailable) {
    console.log('  ⚠️  Peekaboo not installed - testing fallback behavior\n');
  }
  
  // Test 2: Test with sample images (if they exist)
  console.log('Test 2: Looking for test images...');
  const testDir = 'tests/decision-analysis/reference-images';
  const previewDir = '/tmp/evolution_tests/previews';
  
  try {
    await fs.access(testDir);
    const files = await fs.readdir(testDir);
    const imageFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
    
    if (imageFiles.length > 0) {
      console.log(`  Found ${imageFiles.length} reference images`);
      const referenceImage = path.join(testDir, imageFiles[0]);
      console.log(`  Using reference: ${referenceImage}`);
      
      // Create a dummy preview file for testing
      const dummyPreview = path.join(previewDir, 'test-preview.png');
      await fs.mkdir(previewDir, { recursive: true });
      
      // Copy reference as preview for testing
      try {
        await fs.copyFile(referenceImage, dummyPreview);
        console.log(`  Created test preview: ${dummyPreview}`);
        
        // Test 3: Analyze preview
        console.log('\nTest 3: Analyzing preview against reference...');
        const analysis = await analyzer.analyzePreview(dummyPreview, referenceImage);
        
        console.log('  Analysis Results:');
        console.log(`    Similarity: ${analysis.similarity}%`);
        console.log(`    Differences: ${analysis.differences.length} found`);
        if (analysis.differences.length > 0 && analysis.differences[0] !== 'Unable to extract specific differences') {
          console.log('    Sample differences:');
          analysis.differences.slice(0, 3).forEach(d => {
            console.log(`      - ${d}`);
          });
        }
        
        // Clean up
        await fs.unlink(dummyPreview);
        
      } catch (error: any) {
        console.log(`  ⚠️  Test preview creation failed: ${error.message}`);
      }
      
    } else {
      console.log('  No test images found in', testDir);
    }
  } catch (error) {
    console.log(`  Test directory not found: ${testDir}`);
    console.log('  Skipping image analysis tests');
  }
  
  // Test 4: Test fallback behavior
  console.log('\nTest 4: Testing fallback analysis...');
  const fallbackAnalyzer = new PeekabooAnalyzer('invalid', 'invalid');
  const fallback = await fallbackAnalyzer.analyzePreview(
    '/nonexistent/preview.png',
    '/nonexistent/reference.png'
  ).catch(err => {
    console.log(`  Expected error caught: ${err.message}`);
    return null;
  });
  
  if (fallback) {
    console.log('  Fallback analysis returned (unexpected)');
  } else {
    console.log('  ✅ Error handling works correctly');
  }
  
  console.log('\n✅ Peekaboo Analyzer tests complete');
  console.log('\nNext steps:');
  console.log('1. On macOS: Install Peekaboo with `npm install -g @steipete/peekaboo-mcp`');
  console.log('2. Run this test again to verify Peekaboo integration');
  console.log('3. Proceed with MCPBridge integration');
}

// Run tests
testPeekabooAnalyzer().catch(console.error);