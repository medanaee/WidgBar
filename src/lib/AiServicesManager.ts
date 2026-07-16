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

    // 2. Call the provider (API or Web)
    let aiResponseContent = "";

    try {
      if (provider.type === 'api') {
        aiResponseContent = await this.callApiProvider(provider.id, instance.apiKey, updatedMessages);
      } else {
        aiResponseContent = await this.callWebProvider(instanceId, provider.id, content);
      }
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

  private async callWebProvider(instanceId: string, providerId: string, content: string): Promise<string> {
    if (providerId !== 'gemini-web') {
      return `Automation for ${providerId} is not yet implemented. Please use Gemini Web or open the chat manually.`;
    }

    // Ensure the popup exists
    const url = AI_PROVIDERS.find(p => p.id === providerId)?.url || 'https://gemini.google.com/app';
    await invoke('create_locked_popup', { id: instanceId, url });

    return new Promise((resolve, reject) => {
      let unlisten: any = null;
      let timeout: any = null;

      const cleanup = () => {
        if (unlisten) unlisten();
        if (timeout) clearTimeout(timeout);
      };

      // Listen for the response from Rust
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<string>('ai-response-received', (event) => {
          try {
            const data = JSON.parse(event.payload);
            if (data.instanceId === instanceId) {
              cleanup();
              resolve(data.text);
            }
          } catch (e) {
            console.error("Failed to parse AI response payload", e);
          }
        }).then(u => { unlisten = u; });
      });

      // Timeout after 60 seconds
      timeout = setTimeout(() => {
        cleanup();
        reject(new Error("AI response timed out"));
      }, 60000);

      // Construct the JS injection script for Gemini
      const script = `
        (async () => {
          try {
            // 1. Find the input box
            const inputBox = document.querySelector('rich-textarea div[contenteditable="true"]') || document.querySelector('textarea');
            if (!inputBox) throw new Error("Input box not found");
            
            // 2. Focus and set text
            inputBox.focus();
            if (inputBox.tagName.toLowerCase() === 'textarea') {
              inputBox.value = ${JSON.stringify(content)};
            } else {
              inputBox.textContent = ${JSON.stringify(content)};
            }
            
            // Trigger input event to enable the send button
            inputBox.dispatchEvent(new Event('input', { bubbles: true }));
            
            // 3. Find and click send button
            await new Promise(r => setTimeout(r, 500));
            const sendBtn = document.querySelector('button[aria-label*="Send message"], button[aria-label*="ارسال"]');
            if (sendBtn) {
              sendBtn.click();
            } else {
              // Try pressing enter
              inputBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
            }

            // 4. Wait for response to generate
            // Gemini shows a generating indicator. We poll until the response is stable.
            let lastResponseText = "";
            let stableCount = 0;
            
            const poll = setInterval(() => {
              const responses = document.querySelectorAll('message-content');
              if (responses.length > 0) {
                const latestResponse = responses[responses.length - 1].textContent.trim();
                
                // If it's still generating, the text might change or there's a loading spinner
                // We just assume if text stays same for 3 seconds, it's done.
                if (latestResponse === lastResponseText && latestResponse.length > 0) {
                  stableCount++;
                  if (stableCount >= 6) { // 3 seconds (6 * 500ms)
                    clearInterval(poll);
                    
                    // Send back to Rust
                    const payload = JSON.stringify({ instanceId: "${instanceId}", text: latestResponse });
                    document.title = "__WIDGBAR_AI_RES:" + payload;
                  }
                } else {
                  lastResponseText = latestResponse;
                  stableCount = 0;
                }
              }
            }, 500);

          } catch (e) {
            document.title = "__WIDGBAR_AI_RES:" + JSON.stringify({ instanceId: "${instanceId}", text: "Error: " + e.message });
          }
        })();
      `;

      invoke('execute_js_in_popup', { id: instanceId, script }).catch(e => {
        cleanup();
        reject(e);
      });
    });
  }
}

export const aiManager = new AiServicesManager();
