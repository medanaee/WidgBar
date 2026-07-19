import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import {
  AiServiceInstance,
  ChatSession,
  ChatMessage,
  SessionDraft,
  SessionAttachment,
  emptySessionDraft,
  EMPTY_SESSION_DRAFT,
} from '../types/ai';

interface AiData {
  instances: AiServiceInstance[];
  sessions: ChatSession[];
}

interface AiServicesState {
  data: AiData;
  sessionMessages: Record<string, ChatMessage[]>;
  sessionsLoaded: Record<string, boolean>;
  /** Unsent composer state per session — shared across windows via ai-draft-sync */
  sessionDrafts: Record<string, SessionDraft>;
  isLoading: boolean;
  hasInitialized: boolean;

  fetchAndSyncData: () => Promise<void>;

  addInstance: (instance: AiServiceInstance) => Promise<void>;
  updateInstance: (id: string, instance: Partial<AiServiceInstance>) => Promise<void>;
  removeInstance: (id: string) => Promise<void>;

  addSession: (session: ChatSession) => Promise<void>;
  updateSession: (id: string, session: Partial<ChatSession>) => Promise<void>;
  removeSession: (id: string) => Promise<void>;

  loadMessagesForSession: (sessionId: string, offset: number) => Promise<void>;
  addMessageToSession: (sessionId: string, message: ChatMessage) => Promise<void>;
  updateMessageInSession: (sessionId: string, messageId: string, updatedFields: Partial<ChatMessage>) => Promise<void>;

  getSessionDraft: (sessionId: string) => SessionDraft;
  setSessionDraft: (sessionId: string, draft: SessionDraft, sync?: boolean) => void;
  patchSessionDraft: (sessionId: string, patch: Partial<SessionDraft>, sync?: boolean) => void;
  clearSessionDraft: (sessionId: string, sync?: boolean) => void;
  removeAttachmentFromDraft: (sessionId: string, attachmentId: string) => void;
}

function broadcastDraft(sessionId: string, draft: SessionDraft | null) {
  emit('ai-draft-sync', { sessionId, draft }).catch(console.error);
}

