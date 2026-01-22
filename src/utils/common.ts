import * as vscode from 'vscode';

/**
 * Gets the workspace path.
 * @returns {string} The root path of the first workspace folder.
 * @throws {Error} If no workspace folder is open.
 */
export const getWorkspacePath = (): string => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('Please open a folder first');
    }
    return workspaceFolders[0].uri.fsPath;
};

/**
 * Formats the output markdown file name.
 * @param {string} name - Base name.
 * @param {string} [type] - Optional type suffix.
 * @returns {string} The formatted filename.
 */
export const formatFileName = (name: string, type?: string): string =>
    `repoStructure${type ? `-${type}` : ''}.md`;

/**
 * Debounce function to limit execution frequency.
 */
export const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout | undefined;
    return (...args: Parameters<T>) => {
        const later = () => {
            if (timeout) clearTimeout(timeout);
            func(...args);
        };
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Memoize function to cache results.
 */
export const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
    const cache = new Map<string, ReturnType<T>>();
    return ((...args: Parameters<T>): ReturnType<T> => {
        const key = JSON.stringify(args);
        if (cache.has(key)) return cache.get(key)!;
        const result = fn(...args);
        cache.set(key, result);
        return result;
    }) as T;
};
