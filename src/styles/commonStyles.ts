export const commonStyles = {
    container: `
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        padding: 24px 0;
        max-width: 800px;
        margin: 0 auto;
    `,
    footer: `
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid #e1e4e8;
        font-size: 0.85em;
        color: #586069;
        text-align: center;
    `,
    previewHeader: `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    `,
    button: `
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 8px 12px;
        cursor: pointer;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
    `,
    buttonGroup: `
        display: flex;
        gap: 10px;
    `,
    generateButton: `
        background-color: var(--vscode-statusBarItem-prominentBackground);
    `
};
