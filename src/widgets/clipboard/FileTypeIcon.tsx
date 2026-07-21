import {
  getIconForDirectoryPath,
  getIconForFilePath,
  getIconUrlByName,
} from 'vscode-material-icons';
import { cn } from '@/lib/utils';

const ICONS_URL = '/assets/material-icons';

function fileNameFromPath(path: string): string {
  return path.replace(/^.*[\\/]/, '') || path;
}

function looksLikeFolder(path: string): boolean {
  const name = fileNameFromPath(path);
  return name.length > 0 && !name.includes('.');
}

function pickTarget(paths: string[] | null | undefined, path?: string | null): {
  fileName: string;
  isFolder: boolean;
} {
  const list = paths?.length ? paths : path ? [path] : null;
  if (!list?.length) return { fileName: 'file', isFolder: false };
  const p = list[0];
  if (list.length === 1 && looksLikeFolder(p)) {
    return { fileName: fileNameFromPath(p), isFolder: true };
  }
  return { fileName: fileNameFromPath(p), isFolder: false };
}

interface FileTypeIconProps {
  path?: string | null;
  paths?: string[] | null;
  className?: string;
  size?: number;
}

export function FileTypeIcon({ path, paths, className, size = 16 }: FileTypeIconProps) {
  const { fileName, isFolder } = pickTarget(paths, path);
  const iconName = isFolder
    ? getIconForDirectoryPath(fileName)
    : getIconForFilePath(fileName);

  return (
    <img
      src={getIconUrlByName(iconName, ICONS_URL)}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
      className={cn('inline-flex shrink-0', className)}
    />
  );
}