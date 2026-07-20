import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DismissRegular, DocumentRegular, NoteRegular } from '@fluentui/react-icons';
import { CutoutModal } from '../ui/CutoutModal';
import { SessionAttachment } from '../../types/ai';

function AttachmentPreviewContent({ preview }: { preview: SessionAttachment }) {
  const [content, setContent] = useState<string>('Loading...');

  useEffect(() => {
    if (preview.kind === 'file' && preview.content) {
      // It's a file path
      invoke<string>('read_attachment_file', { path: preview.content })
        .then(setContent)
        .catch((e) => setContent(`Error loading file:\n${e}`));
    } else {
      setContent(preview.content || '(empty)');
    }
  }, [preview]);

  return (
    <pre
      dir="auto"
      className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-xl text-[11px] leading-relaxed px-3 py-2.5 bg-white/40 dark:bg-zinc-950/40 border border-zinc-500/20 text-zinc-800 dark:text-zinc-100 font-mono"
    >
      {content}
    </pre>
  );
}

interface AttachmentChipsProps {
  attachments: SessionAttachment[];
  /** Show remove button on each chip (composer only) */
  onRemove?: (id: string) => void;
  /** Compact spacing for widget */
  compact?: boolean;
  /** Invert chip colors for dark user bubbles */
  onDarkBubble?: boolean;
  topOffset?: number;
}

export function AttachmentChips({
  attachments,
  onRemove,
  compact = false,
  onDarkBubble = false,
  topOffset = 36,
}: AttachmentChipsProps) {
  const [preview, setPreview] = useState<SessionAttachment | null>(null);

  if (!attachments.length) return null;

  const chipClass = onDarkBubble
    ? 'bg-sky-500/10 border-sky-500/20 text-sky-200 dark:text-sky-800'
    : 'bg-sky-500/10 border-sky-500/20 text-sky-800 dark:text-sky-200';
  const removeClass = onDarkBubble
    ? 'hover:bg-white/20 text-white/70 dark:hover:bg-black/15 dark:text-zinc-800/70'
    : 'hover:bg-sky-500/20 text-sky-700/70 dark:text-sky-300/70';

  return (
    <>
      {attachments.map((att) => (
        <button
          key={att.id}
          type="button"
          onClick={() => setPreview(att)}
          className={`shrink-0 group inline-flex items-center gap-1 max-w-[160px] h-7 pl-2 ${
            onRemove ? 'pr-1' : 'pr-2'
          } rounded-lg border text-start transition-colors ${chipClass}`}
        >
          {att.kind === 'file' ? (
            <DocumentRegular fontSize={12} className="shrink-0 opacity-80" />
          ) : (
            <NoteRegular fontSize={12} className="shrink-0 opacity-80" />
          )}
          <span className="text-[10px] font-medium truncate">{att.name}</span>
          {onRemove && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(att.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove(att.id);
                }
              }}
              className={`flex justify-center items-center h-4 w-4 rounded-md ${removeClass}`}
              aria-label="Remove attachment"
            >
              <DismissRegular fontSize={12} />
            </span>
          )}
        </button>
      ))}

      <CutoutModal
        isOpen={!!preview}
        onClose={() => setPreview(null)}
        topOffset={topOffset}
        contentClassName="w-[min(480px,calc(100vw-2rem))] rounded-2xl border border-zinc-500/20 bg-zinc-100/30 dark:bg-zinc-900/30 shadow-2xl p-4"
      >
        {preview && (
          <div className="flex flex-col gap-3 pointer-events-auto">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {preview.name}
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {preview.kind === 'file' ? 'Text file' : 'Text note'}
                  {preview.mimeType ? ` · ${preview.mimeType}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="shrink-0 h-7 w-7 rounded-lg hover:bg-zinc-500/10 text-zinc-500 flex items-center justify-center"
              >
                <DismissRegular fontSize={16} />
              </button>
            </div>
            <AttachmentPreviewContent preview={preview} />
          </div>
        )}
      </CutoutModal>
    </>
  );
}
