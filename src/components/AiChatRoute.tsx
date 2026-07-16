import { useParams } from "react-router-dom";
import { useAiServicesStore } from "../stores/aiServicesStore";
import { useEffect, useState } from "react";
import { aiManager } from "../lib/AiServicesManager";
import { invoke } from "@tauri-apps/api/core";
import { ChatSession } from "../types/ai";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Titlebar } from "./Titlebar";
import { CutoutProvider } from "./ui/CutoutProvider";
import { useTranslation, TranslationKey } from "../lib/i18n";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { BotSparkleColor, PersonRegular, SendRegular, AddRegular, DeleteRegular } from '@fluentui/react-icons';

export default function AiChatRoute() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const { data, removeSession } = useAiServicesStore();
  const { language, t } = useTranslation();
  
  const instance = data.instances.find(i => i.id === instanceId);
  const sessions = data.sessions.filter(s => s.instanceId === instanceId);
  
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Default session logic
  useEffect(() => {
    if (sessions.length > 0 && !activeSession) {
      setActiveSession(sessions[0]);
    } else if (sessions.length === 0 && instance && !activeSession) {
      const newSession = aiManager.createSession(instance.id, "Chat 1");
      setActiveSession(newSession);
    }
  }, [sessions, activeSession, instance]);

  // Fetch models for selected instance
  useEffect(() => {
    if (!instance || !instance.apiKey) return;
    
    setModels([]);
    setIsLoadingModels(true);
    
    const providerId = instance.providerId;
    
    if (providerId === 'nvidia-api') {
      invoke<any>('proxy_request', {
        url: 'https://integrate.api.nvidia.com/v1/models',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${instance.apiKey}` }
      })
      .then(resData => {
        if (resData && Array.isArray(resData.data)) {
          // Filter out embedding or non-chat models by excluding embedding/rerank/similarity keywords
          const chatModels = resData.data
            .map((m: any) => m.id)
            .filter((id: string) => 
              !id.includes('embed') && 
              !id.includes('rerank') && 
              !id.includes('similarity') && 
              !id.includes('vl') // Exclude vision-language models if we only support text chat
            );
          setModels(chatModels.length > 0 ? chatModels : resData.data.map((m: any) => m.id));
        }
      })
      .catch(err => console.error("Error fetching Nvidia models:", err))
      .finally(() => setIsLoadingModels(false));
    } else if (providerId === 'openai-api') {
      invoke<any>('proxy_request', {
        url: 'https://api.openai.com/v1/models',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${instance.apiKey}` }
      })
      .then(resData => {
        if (resData && Array.isArray(resData.data)) {
          const chatModels = resData.data
             .map((m: any) => m.id)
             .filter((id: string) => id.includes('gpt'));
          setModels(chatModels);
        }
      })
      .catch(err => console.error("Error fetching OpenAI models:", err))
      .finally(() => setIsLoadingModels(false));
    } else if (providerId === 'deepseek-api') {
      setModels(['deepseek-chat', 'deepseek-reasoner']);
      setIsLoadingModels(false);
    } else if (providerId === 'gemini-api') {
      setModels(['gemini-1.5-flash', 'gemini-1.5-pro']);
      setIsLoadingModels(false);
    } else {
      setIsLoadingModels(false);
    }
  }, [instance?.id, instance?.apiKey, instance?.providerId]);

  if (!instance) {
    return <div className="p-8 text-center text-red-500">AI Service Instance not found.</div>;
  }

  const handleSend = async () => {
    if (!input.trim() || !activeSession) return;
    const msg = input;
    setInput("");
    setIsSending(true);
    try {
      await aiManager.sendMessage(instance.id, activeSession.id, msg);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const handleNewSession = () => {
    const newSession = aiManager.createSession(instance.id, `Chat ${sessions.length + 1}`);
    setActiveSession(newSession);
  };

  const handleDeleteSession = (id: string) => {
    removeSession(id);
    if (activeSession?.id === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setActiveSession(remaining.length > 0 ? remaining[0] : null);
    }
  };

  const handleModelChange = (modelName: string) => {
    if (activeSession) {
      useAiServicesStore.getState().updateSession(activeSession.id, { model: modelName });
    }
  };

  const currentSession = data.sessions.find(s => s.id === activeSession?.id);
  const defaultModel = instance.providerId === 'nvidia-api' 
    ? 'meta/llama-3.1-8b-instruct' 
    : instance.providerId === 'openai-api'
      ? 'gpt-4o'
      : instance.providerId === 'deepseek-api'
        ? 'deepseek-chat'
        : 'gemini-1.5-flash';

  return (
    <CutoutProvider>
      <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden" dir={language === 'fa' ? 'rtl' : 'ltr'}>
        <Titlebar title={`AI Chat - ${instance.name}`} />
        
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {/* 1. Left Sidebar (History & Actions) */}
          <div className="w-56 shrink-0 bg-zinc-500/5 dark:bg-zinc-950/40 border-r border-zinc-500/10 dark:border-white/5 flex flex-col p-3 z-10">
            <button 
              onClick={handleNewSession}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 border border-zinc-500/20 hover:bg-zinc-500/10 rounded-lg text-xs font-semibold transition-all hover:scale-[1.01]"
            >
              <AddRegular fontSize={16} />
              <span>New Chat</span>
            </button>
            
            <div className="flex-grow overflow-y-auto space-y-1.5 py-4 pr-1 scrollbar-thin">
              {sessions.map(s => (
                <div 
                  key={s.id}
                  className={`group flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    activeSession?.id === s.id 
                      ? 'bg-zinc-500/10 dark:bg-white/5 font-semibold text-zinc-900 dark:text-zinc-100' 
                      : 'text-zinc-500 hover:bg-zinc-500/5 hover:text-zinc-800 dark:hover:text-zinc-300'
                  }`}
                  onClick={() => setActiveSession(s)}
                >
                  <span className="truncate flex-1 pr-2 text-start">{s.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(s.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-0.5"
                    title="Delete chat"
                  >
                    <DeleteRegular fontSize={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Main Chat Window */}
          <div className="flex-grow flex flex-col min-h-0 overflow-hidden bg-transparent">
            {/* Model Selector Bar */}
            <div className="px-4 py-2 border-b border-zinc-500/10 dark:border-white/5 flex items-center justify-between shrink-0 bg-white/20 dark:bg-zinc-900/10 backdrop-blur-md">
              <div className="text-xs font-semibold text-zinc-500">
                Chatting with {instance.name}
              </div>
              
              {isLoadingModels ? (
                <span className="text-[10px] text-zinc-400 animate-pulse">Loading Models...</span>
              ) : models.length > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400">Model:</span>
                  <Select
                    value={currentSession?.model || defaultModel}
                    onValueChange={handleModelChange}
                  >
                    <SelectTrigger className="w-48 h-7 text-[10px] bg-transparent border-zinc-500/20 text-zinc-700 dark:text-zinc-300">
                      <SelectValue placeholder="Select Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {models.map(m => (
                          <SelectItem key={m} value={m} className="text-[10px] truncate max-w-[200px]">
                            {m.split('/').pop()}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            {/* Messages Scroll View */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-100/10 dark:bg-zinc-950/20 backdrop-blur-md scrollbar-thin">
              {currentSession?.messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-40">
                  <BotSparkleColor fontSize={48} className="mb-4" />
                  <p className="text-xs">Start a conversation with {instance.name}</p>
                </div>
              )}
              
              {currentSession?.messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-zinc-500/10 dark:bg-white/10 flex items-center justify-center shrink-0 border border-zinc-500/10 dark:border-white/10">
                      <BotSparkleColor fontSize={18} />
                    </div>
                  )}
                  <div 
                    className={`max-w-[80%] px-4 py-2.5 text-xs leading-relaxed border ${
                      msg.role === 'user' 
                        ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 border-zinc-700 dark:border-zinc-300' 
                        : 'bg-white/40 dark:bg-zinc-900/40 border-zinc-500/10 dark:border-white/5'
                    }`}
                    style={{ borderRadius: '16px', cornerShape: 'squircle' } as React.CSSProperties}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-zinc-800/10 dark:bg-white/10 flex items-center justify-center shrink-0 border border-zinc-500/10 dark:border-white/10">
                      <PersonRegular fontSize={18} />
                    </div>
                  )}
                </div>
              ))}
              
              {isSending && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-zinc-500/10 dark:bg-white/10 flex items-center justify-center shrink-0 animate-pulse border border-zinc-500/10 dark:border-white/10">
                    <BotSparkleColor fontSize={18} />
                  </div>
                  <div 
                    className="max-w-[80%] px-4 py-2.5 text-xs bg-white/30 dark:bg-zinc-900/30 border border-zinc-500/5 dark:border-white/5 animate-pulse"
                    style={{ borderRadius: '16px', cornerShape: 'squircle' } as React.CSSProperties}
                  >
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            {/* Message Input Panel */}
            <div className="p-3 bg-white/30 dark:bg-zinc-900/30 backdrop-blur-md border-t border-zinc-500/15 dark:border-white/5 flex gap-2">
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                placeholder="Type a message..."
                className="flex-1 bg-white/20 dark:bg-zinc-900/20 border-zinc-500/20 dark:border-white/10 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-zinc-500/50"
                disabled={isSending}
              />
              <Button 
                size="icon" 
                onClick={handleSend} 
                disabled={!input.trim() || isSending}
                className="bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-100 flex items-center justify-center rounded-lg"
              >
                <SendRegular fontSize={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </CutoutProvider>
  );
}
