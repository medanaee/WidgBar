import { invoke } from '@tauri-apps/api/core';
import { useAiServicesStore } from '../stores/aiServicesStore';
import { AI_PROVIDERS, AiServiceInstance, ChatMessage, ChatSession } from '../types/ai';

class AiServicesManager {
  
  // Create a new chat session for a given instance
  public createSession(instanceId: string, title: string = "New Chat"): ChatSession {
    const session: ChatSession = {
      id: crypto.randomUUID(),
      instanceId,
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    useAiServicesStore.getState().addSession(session);
    return session;
  }

  // Send a message via an instance (API or Web)
  public async sendMessage(
    instanceId: string, 
    sessionId: string, 
    content: string
  ): Promise<ChatMessage> {
    const store = useAiServicesStore.getState();
    const instance = store.data.instances.find(i => i.id === instanceId);
    const session = store.data.sessions.find(s => s.id === sessionId);

    if (!instance) throw new Error("AI Instance not found");
    if (!session) throw new Error("Session not found");

    const provider = AI_PROVIDERS.find(p => p.id === instance.providerId);
    if (!provider) throw new Error("Provider not found");

    // 1. Add User Message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const updatedMessages = [...session.messages, userMessage];
    store.updateSession(sessionId, { messages: updatedMessages, updatedAt: Date.now() });

    // 2. Call the provider (API only now)
    let aiResponseContent = "";

    try {
      aiResponseContent = await this.callApiProvider(provider.id, instance.apiKey, updatedMessages);
    } catch (e: any) {
      aiResponseContent = `Error: ${e.message}`;
    }

    // 3. Add AI Message
    const aiMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: aiResponseContent,
      timestamp: Date.now(),
    };

    store.updateSession(sessionId, { 
      messages: [...updatedMessages, aiMessage], 
      updatedAt: Date.now() 
    });

    return aiMessage;
  }

  private async callApiProvider(providerId: string, apiKey: string | undefined, messages: ChatMessage[]): Promise<string> {
    if (!apiKey) throw new Error("API Key is missing");

    if (providerId === 'openai-api') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o', // or gpt-3.5-turbo
          messages: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });
      if (!response.ok) throw new Error(`OpenAI Error: ${response.statusText}`);
      const data = await response.json();
      return data.choices[0].message.content;
    } 
    
    if (providerId === 'deepseek-api') {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: messages.map(m => ({ role: m.role, content: m.content }))
          })
        });
        if (!response.ok) throw new Error(`DeepSeek Error: ${response.statusText}`);
        const data = await response.json();
        return data.choices[0].message.content;
      }
    
    throw new Error(`Provider ${providerId} API not implemented yet.`);
  }
}

export const aiManager = new AiServicesManager();
