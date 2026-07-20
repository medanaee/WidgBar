/** Extensions accepted as pure-text file attachments. */
export const TEXT_FILE_EXTENSIONS = [
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonl', 'xml', 'yaml', 'yml', 'toml',
  'ini', 'cfg', 'conf', 'log', 'html', 'htm', 'css', 'scss', 'less',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'vue', 'svelte',
  'py', 'rs', 'go', 'java', 'kt', 'kts', 'c', 'h', 'cpp', 'hpp', 'cc', 'cs',
  'php', 'rb', 'swift', 'sql', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
  'r', 'lua', 'pl', 'pm', 'graphql', 'gql', 'env', 'gitignore', 'dockerignore',
  'editorconfig', 'lock', 'properties', 'gradle', 'cmake', 'makefile', 'mk',
] as const;

export const TEXT_FILE_ACCEPT = TEXT_FILE_EXTENSIONS.map((e) => `.${e}`).join(',');

export function isTextFileName(name: string): boolean {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return false;
  const ext = lower.slice(dot + 1);
  return (TEXT_FILE_EXTENSIONS as readonly string[]).includes(ext);
}

/** Reject obvious binary payloads (NUL bytes). */
export function looksLikeTextContent(text: string): boolean {
  if (!text) return true;
  const sample = text.slice(0, 8000);
  return !sample.includes('\u0000');
}

export async function readTextFileFromInput(file: File): Promise<{ name: string; content: string; mimeType?: string }> {
  if (!isTextFileName(file.name)) {
    throw new Error('Only text-based files are supported');
  }
  const content = await file.text();
  if (!looksLikeTextContent(content)) {
    throw new Error('File looks binary and cannot be attached as text');
  }
  return {
    name: file.name,
    content,
    mimeType: file.type || undefined,
  };
}
