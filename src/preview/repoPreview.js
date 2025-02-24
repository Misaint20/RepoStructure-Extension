const vscode = require('vscode');
const { getPreviewHTML } = require('./templates/previewTemplate');
const { generateMinimalRepoStructure } = require('../minimalRepoStructure');

class RepoPreviewPanel {
    constructor(context) {
        this.context = context;
        this.panel = null;
    }

    async show(normalStructure, minimalStructure, rootPath) {
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                'repoStructure',
                'Vista Previa de Estructura',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = null;
            });
        }

        this.setupMessageHandling(normalStructure, minimalStructure, rootPath);
        this.panel.webview.html = getPreviewHTML(normalStructure, 'normal');
    }

    setupMessageHandling(normalStructure, minimalStructure, rootPath) {
        this.panel.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
            case 'switchView': {
                const content = message.viewType === 'normal' ? normalStructure : minimalStructure;
                this.panel.webview.html = getPreviewHTML(content, message.viewType);
                break;
            }
            case 'copyToClipboard': {
                await vscode.env.clipboard.writeText(message.text);
                vscode.window.showInformationMessage('Contenido copiado al portapapeles');
                break;
            }
            case 'generateFile': {
                try {
                    const { generateStructureFile } = require('../repoStructure');
                    const content = message.viewType === 'normal' ? normalStructure : minimalStructure;
                    const fileName = await generateStructureFile(rootPath, content, message.viewType === 'minimal');
                    vscode.window.showInformationMessage(`Archivo ${fileName} generado exitosamente`);
                } catch (error) {
                    vscode.window.showErrorMessage(`Error al generar archivo: ${error.message}`);
                }
                break;
            }
            }
        });
    }
}

async function showPreview(context, normalStructure) {
    const panel = new RepoPreviewPanel(context);
    const minimalStructure = await generateMinimalRepoStructure(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        [
            'node_modules',
            '.git',
            'logs',
            'package-lock.json'
        ]
    );
    await panel.show(normalStructure, minimalStructure, vscode.workspace.workspaceFolders[0].uri.fsPath);
}

module.exports = {
    RepoPreviewPanel,
    showPreview
}; 