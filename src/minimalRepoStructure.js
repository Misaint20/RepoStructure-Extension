const fs = require('fs/promises');
const path = require('path');
const { frameworkDirs } = require('./config/frameworkConfig');

async function generateMinimalRepoStructure(startPath, ignore = [], prefix = '') {
    const entries = await fs.readdir(startPath, { withFileTypes: true });

    // Filtrar y ordenar entradas
    const filteredEntries = entries
        .filter(entry => !ignore.includes(entry.name) && !entry.name.startsWith('.'))
        .sort((a, b) => a.name.localeCompare(b.name));

    const structurePromises = filteredEntries.map(async (entry) => {
        const fullPath = path.join(startPath, entry.name);
        const isLast = entry === filteredEntries[filteredEntries.length - 1];
        const marker = isLast ? '└── ' : '├── ';
        const nextPrefix = isLast ? prefix + '    ' : prefix + '│   ';

        if (entry.isDirectory() && !frameworkDirs.includes(entry.name)) {
            return `${prefix}${marker}${entry.name}/\n` + await generateMinimalRepoStructure(fullPath, ignore, nextPrefix);
        } else if (!entry.isDirectory()) {
            return `${prefix}${marker}${entry.name}\n`;
        }
    });

    const structure = await Promise.all(structurePromises);
    return structure.join('');
}

module.exports = { generateMinimalRepoStructure };
