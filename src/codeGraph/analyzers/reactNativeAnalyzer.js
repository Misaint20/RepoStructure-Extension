const fs = require('fs/promises');
const path = require('path');

class ReactNativeAnalyzer {
    constructor() {
        this.screens = new Map();
        this.components = new Map();
        this.navigation = new Map();
    }

    async analyzeReactNativeProject(projectRoot) {
        const appNode = {
            id: 'react-native-root',
            name: 'React Native App',
            type: 'application',
            group: 0,
            radius: 30
        };

        const nodes = [appNode];
        const links = [];
        const processedFiles = new Set();

        // Detectar estructura del proyecto
        const srcDir = path.join(projectRoot, 'src');
        const hasSrcDir = await this.fileExists(srcDir);
        const rootDir = hasSrcDir ? srcDir : projectRoot;

        // Analizar estructura de carpetas principales
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
                    fileType: folder.type
                });
            }
        }

        return { nodes, links };
    }

    async scanDirectory(currentPath, context) {
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

            if (!/\.(jsx?|tsx?)$/.test(entry.name)) continue;

            const filePath = path.join(currentPath, entry.name);
            if (processedFiles.has(filePath)) continue;

            const content = await fs.readFile(filePath, 'utf-8');
            const fileName = path.basename(filePath, path.extname(filePath));

            const node = {
                id: filePath,
                name: this.formatName(fileName, fileType),
                type: fileType,
                content,
                group: this.getNodeGroup(fileType),
                radius: this.getNodeRadius(fileType)
            };

            nodes.push(node);
            processedFiles.add(filePath);

            // Conectar con el nodo padre
            links.push({
                source: node.id,
                target: parentNode.id,
                value: 1,
                type: `${fileType}-structure`
            });

            // Procesar dependencias
            await this.processDependencies(filePath, content, {
                nodes,
                links,
                processedFiles,
                sourceNode: node
            });

            // Analizar navegación si es un archivo de navegación
            if (fileType === 'navigation') {
                this.analyzeNavigation(content, node, nodes, links);
            }
        }
    }

    formatName(fileName, fileType) {
        switch (fileType) {
            case 'screen':
                return fileName.replace(/Screen$/, '');
            case 'navigation':
                return fileName.replace(/Navigation$/, '');
            default:
                return fileName;
        }
    }

    getNodeGroup(type) {
        const groups = {
            'application': 0,
            'navigation': 1,
            'screen': 2,
            'component': 3
        };
        return groups[type] || 4;
    }

    getNodeRadius(type) {
        const sizes = {
            'application': 30,
            'navigation': 25,
            'screen': 20,
            'component': 15
        };
        return sizes[type] || 10;
    }

    analyzeNavigation(content, navNode, nodes, links) {
        // Buscar definiciones de rutas en el navegador
        const routeMatches = content.matchAll(
            /<Stack\.Screen[^>]*name=["']([^"']+)["'][^>]*component=\{([^}]+)\}/g
        );

        for (const match of routeMatches) {
            const [_, routeName, componentName] = match;
            links.push({
                source: navNode.id,
                target: routeName,
                value: 1,
                type: 'navigation-route'
            });
        }
    }

    // Reutilizar métodos comunes del NextJS analyzer
    async processDependencies(filePath, content, context) {
        const { nodes, links, processedFiles, sourceNode } = context;
        const imports = this.extractImports(content);

        for (const importPath of imports) {
            const resolvedPath = await this.resolveImportPath(importPath, filePath);
            if (resolvedPath && !processedFiles.has(resolvedPath)) {
                try {
                    const depContent = await fs.readFile(resolvedPath, 'utf-8');
                    const depNode = {
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
                        nodes,
                        links,
                        processedFiles,
                        sourceNode: depNode
                    });
                } catch (error) {
                    console.warn(`Error processing dependency: ${resolvedPath}`);
                }
            }
        }
    }

    extractImports(content) {
        const imports = new Set();
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

    async resolveImportPath(importPath, currentFile) {
        const basePath = path.dirname(currentFile);
        const projectRoot = await this.findProjectRoot(basePath);
        
        let resolvedPath = importPath.startsWith('@/')
            ? path.resolve(projectRoot, 'src', importPath.slice(2))
            : path.resolve(basePath, importPath);

        const extensions = ['.tsx', '.ts', '.jsx', '.js'];
        
        for (const ext of extensions) {
            const fullPath = resolvedPath + ext;
            if (await this.fileExists(fullPath)) {
                return fullPath;
            }
        }

        for (const ext of extensions) {
            const indexPath = path.join(resolvedPath, `index${ext}`);
            if (await this.fileExists(indexPath)) {
                return indexPath;
            }
        }

        return null;
    }

    async findProjectRoot(currentPath) {
        let dir = currentPath;
        while (dir !== path.dirname(dir)) {
            if (await this.fileExists(path.join(dir, 'package.json'))) {
                return dir;
            }
            dir = path.dirname(dir);
        }
        return currentPath;
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = { ReactNativeAnalyzer };
