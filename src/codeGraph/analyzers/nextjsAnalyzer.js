const fs = require('fs/promises');
const path = require('path');

class NextjsAnalyzer {
    constructor() {
        this.routes = new Map();
        this.layouts = new Map();
        this.components = new Map();
        this.pages = new Map();
    }

    async analyzeNextProject(projectRoot) {
        const appDirectory = path.join(projectRoot, 'src', 'app');
        const hasAppDir = await this.fileExists(appDirectory);
        const rootDir = hasAppDir ? appDirectory : path.join(projectRoot, 'src', 'pages');

        const appNode = {
            id: 'nextjs-root',
            name: 'Next.js App',
            type: 'application',
            group: 0,
            radius: 30
        };

        const nodes = [appNode];
        const links = [];
        const processedFiles = new Set();

        // Analizar estructura de carpetas para rutas
        await this.scanAppDirectory(rootDir, {
            nodes,
            links,
            processedFiles,
            parentNode: appNode,
            isAppDir: hasAppDir
        });

        return { nodes, links };
    }

    async scanAppDirectory(currentPath, context) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        const { nodes, links, processedFiles, parentNode, isAppDir } = context;
        const rootDir = isAppDir ? path.join(currentPath, '..', '..') : currentPath;

        // Primero procesar layout si existe
        const layoutFile = entries.find(e => /^layout\.(jsx?|tsx?)$/.test(e.name));
        let layoutNode = null;

        if (layoutFile) {
            const layoutPath = path.join(currentPath, layoutFile.name);
            if (!processedFiles.has(layoutPath)) {
                const content = await fs.readFile(layoutPath, 'utf-8');
                layoutNode = {
                    id: layoutPath,
                    name: 'layout',  // Simplificar nombre del layout
                    type: 'layout',
                    content,
                    group: 2,
                    radius: 20
                };
                nodes.push(layoutNode);
                processedFiles.add(layoutPath);

                // Conectar layout con el nodo padre
                links.push({
                    source: layoutNode.id,
                    target: parentNode.id,
                    value: 2,
                    type: 'layout-structure'
                });

                // Procesar dependencias del layout
                await this.processDependencies(layoutPath, content, {
                    nodes,
                    links,
                    processedFiles,
                    sourceNode: layoutNode
                });
            }
        }

        // Procesar page.tsx/js
        const pageFile = entries.find(e => /^page\.(jsx?|tsx?)$/.test(e.name));
        if (pageFile) {
            const pagePath = path.join(currentPath, pageFile.name);
            if (!processedFiles.has(pagePath)) {
                const content = await fs.readFile(pagePath, 'utf-8');
                const routePath = this.getRouteName(currentPath, rootDir);
                const pageNode = {
                    id: pagePath,
                    name: routePath || '/',  // Usar ruta web como nombre
                    type: 'page',
                    content,
                    group: 1,
                    radius: 15
                };
                nodes.push(pageNode);
                processedFiles.add(pagePath);

                // Conectar página con layout o app
                links.push({
                    source: pageNode.id,
                    target: layoutNode ? layoutNode.id : parentNode.id,
                    value: 1,
                    type: 'route'
                });

                // Procesar dependencias de la página
                await this.processDependencies(pagePath, content, {
                    nodes,
                    links,
                    processedFiles,
                    sourceNode: pageNode
                });
            }
        }

        // Procesar subdirectorios
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

                    // Procesar dependencias anidadas
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
            /from\s+['"](@\/[^'"]+)['"]/g,    // @/ imports
            /from\s+['"](\.[^'"]+)['"]/g,      // relative imports
            /import\s+['"](\.[^'"]+)['"]/g     // direct imports
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
        
        // Verificar extensiones directas
        for (const ext of extensions) {
            const fullPath = resolvedPath + ext;
            if (await this.fileExists(fullPath)) {
                return fullPath;
            }
        }

        // Verificar index files
        for (const ext of extensions) {
            const indexPath = path.join(resolvedPath, `index${ext}`);
            if (await this.fileExists(indexPath)) {
                return indexPath;
            }
        }

        return null;
    }

    getRouteName(pagePath, rootDir) {
        // Obtener la ruta relativa desde la raíz del proyecto
        const relativePath = path.relative(rootDir, pagePath);
        
        // Convertir a formato de ruta web
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
                    // Manejar rutas dinámicas
                    if (part.startsWith('[...')) {
                        // Catch-all routes [...param]
                        return '*';
                    } else {
                        // Dynamic routes [param]
                        return `:${part.slice(1, -1)}`;
                    }
                }
                return part;
            })
            .filter(Boolean)
            .join('/')
            .replace(/\/+/g, '/'); // Eliminar slashes duplicados

        return routePath === '' ? '/' : routePath;  // Retornar '/' para la ruta principal
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

module.exports = { NextjsAnalyzer };
