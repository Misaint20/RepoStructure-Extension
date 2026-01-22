import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { frameworkDirs } from '../config/frameworkConfig';
import { ReactAnalyzer } from './analyzers/reactAnalyzer';
import { NextjsAnalyzer } from './analyzers/nextjsAnalyzer';
import { ReactNativeAnalyzer } from './analyzers/reactNativeAnalyzer';
import { NodejsAnalyzer } from './analyzers/nodejsAnalyzer';
import { GraphData, GraphNode, GraphLink } from './types';

export class DependencyAnalyzer {
    private dependencies = new Map<string, string[]>();
    private fileContents = new Map<string, string>();
    private projects = new Map<string, any>();
    private reactAnalyzer = new ReactAnalyzer();
    private nextjsAnalyzer = new NextjsAnalyzer();
    private reactNativeAnalyzer = new ReactNativeAnalyzer();
    private nodejsAnalyzer = new NodejsAnalyzer();
    private projectRootCache = new Map<string, string>();

    async detectProjects(rootPath: string, token?: vscode.CancellationToken): Promise<any[]> {
        const projectMarkers: Record<string, string> = {
            'package.json': 'node', 'composer.json': 'php', 'pom.xml': 'java',
            'build.gradle': 'java', 'requirements.txt': 'python', 'go.mod': 'go',
            'Cargo.toml': 'rust', 'mix.exs': 'elixir', 'pubspec.yaml': 'dart', 'Gemfile': 'ruby'
        };

        const projects: any[] = [];
        const scanDir = async (dir: string) => {
            if (token?.isCancellationRequested) return;
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (!['node_modules', '.git'].includes(entry.name)) {
                        await scanDir(fullPath);
                    }
                } else if (projectMarkers[entry.name]) {
                    projects.push({ type: projectMarkers[entry.name], root: dir, configFile: fullPath });
                }
            }
        };

        await scanDir(rootPath);
        return projects;
    }

    async analyzeDependencies(rootPath: string, ignore: string[] = [], token?: vscode.CancellationToken): Promise<GraphData> {
        const projects = await this.detectProjects(rootPath, token);
        this.projects = new Map(projects.map(p => [p.root, p]));

        const projectFiles = new Set<string>();
        const specificProjectNodes: GraphNode[] = [];
        const specificProjectLinks: GraphLink[] = [];

        for (const [projectRoot, project] of this.projects.entries()) {
            if (token?.isCancellationRequested) return { nodes: [], links: [] };
            if (project.type === 'node') {
                try {
                    const isNextJs = await this.isNextJsProject(projectRoot);
                    const isReactNative = await this.isReactNativeProject(projectRoot);
                    const isNodeBackend = await this.isNodejsBackendProject(projectRoot);

                    let graph: GraphData;
                    if (isNodeBackend) graph = await this.nodejsAnalyzer.analyzeNodeProject(projectRoot);
                    else if (isNextJs) graph = await this.nextjsAnalyzer.analyzeNextProject(projectRoot);
                    else if (isReactNative) graph = await this.reactNativeAnalyzer.analyzeReactNativeProject(projectRoot);
                    else graph = await this.reactAnalyzer.analyzeReactProject(projectRoot);

                    specificProjectNodes.push(...graph.nodes);
                    specificProjectLinks.push(...graph.links);
                    graph.nodes.forEach(node => { if (typeof node.id === 'string') projectFiles.add(node.id); });
                } catch (error) { }
            }
        }

        const files = await this.getAllFiles(rootPath, ignore, token);
        const fileContentsPromises = files.map(async file => {
            if (token?.isCancellationRequested) return null;
            if (!projectFiles.has(file)) {
                try {
                    const content = await fs.readFile(file, 'utf-8');
                    if (content.trim().length > 0) {
                        this.fileContents.set(file, content);
                        return { file, content };
                    }
                } catch { }
            }
            return null;
        });

        const fileContents = (await Promise.all(fileContentsPromises)).filter((x): x is { file: string, content: string } => x !== null);

        for (const { file, content } of fileContents) {
            if (token?.isCancellationRequested) break;
            const projectRoot = await this.findProjectRoot(file);
            const dependencies = this.extractDependencies(content)
                .map(dep => this.resolveDependencyPath(dep, file, projectRoot))
                .filter((x): x is string => x !== null)
                .filter(dep => !projectFiles.has(dep));

            this.dependencies.set(file, dependencies);
        }

        const { nodes, links } = this.formatDependencyGraph();
        return {
            nodes: [...nodes, ...specificProjectNodes],
            links: [...links, ...specificProjectLinks]
        };
    }

    private extractDependencies(content: string): string[] {
        return [
            ...this.findRequires(content),
            ...this.findImports(content),
            ...this.findRelativeImports(content),
            ...this.findStyleImports(content)
        ];
    }

    private async isNextJsProject(root: string): Promise<boolean> {
        try {
            const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8'));
            return 'next' in (pkg.dependencies || {});
        } catch { return false; }
    }

    private async isReactNativeProject(root: string): Promise<boolean> {
        try {
            const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8'));
            return 'react-native' in (pkg.dependencies || {});
        } catch { return false; }
    }

    private async isNodejsBackendProject(root: string): Promise<boolean> {
        try {
            const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8'));
            return 'express' in (pkg.dependencies || {});
        } catch { return false; }
    }

    private async getAllFiles(dir: string, ignore: string[], token?: vscode.CancellationToken): Promise<string[]> {
        const files: string[] = [];
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (token?.isCancellationRequested) return [];
                if (ignore.includes(entry.name) || frameworkDirs.includes(entry.name)) continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) files.push(...await this.getAllFiles(fullPath, ignore, token));
                else if (/\.(js|jsx|ts|tsx|json|vue|py|rb|java|php)$/.test(entry.name)) files.push(fullPath);
            }
        } catch { }
        return files;
    }

    private async findProjectRoot(filePath: string): Promise<string> {
        if (this.projectRootCache.has(filePath)) return this.projectRootCache.get(filePath)!;
        let currentDir = path.dirname(filePath);
        while (currentDir !== path.dirname(currentDir)) {
            if (this.projects.has(currentDir)) {
                this.projectRootCache.set(filePath, currentDir);
                return currentDir;
            }
            currentDir = path.dirname(currentDir);
        }
        return path.dirname(filePath);
    }

    private findRelativeImports(content: string): string[] {
        const patterns = [/from\s+['"]\..*?['"]/g, /import\s+['"]\..*?['"]/g, /require\s*\(['"]\..*?['"]\)/g];
        return patterns.flatMap(p => [...content.matchAll(p)].map(m => m[0].match(/['"]([^'"]+)['"]/)![1]));
    }

    private findStyleImports(content: string): string[] {
        const patterns = [/@import\s+['"].*?['"]/g, /url\s*\(['"].*?['"]\)/g];
        return patterns.flatMap(p => [...content.matchAll(p)].map(m => m[0].match(/['"]([^'"]+)['"]/)![1]));
    }

    private formatDependencyGraph(): GraphData {
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];
        const fileIndex = new Map<string, number>();

        Array.from(this.dependencies.keys()).forEach((file, index) => {
            fileIndex.set(file, index);
            nodes.push({
                id: index,
                name: path.basename(file),
                path: path.relative(process.cwd(), file),
                type: path.extname(file).slice(1) || 'file',
                content: this.fileContents.get(file),
                group: 1,
                radius: this.calculateNodeSize(file)
            });
        });

        this.dependencies.forEach((deps, file) => {
            const sourceIndex = fileIndex.get(file);
            if (sourceIndex === undefined) return;
            deps.forEach(dep => {
                const targetIndex = fileIndex.get(dep);
                if (targetIndex !== undefined) {
                    links.push({ source: sourceIndex, target: targetIndex, value: 1 });
                }
            });
        });

        return { nodes, links };
    }

    private calculateNodeSize(file: string): number {
        const content = this.fileContents.get(file) || '';
        const lines = content.split('\n').length;
        return Math.min(20, Math.max(8, Math.log2(lines) * 3));
    }

    private findRequires(content: string): string[] {
        return [...content.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
    }

    private findImports(content: string): string[] {
        return [...content.matchAll(/import.*?['"]([^'"]+)['"]/g)].map(m => m[1]);
    }

    private resolveDependencyPath(dep: string, currentFile: string, rootPath: string): string | null {
        if (dep.startsWith('.')) {
            const absPath = path.resolve(path.dirname(currentFile), dep);
            const exts = ['.ts', '.js', '.tsx', '.jsx', '.json', ''];
            for (const ext of exts) {
                const p = absPath + ext;
                if (this.fileContents.has(p)) return p;
                if (ext === '') {
                    const index = path.join(absPath, 'index.js');
                    if (this.fileContents.has(index)) return index;
                }
            }
        }
        return null;
    }
}
