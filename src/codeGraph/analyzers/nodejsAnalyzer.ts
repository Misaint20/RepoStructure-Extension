import * as fs from 'fs/promises';
import * as path from 'path';
import { GraphData, GraphNode, GraphLink, AnalyzerContext } from '../types';

export class NodejsAnalyzer {
    async analyzeNodeProject(projectRoot: string): Promise<GraphData> {
        const packageJson = await this.analyzePackageJson(projectRoot);

        const appNode: GraphNode = {
            id: 'nodejs-root',
            name: 'Node.js Backend',
            type: 'application',
            group: 0,
            radius: 30
        };

        const nodes: GraphNode[] = [appNode];
        const links: GraphLink[] = [];
        const processedFiles = new Set<string>();

        if (packageJson.main) {
            let mainFilePath = path.resolve(projectRoot, packageJson.main);

            if (path.extname(mainFilePath) === '') {
                for (const ext of ['.ts', '.js']) {
                    const pathWithExt = mainFilePath + ext;
                    if (await this.fileExists(pathWithExt)) {
                        mainFilePath = pathWithExt;
                        break;
                    }
                }
            }

            if (!(await this.fileExists(mainFilePath))) {
                const srcMainPath = path.join(projectRoot, 'src', path.basename(mainFilePath));
                if (await this.fileExists(srcMainPath)) {
                    mainFilePath = srcMainPath;
                }
            }

            if (await this.fileExists(mainFilePath)) {
                const mainContent = await fs.readFile(mainFilePath, 'utf-8');
                const mainNode: GraphNode = {
                    id: mainFilePath,
                    name: 'Server',
                    type: 'server',
                    content: mainContent,
                    group: 1,
                    radius: 25
                };
                nodes.push(mainNode);
                processedFiles.add(mainFilePath);

                links.push({
                    source: mainNode.id,
                    target: appNode.id,
                    value: 2,
                    type: 'server-entry'
                });

                await this.processDependencies(mainFilePath, mainContent, {
                    nodes,
                    links,
                    processedFiles,
                    sourceNode: mainNode,
                    fileType: 'server',
                    rootDir: projectRoot
                });
            }
        }

        const srcDir = path.join(projectRoot, 'src');
        const hasSrcDir = await this.fileExists(srcDir);
        const rootDir = hasSrcDir ? srcDir : projectRoot;

        const foldersToAnalyze = [
            { path: 'routes', type: 'route' },
            { path: 'controllers', type: 'controller' },
            { path: 'models', type: 'model' },
            { path: 'services', type: 'service' },
            { path: 'middleware', type: 'middleware' },
            { path: 'utils', type: 'utility' },
            { path: 'config', type: 'config' },
            { path: 'types', type: 'type' },
            { path: 'prisma', type: 'database' },
            { path: 'helpers', type: 'helper' }
        ];

        for (const folder of foldersToAnalyze) {
            const folderPath = path.join(rootDir, folder.path);
            if (await this.fileExists(folderPath)) {
                const folderNode: GraphNode = {
                    id: `folder-${folder.path}`,
                    name: folder.path,
                    type: `${folder.type}-folder`,
                    group: this.getNodeGroup(folder.type),
                    radius: 20
                };
                nodes.push(folderNode);

                const mainNode = nodes.find(n => n.type === 'server') || appNode;
                links.push({
                    source: folderNode.id,
                    target: mainNode.id,
                    value: 2,
                    type: 'folder-structure'
                });

                await this.scanDirectory(folderPath, {
                    nodes,
                    links,
                    processedFiles,
                    parentNode: folderNode,
                    fileType: folder.type,
                    rootDir: projectRoot
                });
            }
        }

        return { nodes, links };
    }

    private async scanDirectory(currentPath: string, context: AnalyzerContext): Promise<void> {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        const { nodes, links, processedFiles, parentNode, fileType } = context;

        for (const entry of entries) {
            if (entry.isDirectory()) {
                await this.scanDirectory(
                    path.join(currentPath, entry.name),
                    context
                );
                continue;
            }

            if (!/\.(js|ts)$/.test(entry.name)) continue;

            const filePath = path.join(currentPath, entry.name);
            if (processedFiles.has(filePath)) continue;

            const content = await fs.readFile(filePath, 'utf-8');
            const node: GraphNode = {
                id: filePath,
                name: entry.name.replace(/\.(js|ts)$/, ''),
                type: fileType,
                content,
                group: this.getNodeGroup(fileType),
                radius: this.getNodeRadius(fileType)
            };

            nodes.push(node);
            processedFiles.add(filePath);

            if (parentNode) {
                links.push({
                    source: node.id,
                    target: parentNode.id,
                    value: 1,
                    type: `${fileType}-structure`
                });
            }

            await this.processDependencies(filePath, content, {
                nodes,
                links,
                processedFiles,
                sourceNode: node,
                fileType,
                rootDir: context.rootDir
            });

            if (fileType === 'route') {
                this.analyzeRoutes(content, node, nodes, links);
            }
        }
    }

