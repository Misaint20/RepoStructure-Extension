const fs = require('fs/promises');
const path = require('path');
const { getIcon } = require('./config/iconConfig');
const { frameworkDirs } = require('./config/frameworkConfig');
const { commonStyles } = require('./styles/commonStyles');
const { memoize } = require('./utils/common');

// Memoizar getIcon para mejorar rendimiento
const memoizedGetIcon = memoize(getIcon);

// Caché para estructuras de directorios
const structureCache = new Map();

async function generateRepoStructure(startPath, ignore = []) {
    // Verificar caché
    const cacheKey = `${startPath}-${ignore.join(',')}`;
    if (structureCache.has(cacheKey)) {
        return structureCache.get(cacheKey);
    }

    const entries = await fs.readdir(startPath, { withFileTypes: true });
    
    // Optimizar filtrado y ordenamiento
    const filteredEntries = entries
        .filter(entry => !ignore.includes(entry.name) && !entry.name.startsWith('.'))
        .sort((a, b) => {
            if (a.isDirectory() !== b.isDirectory()) return b.isDirectory() ? 1 : -1;
            return a.name.localeCompare(b.name);
        });

    // Procesamiento en lotes para mejor rendimiento
    const batchSize = 50;
    const results = [];
    
    for (let i = 0; i < filteredEntries.length; i += batchSize) {
        const batch = filteredEntries.slice(i, i + batchSize);
        const batchPromises = batch.map((entry, idx) => 
            generateEntryHTML(entry, (i + idx) === filteredEntries.length - 1, startPath, ignore)
        );
        results.push(...await Promise.all(batchPromises));
    }

    const structure = results.join('');
    structureCache.set(cacheKey, structure);
    
    // Limpiar caché después de 5 minutos
    setTimeout(() => structureCache.delete(cacheKey), 300000);
    
    return structure;
}

async function generateEntryHTML(entry, isLast, startPath, ignore) {
    const fullPath = path.join(startPath, entry.name);
    const icon = memoizedGetIcon(entry.name, entry.isDirectory());
    const borderStyle = `border-left:1px solid #e1e4e8;height:100%;margin-left:-1px;${isLast?'display:none':''}`;

    if (entry.isDirectory() && !frameworkDirs.includes(entry.name)) {
        const subStructure = await generateRepoStructure(fullPath, ignore);
        return `<details open><summary style="margin:10px 0;list-style:none;cursor:pointer;display:flex;align-items:center">
                <div style="${borderStyle}"></div>
                <div style="width:16px;border-bottom:1px solid #e1e4e8;margin-right:5px"></div>
                <img src="${icon}" alt="folder" style="width:16px;height:16px;vertical-align:middle;margin-right:5px">
                <strong>${entry.name}</strong>
            </summary>
            <div style="padding-left:24px;position:relative;${!isLast?'border-left:1px solid #e1e4e8':''}">${subStructure}</div></details>`;
    }
    
    return !entry.isDirectory() ? `<div style="margin:10px 0;display:flex;align-items:center">
            <div style="${borderStyle}"></div>
            <div style="width:16px;border-bottom:1px solid #e1e4e8;margin-right:5px"></div>
            <img src="${icon}" alt="file" style="width:16px;height:16px;vertical-align:middle;margin-right:5px">
            <span>${entry.name}</span>
        </div>` : '';
}

async function generateStructureFile(rootPath, structure, isMinimal = false) {
    const fileName = isMinimal ? 'repoStructure-minimal.md' : 'repoStructure.md';
    const content = isMinimal 
        ? `# Repository Structure (Minimal)\n\n\`\`\`\n${structure}\`\`\`\n\nLast update: ${new Date().toLocaleString()}`
        : `# Repository Structure\n\n<div style="${commonStyles.container}">\n${structure}\n</div>\n\n<footer style="${commonStyles.footer}">\n<p>Last update: ${new Date().toLocaleString()}</p>\n</footer>`;

    await fs.writeFile(path.join(rootPath, fileName), content);
    return fileName;
}

module.exports = {
    generateRepoStructure,
    generateStructureFile
};
