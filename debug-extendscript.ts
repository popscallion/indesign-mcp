import { generateVisualAttributesExtraction } from './src/tools/analysis/extendscript-templates.js';
import fs from 'fs';

const script = generateVisualAttributesExtraction(-1, true, true);
fs.writeFileSync('debug-script.jsx', script);
console.log('Script written to debug-script.jsx');
console.log('Script length:', script.length);