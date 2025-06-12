#!/usr/bin/env node
/**
 * Validation script for Phase 1 implementation
 * Run after implementation to verify success criteria
 */

const fs = require('fs');
const path = require('path');

const requiredFiles = [
    'src/prompts/document-strategy.ts',
    'src/prompts/index.ts',
    'src/guidance/tool-hierarchy.ts', 
    'src/intelligence/document-context.ts'
];

console.log('🔍 Validating Phase 1 Implementation...\n');

let allValid = true;

// Check required files exist
requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} exists`);
    } else {
        console.log(`❌ ${file} missing`);
        allValid = false;
    }
});

// Check for document_creation_strategy function
if (fs.existsSync('src/prompts/document-strategy.ts')) {
    const content = fs.readFileSync('src/prompts/document-strategy.ts', 'utf8');
    if (content.includes('document_creation_strategy')) {
        console.log('✅ document_creation_strategy function found');
    } else {
        console.log('❌ document_creation_strategy function missing');
        allValid = false;
    }
}

console.log(allValid ? '\n🎉 Phase 1 validation passed!' : '\n⚠️  Phase 1 validation failed');
process.exit(allValid ? 0 : 1);