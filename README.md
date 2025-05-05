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

### Enhanced Preview Mode
- 🔍 Real-time search functionality
- 👆 Double-click to expand/collapse folders
- 🎨 Improved visual styling
- 💾 One-click file generation
- 📋 Easy copy to clipboard

### Supported Frameworks
- Next.js (App Router and Pages Router)
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
2. Access the Command Palette (Ctrl+Shift+P)
3. Type "Repo Structure" to see available commands:
   - Generate Repository Structure
   - Generate Minimal Repository Structure
   - Preview Repository Structure

## Requirements

- Visual Studio Code 1.80.0 or higher

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

## What's New in 1.1.0

### Major Features
1. **Interactive Code Map**: Visualize your code dependencies with an interactive D3.js graph (Working in Progress)
2. **Framework Detection**: Automatic detection and specialized analysis for different frameworks (Only Next.js and React are supported for now)
3. **Real-time Search**: Search through your project structure in real-time
4. **Enhanced Preview**: Improved preview interface with better interactivity

### Technical Improvements
- Optimized memory usage for large projects
- Smarter dependency analysis with caching
- Better handling of circular dependencies
- Improved performance through memoization
- Improved project root detection logic
- Increased spacing between nodes in code graph for better readability
- Enhanced security by validating file paths

## License

[MIT](LICENSE.md)