const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
    {
        files: ['**/*'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs'
        },
        globals: {
            acquireVsCodeApi: 'readonly'
        },
        rules: {
            indent: ['error', 4],
            'linebreak-style': ['error', 'windows'],
            quotes: ['error', 'single'],
            semi: ['error', 'always'],
            'no-unused-vars': ['warn'],
            'no-console': ['warn', { allow: ['warn', 'error'] }]
        },
        // Archivos y carpetas a ignorar
        ignores: ['node_modules', '.git', 'logs', 'package-lock.json', 'out', 'dist']
    }
]);
