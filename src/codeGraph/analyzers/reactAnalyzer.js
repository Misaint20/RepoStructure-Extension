const fs = require('fs/promises');
const path = require('path');

class ReactAnalyzer {
    constructor() {
        this.pages = new Map();
        this.layouts = new Map();
        this.components = new Map();
        this.routes = new Set();
        this.projectType = null;
    }

    async analyzeReactProject(projectRoot) {
        this.projectType = await this.detectReactProjectType(projectRoot);
        if (!this.projectType) return { nodes: [], links: [] };

        await this.analyzePagesDirectory(projectRoot);

        const appNode = {
            id: `${this.projectType}-${projectRoot}`,
            name: this.getProjectTypeName(),
            type: 'application',
            group: 0,
            radius: 30,
            project: this.projectType,
            projectRoot
        };

        const nodes = [appNode];
        const links = [];
        const processedFiles = new Set();

        // Procesar layouts primero para mejor jerarquía
        this.layouts.forEach((layoutInfo, layoutPath) => {
            if (!processedFiles.has(layoutPath)) {
                processedFiles.add(layoutPath);
                const layoutNode = this.createFileNode(layoutPath, layoutInfo.content, 'layout');
                nodes.push(layoutNode);

                // Conectar layout con la aplicación
                links.push({
                    source: layoutNode.id,
                    target: appNode.id,
                    value: 2,
                    type: 'layout-structure'
                });

                // Procesar dependencias del layout
                const layoutDeps = this.findComponentDependencies(layoutInfo.content, layoutPath);
                this.processFileDependencies(layoutDeps, nodes, links, processedFiles, layoutPath);
            }
        });

        // Procesar páginas y sus dependencias
        this.pages.forEach((pageInfo, pagePath) => {
            if (!processedFiles.has(pagePath)) {
                processedFiles.add(pagePath);
                const pageNode = this.createFileNode(pagePath, pageInfo.content, 'page');
                nodes.push(pageNode);

                // Conectar página con su layout si existe
                if (pageInfo.layout && this.layouts.has(pageInfo.layout)) {
                    links.push({
                        source: pageNode.id,
                        target: pageInfo.layout,
                        value: 2,
                        type: 'uses-layout'
                    });
                } else {
                    // Si no tiene layout, conectar directamente con la aplicación
                    links.push({
                        source: pageNode.id,
                        target: appNode.id,
                        value: 1,
                        type: 'route'
                    });
                }

                // Procesar dependencias de la página
                const pageDeps = this.findComponentDependencies(pageInfo.content, pagePath);
                this.processFileDependencies(pageDeps, nodes, links, processedFiles, pagePath);
            }
        });

        return { nodes, links };
    }

    createFileNode(filePath, content, type) {
        return {
            id: filePath,
            name: path.basename(filePath),
            type: type,
            content: content,
            group: type === 'page' ? 1 : type === 'layout' ? 2 : 3,
            radius: type === 'page' ? 15 : type === 'layout' ? 20 : 10,
            project: this.projectType,
            projectRoot: this.findProjectRoot(filePath)
        };
    }

    processFileDependencies(dependencies, nodes, links, processedFiles, sourcePath) {
        for (const dep of dependencies) {
            if (dep && !processedFiles.has(dep)) {
                try {
                    const content = require('fs').readFileSync(dep, 'utf-8');
                    processedFiles.add(dep);

                    // Añadir nodo de dependencia
                    const depNode = {
                        id: dep,
                        name: path.basename(dep),
                        type: 'component',
                        content: content,
                        group: 3,
                        radius: 10,
                        project: this.projectType
                    };
                    nodes.push(depNode);

                    // Añadir enlace
                    links.push({
                        source: sourcePath,
                        target: dep,
                        value: 1,
                        type: 'imports'
                    });

                    // Procesar dependencias del componente
                    const nestedDeps = this.findComponentDependencies(content, dep);
                    this.processFileDependencies(nestedDeps, nodes, links, processedFiles, dep);
                } catch (error) {
                    console.warn(`Error processing dependency: ${dep}`);
                }
            }
        }
    }

