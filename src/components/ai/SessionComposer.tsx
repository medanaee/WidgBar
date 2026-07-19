import { useState, useEffect, useRef } from 'react';
import { emit } from '@tauri-apps/api/event';
import { SendRegular, StopRegular, AddRegular, DismissRegular, DocumentRegular, NoteRegular } from '@fluentui/react-icons';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { CutoutModal } from '../ui/CutoutModal';
import { useAiServicesStore } from '../../stores/aiServicesStore';
import { aiManager } from '../../lib/AiServicesManager';
import { SessionAttachment, EMPTY_SESSION_DRAFT } from '../../types/ai';

/** Stable empty attachments ref for Zustand selectors */
const EMPTY_ATTACHMENTS: SessionAttachment[] = EMPTY_SESSION_DRAFT.attachments;

const PROMPT_SAVE_IDLE_MS = 2000;

interface SessionComposerProps {
  instanceId: string;
  sessionId: string | null;
  isSending: boolean;
  onSendingChange?: (sending: boolean) => void;
  /** Called when composer lazily creates a session (first keystroke / attach) */
  onSessionCreated?: (sessionId: string) => void;
  /** Compact layout for widget Area */
  compact?: boolean;
  /** Optional model picker (full chat) */
  modelPicker?: {
    isLoadingModels: boolean;
    models: string[];
    currentModel: string;
    onModelChange: (model: string) => void;
  };
}