    private analyzeRoutes(content: string, routeNode: GraphNode, nodes: GraphNode[], links: GraphLink[]): void {
        const routePatterns = [
            /\.get\(['"]([^'"]+)['"]/g,
            /\.post\(['"]([^'"]+)['"]/g,
            /\.put\(['"]([^'"]+)['"]/g,
            /\.delete\(['"]([^'"]+)['"]/g,
            /\.patch\(['"]([^'"]+)['"]/g,
        ];

        routePatterns.forEach(pattern => {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                const routePath = match[1];
                const endpointNode: GraphNode = {
                    id: `${routeNode.id}-${routePath}`,
                    name: routePath,
                    type: 'endpoint',
                    content: `Endpoint: ${routePath}`,
                    group: 9,
                    radius: 8
                };
                nodes.push(endpointNode);
                links.push({
                    source: endpointNode.id,
                    target: routeNode.id,
                    value: 1,
                    type: 'endpoint-definition'
                });
            }
        });
    }

    private getNodeGroup(type: string): number {
        const groups: Record<string, number> = {
            'application': 0, 'server': 1, 'route': 2, 'controller': 3,
            'model': 4, 'service': 5, 'middleware': 6, 'utility': 7,
            'config': 8, 'endpoint': 9, 'database': 10, 'helper': 11, 'type': 12
        };
        return groups[type] || 13;
    }

    private getNodeRadius(type: string): number {
        const sizes: Record<string, number> = {
            'application': 30, 'server': 25, 'route': 20, 'controller': 18,
            'model': 18, 'service': 15, 'middleware': 12, 'utility': 10,
            'config': 10, 'endpoint': 8, 'database': 15, 'helper': 12, 'type': 10
        };
        return sizes[type] || 10;
    }

    private async processDependencies(filePath: string, content: string, context: AnalyzerContext): Promise<void> {
        const { nodes, links, processedFiles, sourceNode, rootDir } = context;
        if (!sourceNode || !rootDir) return;

        const imports = this.extractImports(content);

        for (const importPath of imports) {
            const resolvedPath = await this.resolveImportPath(importPath, filePath, rootDir);
            if (resolvedPath && !processedFiles.has(resolvedPath)) {
                try {
                    const depContent = await fs.readFile(resolvedPath, 'utf-8');
                    const fileType = this.getFileType(resolvedPath);
                    const depNode: GraphNode = {
                        id: resolvedPath,
                        name: path.basename(resolvedPath, path.extname(resolvedPath)),
                        type: fileType,
                        content: depContent,
                        group: this.getNodeGroup(fileType),
                        radius: this.getNodeRadius(fileType)
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
                        sourceNode: depNode,
                        fileType
                    });
                } catch (error) {
                    // Ignore errors
                }
            }
        }
    }

    private getFileType(filePath: string): string {
        const dir = path.dirname(filePath);
        if (dir.includes('routes')) return 'route';
        if (dir.includes('controllers')) return 'controller';
        if (dir.includes('models')) return 'model';
        if (dir.includes('services')) return 'service';
        if (dir.includes('middleware')) return 'middleware';
        if (dir.includes('utils')) return 'utility';
        if (dir.includes('config')) return 'config';
        if (dir.includes('prisma')) return 'database';
        if (dir.includes('types')) return 'type';
        if (dir.includes('helpers')) return 'helper';
        return 'module';
    }

    private extractImports(content: string): Set<string> {
        const imports = new Set<string>();
        const patterns = [
            /require\(['"]([^'"]+)['"]\)/g,
            /from\s+['"]([^'"]+)['"]/g,
            /import\s+['"]([^'"]+)['"]/g
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (match[1].startsWith('.') || match[1].startsWith('/')) {
                    imports.add(match[1]);
                }
            }
        });

        return imports;
    }

    private async resolveImportPath(importPath: string, currentFile: string, rootDir: string): Promise<string | null> {
        const basePath = path.dirname(currentFile);
        let resolvedPath: string;

        if (importPath.startsWith('.')) {
            resolvedPath = path.resolve(basePath, importPath);
        } else if (importPath.startsWith('/')) {
            resolvedPath = path.join(rootDir, importPath);
        } else {
            resolvedPath = path.join(rootDir, 'src', importPath);
        }

        const extensions = ['.ts', '.js', '.json'];
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

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    private async analyzePackageJson(projectRoot: string): Promise<any> {
        try {
            const content = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8');
            return JSON.parse(content);
        } catch {
            return { main: 'index.js' };
        }
    }
}
