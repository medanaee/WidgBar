import React, { useState, useEffect, useRef } from 'react';
import { aiManager } from '../../lib/AiServicesManager';
import { useAiServicesStore } from '../../stores/aiServicesStore';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { BotSparkleColor, OpenRegular, PersonRegular, AddRegular } from '@fluentui/react-icons';
import { CompanyLogo } from '../../components/CompanyLogo';
import { invoke } from '@tauri-apps/api/core';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import MarkdownChatContent from '../../components/MarkdownChatContent';
import ChatUserMessage from '../../components/ai/ChatUserMessage';
import SessionComposer from '../../components/ai/SessionComposer';
import { CutoutProvider } from '../../components/ui/CutoutProvider';

export default function AiArea({ widgetId }: { widgetId: string }) {
    const [isSending, setIsSending] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const widgetConfig = useWidgetInstanceStore(state => state.instances[widgetId]) || {};
    const selectedInstanceId = widgetConfig.selectedInstanceId;
    const { data: aiData, sessionMessages, sessionsLoaded, loadMessagesForSession } = useAiServicesStore();
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

    const currentMessages = currentSession ? (sessionMessages[currentSession.id] || []) : [];

    useEffect(() => {
        if (currentSession && !sessionsLoaded[currentSession.id]) {
            loadMessagesForSession(currentSession.id, 0);
        }
    }, [currentSession?.id, sessionsLoaded, loadMessagesForSession]);

    const isAutoScrollEnabled = useRef(true);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
        isAutoScrollEnabled.current = isAtBottom;
    };

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

    return (
        <CutoutProvider>
            <div className="flex flex-col h-full w-full bg-transparent p-4 text-zinc-800 dark:text-zinc-200 overflow-hidden font-sans select-none">
                <h2 className="text-sm font-semibold mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {instance ? <CompanyLogo providerId={instance.providerId} size={18} /> : <BotSparkleColor fontSize={18} />}
                        <span>{instance ? instance.name : 'AI Assistant'}</span>
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

                <div
                    className="flex-1 bg-zinc-500/5 dark:bg-black/20 border border-zinc-500/10 dark:border-white/5 rounded-xl p-3 mb-3 overflow-y-auto text-xs font-sans leading-relaxed flex flex-col gap-2"
                    onScroll={handleScroll}
                >
                    {!currentSession || currentMessages.length === 0 ? (
                        <div className="text-zinc-400 dark:text-zinc-500 text-center my-auto">Ask me anything...</div>
                    ) : (
                        currentMessages.map((msg, idx) => (
                            <div key={msg.id} className="w-full">
                                {idx > 0 && <hr className="border-zinc-500/10 dark:border-white/5 my-3" />}
                                <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1.5">
                                        {msg.role === 'user' ? <PersonRegular fontSize={12} /> : (instance ? <CompanyLogo providerId={instance.providerId} size={12} /> : <BotSparkleColor fontSize={12} />)}
                                        <span>{msg.role === 'user' ? 'You' : (instance ? instance.name : 'Assistant')}</span>
                                    </div>
                                    <div className="text-zinc-700 dark:text-zinc-300 leading-normal overflow-hidden w-full px-2">
                                        <div className="flex flex-col gap-1.5 overflow-x-auto overflow-y-hidden break-words">
                                            {msg.role === 'user' ? (
                                                <ChatUserMessage
                                                    message={msg}
                                                    isWidget
                                                    onScrollToBottom={scrollToBottomIfEnabled}
                                                    topOffset={8}
                                                />
                                            ) : (
                                                <MarkdownChatContent
                                                    content={msg.content}
                                                    streamingEventId={msg.streamingEventId}
                                                    isWidget={true}
                                                    onScrollToBottom={scrollToBottomIfEnabled}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {instance && (
                    <SessionComposer
                        instanceId={instance.id}
                        sessionId={currentSession?.id ?? null}
                        isSending={isSending}
                        onSendingChange={setIsSending}
                        onSessionCreated={setActiveSessionId}
                        compact
                    />
                )}
            </div>
        </CutoutProvider>
    );
}
