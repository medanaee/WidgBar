import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Pin, Trash2 } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import {
  useClipboardStore,
  subscribeClipboardSync,
} from '../stores/clipboardStore';
import { ContextMenu, ContextMenuItem } from './ui/ContextMenu';

async function closeSelf() {
  await invoke('hide_popup', { selfClose: true }).catch(console.error);
}

export default function ClipboardContextMenu() {
  const { itemId } = useParams<{ itemId: string }>();
  const { t } = useTranslation();
  const item = useClipboardStore((s) =>
    itemId ? s.items.find((i) => i.id === itemId) : undefined,
  );
  const setPinned = useClipboardStore((s) => s.setPinned);
  const deleteItem = useClipboardStore((s) => s.deleteItem);

  useEffect(() => {
    const unsub = subscribeClipboardSync();
    return unsub;
  }, []);

  if (!itemId) {
    return null;
  }

  const pinned = item?.pinned ?? false;

  return (
    <ContextMenu>
      <ContextMenuItem
        icon={<Pin fill={pinned ? 'currentColor' : 'none'} />}
        onClick={async () => {
          setPinned(itemId, !pinned);
          await closeSelf();
        }}
      >
        {pinned ? t('clipboardUnpin') : t('clipboardPin')}
      </ContextMenuItem>
      <ContextMenuItem
        icon={<Trash2 />}
        destructive
        onClick={async () => {
          deleteItem(itemId);
          await closeSelf();
        }}
      >
        {t('clipboardDelete')}
      </ContextMenuItem>
    </ContextMenu>
  );
}
