import { defineConfig } from 'eslint-define-config';

export default defineConfig([
    {
        languageOptions: {
            globals: {
                node: true,
                browser: true,
                commonjs: true,
                es2024: true,
                acquireVsCodeApi: 'readonly'
            },
            parserOptions: {
                ecmaVersion: 'latest'
            }
        },
        rules: {
            indent: ['error', 4],
            'linebreak-style': ['error', 'windows'],
            quotes: ['error', 'single'],
            semi: ['error', 'always'],
            'no-unused-vars': ['warn'],
            'no-console': ['warn', { allow: ['warn', 'error'] }]
        },
        ignores: ['node_modules', '.git', 'logs', 'package-lock.json']
    },
]);
