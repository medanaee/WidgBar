import React, { useState } from 'react';
import { aiManager } from '../../lib/AiServicesManager';
import { useAiServicesStore } from '../../stores/aiServicesStore';
import { invoke } from '@tauri-apps/api/core';

export default function AiArea({ widgetId }: { widgetId: string }) {
    const [message, setMessage] = useState('Hello from Widget!');
    const [response, setResponse] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        const store = useAiServicesStore.getState();
        const instances = store.data.instances;
        
        if (instances.length === 0) {
            setResponse('Error: No AI instances found. Please add one in AI Services settings.');
            return;
        }
        
        // Find any instance
        const instance = instances[0];
        
        // Find an existing session or create a new one
        let session = store.data.sessions.find(s => s.instanceId === instance.id);
        if (!session) {
            session = aiManager.createSession(instance.id, 'Widget Chat');
        }

        setIsSending(true);
        setResponse('Sending...');
        try {
            const aiMessage = await aiManager.sendMessage(instance.id, session.id, message);
            setResponse(aiMessage.content);
        } catch (e: any) {
            setResponse('Error: ' + e.message);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#1e1e1e] rounded-xl p-4 text-white overflow-hidden shadow-lg border border-white/10">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span>✨</span> AI Assistant
            </h2>
            
            <div className="flex-1 bg-black/30 rounded-lg p-3 mb-4 overflow-y-auto text-sm whitespace-pre-wrap font-sans">
                {response || 'Ask me anything...'}
            </div>

            <div className="flex flex-col gap-2">
                <input 
                    type="text" 
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Type a message..."
                    onKeyDown={e => e.key === 'Enter' && !isSending && handleSend()}
                />
                
                <div className="flex gap-2">
                    <button 
                        onClick={handleSend}
                        disabled={isSending}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-md py-2 text-sm font-semibold transition-colors"
                    >
                        {isSending ? 'Sending...' : 'Send to AI'}
                    </button>
                </div>
            </div>
        </div>
    );
}
