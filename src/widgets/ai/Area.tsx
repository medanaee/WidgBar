import React, { useState } from 'react';
import { aiManager } from '../../lib/AiServicesManager';
import { useAiServicesStore } from '../../stores/aiServicesStore';
import { useWidgetInstanceStore } from '../../stores/widgetInstanceStore';
import { BotSparkleColor, SendRegular, OpenRegular, PersonRegular } from '@fluentui/react-icons';
import { invoke } from '@tauri-apps/api/core';

export default function AiArea({ widgetId }: { widgetId: string }) {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

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

    // Find the active session for the active instance
    const currentSession = instance 
        ? aiData.sessions.find(s => s.instanceId === instance.id) 
        : null;

    const handleSend = async () => {
        if (!message.trim()) return;
        if (!instance) return;
        
        const store = useAiServicesStore.getState();
        let session = store.data.sessions.find(s => s.instanceId === instance.id);
        if (!session) {
            session = aiManager.createSession(instance.id, 'Widget Chat');
        }

        const msgToSend = message;
        setMessage('');
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
                        <span className="text-[10px] text-zinc-500 font-mono bg-zinc-500/5 px-1.5 py-0.5 rounded truncate max-w-[100px]" title={instance.name}>
                            {instance.name}
                        </span>
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
            
            <div className="flex-1 bg-zinc-500/5 dark:bg-black/20 border border-zinc-500/10 dark:border-white/5 rounded-xl p-3 mb-3 overflow-y-auto text-xs font-sans leading-relaxed scrollbar-thin flex flex-col gap-2">
                {!currentSession || currentSession.messages.length === 0 ? (
                    <div className="text-zinc-400 dark:text-zinc-500 text-center my-auto">Ask me anything...</div>
                ) : (
                    currentSession.messages.map((msg, idx) => (
                        <div key={msg.id} className="w-full">
                            {idx > 0 && <hr className="border-zinc-500/10 dark:border-white/5 my-3" />}
                            <div className="flex flex-col gap-1">
                                <div className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1.5">
                                    {msg.role === 'user' ? <PersonRegular fontSize={12} /> : <BotSparkleColor fontSize={12} />}
                                    <span>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                                </div>
                                <div className="text-zinc-700 dark:text-zinc-300 leading-normal pl-4 whitespace-pre-wrap">
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                {isSending && (
                    <div className="w-full">
                        <hr className="border-zinc-500/10 dark:border-white/5 my-3" />
                        <div className="flex flex-col gap-1 animate-pulse">
                            <div className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1.5">
                                <BotSparkleColor fontSize={12} />
                                <span>Assistant</span>
                            </div>
                            <div className="text-zinc-500 leading-normal pl-4">
                                Thinking...
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="flex-1 bg-zinc-500/5 dark:bg-white/5 border border-zinc-500/20 dark:border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-zinc-500/40 dark:text-white"
                    placeholder="Type a message..."
                    disabled={isSending}
                    onKeyDown={e => e.key === 'Enter' && !isSending && handleSend()}
                />
                <button 
                    onClick={handleSend}
                    disabled={isSending || !message.trim()}
                    className="bg-zinc-500/10 hover:bg-zinc-500/20 dark:bg-white/10 dark:hover:bg-white/20 disabled:opacity-40 text-zinc-800 dark:text-white rounded-lg p-2 flex items-center justify-center transition-colors border border-zinc-500/10 dark:border-white/10"
                >
                    <SendRegular fontSize={16} />
                </button>
            </div>
        </div>
    );
}
