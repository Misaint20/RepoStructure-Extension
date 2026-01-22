import * as fs from 'fs/promises';
import * as path from 'path';
import { GraphData, GraphNode, GraphLink } from '../types';

export class ReactAnalyzer {
    private pages = new Map<string, any>();
    private layouts = new Map<string, any>();
    private projectType: string | null = null;

    async analyzeReactProject(projectRoot: string): Promise<GraphData> {
        this.projectType = await this.detectReactProjectType(projectRoot);
        if (!this.projectType) return { nodes: [], links: [] };

        await this.analyzePagesDirectory(projectRoot);

        const appNode: GraphNode = {
            id: `${this.projectType}-${projectRoot}`,
            name: this.getProjectTypeName(),
            type: 'application',
            group: 0,
            radius: 30,
            project: this.projectType,
            projectRoot
        };

        const nodes: GraphNode[] = [appNode];
        const links: GraphLink[] = [];
        const processedFiles = new Set<string>();

        // Procesar layouts primero para mejor jerarquía
        for (const [layoutPath, layoutInfo] of this.layouts.entries()) {
            if (!processedFiles.has(layoutPath)) {
                processedFiles.add(layoutPath);
                const layoutNode = await this.createFileNode(layoutPath, layoutInfo.content, 'layout');
                nodes.push(layoutNode);

                links.push({
                    source: layoutNode.id,
                    target: appNode.id,
                    value: 2,
                    type: 'layout-structure'
                });

                const layoutDeps = await this.findComponentDependencies(layoutInfo.content, layoutPath);
                await this.processFileDependencies(Array.from(layoutDeps), nodes, links, processedFiles, layoutPath);
            }
        }

        // Procesar páginas y sus dependencias
        for (const [pagePath, pageInfo] of this.pages.entries()) {
            if (!processedFiles.has(pagePath)) {
                processedFiles.add(pagePath);
                const pageNode = await this.createFileNode(pagePath, pageInfo.content, 'page');
                nodes.push(pageNode);

                if (pageInfo.layout && this.layouts.has(pageInfo.layout)) {
                    links.push({
                        source: pageNode.id,
                        target: pageInfo.layout,
                        value: 2,
                        type: 'uses-layout'
                    });
                } else {
                    links.push({
                        source: pageNode.id,
                        target: appNode.id,
                        value: 1,
                        type: 'route'
                    });
                }

                const pageDeps = await this.findComponentDependencies(pageInfo.content, pagePath);
                await this.processFileDependencies(Array.from(pageDeps), nodes, links, processedFiles, pagePath);
            }
        }

        return { nodes, links };
    }

    private async createFileNode(filePath: string, content: string, type: string): Promise<GraphNode> {
        return {
            id: filePath,
            name: path.basename(filePath),
            type: type,
            content: content,
            group: type === 'page' ? 1 : type === 'layout' ? 2 : 3,
            radius: type === 'page' ? 15 : type === 'layout' ? 20 : 10,
            project: this.projectType!,
            projectRoot: await this.findProjectRoot(filePath)
        };
    }

    private async processFileDependencies(
        dependencies: string[],
        nodes: GraphNode[],
        links: GraphLink[],
        processedFiles: Set<string>,
        sourcePath: string
    ): Promise<void> {
        for (const dep of dependencies) {
            if (dep && !processedFiles.has(dep)) {
                try {
                    const content = await fs.readFile(dep, 'utf-8');
                    processedFiles.add(dep);

                    const depNode: GraphNode = {
                        id: dep,
                        name: path.basename(dep),
                        type: 'component',
                        content: content,
                        group: 3,
                        radius: 10,
                        project: this.projectType!
                    };
                    nodes.push(depNode);

                    links.push({
                        source: sourcePath,
                        target: dep,
                        value: 1,
                        type: 'imports'
                    });

                    const nestedDeps = await this.findComponentDependencies(content, dep);
                    await this.processFileDependencies(Array.from(nestedDeps), nodes, links, processedFiles, dep);
                } catch (error) {
                    // Ignore
                }
            }
        }
    }

