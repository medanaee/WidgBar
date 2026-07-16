import { invoke } from '@tauri-apps/api/core';
import { useAiServicesStore } from '../stores/aiServicesStore';
import { AI_PROVIDERS, AiServiceInstance, ChatMessage, ChatSession } from '../types/ai';

export const DEFAULT_SYSTEM_PROMPT = 
  "You are a helpful assistant. Respond using well-formatted Markdown. " +
  "For mathematical equations, always use LaTeX syntax: use $...$ for inline math (e.g. $E=mc^2$) " +
  "and $$...$$ for block display equations on separate lines (e.g. $$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$). " +
  "Always keep code blocks and math LTR.";

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
        instance.temperature,
        instance.systemPrompt || DEFAULT_SYSTEM_PROMPT
      );
    } catch (e: any) {
      aiResponseContent = `Error: ${e.message}`;
    }

    // 3. Save the full completed message immediately with typing: true
    const aiMessageId = crypto.randomUUID();
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: aiResponseContent,
      timestamp: Date.now(),
      typing: !aiResponseContent.startsWith('Error:'), // Only animate if it's not an error
    };

    const finalMessages = [...updatedMessages, aiMessage];
    store.updateSession(sessionId, { 
      messages: finalMessages, 
      updatedAt: Date.now() 
    });

    return aiMessage;
  }

  // Set typing: false after animation finishes
  public finishTyping(sessionId: string, messageId: string) {
    const store = useAiServicesStore.getState();
    const session = store.data.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const updated = session.messages.map(m => 
      m.id === messageId ? { ...m, typing: false } : m
    );
    store.updateSession(sessionId, { messages: updated });
  }

  private async callApiProvider(
    providerId: string, 
    apiKey: string | undefined, 
    messages: ChatMessage[],
    model?: string,
    temperature?: number,
    systemPrompt?: string
  ): Promise<string> {
    if (!apiKey) throw new Error("API Key is missing");

    const requestMessages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

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
          messages: requestMessages,
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
      
      const requestBody: any = {
        contents: formattedContents,
        generationConfig
      };

      if (systemPrompt) {
        requestBody.systemInstruction = {
          parts: [{ text: systemPrompt }]
        };
      }
      
      const data = await invoke<any>('proxy_request', {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: requestBody
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
          messages: requestMessages,
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
          messages: requestMessages,
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
