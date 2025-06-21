import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Relaxed TypeScript rules for now
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_' 
      }],
      '@typescript-eslint/no-explicit-any': 'off',
      'prefer-const': 'warn',
      'no-unused-vars': 'off', // Let TypeScript handle this
      
      // Allow console.error for MCP logging convention
      'no-console': 'off',
      'no-undef': 'off', // TypeScript handles this better
    },
  },
  {
    files: ['**/*.test.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: [
      'dist/**', 
      'node_modules/**', 
      '*.js',
      'src/guidance/**', // Placeholder files with unused exports
      'src/intelligence/**', // Placeholder files with unused exports
    ],
  },
];