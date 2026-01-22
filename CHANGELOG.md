# Change Log

## [1.2.0] - 2025-05-20
### Added
- **Full TypeScript Migration**: Rewritten the entire codebase in TypeScript for improved reliability and developer experience.
- **Folder Selection**: Enabled context menu support to generate structure/preview for specific subdirectories.
- **Improved Specialized Analyzers**: Refined Node.js, Next.js, and React analyzers for more accurate dependency mapping.

### Improved
- **VS Code Engine Update**: Targeted VS Code 1.96.0 to leverage latest API features.
- **Error Handling**: Enhanced error management during file system operations.
- **Sorting Logic**: Folders are now consistently placed before files in generated structures.

### Fixed
- Fixed several path resolution edge cases in complex project structures.


## [1.1.2] - 2025-05-05
### Added
- Implemented cancellation tokens to stop long running operations.

### Improved
- Improved project root detection logic.
- Increased spacing between nodes in code graph for better readability.
- Enhanced security by validating file paths.

### Fixed
- Fixed fs.existsSync is not a function error.

## [1.1.0] - 2024-03-29
### Added
- Interactive Code Map visualization feature
- Real-time search functionality in preview mode
- Double-click to expand/collapse folders in preview
- Automatic framework detection for better code analysis
- Support for Next.js App Router and Pages Router
- Support for React and React Native projects
- Support for Node.js backend projects
- Smart file type detection and grouping
- Improved dependency analysis with caching
- Memory efficient file processing

### Improved
- Enhanced preview interface with better styling
- More efficient file scanning with batched processing
- Better handling of large projects
- Memoization for performance optimization
- Smarter project structure detection

### Fixed
- Memory usage optimization for large projects
- More reliable dependency resolution
- Better handling of circular dependencies

## [1.0.2] - 2024-03-04
### Added
- Initial preview feature for repository structure
- Basic Markdown generation
- File icons support

### Fixed
- Path resolution issues
- Icon loading problems

## [1.0.1] - 2025-02-23
### Added
- Initial release
- Basic repository structure generation
- Support for minimal view
