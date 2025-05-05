/** @format */

import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
    js.configs.recommended,
    {
        files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
        ignores: ['node_modules/**', '.git/**', 'logs/**', 'package-lock.json', 'out/**', 'dist/**'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.browser,
                acquireVsCodeApi: 'readonly',
            },
            parserOptions: {
                project: true,
                tsconfigRootDir: './',
            },
        },
        plugins: {
            '@typescript-eslint': ts,
        },
        settings: {
            'import/resolver': {
                typescript: true,
                node: true,
            },
        },
        rules: {
            indent: ['error', 2],
            'linebreak-style': ['error', 'windows'], 
            quotes: ['error', 'single'],
            semi: ['error', 'always'],
            'no-unused-vars': ['warn'],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-undef': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'warn',
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'warn',
        },
        parser: tsParser,
    },
    eslintConfigPrettier,
];
