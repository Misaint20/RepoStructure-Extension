import * as fs from 'fs/promises';
import * as path from 'path';
import { frameworkDirs } from './config/frameworkConfig';

/**
 * Generates a minimal text-based representation of the repository structure.
 * @param {string} startPath - The starting directory path.
 * @param {string[]} ignore - List of directory/file names to ignore.
 * @param {string} prefix - The current line prefix for nesting.
 * @returns {Promise<string>} The minimal structure string.
 */
export async function generateMinimalRepoStructure(
    startPath: string,
    ignore: string[] = [],
    prefix: string = '',
    isRoot: boolean = true
): Promise<string> {
    try {
        const entries = await fs.readdir(startPath, { withFileTypes: true });

        // Filtrar y ordenar entradas (carpetas primero, luego alfabético)
        const filteredEntries = entries
            .filter(entry => !ignore.includes(entry.name) && !entry.name.startsWith('.'))
            .sort((a, b) => {
                if (a.isDirectory() !== b.isDirectory()) return b.isDirectory() ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

        const structurePromises = filteredEntries.map(async (entry, index) => {
            const fullPath = path.join(startPath, entry.name);
            const isLast = index === filteredEntries.length - 1;
            const marker = isLast ? '└── ' : '├── ';
            const nextPrefix = isLast ? prefix + '    ' : prefix + '│   ';

            if (entry.isDirectory() && !frameworkDirs.includes(entry.name)) {
                const subRepo = await generateMinimalRepoStructure(fullPath, ignore, nextPrefix, false);
                return `${prefix}${marker}${entry.name}/\n` + subRepo;
            } else if (!entry.isDirectory()) {
                return `${prefix}${marker}${entry.name}\n`;
            } else {
                // For ignored framework directories
                return `${prefix}${marker}${entry.name}/ (ignored)\n`;
            }
        });

        const structureParts = await Promise.all(structurePromises);
        let structure = structureParts.join('');

        if (isRoot) {
            const folderName = path.basename(startPath);
            structure = `${folderName}/\n` + structure;
        }

        return structure;
    } catch (error) {
        console.error(`Error generating minimal structure for ${startPath}:`, error);
        return `${prefix}└── Error processing ${path.basename(startPath)}\n`;
    }
}
