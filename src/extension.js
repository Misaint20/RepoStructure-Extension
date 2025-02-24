const vscode = require('vscode');
const { generateRepoStructure, generateStructureFile } = require('./repoStructure');
const { generateMinimalRepoStructure } = require('./minimalRepoStructure');
const { showPreview } = require('./preview/repoPreview');
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

    context.subscriptions.push(disposableRepoStructure, disposableMinimalRepoStructure, disposablePreview);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};