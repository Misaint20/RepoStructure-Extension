const fs = require('fs/promises');
const path = require('path');

class NodejsAnalyzer {
    constructor() {
        this.routes = new Map();
        this.controllers = new Map();
        this.models = new Map();
        this.services = new Map();
        this.middleware = new Map();
    }

    async analyzeNodeProject(projectRoot) {
        // Analizar package.json primero
        const packageJson = await this.analyzePackageJson(projectRoot);
        
        const appNode = {
            id: 'nodejs-root',
            name: 'Node.js Backend',
            type: 'application',
            group: 0,
            radius: 30
        };

        const nodes = [appNode];
        const links = [];
        const processedFiles = new Set();

        // Procesar el archivo principal desde package.json
        if (packageJson.main) {
            let mainFilePath = path.resolve(projectRoot, packageJson.main);
            
            // Ajustar la extensión si es necesario
            if (path.extname(mainFilePath) === '') {
                for (const ext of ['.ts', '.js']) {
                    const pathWithExt = mainFilePath + ext;
                    if (await this.fileExists(pathWithExt)) {
                        mainFilePath = pathWithExt;
                        break;
                    }
                }
            }

            // Si no encuentra el archivo en la ruta exacta, buscar en src/
            if (!(await this.fileExists(mainFilePath))) {
                const srcMainPath = path.join(projectRoot, 'src', path.basename(mainFilePath));
                if (await this.fileExists(srcMainPath)) {
                    mainFilePath = srcMainPath;
                }
            }

            if (await this.fileExists(mainFilePath)) {
                const mainContent = await fs.readFile(mainFilePath, 'utf-8');
                const mainNode = {
                    id: mainFilePath,
                    name: 'Server',
                    type: 'server',
                    content: mainContent,
                    group: 1,
                    radius: 25
                };
                nodes.push(mainNode);
                processedFiles.add(mainFilePath);
                
                // Conectar el servidor con la aplicación
                links.push({
                    source: mainNode.id,
                    target: appNode.id,
                    value: 2,
                    type: 'server-entry'
                });

                // Procesar dependencias del servidor
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

        // Detectar estructura del proyecto
        const srcDir = path.join(projectRoot, 'src');
        const hasSrcDir = await this.fileExists(srcDir);
        const rootDir = hasSrcDir ? srcDir : projectRoot;

        // Actualizar foldersToAnalyze para incluir carpetas específicas de tu proyecto
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

        // Crear nodo para cada carpeta principal
        for (const folder of foldersToAnalyze) {
            const folderPath = path.join(rootDir, folder.path);
            if (await this.fileExists(folderPath)) {
                const folderNode = {
                    id: `folder-${folder.path}`,
                    name: folder.path,
                    type: `${folder.type}-folder`,
                    group: this.getNodeGroup(folder.type),
                    radius: 20
                };
                nodes.push(folderNode);
                
                // Conectar carpeta con el nodo servidor si existe, o con la aplicación
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

            if (!/\.(js|ts)$/.test(entry.name)) continue;

            const filePath = path.join(currentPath, entry.name);
            if (processedFiles.has(filePath)) continue;

            const content = await fs.readFile(filePath, 'utf-8');
            const node = {
                id: filePath,
                name: this.formatName(entry.name, fileType),
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
                sourceNode: node,
                fileType
            });

            // Analizar rutas si es un archivo de rutas
            if (fileType === 'route') {
                this.analyzeRoutes(content, node, nodes, links);
            }
        }
    }

    analyzeRoutes(content, routeNode, nodes, links) {
        // Detectar definiciones de rutas (Express.js style)
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
                // Crear nodo para cada endpoint
                const endpointNode = {
                    id: `${routeNode.id}-${routePath}`,
                    name: `${routePath}`,
                    type: 'endpoint',
                    content: `Endpoint: ${routePath}`,
                    group: 5,
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

    formatName(fileName, fileType) {
        return fileName.replace(/\.(js|ts)$/, '');
    }

    getNodeGroup(type) {
        const groups = {
            'application': 0,
            'server': 1,
            'route': 2,
            'controller': 3,
            'model': 4,
            'service': 5,
            'middleware': 6,
            'utility': 7,
            'config': 8,
            'endpoint': 9,
            'database': 10,
            'helper': 11,
            'type': 12
        };
        return groups[type] || 13;
    }

    getNodeRadius(type) {
        const sizes = {
            'application': 30,
            'server': 25,
            'route': 20,
            'controller': 18,
            'model': 18,
            'service': 15,
            'middleware': 12,
            'utility': 10,
            'config': 10,
            'endpoint': 8,
            'database': 15,
            'helper': 12,
            'type': 10
        };
        return sizes[type] || 10;
    }

    // Reutilizar métodos comunes
    async processDependencies(filePath, content, context) {
        const { nodes, links, processedFiles, sourceNode, rootDir } = context;
        const imports = this.extractImports(content);

        for (const importPath of imports) {
            const resolvedPath = await this.resolveImportPath(importPath, filePath, rootDir);
            if (resolvedPath && !processedFiles.has(resolvedPath)) {
                try {
                    const depContent = await fs.readFile(resolvedPath, 'utf-8');
                    const fileType = this.getFileType(resolvedPath);
                    const depNode = {
                        id: resolvedPath,
                        name: path.basename(resolvedPath, path.extname(resolvedPath)),
                        type: fileType,
                        content: depContent,
                        group: this.getNodeGroup(fileType),
                        radius: this.getNodeRadius(fileType)
                    };

                    nodes.push(depNode);
                    processedFiles.add(resolvedPath);

                    // Crear enlace con el nodo fuente
                    links.push({
                        source: sourceNode.id,
                        target: depNode.id,
                        value: 1,
                        type: 'imports'
                    });

                    // Procesar dependencias recursivamente
                    await this.processDependencies(resolvedPath, depContent, {
                        nodes,
                        links,
                        processedFiles,
                        sourceNode: depNode,
                        fileType
                    });
                } catch (error) {
                    console.warn(`Error processing dependency: ${resolvedPath}`);
                }
            }
        }
    }

    getFileType(filePath) {
        const dir = path.dirname(filePath);
        const dirName = path.basename(dir).toLowerCase();
        
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

    // Otros métodos auxiliares reutilizados
    extractImports(content) {
        const imports = new Set();
        const patterns = [
            /require\(['"]([^'"]+)['"]\)/g,     // require
            /from\s+['"]([^'"]+)['"]/g,         // import from
            /import\s+['"]([^'"]+)['"]/g        // direct import
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                // Solo incluir importaciones locales
                if (match[1].startsWith('.') || match[1].startsWith('/')) {
                    imports.add(match[1]);
                }
            }
        });

        return imports;
    }

    async resolveImportPath(importPath, currentFile, rootDir) {
        const basePath = path.dirname(currentFile);
        
        let resolvedPath;
        if (importPath.startsWith('.')) {
            resolvedPath = path.resolve(basePath, importPath);
        } else if (importPath.startsWith('/')) {
            resolvedPath = path.join(rootDir, importPath);
        } else {
            // Para imports que podrían estar en src/
            resolvedPath = path.join(rootDir, 'src', importPath);
        }

        const extensions = ['.ts', '.js', '.json'];
        
        // Verificar con extensiones
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

    async findProjectRoot(currentPath) {
        // ... mismo código que otros analizadores ...
    }

    async fileExists(filePath) {
        // ... mismo código que otros analizadores ...
    }

    async analyzePackageJson(projectRoot) {
        try {
            const packageJsonPath = path.join(projectRoot, 'package.json');
            const content = await fs.readFile(packageJsonPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.warn('Error reading package.json:', error);
            return { main: 'index.js' }; // valor por defecto
        }
    }
}

module.exports = { NodejsAnalyzer };
