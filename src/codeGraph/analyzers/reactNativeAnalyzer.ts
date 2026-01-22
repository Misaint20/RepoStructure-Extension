import * as fs from 'fs/promises';
import * as path from 'path';
import { GraphData, GraphNode, GraphLink, AnalyzerContext } from '../types';

export class ReactNativeAnalyzer {
    async analyzeReactNativeProject(projectRoot: string): Promise<GraphData> {
        const appNode: GraphNode = {
            id: 'react-native-root',
            name: 'React Native App',
            type: 'application',
            group: 0,
            radius: 30
        };

        const nodes: GraphNode[] = [appNode];
        const links: GraphLink[] = [];
        const processedFiles = new Set<string>();

        const srcDir = path.join(projectRoot, 'src');
        const hasSrcDir = await this.fileExists(srcDir);
        const rootDir = hasSrcDir ? srcDir : projectRoot;

        const foldersToAnalyze = [
            { path: 'screens', type: 'screen' },
            { path: 'navigation', type: 'navigation' },
            { path: 'components', type: 'component' }
        ];

        for (const folder of foldersToAnalyze) {
            const folderPath = path.join(rootDir, folder.path);
            if (await this.fileExists(folderPath)) {
                await this.scanDirectory(folderPath, {
                    nodes,
                    links,
                    processedFiles,
                    parentNode: appNode,
                    fileType: folder.type,
                    rootDir: projectRoot
                });
            }
        }

        return { nodes, links };
    }

    private async scanDirectory(currentPath: string, context: AnalyzerContext): Promise<void> {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        const { nodes, links, processedFiles, parentNode, fileType, rootDir } = context;

        for (const entry of entries) {
            if (entry.isDirectory()) {
                await this.scanDirectory(
                    path.join(currentPath, entry.name),
                    context
                );
                continue;
            }

            if (!/\.(jsx?|tsx?)$/.test(entry.name)) continue;

            const filePath = path.join(currentPath, entry.name);
            if (processedFiles.has(filePath)) continue;

            const content = await fs.readFile(filePath, 'utf-8');
            const fileName = path.basename(filePath, path.extname(filePath));

            const node: GraphNode = {
                id: filePath,
                name: this.formatName(fileName, fileType),
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
                rootDir
            });

            if (fileType === 'navigation') {
                this.analyzeNavigation(content, node, nodes, links);
            }
        }
    }

    private formatName(fileName: string, fileType: string): string {
        switch (fileType) {
            case 'screen': return fileName.replace(/Screen$/, '');
            case 'navigation': return fileName.replace(/Navigation$/, '');
            default: return fileName;
        }
    }

    private getNodeGroup(type: string): number {
        const groups: Record<string, number> = {
            'application': 0, 'navigation': 1, 'screen': 2, 'component': 3
        };
        return groups[type] || 4;
    }

    private getNodeRadius(type: string): number {
        const sizes: Record<string, number> = {
            'application': 30, 'navigation': 25, 'screen': 20, 'component': 15
        };
        return sizes[type] || 10;
    }

    private analyzeNavigation(content: string, navNode: GraphNode, nodes: GraphNode[], links: GraphLink[]): void {
        const routeMatches = content.matchAll(
            /<Stack\.Screen[^>]*name=["']([^"']+)["'][^>]*component=\{([^}]+)\}/g
        );

        for (const match of routeMatches) {
            const [_, routeName] = match;
            links.push({
                source: navNode.id,
                target: routeName,
                value: 1,
                type: 'navigation-route'
            });
        }
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
                    const depNode: GraphNode = {
                        id: resolvedPath,
                        name: path.basename(resolvedPath),
                        type: 'component',
                        content: depContent,
                        group: 3,
                        radius: 15
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
                } catch { }
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

    private async resolveImportPath(importPath: string, currentFile: string, rootDir: string): Promise<string | null> {
        const basePath = path.dirname(currentFile);
        let resolvedPath = importPath.startsWith('@/')
            ? path.resolve(rootDir, 'src', importPath.slice(2))
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
