import * as fs from 'fs/promises';
import * as path from 'path';
import { GraphData, GraphNode, GraphLink } from '../types';

export class NextjsAnalyzer {
    async analyzeNextProject(projectRoot: string): Promise<GraphData> {
        const appDirectory = path.join(projectRoot, 'src', 'app');
        const hasAppDir = await this.fileExists(appDirectory);
        const rootDir = hasAppDir ? appDirectory : path.join(projectRoot, 'src', 'pages');

        const appNode: GraphNode = {
            id: 'nextjs-root',
            name: 'Next.js App',
            type: 'application',
            group: 0,
            radius: 30
        };

        const nodes: GraphNode[] = [appNode];
        const links: GraphLink[] = [];
        const processedFiles = new Set<string>();

        await this.scanAppDirectory(rootDir, {
            nodes,
            links,
            processedFiles,
            parentNode: appNode,
            isAppDir: hasAppDir
        });

        return { nodes, links };
    }

    private async scanAppDirectory(currentPath: string, context: any): Promise<void> {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        const { nodes, links, processedFiles, parentNode, isAppDir } = context;
        const rootDir = isAppDir ? path.join(currentPath, '..', '..') : currentPath;

        const layoutFile = entries.find(e => /^layout\.(jsx?|tsx?)$/.test(e.name));
        let layoutNode: GraphNode | null = null;

        if (layoutFile) {
            const layoutPath = path.join(currentPath, layoutFile.name);
            if (!processedFiles.has(layoutPath)) {
                const content = await fs.readFile(layoutPath, 'utf-8');
                layoutNode = {
                    id: layoutPath,
                    name: 'layout',
                    type: 'layout',
                    content,
                    group: 2,
                    radius: 20
                };
                nodes.push(layoutNode);
                processedFiles.add(layoutPath);

                links.push({
                    source: layoutNode.id,
                    target: parentNode.id,
                    value: 2,
                    type: 'layout-structure'
                });

                await this.processDependencies(layoutPath, content, {
                    nodes,
                    links,
                    processedFiles,
                    sourceNode: layoutNode
                });
            }
        }

        const pageFile = entries.find(e => /^page\.(jsx?|tsx?)$/.test(e.name));
        if (pageFile) {
            const pagePath = path.join(currentPath, pageFile.name);
            if (!processedFiles.has(pagePath)) {
                const content = await fs.readFile(pagePath, 'utf-8');
                const routePath = this.getRouteName(currentPath, rootDir);
                const pageNode: GraphNode = {
                    id: pagePath,
                    name: routePath || '/',
                    type: 'page',
                    content,
                    group: 1,
                    radius: 15
                };
                nodes.push(pageNode);
                processedFiles.add(pagePath);

                links.push({
                    source: pageNode.id,
                    target: layoutNode ? layoutNode.id : parentNode.id,
                    value: 1,
                    type: 'route'
                });

                await this.processDependencies(pagePath, content, {
                    nodes,
                    links,
                    processedFiles,
                    sourceNode: pageNode
                });
            }
        }

        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
                await this.scanAppDirectory(
                    path.join(currentPath, entry.name),
                    {
                        nodes,
                        links,
                        processedFiles,
                        parentNode: layoutNode || parentNode,
                        isAppDir
                    }
                );
            }
        }
    }

    private async processDependencies(filePath: string, content: string, context: any): Promise<void> {
        const { nodes, links, processedFiles, sourceNode } = context;
        const imports = this.extractImports(content);

        for (const importPath of imports) {
            const resolvedPath = await this.resolveImportPath(importPath, filePath);
            if (resolvedPath && !processedFiles.has(resolvedPath)) {
                try {
                    const depContent = await fs.readFile(resolvedPath, 'utf-8');
                    const depNode: GraphNode = {
                        id: resolvedPath,
                        name: path.basename(resolvedPath),
                        type: 'component',
                        content: depContent,
                        group: 3,
                        radius: 10
                    };

                    nodes.push(depNode);
                    processedFiles.add(resolvedPath);

                    links.push({
                        source: sourceNode.id,
                        target: depNode.id,
                        value: 1,
                        type: 'imports'
                    });

                    await this.processDependencies(resolvedPath, depContent, {
                        ...context,
                        sourceNode: depNode
                    });
                } catch (error) {
                    // Ignore
                }
            }
        }
    }

    private extractImports(content: string): Set<string> {
        const imports = new Set<string>();
        const patterns = [
            /from\s+['"](@\/[^'"]+)['"]/g,
            /from\s+['"](\.[^'"]+)['"]/g,
            /import\s+['"](\.[^'"]+)['"]/g
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                imports.add(match[1]);
            }
        });
        return imports;
    }

    private async resolveImportPath(importPath: string, currentFile: string): Promise<string | null> {
        const basePath = path.dirname(currentFile);
        const projectRoot = await this.findProjectRoot(basePath);

        let resolvedPath = importPath.startsWith('@/')
            ? path.resolve(projectRoot, 'src', importPath.slice(2))
            : path.resolve(basePath, importPath);

        const extensions = ['.tsx', '.ts', '.jsx', '.js'];
        for (const ext of extensions) {
            const fullPath = resolvedPath + ext;
            if (await this.fileExists(fullPath)) return fullPath;
        }

        for (const ext of extensions) {
            const indexPath = path.join(resolvedPath, `index${ext}`);
            if (await this.fileExists(indexPath)) return indexPath;
        }

        return null;
    }

    private getRouteName(pagePath: string, rootDir: string): string {
        const relativePath = path.relative(rootDir, pagePath);
        const routePath = '/' + relativePath
            .split(path.sep)
            .filter(part =>
                !part.startsWith('(') &&
                !part.startsWith('_') &&
                part !== 'page' &&
                part !== 'app' &&
                part !== 'pages' &&
                part !== 'src'
            )
            .map(part => {
                if (part.startsWith('[') && part.endsWith(']')) {
                    if (part.startsWith('[...')) return '*';
                    return `:${part.slice(1, -1)}`;
                }
                return part;
            })
            .filter(Boolean)
            .join('/')
            .replace(/\/+/g, '/');

        return routePath === '' ? '/' : routePath;
    }

    private async findProjectRoot(currentPath: string): Promise<string> {
        let dir = currentPath;
        while (dir !== path.dirname(dir)) {
            if (await this.fileExists(path.join(dir, 'package.json'))) return dir;
            dir = path.dirname(dir);
        }
        return currentPath;
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
