import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
    Clipboard,
    Pin,
    Snowflake,
    Trash2,
    X,
    Sparkles,
    Send,
    Loader2,
} from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { useClipboardStore, type ClipboardItem } from '../../stores/clipboardStore';
import { useAiServicesStore } from '../../stores/aiServicesStore';
import { aiManager } from '../../lib/AiServicesManager';
import MarkdownChatContent from '../../components/MarkdownChatContent';
import { resolveClipboardAiTarget } from './clipboardAi';
import {
    clipboardPasteHover,
    imageSrc,
    pasteClipboardItem,
    resetClipboardPasteHover,
    setWindowNoActivate,
} from './clipboardApi';

interface AskReply {
    content: string;
    streamingEventId?: string;
}

function ClipboardItemRow({
    item,
    askOpen,
    askPrompt,
    sending,
    reply,
    onToggleAsk,
    onAskPromptChange,
    onAskSend,
}: {
    item: ClipboardItem;
    askOpen: boolean;
    askPrompt: string;
    sending: boolean;
    reply: AskReply | null;
    onToggleAsk: () => void;
    onAskPromptChange: (v: string) => void;
    onAskSend: () => void;
}) {
    const { t } = useTranslation();
    const isImage = item.kind === 'image';
    const src = isImage ? imageSrc(item.imagePath) : null;
    const canAskAi = !isImage && !!(item.textContent || item.preview);
    const setPinned = useClipboardStore((s) => s.setPinned);
    const setFrozen = useClipboardStore((s) => s.setFrozen);
    const deleteItem = useClipboardStore((s) => s.deleteItem);
    const showReply = askOpen && (reply || sending);

    return (
        <div className="rounded-xl border border-zinc-500/15 bg-white/40 dark:bg-zinc-900/30 hover:bg-white/70 dark:hover:bg-zinc-900/55 transition-colors overflow-hidden">
            <div className="group flex items-stretch">
                <button
                    type="button"
                    className="flex-1 min-w-0 flex flex-col justify-start p-2.5 text-start"
                    onMouseEnter={() => clipboardPasteHover(true)}
                    onMouseLeave={() => clipboardPasteHover(false)}
                    onClick={() => pasteClipboardItem(item).catch(console.error)}
                >
                    {isImage && src ? (
                        <img src={src} alt="" className="w-fit h-auto max-h-20 object-contain rounded-md" />
                    ) : (
                        <div
                            dir="auto"
                            className="w-full text-xs font-medium leading-snug text-zinc-900 dark:text-zinc-100 line-clamp-4 break-words"
                        >
                            {item.textContent || item.preview}
                        </div>
                    )}
                </button>

                <div
                    className="flex flex-col justify-center gap-1 p-1 border-s border-zinc-500/10 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    {canAskAi && (
                        <button
                            type="button"
                            className={`p-1.5 rounded-md hover:bg-zinc-500/10 transition-colors ${
                                askOpen
                                    ? 'text-violet-500 dark:text-violet-400'
                                    : 'text-zinc-400 hover:text-violet-600 dark:hover:text-violet-300'
                            }`}
                            onClick={onToggleAsk}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        type="button"
                        className={`p-1.5 rounded-md hover:bg-zinc-500/10 transition-colors ${
                            item.pinned
                                ? 'text-sky-500 dark:text-sky-400'
                                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                        }`}
                        onClick={() => setPinned(item.id, !item.pinned)}
                    >
                        <Pin className="w-3.5 h-3.5" fill={item.pinned ? 'currentColor' : 'none'} />
                    </button>
                    <button
                        type="button"
                        className={`p-1.5 rounded-md hover:bg-zinc-500/10 transition-colors ${
                            item.frozen
                                ? 'text-cyan-500 dark:text-cyan-400'
                                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                        }`}
                        onClick={() => setFrozen(item.id, !item.frozen)}
                    >
                        <Snowflake className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-zinc-400 hover:text-red-600 transition-colors"
                        onClick={() => deleteItem(item.id)}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {askOpen && (
                <div className="border-t border-zinc-500/10 bg-zinc-500/5 animate-in slide-in-from-top-1 fade-in duration-150">
                    <div className="px-2.5 py-2 flex items-center gap-1.5">
                        <input
                            type="text"
                            value={askPrompt}
                            onChange={(e) => onAskPromptChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    onAskSend();
                                }
                            }}
                            placeholder={t('clipboardAskPlaceholder')}
                            disabled={sending}
                            className="flex-1 min-w-0 h-8 px-2.5 rounded-lg bg-white/60 dark:bg-zinc-900/50 border border-zinc-500/15 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-violet-500/40"
                            autoFocus
                        />
                        <button
                            type="button"
                            disabled={sending || !askPrompt.trim()}
                            onClick={onAskSend}
                            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300 hover:bg-violet-500/25 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                            {sending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Send className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </div>

                    {showReply && (
                        <div className="mx-2.5 mb-2.5 max-h-48 text-[9pt] overflow-y-auto rounded-lg border border-zinc-500/10 bg-white/50 dark:bg-zinc-950/40 px-2.5 py-2 text-start select-text">
                            <MarkdownChatContent
                                content={reply?.content || ''}
                                streamingEventId={reply?.streamingEventId}
                                isWidget={true}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ClipboardArea({ widgetId: _widgetId }: { widgetId: string }) {
    const { t } = useTranslation();
    const items = useClipboardStore((s) => s.items);
    const clearAll = useClipboardStore((s) => s.clearAll);

    const [askItemId, setAskItemId] = useState<string | null>(null);
    const [askPrompt, setAskPrompt] = useState('');
    const [sending, setSending] = useState(false);
    const [reply, setReply] = useState<AskReply | null>(null);

    useEffect(() => {
        return () => {
            resetClipboardPasteHover();
            setWindowNoActivate(false).catch(() => { });
        };
    }, []);

    const closePopup = () => {
        resetClipboardPasteHover();
        invoke('hide_popup', { selfClose: true }).catch(console.error);
    };

    const handleToggleAsk = (item: ClipboardItem) => {
        if (askItemId === item.id) {
            setAskItemId(null);
            setAskPrompt('');
            setReply(null);
            return;
        }
        try {
            const { sessionId } = resolveClipboardAiTarget();
            const text = (item.textContent || item.preview || '').trim();
            if (!text) return;
            aiManager.clearAttachments(sessionId);
            aiManager.addAttach(sessionId, {
                kind: 'text',
                name: 'Clipboard',
                content: text,
            });
            setAskItemId(item.id);
            setAskPrompt('');
            setReply(null);
        } catch (e) {
            console.error(e);
        }
    };

    const handleAskSend = async () => {
        const prompt = askPrompt.trim();
        if (!prompt || sending) return;
        setSending(true);
        setReply({ content: '', streamingEventId: undefined });
        try {
            const { instanceId, sessionId } = resolveClipboardAiTarget();
            aiManager.updateMessage(sessionId, prompt);

            const unsub = useAiServicesStore.subscribe((state) => {
                const msgs = state.sessionMessages[sessionId] || [];
                const lastAi = [...msgs].reverse().find((m) => m.role === 'assistant');
                if (!lastAi) return;
                setReply({
                    content: lastAi.content || '',
                    streamingEventId: lastAi.streamingEventId,
                });
            });

            try {
                await aiManager.send(instanceId, sessionId);
            } finally {
                unsub();
            }

            const msgs = useAiServicesStore.getState().sessionMessages[sessionId] || [];
            const lastAi = [...msgs].reverse().find((m) => m.role === 'assistant');
            setReply({
                content: lastAi?.content || '',
                streamingEventId: undefined,
            });
            setAskPrompt('');
        } catch (e) {
            console.error(e);
            setReply(null);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="w-full h-full min-h-0 flex flex-col select-none overflow-hidden">
            <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-500/15">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Clipboard className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                        {t('widgetClipboard')}
                    </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {items.length > 0 && (
                        <button
                            type="button"
                            onClick={() => clearAll()}
                            className="h-7 px-2 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-500/10 transition-colors"
                        >
                            {t('clipboardClear')}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={closePopup}
                        className="shrink-0 p-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-500/10 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                    <Clipboard className="w-8 h-8 text-zinc-400/80" />
                    <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{t('clipboardEmpty')}</div>
                    <div className="text-xs text-zinc-500">{t('clipboardEmptyHint')}</div>
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 p-2">
                    {items.map((item) => (
                        <ClipboardItemRow
                            key={item.id}
                            item={item}
                            askOpen={askItemId === item.id}
                            askPrompt={askItemId === item.id ? askPrompt : ''}
                            sending={sending && askItemId === item.id}
                            reply={askItemId === item.id ? reply : null}
                            onToggleAsk={() => handleToggleAsk(item)}
                            onAskPromptChange={setAskPrompt}
                            onAskSend={handleAskSend}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
