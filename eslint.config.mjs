import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Pre-existing debt surfaced when Next's rule sets were enabled. Kept visible as
    // warnings so they can be paid down incrementally without blocking CI.
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    // Plain Node/CommonJS helper scripts.
    files: ['scripts/**/*.js', '*.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  globalIgnores(['.next/**', 'node_modules/**', 'next-env.d.ts', 'artifacts/**', 'screenshots/**']),
]);