export const useAiServicesStore = create<AiServicesState>((set, get) => {
  return {
    data: { instances: [], sessions: [] },
    sessionMessages: {},
    sessionsLoaded: {},
    sessionDrafts: {},
    isLoading: false,
    hasInitialized: false,

    fetchAndSyncData: async () => {
      set({ isLoading: true });
      try {
        const instancesRaw: string[] = await invoke('load_ai_instances');
        const sessionsRaw: string[] = await invoke('load_ai_sessions');

        const instances = instancesRaw.map(r => JSON.parse(r));
        const sessions = sessionsRaw.map(r => JSON.parse(r));

        set({
          data: { instances, sessions },
          isLoading: false,
          hasInitialized: true,
        });
      } catch (err) {
        console.error('Error fetching AI data from tauri backend:', err);
        set({ isLoading: false });
      }
    },

    addInstance: async (instance) => {
      await invoke('save_ai_instance', { id: instance.id, data: JSON.stringify(instance) });
      const currentData = get().data;
      set({ data: { ...currentData, instances: [...currentData.instances, instance] } });
      emit('ai-data-sync').catch(console.error);
    },

    updateInstance: async (id, updatedFields) => {
      const currentData = get().data;
      const index = currentData.instances.findIndex(i => i.id === id);
      if (index === -1) return;

      const updatedInstance = { ...currentData.instances[index], ...updatedFields };
      await invoke('save_ai_instance', { id: updatedInstance.id, data: JSON.stringify(updatedInstance) });

      const newInstances = [...currentData.instances];
      newInstances[index] = updatedInstance;
      set({ data: { ...currentData, instances: newInstances } });
      emit('ai-data-sync').catch(console.error);
    },

    removeInstance: async (id) => {
      await invoke('delete_ai_instance', { id });
      const currentData = get().data;
      const sessionIds = currentData.sessions.filter(s => s.instanceId === id).map(s => s.id);
      const drafts = { ...get().sessionDrafts };
      for (const sid of sessionIds) delete drafts[sid];
      set({
        data: {
          ...currentData,
          instances: currentData.instances.filter(i => i.id !== id),
          sessions: currentData.sessions.filter(s => s.instanceId !== id),
        },
        sessionDrafts: drafts,
      });
      emit('ai-data-sync').catch(console.error);
    },

    addSession: async (session) => {
      const sessionToSave = { ...session };
      delete sessionToSave.messages;

      const currentData = get().data;
      set({ data: { ...currentData, sessions: [sessionToSave, ...currentData.sessions] } });

      invoke('save_ai_session', {
        id: session.id,
        instanceId: session.instanceId,
        updatedAt: session.updatedAt,
        data: JSON.stringify(sessionToSave),
      }).then(() => emit('ai-data-sync')).catch(console.error);
    },

    updateSession: async (id, updatedFields) => {
      const currentData = get().data;
      const index = currentData.sessions.findIndex(s => s.id === id);
      if (index === -1) return;

      const updatedSession = { ...currentData.sessions[index], ...updatedFields };
      delete updatedSession.messages;

      const newSessions = [...currentData.sessions];
      newSessions[index] = updatedSession;
      newSessions.sort((a, b) => b.updatedAt - a.updatedAt);
      set({ data: { ...currentData, sessions: newSessions } });

      invoke('save_ai_session', {
        id: updatedSession.id,
        instanceId: updatedSession.instanceId,
        updatedAt: updatedSession.updatedAt,
        data: JSON.stringify(updatedSession),
      }).then(() => emit('ai-data-sync')).catch(console.error);
    },

    removeSession: async (id) => {
      await invoke('delete_ai_session', { id });
      const currentData = get().data;
      const currentMessages = get().sessionMessages;
      const currentLoaded = get().sessionsLoaded;
      const drafts = { ...get().sessionDrafts };
      delete drafts[id];

      const newMessages = { ...currentMessages };
      delete newMessages[id];
      const newLoaded = { ...currentLoaded };
      delete newLoaded[id];

      set({
        data: { ...currentData, sessions: currentData.sessions.filter(s => s.id !== id) },
        sessionMessages: newMessages,
        sessionsLoaded: newLoaded,
        sessionDrafts: drafts,
      });
      broadcastDraft(id, null);
      emit('ai-data-sync').catch(console.error);
    },

    loadMessagesForSession: async (sessionId, offset) => {
      try {
        const limit = 20;
        const messagesRaw: string[] = await invoke('load_ai_messages', { sessionId, limit, offset });
        const messages = messagesRaw.map(r => JSON.parse(r));

        const currentMessages = get().sessionMessages;
        const existingMessages = currentMessages[sessionId] || [];

        const newMessages = [...messages, ...existingMessages];

        const uniqueMessages = Array.from(new Map(newMessages.map(item => [item.id, item])).values());
        uniqueMessages.sort((a, b) => a.timestamp - b.timestamp);

        set({
          sessionMessages: { ...currentMessages, [sessionId]: uniqueMessages },
          sessionsLoaded: { ...get().sessionsLoaded, [sessionId]: true },
        });
      } catch (err) {
        console.error('Error fetching messages for session', sessionId, err);
      }
    },

    addMessageToSession: async (sessionId, message) => {
      if (!message.streamingEventId) {
        await invoke('save_ai_message', {
          id: message.id,
          sessionId: sessionId,
          timestamp: message.timestamp,
          data: JSON.stringify(message),
        });
      }
      const currentMessagesMap = get().sessionMessages;
      const sessionMsgs = currentMessagesMap[sessionId] || [];
      if (!sessionMsgs.find(m => m.id === message.id)) {
        set({ sessionMessages: { ...currentMessagesMap, [sessionId]: [...sessionMsgs, message] } });
      }
      emit('ai-sync-action', { type: 'ADD_MESSAGE', payload: { sessionId, message } }).catch(console.error);
    },

    updateMessageInSession: async (sessionId, messageId, updatedFields) => {
      const currentMessagesMap = get().sessionMessages;
      const sessionMsgs = currentMessagesMap[sessionId] || [];
      const index = sessionMsgs.findIndex(m => m.id === messageId);
      if (index === -1) return;

      const updatedMessage = { ...sessionMsgs[index], ...updatedFields };
      if ('streamingEventId' in updatedFields && updatedFields.streamingEventId === undefined) {
        delete updatedMessage.streamingEventId;
      }

      if (!updatedMessage.streamingEventId && sessionMsgs[index].streamingEventId) {
        await invoke('save_ai_message', {
          id: updatedMessage.id,
          sessionId: sessionId,
          timestamp: updatedMessage.timestamp,
          data: JSON.stringify(updatedMessage),
        });
      } else if (!updatedMessage.streamingEventId) {
        await invoke('save_ai_message', {
          id: updatedMessage.id,
          sessionId: sessionId,
          timestamp: updatedMessage.timestamp,
          data: JSON.stringify(updatedMessage),
        });
      }

      const newMsgs = [...sessionMsgs];
      newMsgs[index] = updatedMessage;
      set({ sessionMessages: { ...currentMessagesMap, [sessionId]: newMsgs } });

      emit('ai-sync-action', { type: 'UPDATE_MESSAGE', payload: { sessionId, messageId, updatedMessage } }).catch(console.error);
    },

    getSessionDraft: (sessionId) => {
      return get().sessionDrafts[sessionId] ?? EMPTY_SESSION_DRAFT;
    },

    setSessionDraft: (sessionId, draft, sync = true) => {
      set({
        sessionDrafts: { ...get().sessionDrafts, [sessionId]: draft },
      });
      if (sync) broadcastDraft(sessionId, draft);
    },

    patchSessionDraft: (sessionId, patch, sync = true) => {
      const prev = get().sessionDrafts[sessionId] ?? emptySessionDraft();
      const next: SessionDraft = {
        prompt: patch.prompt !== undefined ? patch.prompt : prev.prompt,
        attachments: patch.attachments !== undefined ? patch.attachments : prev.attachments,
      };
      set({
        sessionDrafts: { ...get().sessionDrafts, [sessionId]: next },
      });
      if (sync) broadcastDraft(sessionId, next);
    },

    clearSessionDraft: (sessionId, sync = true) => {
      const drafts = { ...get().sessionDrafts };
      drafts[sessionId] = emptySessionDraft();
      set({ sessionDrafts: drafts });
      if (sync) broadcastDraft(sessionId, drafts[sessionId]);
    },

    removeAttachmentFromDraft: (sessionId, attachmentId) => {
      const prev = get().sessionDrafts[sessionId] ?? emptySessionDraft();
      const next: SessionDraft = {
        ...prev,
        attachments: prev.attachments.filter((a: SessionAttachment) => a.id !== attachmentId),
      };
      set({
        sessionDrafts: { ...get().sessionDrafts, [sessionId]: next },
      });
      broadcastDraft(sessionId, next);
    },
  };
});

