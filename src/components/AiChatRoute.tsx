import { useParams } from "react-router-dom";
import { useAiServicesStore } from "../stores/aiServicesStore";
import { useEffect, useState } from "react";
import { aiManager } from "../lib/AiServicesManager";
import { ChatSession } from "../types/ai";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Send, Bot, User } from "lucide-react";
import { Titlebar } from "./Titlebar";
import { CutoutProvider } from "./ui/CutoutProvider";
import { useTranslation } from "../lib/i18n";

export default function AiChatRoute() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const { data } = useAiServicesStore();
  const { language } = useTranslation();
  
  const instance = data.instances.find(i => i.id === instanceId);
  const sessions = data.sessions.filter(s => s.instanceId === instanceId);
  
  const [activeSession, setActiveSession] = useState<ChatSession | null>(
    sessions.length > 0 ? sessions[0] : null
  );
  
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!activeSession && instance) {
      // Create default session if none exists
      const newSession = aiManager.createSession(instance.id, "Chat");
      setActiveSession(newSession);
    }
  }, [activeSession, instance]);

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

  // We need to fetch the latest session data from store because `activeSession` 
  // might be stale. We just find it again.
  const currentSession = data.sessions.find(s => s.id === activeSession?.id);

  return (
    <CutoutProvider>
      <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100" dir={language === 'fa' ? 'rtl' : 'ltr'}>
        <Titlebar title={`AI Chat - ${instance.name}`} />
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {currentSession?.messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-50">
              <Bot className="w-12 h-12 mb-4" />
              <p>Start a conversation with {instance.name}</p>
            </div>
          )}
          {currentSession?.messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-blue-500" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
              )}
            </div>
          ))}
          {isSending && (
            <div className="flex gap-3 justify-start">
               <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 animate-pulse">
                  <Bot className="w-4 h-4 text-blue-500" />
                </div>
                <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-800 animate-pulse">
                  Typing...
                </div>
            </div>
          )}
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder="Type a message..."
            className="flex-1"
            disabled={isSending}
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || isSending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </CutoutProvider>
  );
}
