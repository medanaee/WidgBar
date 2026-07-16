import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
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

    // 2. Prepare the empty AI message with streamingEventId
    const eventId = crypto.randomUUID();
    const aiMessageId = crypto.randomUUID();
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: "", // Will be filled
      timestamp: Date.now(),
      streamingEventId: eventId
    };

    const updatedWithAi = [...updatedMessages, aiMessage];
    store.updateSession(sessionId, { messages: updatedWithAi, updatedAt: Date.now() });

    // 3. Call the provider using the streaming interface
    let aiResponseContent = "";
    try {
      aiResponseContent = await this.callApiProviderStream(
        provider.id, 
        instance.apiKey, 
        updatedMessages, 
        session.model,
        instance.temperature,
        instance.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        eventId
      );
    } catch (e: any) {
      aiResponseContent = `Error: ${e.message}`;
    }

    // 4. Save the full completed message and remove streaming state
    const storeAfter = useAiServicesStore.getState();
    const sessionAfter = storeAfter.data.sessions.find(s => s.id === sessionId);
    if (sessionAfter) {
      const finalMessages = sessionAfter.messages.map(m => 
        m.id === aiMessageId ? { ...m, content: aiResponseContent, streamingEventId: undefined } : m
      );
      storeAfter.updateSession(sessionId, { messages: finalMessages, updatedAt: Date.now() });
    }

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

  private async callApiProviderStream(
    providerId: string, 
    apiKey: string | undefined, 
    messages: ChatMessage[],
    model: string | undefined,
    temperature: number | undefined,
    systemPrompt: string,
    eventId: string
  ): Promise<string> {
    if (!apiKey) throw new Error("API Key is missing");

    const requestMessages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    let fullText = "";

    return new Promise((resolve, reject) => {
      let unlistenChunk: UnlistenFn;
      let unlistenClose: UnlistenFn;

      const cleanup = () => {
        if (unlistenChunk) unlistenChunk();
        if (unlistenClose) unlistenClose();
      };

      const onChunk = (payload: any) => {
        const line = payload as string;
        let textPart = "";
        
        try {
          if (providerId === 'gemini-api') {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.substring(6));
              textPart = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            }
          } else {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              const data = JSON.parse(line.substring(6));
              textPart = data.choices?.[0]?.delta?.content || "";
            }
          }
        } catch (e) {
          // ignore parsing error for partial lines
        }

        if (textPart) {
          fullText += textPart;
          window.dispatchEvent(new CustomEvent(`ai-text-${eventId}`, { detail: textPart }));
        }
      };

      listen(`ai-chunk-${eventId}`, (event) => onChunk(event.payload)).then(u => unlistenChunk = u);
      listen(`ai-close-${eventId}`, () => {
        cleanup();
        resolve(fullText);
      }).then(u => unlistenClose = u);

      let promise;
      if (providerId === 'openai-api') {
        promise = invoke('stream_ai_request', {
          url: 'https://api.openai.com/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: {
            model: model || 'gpt-4o',
            messages: requestMessages,
            temperature: temperature ?? 0.7,
            stream: true
          },
          eventId
        });
      } else if (providerId === 'gemini-api') {
        const formattedContents = messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
        const geminiModel = model || 'gemini-1.5-flash';
        
        const requestBody: any = {
          contents: formattedContents,
          generationConfig: {
             ...(temperature !== undefined && { temperature })
          }
        };
        if (systemPrompt) requestBody.systemInstruction = { parts: [{ text: systemPrompt }] };

        promise = invoke('stream_ai_request', {
          url: `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
          eventId
        });
      } else if (providerId === 'deepseek-api') {
        promise = invoke('stream_ai_request', {
          url: 'https://api.deepseek.com/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: {
            model: model || 'deepseek-chat',
            messages: requestMessages,
            temperature: temperature ?? 0.7,
            stream: true
          },
          eventId
        });
      } else if (providerId === 'nvidia-api') {
        promise = invoke('stream_ai_request', {
          url: 'https://integrate.api.nvidia.com/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: {
            model: model || 'meta/llama-3.1-8b-instruct',
            messages: requestMessages,
            temperature: temperature ?? 0.7,
            stream: true
          },
          eventId
        });
      } else {
        promise = Promise.reject(new Error(`Provider ${providerId} API not implemented yet.`));
      }

      promise.catch(err => {
        cleanup();
        reject(new Error(err as string));
      });
    });
  }
}

export const aiManager = new AiServicesManager();
