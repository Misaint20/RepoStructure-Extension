// Mapeo de extensiones a iconos
const iconMap = {
    '.js': 'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/5ad133857db0d34cedfbe80ba0e5263001d1e67c/icons/javascript.svg',
    '.json': 'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/5ad133857db0d34cedfbe80ba0e5263001d1e67c/icons/json.svg',
    '.md': 'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/5ad133857db0d34cedfbe80ba0e5263001d1e67c/icons/markdown.svg',
    '.html': 'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/5ad133857db0d34cedfbe80ba0e5263001d1e67c/icons/html.svg',
    '.css': 'https://upload.wikimedia.org/wikipedia/commons/d/d5/CSS3_logo_and_wordmark.svg',
    '.py': 'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/5ad133857db0d34cedfbe80ba0e5263001d1e67c/icons/python.svg',
    '.java': 'https://static-00.iconduck.com/assets.00/java-original-icon-1510x2048-qvtt7tr9.png',
    '.cs': 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Csharp_Logo.png',
    '.cpp': 'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/5ad133857db0d34cedfbe80ba0e5263001d1e67c/icons/cpp.svg',
    '.go': 'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/5ad133857db0d34cedfbe80ba0e5263001d1e67c/icons/go.svg',
    '.ts': 'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/5ad133857db0d34cedfbe80ba0e5263001d1e67c/icons/typescript.svg',
    '.tsx': 'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/5ad133857db0d34cedfbe80ba0e5263001d1e67c/icons/react_ts.svg',
    '.jsx': 'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/5ad133857db0d34cedfbe80ba0e5263001d1e67c/icons/react.svg',
    '.test.js': 'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/5ad133857db0d34cedfbe80ba0e5263001d1e67c/icons/test-js.svg',
    '.test.ts': 'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/5ad133857db0d34cedfbe80ba0e5263001d1e67c/icons/test-ts.svg',
    '.gitignore': 'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/5ad133857db0d34cedfbe80ba0e5263001d1e67c/icons/git.svg',
    '.env': 'https://example.com/env-icon.png',
    'folder': 'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/5ad133857db0d34cedfbe80ba0e5263001d1e67c/icons/folder-base-open.svg',
    'default': 'https://example.com/default-icon.png',
};

function getIcon(name, isDirectory) {
    if (isDirectory) return iconMap['folder'];
    const ext = require('path').extname(name);
    return iconMap[ext] || iconMap['default'];
}

module.exports = {
    iconMap,
    getIcon
};
