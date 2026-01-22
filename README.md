# Repository Structure Generator

A Visual Studio Code extension that generates a visual representation of your repository structure, with support for both detailed and minimal views. Now featuring an interactive code map visualization!

## Features

### 🆕 Interactive Code Map (New!)
- Visualize your project's code dependencies in an interactive graph
- Smart framework detection (Next.js, React, React Native, Node.js, PHP, Java, Python, Go, Rust, Elixir, Dart, Ruby)
- Real-time code preview on hover
- Zoom and pan capabilities
- Drag and drop nodes to organize your view
- Auto-detection of project structure and relationships
- Cancellation tokens to stop long running operations
- **New: Folder-level generation** (Right-click any folder to generate structure for that specific part of the project)

### Enhanced Preview Mode
- 🔍 Real-time search functionality
- 👆 Double-click to expand/collapse folders
- 🎨 Improved visual styling
- 💾 One-click file generation
- 📋 Easy copy to clipboard

### Supported Frameworks
- Next.js (App Router and Pages Router) **Need to update some dependencies for nextjs 16**
- React
- React Native
- Node.js Backend
- PHP
- Java
- Python
- Go
- Rust
- Elixir
- Dart
- Ruby
- Generic JavaScript/TypeScript projects

## Usage

1. Open a folder in VS Code
2. Right-click on any folder in the Explorer or use the Command Palette (Ctrl+Shift+P)
3. Select "Repo Structure" commands:
   - Generate Repository Structure
   - Generate Minimal Repository Structure
   - Preview Repository Structure

## Requirements

- Visual Studio Code 1.96.0 or higher

## Extension Settings

This extension contributes the following commands:

* `extension.generateRepoStructure`: Generate detailed repository structure
* `extension.generateMinimalRepoStructure`: Generate minimal repository structure
* `extension.previewRepoStructure`: Show interactive preview

## Known Issues

Report issues at [GitHub Issues](https://github.com/Misaint20/repo-structure-generator/issues)

## Release Notes

### 1.0.0

Initial release of Repository Structure Generator

## What's New in 1.2.0

### Major Improvements
1. **Full TypeScript Migration**: The entire extension has been rewritten in TypeScript for better performance, stability, and maintainability.
2. **Folder Selection Support**: You can now generate structures for specific folders! Simply right-click any folder in the Explorer and select a "Repo Structure" command.
3. **Enhanced Dependency Analysis**: Improved specialized analyzers for React, Next.js, and Node.js.
4. **Improved Performance**: Optimized file scanning and recursive traversal for faster processing.

### Technical Improvements
- Optimized memory usage for large projects
- Smarter dependency analysis with caching
- Better handling of circular dependencies
- Improved performance through memoization
- Improved project root detection logic
- Increased spacing between nodes in code graph for better readability
- Enhanced security by validating file paths
- Updated VS Code engine compatibility (v1.96.0+)

## License

[MIT](LICENSE.md)