const fs = require('fs/promises');
const path = require('path');
const { frameworkDirs } = require('../config/frameworkConfig');
const { ReactAnalyzer } = require('./analyzers/reactAnalyzer');
const { NextjsAnalyzer } = require('./analyzers/nextjsAnalyzer');
const { ReactNativeAnalyzer } = require('./analyzers/reactNativeAnalyzer');
const { NodejsAnalyzer } = require('./analyzers/nodejsAnalyzer');

class DependencyAnalyzer {
    constructor() {
        this.dependencies = new Map();
        this.fileContents = new Map();
        this.projects = new Map();
        this.reactAnalyzer = new ReactAnalyzer();
        this.nextjsAnalyzer = new NextjsAnalyzer();
        this.reactNativeAnalyzer = new ReactNativeAnalyzer();
        this.nodejsAnalyzer = new NodejsAnalyzer();
        this.projectRootCache = new Map(); // Cache project roots
    }

    async detectProjects(rootPath, token) {
        const projectMarkers = {
            'package.json': 'node',
            'composer.json': 'php',
            'pom.xml': 'java',
            'build.gradle': 'java',
            'requirements.txt': 'python',
            'go.mod': 'go',
            'Cargo.toml': 'rust',
            'mix.exs': 'elixir',
            'pubspec.yaml': 'dart',
            'Gemfile': 'ruby'
        };

        const projects = [];

        async function scanDir(dir) {
            if (token?.isCancellationRequested) {
                console.log('Operation cancelled.');
                return;
            }
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    await scanDir(fullPath);
                } else if (projectMarkers[entry.name]) {
                    projects.push({
                        type: projectMarkers[entry.name],
                        root: dir,
                        configFile: fullPath
                    });
                }
            }
        }

        await scanDir(rootPath);
        return projects;
    }

    async analyzeDependencies(rootPath, ignore = [], token) {
        const projects = await this.detectProjects(rootPath, token);
        this.projects = new Map(projects.map(p => [p.root, p]));

        const projectFiles = new Set();
        const specificProjectNodes = [];
        const specificProjectLinks = [];

        for (const [projectRoot, project] of this.projects.entries()) {
            if (token?.isCancellationRequested) {
                console.log('Operation cancelled.');
                return;
            }
            if (project.type === 'node') {
                try {
                    const isNextJs = await this.isNextJsProject(projectRoot, token);
                    const isReactNative = await this.isReactNativeProject(projectRoot, token);
                    const isNodeBackend = await this.isNodejsBackendProject(projectRoot, token);

                    if (isNodeBackend) {
                        console.log('Analyzing Node.js Backend project:', projectRoot);
                        const nodeGraph = await this.nodejsAnalyzer.analyzeNodeProject(projectRoot, token);
                        specificProjectNodes.push(...nodeGraph.nodes);
                        specificProjectLinks.push(...nodeGraph.links);
                        nodeGraph.nodes.forEach(node => {
                            if (typeof node.id === 'string') {
                                projectFiles.add(node.id);
                            }
                        });
                    } else if (isNextJs) {
                        console.log('Analyzing Next.js project:', projectRoot);
                        const nextGraph = await this.nextjsAnalyzer.analyzeNextProject(projectRoot, token);
                        specificProjectNodes.push(...nextGraph.nodes);
                        specificProjectLinks.push(...nextGraph.links);
                        nextGraph.nodes.forEach(node => {
                            if (typeof node.id === 'string') {
                                projectFiles.add(node.id);
                            }
                        });
                    } else if (isReactNative) {
                        console.log('Analyzing React Native project:', projectRoot);
                        const rnGraph = await this.reactNativeAnalyzer.analyzeReactNativeProject(projectRoot, token);
                        specificProjectNodes.push(...rnGraph.nodes);
                        specificProjectLinks.push(...rnGraph.links);
                        rnGraph.nodes.forEach(node => {
                            if (typeof node.id === 'string') {
                                projectFiles.add(node.id);
                            }
                        });
                    } else {
                        console.log('Analyzing React project:', projectRoot);
                        const reactGraph = await this.reactAnalyzer.analyzeReactProject(projectRoot, token);
                        specificProjectNodes.push(...reactGraph.nodes);
                        specificProjectLinks.push(...reactGraph.links);
                        reactGraph.nodes.forEach(node => {
                            if (typeof node.id === 'string') {
                                projectFiles.add(node.id);
                            }
                        });
                    }
                } catch (error) {
                    console.warn('Error analyzing project:', error.message);
                }
            } else {
                const projectType = this.getProjectType(project);
                console.log(`Analyzing ${projectType} project:`, projectRoot);
            }
        }

        const files = await this.getAllFiles(rootPath, ignore, token);
        const nonEmptyFiles = [];

        const fileContentsPromises = files.map(async file => {
            if (token?.isCancellationRequested) {
                console.log('Operation cancelled.');
                return null;
            }
            if (!projectFiles.has(file)) {
                try {
                    const content = await fs.readFile(file, 'utf-8');
                    if (content.trim().length > 0) {
                        this.fileContents.set(file, content);
                        nonEmptyFiles.push(file);
                        return { file, content };
                    }
                } catch (error) {
                    console.warn(`Error reading file ${file}:`, error);
                    return null;
                }
            }
            return null;
        });

        const fileContents = (await Promise.all(fileContentsPromises)).filter(Boolean);

        for (const { file, content } of fileContents) {
            if (token?.isCancellationRequested) {
                console.log('Operation cancelled.');
                return;
            }
            const projectRoot = this.findProjectRoot(file);

            const dependencies = [
                ...this.findRequires(content),
                ...this.findImports(content),
                ...this.findRelativeImports(content),
                ...this.findStyleImports(content),
                ...this.findCustomImports(content, projectRoot)
            ].map(dep => this.resolveDependencyPath(dep, file, projectRoot))
                .filter(Boolean)
                .filter(dep => !projectFiles.has(dep));

            this.dependencies.set(file, dependencies);
        }

        const { nodes, links } = this.formatDependencyGraph();

        return {
            nodes: [...nodes, ...specificProjectNodes],
            links: [...links, ...specificProjectLinks]
        };
    }

    async isNextJsProject(projectRoot, token) {
        try {
            if (token?.isCancellationRequested) {
                console.log('Operation cancelled.');
                return false;
            }
            const packageJson = await fs.readFile(
                path.join(projectRoot, 'package.json'),
                'utf-8'
            );
            const { dependencies = {} } = JSON.parse(packageJson);
            const hasNextDep = 'next' in dependencies;
            const hasAppDir = await fs.access(path.join(projectRoot, 'src', 'app'))
                .then(() => true)
                .catch(() => false);
            const hasNextConfig = await fs.access(path.join(projectRoot, 'next.config.js'))
                .then(() => true)
                .catch(() => false);

            return hasNextDep && (hasAppDir || hasNextConfig);
        } catch {
            return false;
        }
    }

    async isReactNativeProject(projectRoot, token) {
        try {
            if (token?.isCancellationRequested) {
                console.log('Operation cancelled.');
                return false;
            }
            const packageJson = await fs.readFile(
                path.join(projectRoot, 'package.json'),
                'utf-8'
            );
            const { dependencies = {} } = JSON.parse(packageJson);
            const hasRNDep = 'react-native' in dependencies;
            const hasAppJson = await fs.access(path.join(projectRoot, 'app.json'))
                .then(() => true)
                .catch(() => false);

            return hasRNDep && hasAppJson;
        } catch {
            return false;
        }
    }

    async isNodejsBackendProject(projectRoot, token) {
        try {
            if (token?.isCancellationRequested) {
                console.log('Operation cancelled.');
                return false;
            }
            const packageJson = await fs.readFile(
                path.join(projectRoot, 'package.json'),
                'utf-8'
            );
            const { dependencies = {}, devDependencies = {} } = JSON.parse(packageJson);

            const hasExpress = 'express' in dependencies;
            const hasNodemon = 'nodemon' in dependencies || 'nodemon' in devDependencies;
            const hasFolderStructure = await this.hasBackendFolders(projectRoot, token);

            return hasExpress && (hasNodemon || hasFolderStructure);
        } catch {
            return false;
        }
    }

    async hasBackendFolders(projectRoot, token) {
        const backendFolders = ['routes', 'controllers', 'models', 'middleware'];
        const srcDir = path.join(projectRoot, 'src');

        for (const folder of backendFolders) {
            if (token?.isCancellationRequested) {
                console.log('Operation cancelled.');
                return false;
            }
            if (
                await fs.access(path.join(projectRoot, folder)).then(() => true).catch(() => false) ||
                await fs.access(path.join(srcDir, folder)).then(() => true).catch(() => false)
            ) {
                return true;
            }
        }
        return false;
    }

    async getAllFiles(dir, ignore, token) {
        const files = [];
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (token?.isCancellationRequested) {
                    console.log('Operation cancelled.');
                    return [];
                }
                if (ignore.includes(entry.name) ||
                    frameworkDirs.includes(entry.name)) continue;

                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    files.push(...await this.getAllFiles(fullPath, ignore, token));
                } else {
                    if (/\.(js|jsx|ts|tsx|json|vue|py|rb|java|php)$/.test(entry.name)) {
                        if (this.isValidFilePath(fullPath)) {
                            files.push(fullPath);
                        } else {
                            console.warn(`Skipping invalid file path: ${fullPath}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${dir}:`, error);
        }

        return files;
    }

    findProjectRoot(filePath) {
        if (this.projectRootCache.has(filePath)) {
            return this.projectRootCache.get(filePath);
        }

        let currentDir = path.dirname(filePath);
        while (currentDir !== path.dirname(currentDir)) {
            if (this.projects.has(currentDir)) {
                this.projectRootCache.set(filePath, currentDir);
                return currentDir;
            }
            const projectMarkers = ['package.json', 'composer.json', 'pom.xml', 'build.gradle', 'requirements.txt', 'go.mod', 'Cargo.toml'];
            if (projectMarkers.some(marker => {
                try {
                    fs.access(path.join(currentDir, marker));
                    return true;
                } catch {
                    return false;
                }
            })) {
                this.projectRootCache.set(filePath, currentDir);
                return currentDir;
            }
            currentDir = path.dirname(currentDir);
        }
        this.projectRootCache.set(filePath, path.dirname(filePath));
        return path.dirname(filePath);
    }

    findRelativeImports(content) {
        const patterns = [
            /from\s+['"]\..*?['"]/g,
            /import\s+['"]\..*?['"]/g,
            /require\s*\(['"]\..*?['"]\)/g,
            /@import\s+['"]\..*?['"]/g
        ];

        return patterns.flatMap(pattern =>
            [...content.matchAll(pattern)].map(match =>
                match[0].match(/['"]([^'"]+)['"]/)[1]
            )
        );
    }

    findStyleImports(content) {
        const patterns = [
            /@import\s+['"].*?['"]/g,
            /url\s*\(['"].*?['"]\)/g,
            /<link[^>]+href=["'].*?["']/g
        ];

        return patterns.flatMap(pattern =>
            [...content.matchAll(pattern)].map(match => {
                const url = match[0].match(/['"]([^'"]+)['"]/);
                return url ? url[1] : null;
            }).filter(Boolean)
        );
    }

    findCustomImports(content, projectRoot) {
        const projectType = this.projects.get(projectRoot)?.type;
        const customPatterns = {
            'python': /from\s+(\w+(?:\.\w+)*)\s+import|\bimport\s+(\w+(?:\.\w+)*)/g,
            'java': /import\s+([a-zA-Z_][\w.]*\*?);/g,
            'php': /use\s+([a-zA-Z_][\w\\]*);/g
        };

        const pattern = customPatterns[projectType];
        if (!pattern) return [];

        return [...content.matchAll(pattern)]
            .map(match => match[1] || match[2])
            .filter(Boolean);
    }

    formatDependencyGraph() {
        const nodes = [];
        const links = [];
        const fileIndex = new Map();

        const projectGroups = new Map();
        this.dependencies.forEach((_, file) => {
            const projectRoot = this.findProjectRoot(file);
            if (!projectGroups.has(projectRoot)) {
                projectGroups.set(projectRoot, []);
            }
            projectGroups.get(projectRoot).push(file);
        });

        Array.from(this.dependencies.keys()).forEach((file, index) => {
            const ext = path.extname(file);
            const shortName = path.basename(file);
            let projectRoot = this.findProjectRoot(file);
            const projectType = this.projects.get(projectRoot)?.type || 'unknown';
            const relPath = path.relative(process.cwd(), file);

            fileIndex.set(file, index);
            nodes.push({
                id: index,
                name: shortName,
                path: relPath,
                project: projectType,
                projectRoot,
                type: ext.slice(1) || 'file',
                content: this.fileContents.get(file),
                group: this.getFileGroup(file, projectType),
                radius: this.calculateNodeSize(file)
            });
        });

        this.dependencies.forEach((deps, file) => {
            const sourceIndex = fileIndex.get(file);
            deps.forEach(dep => {
                const targetIndex = fileIndex.get(dep);
                if (targetIndex !== undefined) {
                    links.push({
                        source: sourceIndex,
                        target: targetIndex,
                        value: 1
                    });
                }
            });
        });

        return { nodes, links };
    }

    calculateNodeSize(file) {
        const content = this.fileContents.get(file);
        const linesOfCode = content.split('\n').length;
        return Math.min(20, Math.max(8, Math.log2(linesOfCode) * 3));
    }

    getFileGroup(file, projectType) {
        const ext = path.extname(file);
        switch (projectType) {
            case 'node':
                switch (ext) {
                    case '.js': return 1;
                    case '.jsx': return 1;
                    case '.ts': return 2;
                    case '.tsx': return 2;
                    case '.json': return 3;
                    default: return 9;
                }
            case 'php': return 8;
            case 'java': return 7;
            case 'python': return 5;
            default:
                switch (ext) {
                    case '.md': return 3;
                    default: return 9;
                }
        }
    }

    findRequires(content) {
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        return [...content.matchAll(requireRegex)].map(match => match[1]);
    }

    findImports(content) {
        const importRegex = /import.*?['"]([^'"]+)['"]/g;
        return [...content.matchAll(importRegex)].map(match => match[1]);
    }

    isValidFilePath(filePath) {
        return !filePath.includes('..') && !filePath.startsWith('/');
    }

    async fileExists(filePath) {
        try {
            if (!this.isValidFilePath(filePath)) {
                console.warn(`Skipping invalid file path check: ${filePath}`);
                return false;
            }
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    resolveDependencyPath(dep, currentFile, rootPath) {
        if (dep.startsWith('.')) {
            const currentDir = path.dirname(currentFile);
            const absolutePath = path.resolve(currentDir, dep);

            const extensions = ['.js', '.json', '.ts', '.jsx', '.tsx', ''];
            for (const ext of extensions) {
                const fullPath = absolutePath + ext;
                if (this.fileContents.has(fullPath)) {
                    return fullPath;
                }
                if (ext === '') {
                    const indexFile = path.join(absolutePath, 'index.js');
                    if (this.fileContents.has(indexFile)) {
                        return indexFile;
                    }
                }
            }
        } else {
            const possiblePath = path.join(rootPath, dep);
            if (this.fileContents.has(possiblePath)) {
                return possiblePath;
            }
        }
        return null;
    }

    getProjectType(project) {
        switch (project.type) {
            case 'node': return 'Node.js';
            case 'php': return 'PHP';
            case 'java': return 'Java';
            case 'python': return 'Python';
            case 'go': return 'Go';
            case 'rust': return 'Rust';
            case 'elixir': return 'Elixir';
            case 'dart': return 'Dart';
            case 'ruby': return 'Ruby';
            default: return 'Unknown';
        }
    }
}

module.exports = { DependencyAnalyzer };
