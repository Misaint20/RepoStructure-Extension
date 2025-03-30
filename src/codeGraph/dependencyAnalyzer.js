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
    }

    async detectProjects(rootPath) {
        const projectMarkers = {
            'package.json': 'node',
            'composer.json': 'php',
            'pom.xml': 'java',
            'build.gradle': 'java',
            'requirements.txt': 'python',
            'go.mod': 'go',
            'Cargo.toml': 'rust'
        };

        const projects = [];

        async function scanDir(dir) {
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

    async analyzeDependencies(rootPath, ignore = []) {
        // Detectar proyectos primero
        const projects = await this.detectProjects(rootPath);
        this.projects = new Map(projects.map(p => [p.root, p]));

        // Analizar proyectos específicos primero para conocer sus archivos
        const projectFiles = new Set();
        const specificProjectNodes = [];
        const specificProjectLinks = [];

        // Analizar proyectos específicos
        for (const [projectRoot, project] of this.projects.entries()) {
            if (project.type === 'node') {
                try {
                    const isNextJs = await this.isNextJsProject(projectRoot);
                    const isReactNative = await this.isReactNativeProject(projectRoot);
                    const isNodeBackend = await this.isNodejsBackendProject(projectRoot);
                    
                    if (isNodeBackend) {
                        console.log('Analyzing Node.js Backend project:', projectRoot);
                        const nodeGraph = await this.nodejsAnalyzer.analyzeNodeProject(projectRoot);
                        specificProjectNodes.push(...nodeGraph.nodes);
                        specificProjectLinks.push(...nodeGraph.links);
                        nodeGraph.nodes.forEach(node => {
                            if (typeof node.id === 'string') {
                                projectFiles.add(node.id);
                            }
                        });
                    } else if (isNextJs) {
                        console.log('Analyzing Next.js project:', projectRoot);
                        const nextGraph = await this.nextjsAnalyzer.analyzeNextProject(projectRoot);
                        specificProjectNodes.push(...nextGraph.nodes);
                        specificProjectLinks.push(...nextGraph.links);
                        // Registrar archivos del proyecto Next.js
                        nextGraph.nodes.forEach(node => {
                            if (typeof node.id === 'string') {
                                projectFiles.add(node.id);
                            }
                        });
                    } else if (isReactNative) {
                        console.log('Analyzing React Native project:', projectRoot);
                        const rnGraph = await this.reactNativeAnalyzer.analyzeReactNativeProject(projectRoot);
                        specificProjectNodes.push(...rnGraph.nodes);
                        specificProjectLinks.push(...rnGraph.links);
                        // Registrar archivos del proyecto React Native
                        rnGraph.nodes.forEach(node => {
                            if (typeof node.id === 'string') {
                                projectFiles.add(node.id);
                            }
                        });
                    } else {
                        console.log('Analyzing React project:', projectRoot);
                        const reactGraph = await this.reactAnalyzer.analyzeReactProject(projectRoot);
                        specificProjectNodes.push(...reactGraph.nodes);
                        specificProjectLinks.push(...reactGraph.links);
                        // Registrar archivos del proyecto React
                        reactGraph.nodes.forEach(node => {
                            if (typeof node.id === 'string') {
                                projectFiles.add(node.id);
                            }
                        });
                    }
                } catch (error) {
                    console.warn('Error analyzing project:', error.message);
                }
            }
        }

        const files = await this.getAllFiles(rootPath, ignore);
        const nonEmptyFiles = [];

        // Primer paso: leer contenidos y filtrar archivos vacíos y los que ya están en proyectos específicos
        for (const file of files) {
            if (!projectFiles.has(file)) {  // Solo procesar archivos que no están en proyectos específicos
                const content = await fs.readFile(file, 'utf-8');
                if (content.trim().length > 0) {
                    this.fileContents.set(file, content);
                    nonEmptyFiles.push(file);
                }
            }
        }

        // Segundo paso: analizar dependencias solo para archivos no incluidos en proyectos específicos
        for (const file of nonEmptyFiles) {
            const content = this.fileContents.get(file);
            const projectRoot = this.findProjectRoot(file);

            const dependencies = [
                ...this.findRequires(content),
                ...this.findImports(content),
                ...this.findRelativeImports(content),
                ...this.findStyleImports(content),
                ...this.findCustomImports(content, projectRoot)
            ].map(dep => this.resolveDependencyPath(dep, file, projectRoot))
                .filter(Boolean)
                .filter(dep => !projectFiles.has(dep));  // Filtrar dependencias que ya están en proyectos específicos

            this.dependencies.set(file, dependencies);
        }

        const { nodes, links } = this.formatDependencyGraph();

        // Combinar nodos y enlaces
        return {
            nodes: [...nodes, ...specificProjectNodes],
            links: [...links, ...specificProjectLinks]
        };
    }

    async isNextJsProject(projectRoot) {
        try {
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

    async isReactNativeProject(projectRoot) {
        try {
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

    async isNodejsBackendProject(projectRoot) {
        try {
            const packageJson = await fs.readFile(
                path.join(projectRoot, 'package.json'),
                'utf-8'
            );
            const { dependencies = {}, devDependencies = {} } = JSON.parse(packageJson);
            
            // Verificar dependencias típicas de backend
            const hasExpress = 'express' in dependencies;
            const hasNodemon = 'nodemon' in dependencies || 'nodemon' in devDependencies;
            const hasFolderStructure = await this.hasBackendFolders(projectRoot);

            return hasExpress && (hasNodemon || hasFolderStructure);
        } catch {
            return false;
        }
    }

    async hasBackendFolders(projectRoot) {
        const backendFolders = ['routes', 'controllers', 'models', 'middleware'];
        const srcDir = path.join(projectRoot, 'src');
        
        // Verificar en la raíz y en src/
        for (const folder of backendFolders) {
            if (
                await fs.access(path.join(projectRoot, folder)).then(() => true).catch(() => false) ||
                await fs.access(path.join(srcDir, folder)).then(() => true).catch(() => false)
            ) {
                return true;
            }
        }
        return false;
    }

    findProjectRoot(filePath) {
        let currentDir = path.dirname(filePath);
        while (currentDir !== path.dirname(currentDir)) {
            if (this.projects.has(currentDir)) {
                return currentDir;
            }
            currentDir = path.dirname(currentDir);
        }
        return path.dirname(filePath);
    }

    // Nuevos métodos de análisis de dependencias
    findRelativeImports(content) {
        const patterns = [
            /from\s+['"]\..*?['"]/g,           // from './path'
            /import\s+['"]\..*?['"]/g,         // import './path'
            /require\s*\(['"]\..*?['"]\)/g,    // require('./path')
            /@import\s+['"]\..*?['"]/g         // @import './path'
        ];

        return patterns.flatMap(pattern =>
            [...content.matchAll(pattern)].map(match =>
                match[0].match(/['"]([^'"]+)['"]/)[1]
            )
        );
    }

    findStyleImports(content) {
        const patterns = [
            /@import\s+['"].*?['"]/g,          // CSS/SCSS imports
            /url\s*\(['"].*?['"]\)/g,          // url() in CSS
            /<link[^>]+href=["'].*?["']/g      // <link href="...">
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

        // Agrupar archivos por proyecto
        const projectGroups = new Map();
        this.dependencies.forEach((_, file) => {
            const projectRoot = this.findProjectRoot(file);
            if (!projectGroups.has(projectRoot)) {
                projectGroups.set(projectRoot, []);
            }
            projectGroups.get(projectRoot).push(file);
        });

        // Crear nodos con información de proyecto
        Array.from(this.dependencies.keys()).forEach((file, index) => {
            const ext = path.extname(file);
            const shortName = path.basename(file);
            const projectRoot = this.findProjectRoot(file);
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
                group: this.getFileGroup(file),
                radius: this.calculateNodeSize(file)
            });
        });

        // Crear enlaces
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
        // Tamaño base 8, máximo 20 basado en líneas de código
        return Math.min(20, Math.max(8, Math.log2(linesOfCode) * 3));
    }

    getFileGroup(file) {
        const ext = path.extname(file);
        switch (ext) {
            case '.js': return 1;
            case '.jsx': return 1;
            case '.ts': return 2;
            case '.tsx': return 2;
            case '.json': return 3;
            case '.vue': return 4;
            case '.py': return 5;
            case '.rb': return 6;
            case '.java': return 7;
            case '.php': return 8;
            case '.md': return 3;
            default: return 9;
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

    async getAllFiles(dir, ignore) {
        const files = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            if (ignore.includes(entry.name) ||
                frameworkDirs.includes(entry.name)) continue;

            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...await this.getAllFiles(fullPath, ignore));
            } else {
                // Solo incluir archivos de código
                if (/\.(js|jsx|ts|tsx|json|vue|py|rb|java|php)$/.test(entry.name)) {
                    files.push(fullPath);
                }
            }
        }

        return files;
    }

    resolveDependencyPath(dep, currentFile, rootPath) {
        if (dep.startsWith('.')) {
            // Ruta relativa
            const currentDir = path.dirname(currentFile);
            const absolutePath = path.resolve(currentDir, dep);

            // Intentar diferentes extensiones si no se especifica
            const extensions = ['.js', '.json', '.ts', '.jsx', '.tsx', ''];
            for (const ext of extensions) {
                const fullPath = absolutePath + ext;
                if (this.fileContents.has(fullPath)) {
                    return fullPath;
                }
                // Comprobar también index files en directorios
                if (ext === '') {
                    const indexFile = path.join(absolutePath, 'index.js');
                    if (this.fileContents.has(indexFile)) {
                        return indexFile;
                    }
                }
            }
        } else {
            // Módulo del proyecto o de node_modules
            const possiblePath = path.join(rootPath, dep);
            if (this.fileContents.has(possiblePath)) {
                return possiblePath;
            }
        }
        return null;
    }
}

module.exports = { DependencyAnalyzer };
