import React, { useState, useEffect, useRef } from 'react';
import { aiManager } from '../../lib/AiServicesManager';
import { useAiServicesStore } from '../../stores/aiServicesStore';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { BotSparkleColor, SendRegular, OpenRegular, PersonRegular, AddRegular } from '@fluentui/react-icons';
import { invoke } from '@tauri-apps/api/core';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import MarkdownChatContent from '../../components/MarkdownChatContent';

function AreaInput({ onSend, isSending }: { onSend: (msg: string) => void; isSending: boolean }) {
    const [val, setVal] = useState('');
    const handleSend = () => {
        if (!val.trim()) return;
        onSend(val);
        setVal('');
    };
    return (
        <div className="flex gap-2">
            <input 
                type="text" 
                value={val}
                dir= "auto"
                onChange={e => setVal(e.target.value)}
                className="flex-1 bg-zinc-500/5 dark:bg-white/5 border border-zinc-500/20 dark:border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-zinc-500/40 dark:text-white"
                placeholder="Type a message..."
                disabled={isSending}
                onKeyDown={e => e.key === 'Enter' && !isSending && handleSend()}
            />
            <button 
                onClick={handleSend}
                disabled={isSending || !val.trim()}
                className="bg-zinc-500/10 hover:bg-zinc-500/20 dark:bg-white/10 dark:hover:bg-white/20 disabled:opacity-40 text-zinc-800 dark:text-white rounded-lg p-2 flex items-center justify-center transition-colors border border-zinc-500/10 dark:border-white/10"
            >
                <SendRegular fontSize={16} />
            </button>
        </div>
    );
}

export default function AiArea({ widgetId }: { widgetId: string }) {
    const [isSending, setIsSending] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const widgetConfig = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const selectedInstanceId = widgetConfig.selectedInstanceId;
    const { data: aiData } = useAiServicesStore();
    const instances = aiData.instances || [];

    let instance = instances.find(i => i.id === selectedInstanceId);
    if (!instance && instances.length > 0) {
        instance = instances[0];
    }

    const openFullChat = () => {
        if (!instance) return;
        invoke('request_popup', {
            x: window.screenX + 100,
            y: window.screenY + 100,
            width: 800,
            height: 600,
            route: `/ai-chat/${instance.id}`,
            closeOnBlur: false,
            xIsCenter: false,
            animated: true,
            belowBar: false,
            center: true,
            resizable: true,
            skipTaskbar: false,
            alwaysOnTop: false
        }).catch(console.error);
    };

    const instanceSessions = instance ? aiData.sessions.filter(s => s.instanceId === instance.id) : [];
    let currentSession = instanceSessions.find(s => s.id === activeSessionId);
    if (!currentSession && instanceSessions.length > 0) {
        currentSession = instanceSessions[0];
    }

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentSession?.messages, isSending]);

    const handleSend = async (msgToSend: string) => {
        if (!instance) return;
        
        let session = currentSession;
        if (!session) {
            session = aiManager.createSession(instance.id, 'Widget Chat');
            setActiveSessionId(session.id);
        }

        setIsSending(true);
        try {
            await aiManager.sendMessage(instance.id, session.id, msgToSend);
        } catch (e: any) {
            console.error(e);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-transparent p-4 text-zinc-800 dark:text-zinc-200 overflow-hidden font-sans select-none">
            <h2 className="text-sm font-semibold mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BotSparkleColor fontSize={18} />
                    <span>AI Assistant</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                    {instance && (
                        <>
                            <Select 
                                value={currentSession?.id || ''} 
                                onValueChange={setActiveSessionId}
                            >
                                <SelectTrigger className="h-6 px-2 text-[10px] bg-zinc-500/5 border-none shadow-none focus:ring-0 gap-1 w-auto max-w-[90px]">
                                    <SelectValue placeholder="Session" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {instanceSessions.map(s => (
                                            <SelectItem key={s.id} value={s.id} className="text-[10px]">
                                                {s.title || 'Chat'}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <button
                                onClick={() => {
                                    const newS = aiManager.createSession(instance.id, `Widget Chat ${instanceSessions.length + 1}`);
                                    setActiveSessionId(newS.id);
                                }}
                                className="p-1 hover:bg-zinc-500/10 dark:hover:bg-white/10 rounded transition-colors text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 shrink-0"
                                title="New Chat"
                            >
                                <AddRegular fontSize={14} />
                            </button>
                        </>
                    )}
                    <button
                        onClick={openFullChat}
                        className="p-1 hover:bg-zinc-500/10 dark:hover:bg-white/10 rounded transition-colors text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 shrink-0"
                        title="Open Full Chat"
                    >
                        <OpenRegular fontSize={16} />
                    </button>
                </div>
            </h2>
            
            <div className="flex-1 bg-zinc-500/5 dark:bg-black/20 border border-zinc-500/10 dark:border-white/5 rounded-xl p-3 mb-3 overflow-y-auto text-xs font-sans leading-relaxed flex flex-col gap-2">
                {!currentSession || currentSession.messages.length === 0 ? (
                    <div className="text-zinc-400 dark:text-zinc-500 text-center my-auto">Ask me anything...</div>
                ) : (
                    currentSession.messages.map((msg, idx) => (
                        <div key={msg.id} className="w-full">
                            {idx > 0 && <hr className="border-zinc-500/10 dark:border-white/5 my-3" />}
                            <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1.5">
                                    {msg.role === 'user' ? <PersonRegular fontSize={12} /> : <BotSparkleColor fontSize={12} />}
                                    <span>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                                </div>
                                <div className="text-zinc-700 dark:text-zinc-300 leading-normal overflow-hidden w-full px-2">
                                    <div className="flex flex-col gap-1.5 overflow-x-auto">
                                        <MarkdownChatContent
                                            content={msg.content}
                                            typing={msg.typing}
                                            messageId={msg.id}
                                            sessionId={currentSession?.id || ''}
                                            isWidget={true}
                                            onScrollToBottom={() => {
                                                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
                {isSending && (
                    <div className="w-full">
                        <hr className="border-zinc-500/10 dark:border-white/5 my-3" />
                        <div className="flex flex-col gap-1 items-start">
                            <div className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1.5">
                                <BotSparkleColor fontSize={12} className="animate-pulse" />
                                <span>Assistant</span>
                            </div>
                            <div className="text-zinc-500 text-[10px] leading-normal pl-4 flex items-center gap-2">
                                <span className="animate-pulse">Thinking</span>
                                <div className="flex gap-0.5">
                                    <div className="w-0.5 h-0.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-0.5 h-0.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-0.5 h-0.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <AreaInput onSend={handleSend} isSending={isSending} />
        </div>
    );
}
