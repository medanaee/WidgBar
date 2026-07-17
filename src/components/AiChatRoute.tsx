import { useParams } from "react-router-dom";
import { useAiServicesStore } from "../stores/aiServicesStore";
import { useEffect, useState, useRef } from "react";
import { aiManager } from "../lib/AiServicesManager";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { ChatSession } from "../types/ai";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Titlebar } from "./Titlebar";
import { CutoutProvider } from "./ui/CutoutProvider";
import { useTranslation, TranslationKey } from "../lib/i18n";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { BotSparkleColor, PersonRegular, SendRegular, AddRegular, DeleteRegular, StopRegular } from '@fluentui/react-icons';
import { CompanyLogo } from "./CompanyLogo";
import EditAiServicePanel from "./tabs/EditAiServicePanel";
import MarkdownChatContent from "./MarkdownChatContent";
import { Settings as SettingsIcon } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  isSending: boolean;
  isLoadingModels: boolean;
  models: string[];
  currentModel: string;
  onModelChange: (model: string) => void;
}

function ChatInput({
  onSend,
  isSending,
  isLoadingModels,
  models,
  currentModel,
  onModelChange
}: ChatInputProps) {
  const [val, setVal] = useState("");

  const handleSend = () => {
    if (!val.trim()) return;
    onSend(val);
    setVal("");
  };



  return (
    <div className="p-3 bg-white/30 dark:bg-zinc-900/30 border-t border-zinc-500/15 dark:border-white/5 flex items-end gap-2 shrink-0">
      {isLoadingModels ? (
        <span className="text-[10px] text-zinc-400 animate-pulse w-32 text-center mb-2">Loading models...</span>
      ) : models.length > 0 ? (
        <div className="mb-0.5">
          <Select
            value={currentModel}
            onValueChange={onModelChange}
          >
            <SelectTrigger className="w-40 h-9 text-[10px] bg-white/20 dark:bg-zinc-900/20 border-zinc-500/20 text-zinc-700 dark:text-zinc-300">
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

      <textarea 
        value={val}
        dir = "auto"
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Type a message..."
        rows={1}
        className="flex-1 bg-white/20 dark:bg-zinc-900/20 border border-zinc-500/20 dark:border-white/10 text-xs focus:outline-none focus:border-zinc-500/50 rounded-lg px-3 py-2 resize-none [field-sizing:content] min-h-[36px] max-h-[120px] leading-relaxed dark:text-white"
        disabled={isSending}
      />
      <Button 
        size="icon" 
        onClick={() => {
          if (isSending) {
            emit('ai-abort-stream').catch(console.error);
          } else {
            handleSend();
          }
        }} 
        disabled={!isSending && !val.trim()}
        className={`flex items-center justify-center rounded-lg h-9 w-9 shrink-0 ${
          isSending 
            ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' 
            : 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-100'
        }`}
      >
        {isSending ? <StopRegular fontSize={16} /> : <SendRegular fontSize={16} />}
      </Button>
    </div>
  );
}

export default function AiChatRoute() {
  console.log("Rendering AiChatRoute");
  const { instanceId } = useParams<{ instanceId: string }>();
  const { data, sessionMessages, sessionsLoaded, loadMessagesForSession, removeSession } = useAiServicesStore();
  const { language, t } = useTranslation();
  
  const instance = data.instances.find(i => i.id === instanceId);
  const sessions = data.sessions.filter(s => s.instanceId === instanceId);
  
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentMessages = activeSession ? (sessionMessages[activeSession.id] || []) : [];

  const isAutoScrollEnabled = useRef(true);

  // Scroll to bottom whenever messages change or we start sending, if we're near bottom
  useEffect(() => {
    if (isAutoScrollEnabled.current || isSending) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        if (isSending) isAutoScrollEnabled.current = true;
    }
  }, [currentMessages.length > 0 ? currentMessages[currentMessages.length - 1].id : null, isSending]);

  const scrollToBottomIfEnabled = () => {
      if (isAutoScrollEnabled.current) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
  };

  const [models, setModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isEditingSettings, setIsEditingSettings] = useState(false);

  // Default session logic
  useEffect(() => {
    if (sessions.length > 0 && !activeSession) {
      setActiveSession(sessions[0]);
    } else if (sessions.length === 0 && instance && !activeSession) {
      const newSession = aiManager.createSession(instance.id, "Chat 1");
      setActiveSession(newSession);
    }
  }, [sessions, activeSession, instance]);

  // Lazy load initial messages when activeSession changes
  useEffect(() => {
    if (activeSession && !sessionsLoaded[activeSession.id]) {
      loadMessagesForSession(activeSession.id, 0);
    }
  }, [activeSession?.id, sessionsLoaded, loadMessagesForSession]);

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    isAutoScrollEnabled.current = isAtBottom;

    if (e.currentTarget.scrollTop === 0 && activeSession && !isLoadingMore) {
      const msgs = sessionMessages[activeSession.id] || [];
      if (msgs.length >= 20) {
        setIsLoadingMore(true);
        // Save scroll height to restore scroll position
        const scrollContainer = e.currentTarget;
        const prevHeight = scrollContainer.scrollHeight;
        
        await loadMessagesForSession(activeSession.id, msgs.length);
        
        // Restore scroll position so it doesn't jump to top
        requestAnimationFrame(() => {
           scrollContainer.scrollTop = scrollContainer.scrollHeight - prevHeight;
        });
        setIsLoadingMore(false);
      }
    }
  };

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
    } else if (providerId === 'groq-api') {
      invoke<any>('proxy_request', {
        url: 'https://api.groq.com/openai/v1/models',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${instance.apiKey}` }
      })
      .then(resData => {
        if (resData && Array.isArray(resData.data)) {
          const chatModels = resData.data
            .map((m: any) => m.id)
            .filter((id: string) => !id.includes('whisper'));
          setModels(chatModels);
        }
      })
      .catch(err => console.error("Error fetching Groq models:", err))
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

  const handleSend = async (msg: string) => {
    if (!activeSession) return;
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
    useAiServicesStore.getState().updateInstance(instance.id, { model: modelName });
    if (activeSession) {
      useAiServicesStore.getState().updateSession(activeSession.id, { model: modelName });
    }
  };

  if (isEditingSettings) {
    return (
      <CutoutProvider>
        <div className="flex flex-col h-screen font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden" dir={language === 'fa' ? 'rtl' : 'ltr'}>
          <Titlebar title={`Service Settings - ${instance.name}`} />
          <div className="flex-1 p-8 overflow-y-auto flex items-center justify-center">
            <EditAiServicePanel
              instance={instance}
              onBack={() => setIsEditingSettings(false)}
              onSave={(updatedFields) => {
                useAiServicesStore.getState().updateInstance(instance.id, updatedFields);
                setIsEditingSettings(false);
              }}
            />
          </div>
        </div>
      </CutoutProvider>
    );
  }

  const currentSession = data.sessions.find(s => s.id === activeSession?.id);
  const defaultModel = instance.providerId === 'nvidia-api' 
    ? 'meta/llama-3.1-8b-instruct' 
    : instance.providerId === 'openai-api'
      ? 'gpt-4o'
      : instance.providerId === 'deepseek-api'
        ? 'deepseek-chat'
        : instance.providerId === 'groq-api'
          ? 'llama-3.3-70b-specdec'
          : 'gemini-1.5-flash';

  return (
    <CutoutProvider>
      <div className="flex flex-col h-screen font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden" dir={language === 'fa' ? 'rtl' : 'ltr'}>
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
            
            <div className="flex-grow overflow-y-auto py-4 pr-1">
              {sessions.map(s => (
                <div 
                  key={s.id}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
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
            {/* Header bar with Settings Button */}
            <div className="px-4 py-2 border-b border-zinc-500/10 dark:border-white/5 flex items-center justify-between shrink-0 bg-white/20 dark:bg-zinc-900/10">
              <div className="text-xs font-semibold text-zinc-500">
                Chatting with {instance.name}
              </div>
              <button
                onClick={() => setIsEditingSettings(true)}
                className="p-1.5 hover:bg-zinc-500/10 dark:hover:bg-white/10 rounded transition-colors text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                title="Instance Settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Scroll View */}
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-100/10 dark:bg-zinc-950/20"
              onScroll={handleScroll}
            >
              {currentMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-40">
                  <CompanyLogo providerId={instance.providerId} size={48} className="mb-4" />
                  <p className="text-xs">Start a conversation with {instance.name}</p>
                </div>
              )}
              
              {isLoadingMore && (
                <div className="w-full flex justify-center py-2">
                  <span className="text-[10px] text-zinc-400 animate-pulse">Loading older messages...</span>
                </div>
              )}

              {currentMessages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-zinc-500/10 dark:bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-500/10 dark:border-zinc-700 overflow-hidden shadow-sm">
                      <CompanyLogo providerId={instance.providerId} size={18} />
                    </div>
                  )}
                  <div 
                    className={`max-w-[80%] text-[11px] leading-relaxed border overflow-hidden ${
                      msg.role === 'user' 
                        ? 'px-4 py-1 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 border-zinc-700 dark:border-zinc-300' 
                        : 'px-4 py-3 bg-white/40 dark:bg-zinc-900/40 border-zinc-500/10 dark:border-white/5'
                    }`}
                    style={{ borderRadius: '16px', cornerShape: 'squircle' } as React.CSSProperties}
                    
                  >
                    <div className="flex flex-col gap-2 overflow-x-auto overflow-y-hidden break-words">
                      <MarkdownChatContent
                        content={msg.content}
                        streamingEventId={msg.streamingEventId}
                        onScrollToBottom={scrollToBottomIfEnabled}
                      />
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-zinc-800/10 dark:bg-white/10 flex items-center justify-center shrink-0 border border-zinc-500/10 dark:border-white/10">
                      <PersonRegular fontSize={18} />
                    </div>
                  )}
                </div>
              ))}
              

              
              <div ref={messagesEndRef} />
            </div>

            <ChatInput 
              onSend={handleSend}
              isSending={isSending}
              isLoadingModels={isLoadingModels}
              models={models}
              currentModel={instance.model || currentSession?.model || defaultModel}
              onModelChange={handleModelChange}
            />
          </div>
        </div>
      </div>
    </CutoutProvider>
  );
}
