import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'node_modules/',
    '.next/',
    'dist/',
    'build/',
    'coverage/',
    'supabase/.temp/',
    'supabase/.branches/',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
]);