    async detectReactProjectType(projectRoot) {
        try {
            const packageJson = await fs.readFile(
                path.join(projectRoot, 'package.json'),
                'utf-8'
            );
            const { dependencies = {}, devDependencies = {} } = JSON.parse(packageJson);

            // Verificar presencia de archivos específicos
            const hasAppJson = await this.fileExists(path.join(projectRoot, 'app.json'));
            const hasNextConfig = await this.fileExists(path.join(projectRoot, 'next.config.js'));
            const hasAppDir = await this.fileExists(path.join(projectRoot, 'src/app')) ||
                await this.fileExists(path.join(projectRoot, 'app'));

            if ('react-native' in dependencies && hasAppJson) {
                return 'react-native';
            } else if ('next' in dependencies && (hasNextConfig || hasAppDir)) {
                return 'nextjs';
            } else if ('react' in dependencies) {
                return 'react';
            }
            return null;
        } catch {
            return null;
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    getProjectTypeName() {
        switch (this.projectType) {
            case 'nextjs': return 'Next.js Application';
            case 'react-native': return 'React Native Application';
            default: return 'React Application';
        }
    }

    getProjectDirs(projectType) {
        switch (projectType) {
            case 'nextjs':
                return {
                    pagesDir: ['src/app', 'app', 'pages', 'src/pages'],  // Nuevas y viejas ubicaciones
                    layoutsDir: ['src/app', 'app'],  // Los layouts ahora van junto a las páginas
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

    async analyzePagesDirectory(projectRoot) {
        const { pagesDir } = this.getProjectDirs(this.projectType);

        for (const dir of pagesDir) {
            const fullPath = path.join(projectRoot, dir);
            try {
                await this.scanPagesRecursively(fullPath, '');
            } catch (error) {
                console.warn(`No pages found in ${dir}:`, error.message);
            }
        }
    }

    async scanPagesRecursively(currentPath, routePath) {
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });

            // Primero buscar page.tsx/js en el directorio actual
            const pageFile = entries.find(entry =>
                !entry.isDirectory() && /page\.(jsx?|tsx?)$/.test(entry.name)
            );

            if (pageFile) {
                const fullPath = path.join(currentPath, pageFile.name);
                const content = await fs.readFile(fullPath, 'utf-8');
                const layout = await this.findLayout(content, fullPath);
                const dependencies = await this.findComponentDependencies(content, fullPath);

                // Construir la ruta basada en la estructura de carpetas
                const route = this.buildRouteFromPath(routePath);

                this.pages.set(fullPath, {
                    content,
                    layout,
                    dependencies,
                    route,
                    isAppDir: currentPath.includes('/app/') || currentPath.includes('\\app\\')
                });
            }

            // Luego procesar subdirectorios
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
                    const nextPath = path.join(currentPath, entry.name);
                    const nextRoutePath = path.join(routePath, this.normalizeRouteSegment(entry.name));
                    await this.scanPagesRecursively(nextPath, nextRoutePath);
                }
            }
        } catch (error) {
            console.warn(`Error scanning directory ${currentPath}:`, error);
        }
    }

    buildRouteFromPath(routePath) {
        // Convertir la ruta del sistema de archivos a una ruta web
        let webRoute = routePath
            .split(path.sep)
            .filter(Boolean)
            .map(segment => this.normalizeRouteSegment(segment))
            .join('/');

        // Asegurar que la ruta comience con /
        return webRoute.startsWith('/') ? webRoute : `/${webRoute}`;
    }

    normalizeRouteSegment(segment) {
        return segment
            .replace(/\(.*?\)/, '') // Eliminar grupos de rutas (marketing)
            .replace(/\[\.{3}(\w+)\]/, '*') // Rutas catch-all [...param]
            .replace(/\[(\w+)\]/, ':$1'); // Rutas dinámicas [id]
    }

    async analyzeLayoutsDirectory(layoutsDir) {
        try {
            const files = await this.getFiles(layoutsDir);
            for (const file of files) {
                if (/\.(jsx?|tsx?)$/.test(file)) {
                    const content = await fs.readFile(file, 'utf-8');
                    this.layouts.set(file, { content });
                }
            }
        } catch (error) {
            console.warn('No layouts directory found:', error.message);
        }
    }

