import * as vscode from 'vscode';
import * as path from 'path';
import { getPreviewHTML } from './templates/previewTemplate';
import { generateMinimalRepoStructure } from '../minimalRepoStructure';
import { generateStructureFile } from '../repoStructure';

export class RepoPreviewPanel {
    private static currentPanel: RepoPreviewPanel | undefined;
    private panel: vscode.WebviewPanel | undefined;
    private readonly context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public static async show(
        context: vscode.ExtensionContext,
        normalStructure: string,
        rootPath: string,
        ignoreList: string[]
    ) {
        if (!RepoPreviewPanel.currentPanel) {
            RepoPreviewPanel.currentPanel = new RepoPreviewPanel(context);
        }
        await RepoPreviewPanel.currentPanel.createOrUpdatePanel(normalStructure, rootPath, ignoreList);
    }

    private async createOrUpdatePanel(normalStructure: string, rootPath: string, ignoreList: string[]) {
        const folderName = path.basename(rootPath);

        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                'repoStructure',
                `Structure: ${folderName}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
                RepoPreviewPanel.currentPanel = undefined;
            });
        } else {
            this.panel.title = `Structure: ${folderName}`;
        }

        const minimalStructure = await generateMinimalRepoStructure(rootPath, ignoreList);
        this.setupMessageHandling(normalStructure, minimalStructure, rootPath);
        this.panel.webview.html = getPreviewHTML(normalStructure, 'normal');
    }

    private setupMessageHandling(normalStructure: string, minimalStructure: string, rootPath: string) {
        if (!this.panel) return;

        this.panel.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'switchView': {
                    const content = message.viewType === 'normal' ? normalStructure : minimalStructure;
                    if (this.panel) {
                        this.panel.webview.html = getPreviewHTML(content, message.viewType);
                    }
                    break;
                }
                case 'copyToClipboard': {
                    await vscode.env.clipboard.writeText(message.text);
                    vscode.window.showInformationMessage('Content copied to clipboard');
                    break;
                }
                case 'generateFile': {
                    try {
                        const content = message.viewType === 'normal' ? normalStructure : minimalStructure;
                        const fileName = await generateStructureFile(rootPath, content, message.viewType === 'minimal');
                        vscode.window.showInformationMessage(`File ${fileName} generated successfully`);
                    } catch (error: any) {
                        vscode.window.showErrorMessage(`Error generating file: ${error.message}`);
                    }
                    break;
                }
            }
        });
    }
}

export async function showPreview(context: vscode.ExtensionContext, normalStructure: string, rootPath: string, ignoreList: string[]) {
    await RepoPreviewPanel.show(context, normalStructure, rootPath, ignoreList);
}
