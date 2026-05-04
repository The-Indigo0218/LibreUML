import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dist-electron', 'release', '.turbo']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // `any` is a pragmatic escape hatch in an evolving domain model;
      // surface it but don't fail CI.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow underscore-prefixed args/vars to mark intentional non-use.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // The react-hooks v7 lint pack ships several new opinionated rules
      // (set-state-in-effect, exhaustive-deps, manual memoization, etc.).
      // Treat them as warnings for now so they get attention without blocking CI.
      // TODO: address in dedicated PRs and promote back to 'error'.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      // Fast-refresh boundary warnings — useful during dev but not a blocker.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
