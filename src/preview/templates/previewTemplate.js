const { commonStyles } = require('../../styles/commonStyles');

function getPreviewHTML(structure, viewType = 'normal') {
    const isMinimal = viewType === 'minimal';
    const content = isMinimal ? `<pre>${structure}</pre>` : structure;
    
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${isMinimal ? '' : 'img-src https: data:;'} style-src 'unsafe-inline'; script-src 'unsafe-inline';">
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    color: var(--vscode-editor-foreground);
                }
                .preview-container { ${commonStyles.container} }
                .preview-header { ${commonStyles.previewHeader} }
                .button { ${commonStyles.button} }
                .button:hover { background-color: var(--vscode-button-hoverBackground); }
                .button-group { ${commonStyles.buttonGroup} }
                .generate-button { ${commonStyles.generateButton} }
                .generate-button:hover { background-color: var(--vscode-statusBarItem-prominentHoverBackground); }
                ${isMinimal ? `
                pre {
                    background-color: var(--vscode-editor-background);
                    padding: 16px;
                    border-radius: 4px;
                    overflow-x: auto;
                }` : ''}
            </style>
        </head>
        <body>
            <div class="preview-container">
                <div class="preview-header">
                    <h1>${isMinimal ? 'Minimal' : 'Detailed'} View</h1>
                    <div class="button-group">
                        <button class="button" onclick="switchView()">
                            <span>${isMinimal ? '🔍' : '📊'}</span> ${isMinimal ? 'Detailed' : 'Minimal'} View
                        </button>
                        <button class="button" onclick="copyContent()">
                            <span>📋</span> Copy
                        </button>
                        <button class="button generate-button" onclick="generateFile()">
                            <span>💾</span> Generate File
                        </button>
                    </div>
                </div>
                ${content}
            </div>
            <script>
                const vscode = acquireVsCodeApi();

                function switchView() {
                    vscode.postMessage({
                        command: 'switchView',
                        viewType: '${isMinimal ? 'normal' : 'minimal'}'
                    });
                }

                function copyContent() {
                    const content = document.querySelector('${isMinimal ? 'pre' : '.preview-container'}').${isMinimal ? 'textContent' : 'innerHTML'};
                    vscode.postMessage({
                        command: 'copyToClipboard',
                        text: content
                    });
                }

                function generateFile() {
                    vscode.postMessage({
                        command: 'generateFile',
                        viewType: '${viewType}'
                    });
                }
            </script>
        </body>
        </html>
    `;
}

module.exports = { getPreviewHTML }; 