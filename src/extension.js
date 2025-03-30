const vscode = require('vscode');
const { generateRepoStructure, generateStructureFile } = require('./repoStructure');
const { generateMinimalRepoStructure } = require('./minimalRepoStructure');
const { showPreview } = require('./preview/repoPreview');
const { DependencyAnalyzer } = require('./codeGraph/dependencyAnalyzer');
const { getGraphHTML } = require('./codeGraph/graphTemplate');
const path = require('path');

function activate(context) {
    
    const ignoreList = [
        'node_modules',
        '.git',
        'logs',
        'package-lock.json'
    ];

    let disposableRepoStructure = vscode.commands.registerCommand('extension.generateRepoStructure', async () => {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('Please open a folder first');
                return;
            }

            const rootPath = workspaceFolders[0].uri.fsPath;
            const structure = await generateRepoStructure(rootPath, ignoreList);
            const fileName = await generateStructureFile(rootPath, structure, false);
            
            vscode.window.showInformationMessage('Repository structure generated successfully');
            const doc = await vscode.workspace.openTextDocument(path.join(rootPath, fileName));
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    let disposableMinimalRepoStructure = vscode.commands.registerCommand('extension.generateMinimalRepoStructure', async () => {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('Please open a folder first');
                return;
            }

            const rootPath = workspaceFolders[0].uri.fsPath;
            const structure = await generateMinimalRepoStructure(rootPath, ignoreList);
            const fileName = await generateStructureFile(rootPath, structure, true);
            
            vscode.window.showInformationMessage('Minimal repository structure generated successfully');
            const doc = await vscode.workspace.openTextDocument(path.join(rootPath, fileName));
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    let disposablePreview = vscode.commands.registerCommand('extension.previewRepoStructure', async () => {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('Please open a folder first');
                return;
            }

            const rootPath = workspaceFolders[0].uri.fsPath;
            const structure = await generateRepoStructure(rootPath, ignoreList);
            await showPreview(context, structure);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    let disposableCodeGraph = vscode.commands.registerCommand('extension.showCodeGraph', async () => {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('Please open a folder first');
                return;
            }

            let panel = null;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Analyzing code dependencies...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });
                
                const rootPath = workspaceFolders[0].uri.fsPath;
                const analyzer = new DependencyAnalyzer();
                
                progress.report({ increment: 50, message: "Building dependency graph..." });
                const graph = await analyzer.analyzeDependencies(rootPath, ignoreList);

                if (!graph || !graph.nodes || graph.nodes.length === 0) {
                    vscode.window.showInformationMessage('No code dependencies found in this folder.');
                    return;
                }

                progress.report({ increment: 50, message: "Rendering graph..." });
                
                panel = vscode.window.createWebviewPanel(
                    'codeGraph',
                    'Code Dependencies Graph',
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );

                panel.webview.html = getGraphHTML(graph);
            });

            // Mostrar mensaje de error si el panel no se creó
            if (!panel) {
                vscode.window.showErrorMessage('Failed to create dependency graph visualization');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    context.subscriptions.push(disposableRepoStructure, disposableMinimalRepoStructure, disposablePreview, disposableCodeGraph);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};