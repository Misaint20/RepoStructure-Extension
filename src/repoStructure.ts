import * as fs from 'fs/promises';
import { Dirent } from 'fs';
import * as path from 'path';
import { getIcon } from './config/iconConfig';
import { frameworkDirs } from './config/frameworkConfig';
import { commonStyles } from './styles/commonStyles';
import { memoize } from './utils/common';

// Memoizar getIcon para mejorar rendimiento
const memoizedGetIcon = memoize(getIcon);

// Caché para estructuras de directorios
const structureCache = new Map<string, string>();

/**
 * Generates the HTML representation of the repository structure.
 * @param {string} startPath - The starting directory path.
 * @param {string[]} ignore - List of directory/file names to ignore.
 * @returns {Promise<string>} The HTML structure string.
 */
export async function generateRepoStructure(startPath: string, ignore: string[] = [], isRoot: boolean = true): Promise<string> {
    // Verificar caché
    const cacheKey = `${startPath}-${ignore.join(',')}-${isRoot}`;
    if (structureCache.has(cacheKey)) {
        return structureCache.get(cacheKey)!;
    }

    try {
        const entries = await fs.readdir(startPath, { withFileTypes: true });

        // Optimizar filtrado y ordenamiento
        const filteredEntries = entries
            .filter(entry => !ignore.includes(entry.name) && !entry.name.startsWith('.'))
            .sort((a, b) => {
                if (a.isDirectory() !== b.isDirectory()) return b.isDirectory() ? -1 : 1; // Folders first
                return a.name.localeCompare(b.name);
            });

        // Procesamiento en lotes para mejor rendimiento
        const batchSize = 50;
        const results: string[] = [];

        for (let i = 0; i < filteredEntries.length; i += batchSize) {
            const batch = filteredEntries.slice(i, i + batchSize);
            const batchPromises = batch.map((entry, idx) =>
                generateEntryHTML(entry, (i + idx) === filteredEntries.length - 1, startPath, ignore)
            );
            results.push(...await Promise.all(batchPromises));
        }

        let structure = results.join('');

        // Si es la raíz, envolver en el nombre de la carpeta padre / actual
        if (isRoot) {
            const folderName = path.basename(startPath);
            const icon = memoizedGetIcon(folderName, true);

            structure = `<details open>
                <summary style="margin:10px 0;list-style:none;cursor:pointer;display:flex;align-items:center">
                    <img src="${icon}" alt="folder" style="width:16px;height:16px;vertical-align:middle;margin-right:5px">
                    <strong>${folderName}</strong>
                </summary>
                <div style="padding-left:24px;border-left:1px solid #e1e4e8">${structure}</div>
            </details>`;
        }

        structureCache.set(cacheKey, structure);

        // Limpiar caché después de 5 minutos
        setTimeout(() => structureCache.delete(cacheKey), 300000);

        return structure;
    } catch (error) {
        console.error(`Error generating structure for ${startPath}:`, error);
        return `<div style="color: red;">Error processing directory: ${path.basename(startPath)}</div>`;
    }
}

/**
 * Generates HTML for a single entry (file or folder).
 */
async function generateEntryHTML(entry: Dirent, isLast: boolean, startPath: string, ignore: string[]): Promise<string> {
    const fullPath = path.join(startPath, entry.name);
    const icon = memoizedGetIcon(entry.name, entry.isDirectory());
    const borderStyle = `border-left:1px solid #e1e4e8;height:100%;margin-left:-1px;${isLast ? 'display:none' : ''}`;

    if (entry.isDirectory() && !frameworkDirs.includes(entry.name)) {
        const subStructure = await generateRepoStructure(fullPath, ignore, false);
        return `<details open>
            <summary style="margin:10px 0;list-style:none;cursor:pointer;display:flex;align-items:center">
                <div style="${borderStyle}"></div>
                <div style="width:16px;border-bottom:1px solid #e1e4e8;margin-right:5px"></div>
                <img src="${icon}" alt="folder" style="width:16px;height:16px;vertical-align:middle;margin-right:5px">
                <strong>${entry.name}</strong>
            </summary>
            <div style="padding-left:24px;position:relative;${!isLast ? 'border-left:1px solid #e1e4e8' : ''}">${subStructure}</div>
        </details>`;
    }

    if (!entry.isDirectory()) {
        return `<div style="margin:10px 0;display:flex;align-items:center">
            <div style="${borderStyle}"></div>
            <div style="width:16px;border-bottom:1px solid #e1e4e8;margin-right:5px"></div>
            <img src="${icon}" alt="file" style="width:16px;height:16px;vertical-align:middle;margin-right:5px">
            <span>${entry.name}</span>
        </div>`;
    }

    // Folders that are in frameworkDirs but not expanded
    return `<div style="margin:10px 0;display:flex;align-items:center">
        <div style="${borderStyle}"></div>
        <div style="width:16px;border-bottom:1px solid #e1e4e8;margin-right:5px"></div>
        <img src="${icon}" alt="folder" style="width:16px;height:16px;vertical-align:middle;margin-right:5px">
        <em>${entry.name} (ignored)</em>
    </div>`;
}

/**
 * Generates the final structure file.
 */
export async function generateStructureFile(rootPath: string, structure: string, isMinimal = false): Promise<string> {
    const folderName = path.basename(rootPath);
    const fileName = isMinimal ? 'repoStructure-minimal.md' : 'repoStructure.md';
    const content = isMinimal
        ? `# Repository Structure (Minimal) - ${folderName}\n\n\`\`\`\n${structure}\`\`\`\n\nLast update: ${new Date().toLocaleString()}`
        : `# Repository Structure - ${folderName}\n\n<div style="${commonStyles.container}">\n${structure}\n</div>\n\n<footer style="${commonStyles.footer}">\n<p>Last update: ${new Date().toLocaleString()}</p>\n</footer>`;

    await fs.writeFile(path.join(rootPath, fileName), content);
    return fileName;
}