listen('ai-data-sync', () => {
  useAiServicesStore.getState().fetchAndSyncData();
}).catch(console.error);

listen<{ sessionId: string; draft: SessionDraft | null }>('ai-draft-sync', (event) => {
  const { sessionId, draft } = event.payload || {};
  if (!sessionId) return;
  const store = useAiServicesStore.getState();
  if (draft === null) {
    const drafts = { ...store.sessionDrafts };
    delete drafts[sessionId];
    useAiServicesStore.setState({ sessionDrafts: drafts });
    return;
  }
  useAiServicesStore.setState({
    sessionDrafts: { ...store.sessionDrafts, [sessionId]: draft },
  });
}).catch(console.error);

listen<any>('ai-sync-action', (event) => {
  const { type, payload } = event.payload;
  const store = useAiServicesStore.getState();

  if (type === 'ADD_MESSAGE') {
    const { sessionId, message } = payload;
    const msgs = store.sessionMessages[sessionId] || [];
    if (!msgs.find(m => m.id === message.id)) {
      useAiServicesStore.setState({ sessionMessages: { ...store.sessionMessages, [sessionId]: [...msgs, message] } });
    }
  } else if (type === 'UPDATE_MESSAGE') {
    const { sessionId, messageId, updatedMessage } = payload;
    const msgs = store.sessionMessages[sessionId] || [];
    const idx = msgs.findIndex(m => m.id === messageId);
    if (idx !== -1) {
      const newMsgs = [...msgs];
      newMsgs[idx] = updatedMessage;
      useAiServicesStore.setState({ sessionMessages: { ...store.sessionMessages, [sessionId]: newMsgs } });
    }
  }
}).catch(console.error);
