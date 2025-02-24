// Configuración de directorios de frameworks y entornos
const frameworkDirs = [
    '.next',        // Next.js build output
    'dist',         // Común en varios frameworks
    'build',        // React y otros
    'node_modules', // Dependencias
    'vendor',       // Laravel y otros
    'bin',          // Symfony y otros
    '__pycache__',  // Python
    'venv',         // Python virtual environment
    'target',       // Java/Maven
    'out',          // Typescript/Java
    'migrations',   // Prisma/DB migrations
    '.prisma',      // Prisma generated files
    'generated',    // Prisma/GraphQL generated files
];

// Orden personalizado para directorios principales
const directoryOrder = [
    '.vscode', 
    'prisma',      // Agregamos prisma al inicio para mejor visibilidad
    'data', 
    'public', 
    'src', 
    'tests'
];

module.exports = {
    frameworkDirs,
    directoryOrder
}; 