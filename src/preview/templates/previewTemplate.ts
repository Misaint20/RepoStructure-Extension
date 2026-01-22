import { commonStyles } from '../../styles/commonStyles';

export function getPreviewHTML(structure: string, viewType: 'normal' | 'minimal' = 'normal'): string {
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
                .tree-item {
                    margin: 4px 0;
                    list-style: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                }
                .tree-item img {
                    width: 16px;
                    height: 16px;
                    vertical-align: middle;
                    margin-right: 5px;
                }
                .tree-line {
                    width: 16px;
                    border-bottom: 1px solid #e1e4e8;
                    margin-right: 5px;
                }
                .tree-content {
                    padding-left: 20px;
                    position: relative;
                }
                details {
                    margin: 4px 0;
                }
                summary {
                    margin: 4px 0;
                }
                .search-box {
                    margin-bottom: 20px;
                    width: 100%;
                    padding: 8px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="preview-container">
                <input type="text" 
                       class="search-box" 
                       placeholder="Search files and folders..."
                       id="searchInput">
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
                
                // Búsqueda en tiempo real
                const searchInput = document.getElementById('searchInput');
                
                function debounce(func, wait) {
                    let timeout;
                    return function executedFunction(...args) {
                        const later = () => {
                            clearTimeout(timeout);
                            func(...args);
                        };
                        clearTimeout(timeout);
                        timeout = setTimeout(later, wait);
                    };
                }

                const debouncedSearch = debounce((value) => {
                    const items = document.querySelectorAll('.tree-item');
                    items.forEach(item => {
                        const text = item.textContent.toLowerCase();
                        const isMatch = text.includes(value.toLowerCase());
                        item.style.display = isMatch ? '' : 'none';
                        
                        if (item.nextElementSibling?.classList.contains('tree-content')) {
                            item.nextElementSibling.style.display = isMatch ? '' : 'none';
                        }
                    });
                }, 300);

                searchInput.addEventListener('input', (e) => {
                    debouncedSearch(e.target.value);
                });

                // Expandir/colapsar al hacer doble clic
                document.addEventListener('dblclick', (e) => {
                    const item = e.target.closest('.tree-item');
                    if (item) {
                        const details = item.closest('details');
                        if (details) {
                            details.open = !details.open;
                        }
                    }
                });

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
