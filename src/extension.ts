import * as vscode from 'vscode';
import * as path from 'path';
import { generateRepoStructure, generateStructureFile } from './repoStructure';
import { generateMinimalRepoStructure } from './minimalRepoStructure';
import { showPreview } from './preview/repoPreview';
import { DependencyAnalyzer } from './codeGraph/dependencyAnalyzer';
import { getGraphHTML } from './codeGraph/graphTemplate';

export function activate(context: vscode.ExtensionContext) {
    const ignoreList = [
        'node_modules',
        '.git',
        'logs',
        'package-lock.json'
    ];

    const getRootPath = async (uri?: vscode.Uri): Promise<string | undefined> => {
        if (uri && uri.fsPath) {
            return uri.fsPath;
        }
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('Please open a folder or workspace first');
            return undefined;
        }

        // If from command palette and multiple workspace folders exist, let user choose
        if (workspaceFolders.length > 1) {
            const picked = await vscode.window.showWorkspaceFolderPick();
            return picked ? picked.uri.fsPath : undefined;
        }

        return workspaceFolders[0].uri.fsPath;
    };

    let disposableRepoStructure = vscode.commands.registerCommand('extension.generateRepoStructure', async (uri?: vscode.Uri) => {
        try {
            const rootPath = await getRootPath(uri);
            if (!rootPath) return;

            const structure = await generateRepoStructure(rootPath, ignoreList);
            const fileName = await generateStructureFile(rootPath, structure, false);

            vscode.window.showInformationMessage(`Structure generated for ${path.basename(rootPath)}`);
            const doc = await vscode.workspace.openTextDocument(path.join(rootPath, fileName));
            await vscode.window.showTextDocument(doc);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    let disposableMinimalRepoStructure = vscode.commands.registerCommand('extension.generateMinimalRepoStructure', async (uri?: vscode.Uri) => {
        try {
            const rootPath = await getRootPath(uri);
            if (!rootPath) return;

            const structure = await generateMinimalRepoStructure(rootPath, ignoreList);
            const fileName = await generateStructureFile(rootPath, structure, true);

            vscode.window.showInformationMessage(`Minimal structure generated for ${path.basename(rootPath)}`);
            const doc = await vscode.workspace.openTextDocument(path.join(rootPath, fileName));
            await vscode.window.showTextDocument(doc);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    let disposablePreview = vscode.commands.registerCommand('extension.previewRepoStructure', async (uri?: vscode.Uri) => {
        try {
            const rootPath = await getRootPath(uri);
            if (!rootPath) return;

            const structure = await generateRepoStructure(rootPath, ignoreList);
            await showPreview(context, structure, rootPath, ignoreList);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    let disposableCodeGraph = vscode.commands.registerCommand('extension.showCodeGraph', async (uri?: vscode.Uri) => {
        try {
            const rootPath = await getRootPath(uri);
            if (!rootPath) return;

            let panel: vscode.WebviewPanel | null = null;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Analyzing dependencies for ${path.basename(rootPath)}...`,
                cancellable: true
            }, async (progress, token) => {
                progress.report({ increment: 0 });

                const analyzer = new DependencyAnalyzer();

                progress.report({ increment: 50, message: "Building dependency graph..." });
                const graph = await analyzer.analyzeDependencies(rootPath, ignoreList, token);

                if (token.isCancellationRequested) {
                    vscode.window.showInformationMessage('Operation cancelled.');
                    return;
                }

                if (!graph || !graph.nodes || graph.nodes.length === 0) {
                    vscode.window.showInformationMessage('No code dependencies found in this folder.');
                    return;
                }

                progress.report({ increment: 50, message: "Rendering graph..." });

                const folderName = path.basename(rootPath);

                panel = vscode.window.createWebviewPanel(
                    'codeGraph',
                    `Code Map: ${folderName}`,
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );

                panel.webview.html = getGraphHTML(graph);
            });

            if (!panel && !vscode.window.state.focused) {
                vscode.window.showErrorMessage('Failed to create dependency graph visualization');
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    context.subscriptions.push(
        disposableRepoStructure,
        disposableMinimalRepoStructure,
        disposablePreview,
        disposableCodeGraph
    );
}

export function deactivate() { }
