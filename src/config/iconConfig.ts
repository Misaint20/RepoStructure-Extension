import * as path from 'path';

export const iconMap: Record<string, string> = {
    '.js': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/javascript.svg',
    '.json': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/json.svg',
    '.md': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/markdown.svg',
    '.html': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/html.svg',
    '.css': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/css.svg',
    '.py': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/python.svg',
    '.java': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/java.svg',
    '.cs': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/csharp.svg',
    '.cpp': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/cpp.svg',
    '.go': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/go.svg',
    '.ts': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/typescript.svg',
    '.tsx': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/react_ts.svg',
    '.jsx': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/react.svg',
    '.test.js': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/test-js.svg',
    '.test.ts': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/test-ts.svg',
    '.gitignore': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/git.svg',
    '.env': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/env-icon.png',
    'folder': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/folder-base-open.svg',
    'default': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/default-icon.png',
    '.abap': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/abap.svg',
    '.ada': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/ada.svg',
    '.dart': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/dart.svg',
    '.elixir': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/elixir.svg',
    '.fortran': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/fortran.svg',
    '.haskell': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/haskell.svg',
    '.kotlin': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/kotlin.svg',
    '.lua': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/lua.svg',
    '.rust': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/rust.svg',
    '.svg': 'https://raw.githubusercontent.com/Misaint20/RepoStructure-Extension/3ac7707e061e555c7d664fa7eb75b2da08ded050/src/media/icons/svg.svg',
};

export function getIcon(name: string, isDirectory: boolean): string {
    if (isDirectory) return iconMap['folder'];
    const ext = path.extname(name);
    return iconMap[ext] || iconMap['default'];
}
