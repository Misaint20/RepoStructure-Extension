const fs = require('fs/promises');
const path = require('path');
const { frameworkDirs } = require('./config/frameworkConfig');

async function generateMinimalRepoStructure(startPath, ignore = [], prefix = '') {
    const entries = await fs.readdir(startPath, { withFileTypes: true });
    let structure = '';

    // Filtrar y ordenar entradas
    const filteredEntries = entries
        .filter(entry => !ignore.includes(entry.name) && !entry.name.startsWith('.'))
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of filteredEntries) {
        const fullPath = path.join(startPath, entry.name);
        const isLast = entry === filteredEntries[filteredEntries.length - 1];
        const marker = isLast ? '└── ' : '├── ';
        const nextPrefix = isLast ? prefix + '    ' : prefix + '│   ';

        if (entry.isDirectory() && !frameworkDirs.includes(entry.name)) {
            structure += `${prefix}${marker}${entry.name}/\n`;
            structure += await generateMinimalRepoStructure(fullPath, ignore, nextPrefix);
        } else if (!entry.isDirectory()) {
            structure += `${prefix}${marker}${entry.name}\n`;
        }
    }

    return structure;
}

module.exports = { generateMinimalRepoStructure };
