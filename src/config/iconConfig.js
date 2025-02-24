// Mapeo de extensiones a iconos
const iconMap = {
    '.js': '../media/icons/javascript.svg',
    '.json': '../media/icons/json.svg',
    '.md': '../media/icons/markdown.svg',
    '.html': '../media/icons/html.svg',
    '.css': '../media/icons/css.svg',
    '.py': '../media/icons/python.svg',
    '.java': '../media/icons/java.svg',
    '.cs': '../media/icons/csharp.svg',
    '.cpp': '../media/icons/cpp.svg',
    '.go': '../media/icons/go.svg',
    '.ts': '../media/icons/typescript.svg',
    '.tsx': '../media/icons/react_ts.svg',
    '.jsx': '../media/icons/react.svg',
    '.test.js': '../media/icons/test-js.svg',
    '.test.ts': '../media/icons/test-ts.svg',
    '.gitignore': '../media/icons/git.svg',
    '.env': '../media/icons/env-icon.png',
    'folder': '../media/icons/folder-base-open.svg',
    'default': '../media/icons/default-icon.png',
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
