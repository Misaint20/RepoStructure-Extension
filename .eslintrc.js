module.exports = {
    'env': {
        'node': true,
        'browser': true,
        'commonjs': true,
        'es2021': true
    },
    'extends': 'eslint:recommended',
    'parserOptions': {
        'ecmaVersion': 'latest'
    },
    'rules': {
        'indent': ['error', 4],
        'linebreak-style': ['error', 'windows'],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'no-unused-vars': ['warn'],
        'no-console': ['warn', { 'allow': ['warn', 'error'] }]
    },
    'globals': {
        'acquireVsCodeApi': 'readonly'
    }
}; 