export default function SessionComposer({
  instanceId,
  sessionId,
  isSending,
  onSendingChange,
  onSessionCreated,
  compact = false,
  modelPicker,
}: SessionComposerProps) {
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachName, setAttachName] = useState('');
  const [attachBody, setAttachBody] = useState('');
  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  const [localPrompt, setLocalPrompt] = useState('');
  const promptDirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localPromptRef = useRef(localPrompt);
  localPromptRef.current = localPrompt;
  const prevSessionRef = useRef<string | null>(null);

  const effectiveSessionId = sessionId || localSessionId;

  useEffect(() => {
    if (sessionId) setLocalSessionId(null);
  }, [sessionId]);

  const attachments = useAiServicesStore((s) =>
    effectiveSessionId
      ? s.sessionDrafts[effectiveSessionId]?.attachments ?? EMPTY_ATTACHMENTS
      : EMPTY_ATTACHMENTS,
  );
  const storePrompt = useAiServicesStore((s) =>
    effectiveSessionId ? (s.sessionDrafts[effectiveSessionId]?.prompt ?? '') : '',
  );
  const removeAttachmentFromDraft = useAiServicesStore((s) => s.removeAttachmentFromDraft);

  // Load prompt when switching sessions (don't clobber mid-keystroke after lazy create)
  useEffect(() => {
    const prev = prevSessionRef.current;
    prevSessionRef.current = effectiveSessionId;

    // Lazy create: null → new id while typing — keep local text
    if (promptDirtyRef.current && !prev && effectiveSessionId) {
      return;
    }

    // Real switch while dirty — flush previous session first
    if (prev && prev !== effectiveSessionId && promptDirtyRef.current) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      aiManager.updateMessage(prev, localPromptRef.current);
      promptDirtyRef.current = false;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    promptDirtyRef.current = false;
    setLocalPrompt(storePrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSessionId]);

  // Remote draft updates (other window) while not typing
  useEffect(() => {
    if (!promptDirtyRef.current) {
      setLocalPrompt(storePrompt);
    }
  }, [storePrompt]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const ensureSession = (): string => {
    if (effectiveSessionId) return effectiveSessionId;
    const session = aiManager.createSession(instanceId, compact ? 'Widget Chat' : 'New Chat');
    setLocalSessionId(session.id);
    onSessionCreated?.(session.id);
    return session.id;
  };

  const flushPromptToStore = (sid: string, value: string) => {
    aiManager.updateMessage(sid, value);
    promptDirtyRef.current = false;
  };

  const hasContent = !!localPrompt.trim() || attachments.length > 0;

  const handlePromptChange = (value: string) => {
    const id = ensureSession();
    promptDirtyRef.current = true;
    setLocalPrompt(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      flushPromptToStore(id, value);
      saveTimerRef.current = null;
    }, PROMPT_SAVE_IDLE_MS);
  };

  const handleSend = async () => {
    const sid = ensureSession();
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const promptSnapshot = localPrompt;
    const draftBefore = useAiServicesStore.getState().getSessionDraft(sid);
    const attachmentsSnapshot = draftBefore.attachments;
    if (!promptSnapshot.trim() && attachmentsSnapshot.length === 0) return;

    // Empty composer immediately on send press
    setLocalPrompt('');
    promptDirtyRef.current = false;
    flushPromptToStore(sid, promptSnapshot);

    onSendingChange?.(true);
    try {
      await aiManager.send(instanceId, sid);
    } catch (e) {
      console.error(e);
      // Restore draft if send failed after we already cleared the UI
      setLocalPrompt(promptSnapshot);
      promptDirtyRef.current = true;
      useAiServicesStore.getState().setSessionDraft(sid, {
        prompt: promptSnapshot,
        attachments: attachmentsSnapshot,
      });
    } finally {
      onSendingChange?.(false);
    }
  };

  const openAttachModal = () => {
    ensureSession();
    setAttachName('');
    setAttachBody('');
    setAttachOpen(true);
  };

  const confirmAttach = () => {
    const sid = ensureSession();
    const body = attachBody.trim();
    if (!body) return;
    // Persist pending prompt before attach sync
    if (promptDirtyRef.current) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      flushPromptToStore(sid, localPrompt);
    }
    aiManager.addAttach(sid, {
      kind: 'text',
      name: attachName.trim() || 'Note',
      content: body,
    });
    setAttachOpen(false);
    setAttachName('');
    setAttachBody('');
  };

  const removeAttach = (id: string) => {
    const sid = ensureSession();
    removeAttachmentFromDraft(sid, id);
  };

  return (
    <>
      <div
        className={`shrink-0 ${
          compact
            ? 'pt-0'
            : ''
        }`}
      >
        <div
          className={`border-t border-zinc-500/20 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 shadow-sm overflow-hidden ${
            compact ? 'rounded-2xl' : ''
          }`}
        >
          {/* Attachments row */}
          <div className="flex items-center gap-1.5 px-2.5 pt-2 overflow-x-auto min-h-[36px]">
              <button
                type="button"
                onClick={openAttachModal}
                disabled={isSending}
                title="Add text attachment"
                className="shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[10px] font-medium bg-zinc-900/5 dark:bg-white/5 hover:bg-zinc-900/10 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 border border-zinc-500/15 transition-colors disabled:opacity-40"
              >
                <AddRegular fontSize={14} />
                <span>Attach</span>
              </button>

              {attachments.map((att: SessionAttachment) => (
                <div
                  key={att.id}
                  className="shrink-0 group inline-flex items-center gap-1 max-w-[160px] h-7 pl-2 pr-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-800 dark:text-sky-200"
                  title={att.kind === 'text' ? att.content.slice(0, 200) : att.name}
                >
                  {att.kind === 'file' ? (
                    <DocumentRegular fontSize={12} className="shrink-0 opacity-80" />
                  ) : (
                    <NoteRegular fontSize={12} className="shrink-0 opacity-80" />
                  )}
                  <span className="text-[10px] font-medium truncate">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttach(att.id)}
                    className="flex justify-center items-center h-4 w-4 rounded-md hover:bg-sky-500/20 text-sky-700/70 dark:text-sky-300/70"
                    aria-label="Remove attachment"
                  >
                    <DismissRegular fontSize={12} />
                  </button>
                </div>
              ))}
            </div>

          {/* Input row */}
          <div className={`flex items-end gap-2 px-2.5 pb-2.5 ${attachments.length ? 'pt-1' : 'pt-1'}`}>
            {modelPicker && (
              modelPicker.isLoadingModels ? (
                <span className="text-[10px] text-zinc-400 animate-pulse w-28 text-center mb-2 shrink-0">Loading…</span>
              ) : modelPicker.models.length > 0 ? (
                <div className="mb-0.5 shrink-0">
                  <Select value={modelPicker.currentModel} onValueChange={modelPicker.onModelChange}>
                    <SelectTrigger className="w-36 h-9 text-[10px] bg-zinc-500/5 dark:bg-white/5 border-zinc-500/15 text-zinc-700 dark:text-zinc-300">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {modelPicker.models.map((m) => (
                          <SelectItem key={m} value={m} className="text-[10px] truncate max-w-[200px]">
                            {m.split('/').pop()}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              ) : null
            )}

            <textarea
              value={localPrompt}
              dir="auto"
              onChange={(e) => handlePromptChange(e.target.value)}
              onBlur={() => {
                if (!promptDirtyRef.current || !effectiveSessionId) return;
                if (saveTimerRef.current) {
                  clearTimeout(saveTimerRef.current);
                  saveTimerRef.current = null;
                }
                flushPromptToStore(effectiveSessionId, localPrompt);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isSending) void handleSend();
                }
              }}
              placeholder="Write a message…"
              rows={1}
              disabled={isSending}
              className={`flex-1 bg-transparent border-0 text-xs focus:outline-none resize-none [field-sizing:content] leading-relaxed dark:text-white placeholder:text-zinc-400 ${
                compact ? 'min-h-[36px] max-h-[100px] py-2' : 'min-h-[40px] max-h-[140px] py-2.5'
              }`}
            />

            <button
              type="button"
              onClick={() => {
                if (isSending) {
                  emit('ai-abort-stream').catch(console.error);
                } else {
                  void handleSend();
                }
              }}
              disabled={!isSending && !hasContent}
              className={`flex items-center justify-center rounded-xl shrink-0 transition-colors border border-zinc-500/10 h-9 w-9 ${
                isSending
                  ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                  : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-35'
              }`}
            >
              {isSending ? <StopRegular fontSize={16} /> : <SendRegular fontSize={16} />}
            </button>
          </div>
        </div>
      </div>

      <CutoutModal
        isOpen={attachOpen}
        onClose={() => setAttachOpen(false)}
        topOffset={compact ? 8 : 36}
        contentClassName="w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-zinc-500/20 bg-zinc-100/30 dark:bg-zinc-900/30 shadow-2xl p-4"
      >
        <div className="flex flex-col gap-3 pointer-events-auto">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add text attachment</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Paste or type content other widgets can also inject into this session.
            </p>
          </div>
          <input
            value={attachName}
            onChange={(e) => setAttachName(e.target.value)}
            placeholder="Label (optional)"
            className="w-full h-9 px-3 rounded-xl text-xs bg-white/40 dark:bg-zinc-950/40 border border-zinc-500/20 focus:outline-none focus:border-zinc-500/40 dark:text-white"
          />
          <textarea
            value={attachBody}
            onChange={(e) => setAttachBody(e.target.value)}
            placeholder="Attachment text…"
            dir="auto"
            rows={6}
            className="w-full px-3 py-2 rounded-xl text-xs bg-white/40 dark:bg-zinc-950/40 border border-zinc-500/20 focus:outline-none focus:border-zinc-500/40 resize-none dark:text-white leading-relaxed"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAttachOpen(false)}
              className="h-8 px-3 rounded-lg text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-500/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmAttach}
              disabled={!attachBody.trim()}
              className="h-8 px-3 rounded-lg text-xs font-medium bg-zinc-900/80 dark:bg-zinc-100/90 text-white dark:text-zinc-900 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      </CutoutModal>
    </>
  );
}