    async findLayout(content, filePath) {
        const dirPath = path.dirname(filePath);
        const isAppDir = dirPath.includes('/app/') || dirPath.includes('\\app\\');

        if (this.projectType === 'nextjs' && isAppDir) {
            // Buscar layout.js/tsx en el directorio actual y superiores
            let currentDir = dirPath;
            const layoutFiles = ['layout.tsx', 'layout.jsx', 'layout.js'];

            while (currentDir.includes('app')) {
                for (const layoutFile of layoutFiles) {
                    const layoutPath = path.join(currentDir, layoutFile);
                    try {
                        await fs.access(layoutPath);
                        const content = await fs.readFile(layoutPath, 'utf-8');
                        this.layouts.set(layoutPath, { content });
                        return layoutPath;
                    } catch { }
                }
                // Subir un nivel en la jerarquía de carpetas
                const parentDir = path.dirname(currentDir);
                if (parentDir === currentDir) break;
                currentDir = parentDir;
            }
        }

        // Pages Router o React tradicional: buscar por importaciones
        const layoutPatterns = [
            /import.*from ['"][@\/\w-]+\/layouts\/(\w+)['"]/,
            /import.*Layout.*from ['"]([^'"]+)['"]/,
            /import.*from ['"]\.\.\/layouts\/(\w+)['"]/
        ];

        for (const pattern of layoutPatterns) {
            const match = content.match(pattern);
            if (match) {
                const layoutPath = match[1];
                const resolvedPath = path.resolve(dirPath, layoutPath);
                // Verificar si el archivo existe
                try {
                    await fs.access(resolvedPath);
                    return resolvedPath;
                } catch {
                    // Intentar con extensiones comunes
                    for (const ext of ['.js', '.jsx', '.tsx']) {
                        const pathWithExt = resolvedPath + ext;
                        try {
                            await fs.access(pathWithExt);
                            return pathWithExt;
                        } catch { }
                    }
                }
            }
        }

        return null;
    }

    findComponentDependencies(content, filePath) {
        const imports = [...content.matchAll(/import.*from ['"]([^'"]+)['"]/g)]
            .map(match => {
                const importPath = match[1];
                // Solo procesar importaciones locales
                if (importPath.startsWith('.') || importPath.startsWith('@/')) {
                    const basePath = path.dirname(filePath);
                    const projectRoot = this.findProjectRoot(basePath);
                    let resolvedPath;

                    try {
                        if (importPath.startsWith('@/')) {
                            resolvedPath = path.resolve(projectRoot, 'src', importPath.slice(2));
                        } else {
                            resolvedPath = path.resolve(basePath, importPath);
                        }

                        // Intentar encontrar el archivo con diferentes extensiones
                        const extensions = ['.js', '.jsx', '.ts', '.tsx'];
                        for (const ext of extensions) {
                            const fullPath = resolvedPath + ext;
                            if (require('fs').existsSync(fullPath)) {
                                return fullPath;
                            }
                        }

                        // Buscar archivo index
                        for (const ext of extensions) {
                            const indexPath = path.join(resolvedPath, `index${ext}`);
                            if (require('fs').existsSync(indexPath)) {
                                return indexPath;
                            }
                        }
                    } catch (error) {
                        console.warn(`Error resolving import: ${importPath}`);
                    }
                }
                return null;
            })
            .filter(Boolean);

        return new Set(imports);
    }

    findProjectRoot(currentPath) {
        let dir = currentPath;
        while (dir !== path.dirname(dir)) {
            if (fs.existsSync(path.join(dir, 'package.json'))) {
                return dir;
            }
            dir = path.dirname(dir);
        }
        return currentPath;
    }

    getRouteName(filePath, pagesDir) {
        const relativePath = path.relative(pagesDir, filePath);
        const isAppDir = pagesDir.includes('app');

        let routeName = relativePath
            .replace(/\.(jsx?|tsx?)$/, '')
            .replace(/\/page$/, '')         // Next.js 14+ page.tsx
            .replace(/\/index$/, '')        // Older index files
            .replace(/\[\.{3}(\w+)\]/, '*') // catch-all routes
            .replace(/\[(\w+)\]/, ':$1')    // dynamic routes
            .replace(/\(.*?\)/, '')         // route groups
            .split(path.sep)
            .join('/');

        // Limpiar la ruta
        routeName = routeName
            .replace(/^\/+/, '')    // Eliminar slashes iniciales extra
            .replace(/\/+$/, '')    // Eliminar slashes finales extra
            .replace(/\/+/g, '/');  // Reemplazar múltiples slashes con uno solo

        return '/' + routeName;
    }

    async getFiles(dir) {
        const files = [];
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    files.push(...await this.getFiles(fullPath));
                } else {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Directorio no existe
        }
        return files;
    }
}

module.exports = { ReactAnalyzer };
