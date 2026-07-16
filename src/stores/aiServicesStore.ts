import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { AiServiceInstance, ChatSession } from '../types/ai';

interface AiData {
  instances: AiServiceInstance[];
  sessions: ChatSession[];
}

const DEFAULT_AI_DATA: AiData = {
  instances: [],
  sessions: [],
};

interface AiServicesState {
  data: AiData;
  isLoading: boolean;
  hasInitialized: boolean;
  
  // Actions
  fetchAndSyncData: () => Promise<void>;
  addInstance: (instance: AiServiceInstance) => void;
  updateInstance: (id: string, instance: Partial<AiServiceInstance>) => void;
  removeInstance: (id: string) => void;
  
  addSession: (session: ChatSession) => void;
  updateSession: (id: string, session: Partial<ChatSession>) => void;
  removeSession: (id: string) => void;
}

export const useAiServicesStore = create<AiServicesState>((set, get) => {
  const saveData = async (newData: AiData) => {
    set({ data: newData });
    invoke('save_ai_data', { data: JSON.stringify(newData) }).catch(console.error);
    emit('ai-data-sync', newData).catch(console.error);
  };

  return {
    data: DEFAULT_AI_DATA,
    isLoading: false,
    hasInitialized: false,

    fetchAndSyncData: async () => {
      set({ isLoading: true });
      try {
        const rawData = await invoke<string>('load_ai_data');
        let parsedData = DEFAULT_AI_DATA;
        if (rawData && rawData !== '{}') {
          parsedData = { ...DEFAULT_AI_DATA, ...JSON.parse(rawData) };
        }
        set({ data: parsedData, isLoading: false, hasInitialized: true });
      } catch (err) {
        console.error('Error fetching AI data from tauri backend:', err);
        set({ isLoading: false });
      }
    },

    addInstance: (instance) => {
      const currentData = get().data;
      saveData({
        ...currentData,
        instances: [...currentData.instances, instance]
      });
    },

    updateInstance: (id, updatedFields) => {
      const currentData = get().data;
      saveData({
        ...currentData,
        instances: currentData.instances.map(i => i.id === id ? { ...i, ...updatedFields } : i)
      });
    },

    removeInstance: (id) => {
      const currentData = get().data;
      saveData({
        ...currentData,
        instances: currentData.instances.filter(i => i.id !== id),
        // optionally remove sessions linked to this instance:
        sessions: currentData.sessions.filter(s => s.instanceId !== id)
      });
    },

    addSession: (session) => {
      const currentData = get().data;
      saveData({
        ...currentData,
        sessions: [...currentData.sessions, session]
      });
    },

    updateSession: (id, updatedFields) => {
      const currentData = get().data;
      saveData({
        ...currentData,
        sessions: currentData.sessions.map(s => s.id === id ? { ...s, ...updatedFields } : s)
      });
    },

    removeSession: (id) => {
      const currentData = get().data;
      saveData({
        ...currentData,
        sessions: currentData.sessions.filter(s => s.id !== id)
      });
    }
  };
});

listen('ai-data-sync', (event: any) => {
  const updatedData = event.payload;
  if (updatedData) {
    useAiServicesStore.setState({ data: updatedData });
  }
}).catch(console.error);