    private async detectReactProjectType(projectRoot: string): Promise<string | null> {
        try {
            const packageJson = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8');
            const { dependencies = {} } = JSON.parse(packageJson);

            const hasAppJson = await this.fileExists(path.join(projectRoot, 'app.json'));
            const hasNextConfig = await this.fileExists(path.join(projectRoot, 'next.config.js'));
            const hasAppDir = await this.fileExists(path.join(projectRoot, 'src/app')) || await this.fileExists(path.join(projectRoot, 'app'));

            if ('react-native' in dependencies && hasAppJson) return 'react-native';
            if ('next' in dependencies && (hasNextConfig || hasAppDir)) return 'nextjs';
            if ('react' in dependencies) return 'react';
            return null;
        } catch {
            return null;
        }
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    private getProjectTypeName(): string {
        switch (this.projectType) {
            case 'nextjs': return 'Next.js Application';
            case 'react-native': return 'React Native Application';
            default: return 'React Application';
        }
    }

    private getProjectDirs(): { pagesDir: string[], layoutsDir: string[], componentsDir: string[] } {
        switch (this.projectType) {
            case 'nextjs':
                return {
                    pagesDir: ['src/app', 'app', 'pages', 'src/pages'],
                    layoutsDir: ['src/app', 'app'],
                    componentsDir: ['src/components', 'components']
                };
            case 'react-native':
                return {
                    pagesDir: ['screens'],
                    layoutsDir: ['layouts'],
                    componentsDir: ['components']
                };
            default:
                return {
                    pagesDir: ['src/pages'],
                    layoutsDir: ['src/layouts'],
                    componentsDir: ['src/components']
                };
        }
    }

    private async analyzePagesDirectory(projectRoot: string): Promise<void> {
        const { pagesDir } = this.getProjectDirs();
        for (const dir of pagesDir) {
            const fullPath = path.join(projectRoot, dir);
            await this.scanPagesRecursively(fullPath, '');
        }
    }

    private async scanPagesRecursively(currentPath: string, routePath: string): Promise<void> {
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            const pageFile = entries.find(entry => !entry.isDirectory() && /page\.(jsx?|tsx?)$/.test(entry.name));

            if (pageFile) {
                const fullPath = path.join(currentPath, pageFile.name);
                const content = await fs.readFile(fullPath, 'utf-8');
                const layout = await this.findLayout(content, fullPath);
                const route = this.buildRouteFromPath(routePath);

                this.pages.set(fullPath, {
                    content,
                    layout,
                    route,
                    isAppDir: currentPath.includes('/app/') || currentPath.includes('\\app\\')
                });
            }

            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
                    const nextPath = path.join(currentPath, entry.name);
                    const nextRoutePath = path.join(routePath, this.normalizeRouteSegment(entry.name));
                    await this.scanPagesRecursively(nextPath, nextRoutePath);
                }
            }
        } catch { }
    }

    private buildRouteFromPath(routePath: string): string {
        let webRoute = routePath.split(path.sep).filter(Boolean).map(s => this.normalizeRouteSegment(s)).join('/');
        return webRoute.startsWith('/') ? webRoute : `/${webRoute}`;
    }

    private normalizeRouteSegment(segment: string): string {
        return segment.replace(/\(.*?\)/, '').replace(/\[\.{3}(\w+)\]/, '*').replace(/\[(\w+)\]/, ':$1');
    }

    private async findLayout(content: string, filePath: string): Promise<string | null> {
        const dirPath = path.dirname(filePath);
        if (this.projectType === 'nextjs' && (dirPath.includes('/app/') || dirPath.includes('\\app\\'))) {
            let currentDir = dirPath;
            const layoutFiles = ['layout.tsx', 'layout.jsx', 'layout.js'];
            while (currentDir.includes('app')) {
                for (const layoutFile of layoutFiles) {
                    const layoutPath = path.join(currentDir, layoutFile);
                    if (await this.fileExists(layoutPath)) {
                        const layoutContent = await fs.readFile(layoutPath, 'utf-8');
                        this.layouts.set(layoutPath, { content: layoutContent });
                        return layoutPath;
                    }
                }
                const parentDir = path.dirname(currentDir);
                if (parentDir === currentDir) break;
                currentDir = parentDir;
            }
        }
        return null;
    }

    private async findComponentDependencies(content: string, filePath: string): Promise<Set<string>> {
        const imports = new Set<string>();
        const matches = content.matchAll(/import.*from ['"]([^'"]+)['"]/g);
        const basePath = path.dirname(filePath);
        const projectRoot = await this.findProjectRoot(basePath);

        for (const match of matches) {
            const importPath = match[1];
            if (importPath.startsWith('.') || importPath.startsWith('@/')) {
                let resolvedPath = importPath.startsWith('@/')
                    ? path.resolve(projectRoot, 'src', importPath.slice(2))
                    : path.resolve(basePath, importPath);

                const extensions = ['.js', '.jsx', '.ts', '.tsx'];
                let found = false;
                for (const ext of extensions) {
                    if (await this.fileExists(resolvedPath + ext)) {
                        imports.add(resolvedPath + ext);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    for (const ext of extensions) {
                        const indexPath = path.join(resolvedPath, `index${ext}`);
                        if (await this.fileExists(indexPath)) {
                            imports.add(indexPath);
                            break;
                        }
                    }
                }
            }
        }
        return imports;
    }

    private async findProjectRoot(currentPath: string): Promise<string> {
        let dir = currentPath;
        while (dir !== path.dirname(dir)) {
            if (await this.fileExists(path.join(dir, 'package.json'))) return dir;
            dir = path.dirname(dir);
        }
        return currentPath;
    }
}
