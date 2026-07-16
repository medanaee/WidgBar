import { invoke } from '@tauri-apps/api/core';
import { useAiServicesStore } from '../stores/aiServicesStore';
import { AI_PROVIDERS, AiServiceInstance, ChatMessage, ChatSession } from '../types/ai';

class AiServicesManager {
  
  // Create a new chat session for a given instance
  public createSession(instanceId: string, title: string = "New Chat"): ChatSession {
    const store = useAiServicesStore.getState();
    const instance = store.data.instances.find(i => i.id === instanceId);
    
    const session: ChatSession = {
      id: crypto.randomUUID(),
      instanceId,
      title,
      messages: [],
      model: instance?.model,
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

    // 2. Call the provider (API via Rust Proxy to bypass CORS)
    let aiResponseContent = "";

    try {
      aiResponseContent = await this.callApiProvider(
        provider.id, 
        instance.apiKey, 
        updatedMessages, 
        session.model,
        instance.temperature
      );
    } catch (e: any) {
      aiResponseContent = `Error: ${e.message}`;
    }

    // 3. Simulate streaming/typewriter by writing to the store word by word
    const aiMessageId = crypto.randomUUID();
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    // Add empty message first
    const messagesWithEmptyAi = [...updatedMessages, aiMessage];
    store.updateSession(sessionId, { 
      messages: messagesWithEmptyAi, 
      updatedAt: Date.now() 
    });

    if (aiResponseContent.startsWith('Error:')) {
      const updatedWithError = messagesWithEmptyAi.map(m => 
        m.id === aiMessageId ? { ...m, content: aiResponseContent } : m
      );
      store.updateSession(sessionId, { messages: updatedWithError });
      aiMessage.content = aiResponseContent;
      return aiMessage;
    }

    const words = aiResponseContent.split(' ');
    let currentText = '';
    
    for (let i = 0; i < words.length; i++) {
        currentText += (i === 0 ? '' : ' ') + words[i];
        
        const currentSessionState = useAiServicesStore.getState().data.sessions.find(s => s.id === sessionId);
        if (currentSessionState) {
            const updatedWithTokens = currentSessionState.messages.map(m => 
                m.id === aiMessageId ? { ...m, content: currentText } : m
            );
            store.updateSession(sessionId, { messages: updatedWithTokens });
        }
        await new Promise(resolve => setTimeout(resolve, 20));
    }

    aiMessage.content = aiResponseContent;
    return aiMessage;
  }

  private async callApiProvider(
    providerId: string, 
    apiKey: string | undefined, 
    messages: ChatMessage[],
    model?: string,
    temperature?: number
  ): Promise<string> {
    if (!apiKey) throw new Error("API Key is missing");

    if (providerId === 'openai-api') {
      const data = await invoke<any>('proxy_request', {
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: {
          model: model || 'gpt-4o',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: temperature ?? 0.7
        }
      });
      if (!data?.choices?.[0]?.message) {
        throw new Error(data?.error?.message || "Invalid response structure from OpenAI API");
      }
      return data.choices[0].message.content;
    } 
    
    if (providerId === 'gemini-api') {
      const formattedContents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      const geminiModel = model || 'gemini-1.5-flash';
      
      const generationConfig: any = {};
      if (temperature !== undefined) {
        generationConfig.temperature = temperature;
      }
      
      const data = await invoke<any>('proxy_request', {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          contents: formattedContents,
          generationConfig
        }
      });
      if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error(data?.error?.message || "Invalid response structure from Gemini API");
      }
      return data.candidates[0].content.parts[0].text;
    }

    if (providerId === 'deepseek-api') {
      const data = await invoke<any>('proxy_request', {
        url: 'https://api.deepseek.com/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: {
          model: model || 'deepseek-chat',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: temperature ?? 0.7
        }
      });
      if (!data?.choices?.[0]?.message) {
        throw new Error(data?.error?.message || "Invalid response structure from DeepSeek API");
      }
      return data.choices[0].message.content;
    }

    if (providerId === 'nvidia-api') {
      const data = await invoke<any>('proxy_request', {
        url: 'https://integrate.api.nvidia.com/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: {
          model: model || 'meta/llama-3.1-8b-instruct',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: temperature ?? 0.7
        }
      });
      if (!data?.choices?.[0]?.message) {
        throw new Error(data?.error?.message || "Invalid response structure from NVIDIA NIM. Check model requirements.");
      }
      return data.choices[0].message.content;
    }
    
    throw new Error(`Provider ${providerId} API not implemented yet.`);
  }
}

export const aiManager = new AiServicesManager();
