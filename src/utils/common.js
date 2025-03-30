const vscode = require('vscode');
const path = require('path');

const getWorkspacePath = () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('Please open a folder first');
    }
    return workspaceFolders[0].uri.fsPath;
};

const formatFileName = (name, type) => `repoStructure${type ? `-${type}` : ''}.md`;

const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

const memoize = (fn) => {
    const cache = new Map();
    return (...args) => {
        const key = JSON.stringify(args);
        if (cache.has(key)) return cache.get(key);
        const result = fn(...args);
        cache.set(key, result);
        return result;
    };
};

module.exports = {
    getWorkspacePath,
    formatFileName,
    debounce,
    memoize
};
