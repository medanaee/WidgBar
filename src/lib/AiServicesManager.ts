import { invoke } from '@tauri-apps/api/core';
import { listen, emit, UnlistenFn } from '@tauri-apps/api/event';
import { useAiServicesStore } from '../stores/aiServicesStore';
import {
  AI_PROVIDERS,
  ChatMessage,
  ChatSession,
  SessionAttachment,
  SessionAttachmentKind,
} from '../types/ai';

export const DEFAULT_SYSTEM_PROMPT = 
  "You are a helpful assistant. Respond using well-formatted Markdown. " +
  "For mathematical equations, always use LaTeX syntax: use $...$ for inline math (e.g. $E=mc^2$) " +
  "and $$...$$ for block display equations on separate lines (e.g. $$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$). " +
  "Always keep code blocks and math LTR.";

/** Options for one-shot (ephemeral) AI calls that never touch sessions/messages in DB */
export interface PromptOnceOptions {
  /** User message to send */
  content: string;
  /** Override model; falls back to instance.model */
  model?: string;
  /** Override temperature; falls back to instance.temperature */
  temperature?: number;
  /** Override system prompt; falls back to instance.systemPrompt then DEFAULT_SYSTEM_PROMPT */
  systemPrompt?: string;
  /** Override reasoning effort; falls back to instance.reasoningEffort. Pass false to force off. */
  reasoningEffort?: 'low' | 'medium' | 'high' | false;
  /**
   * Optional prior turns (not persisted).
   * The `content` field is always appended as the final user message.
   */
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  /** Strip think / reasoning blocks from the reply. Default: true */
  stripReasoning?: boolean;
}

export type AddAttachInput = {
  kind: SessionAttachmentKind;
  name: string;
  content: string;
  mimeType?: string;
};

function stripReasoningBlocks(text: string): string {
  return text
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/<thinking>[\s\S]*?(?:<\/thinking>|$)/gi, '')
    .replace(/<reasoning>[\s\S]*?(?:<\/reasoning>|$)/gi, '')
    .trim();
}

/** Build the user message string from draft prompt + attachments */
export function composeDraftContent(prompt: string, attachments: SessionAttachment[]): string {
  const parts: string[] = [];
  for (const att of attachments) {
    if (att.kind === 'text') {
      parts.push(`--- Attachment: ${att.name} ---\n${att.content}`);
    } else {
      parts.push(`--- File: ${att.name}${att.mimeType ? ` (${att.mimeType})` : ''} ---\n${att.content}`);
    }
  }
  const trimmed = prompt.trim();
  if (trimmed) parts.push(trimmed);
  return parts.join('\n\n').trim();
}

class AiServicesManager {
  
  // Create a new chat session for a given instance
  public createSession(instanceId: string, title: string = "New Chat"): ChatSession {
    const store = useAiServicesStore.getState();
    const instance = store.data.instances.find(i => i.id === instanceId);
    
    const session: ChatSession = {
      id: crypto.randomUUID(),
      instanceId,
      title,
      model: instance?.model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    useAiServicesStore.getState().addSession(session);
    return session;
  }

  /**
   * Update the unsent prompt text for a session draft.
   */
  public updateMessage(sessionId: string, prompt: string): void {
    const store = useAiServicesStore.getState();
    if (!store.data.sessions.find(s => s.id === sessionId)) {
      throw new Error('Session not found');
    }
    store.patchSessionDraft(sessionId, { prompt });
  }

  /**
   * Add an attachment (text snippet or file placeholder) to a session draft.
   * Other widgets call this to inject content into a chat session.
   */
  public addAttach(sessionId: string, input: AddAttachInput): SessionAttachment {
    const store = useAiServicesStore.getState();
    if (!store.data.sessions.find(s => s.id === sessionId)) {
      throw new Error('Session not found');
    }
    const draft = store.getSessionDraft(sessionId);
    const attachment: SessionAttachment = {
      id: crypto.randomUUID(),
      kind: input.kind,
      name: input.name.trim() || (input.kind === 'file' ? 'File' : 'Note'),
      content: input.content,
      mimeType: input.mimeType,
      createdAt: Date.now(),
    };
    store.patchSessionDraft(sessionId, {
      attachments: [...draft.attachments, attachment],
    });
    return attachment;
  }

  /** Clear all draft attachments for a session (keeps the prompt). */
  public clearAttachments(sessionId: string): void {
    const store = useAiServicesStore.getState();
    if (!store.data.sessions.find(s => s.id === sessionId)) {
      throw new Error('Session not found');
    }
    store.patchSessionDraft(sessionId, { attachments: [] });
  }

  /**
   * Send the current session draft (prompt + all attachments) and clear the draft.
   * Uses the same streaming path as sendMessage.
   */
  public async send(instanceId: string, sessionId: string): Promise<ChatMessage> {
    const store = useAiServicesStore.getState();
    const draft = store.getSessionDraft(sessionId);
    const content = composeDraftContent(draft.prompt, draft.attachments);
    if (!content) {
      throw new Error('Draft is empty');
    }
    // Clear immediately on send so the composer empties before streaming finishes
    store.clearSessionDraft(sessionId);
    return this.sendMessage(instanceId, sessionId, content);
  }

  /**
   * One-shot completion against an AI instance without creating/updating any session or messages.
   * Uses the instance mainly for apiKey + provider; any omitted option falls back to instance defaults.
   */
  public async promptOnce(instanceId: string, options: PromptOnceOptions): Promise<string> {
    const store = useAiServicesStore.getState();
    const instance = store.data.instances.find(i => i.id === instanceId);
    if (!instance) throw new Error("AI Instance not found");
    if (!instance.apiKey) throw new Error("API Key is missing");

    const provider = AI_PROVIDERS.find(p => p.id === instance.providerId);
    if (!provider) throw new Error("Provider not found");

    const model = options.model ?? instance.model;
    if (!model) throw new Error("No model specified");

    const temperature = options.temperature ?? instance.temperature ?? 0.7;
    const systemPrompt =
      options.systemPrompt ?? instance.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    // Explicit false disables reasoning; otherwise prefer override, then instance default
    const reasoningEffort =
      options.reasoningEffort === false
        ? undefined
        : options.reasoningEffort !== undefined
          ? options.reasoningEffort
          : instance.reasoningEffort;
    const stripReasoning = options.stripReasoning !== false;

    const history = (options.messages || []).filter(m => m.role !== 'system');
    const messages: ChatMessage[] = [
      ...history.map((m, i) => ({
        id: `ephemeral_${i}`,
        role: m.role as ChatMessage['role'],
        content: m.content,
        timestamp: Date.now(),
      })),
      {
        id: 'ephemeral_user',
        role: 'user' as const,
        content: options.content,
        timestamp: Date.now(),
      },
    ];

    const raw = await this.callApiProviderOnce(
      provider.id,
      instance.apiKey,
      messages,
      model,
      temperature,
      systemPrompt,
      reasoningEffort
    );

    const cleaned = stripReasoning ? stripReasoningBlocks(raw) : raw.trim();
    if (!cleaned) throw new Error("Empty AI response");
    return cleaned;
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

    await store.addMessageToSession(sessionId, userMessage);
    await store.updateSession(sessionId, { updatedAt: Date.now() });

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

    await store.addMessageToSession(sessionId, aiMessage);
    
    // Ensure the message list passed to the provider includes the new user message
    const currentMessages = useAiServicesStore.getState().sessionMessages[sessionId] || [];

    // 3. Call the provider using the streaming interface
    let aiResponseContent = "";
    try {
      aiResponseContent = await this.callApiProviderStream(
        provider.id, 
        instance.apiKey, 
        currentMessages, 
        session.model,
        instance.temperature,
        instance.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        eventId,
        instance.reasoningEffort
      );
    } catch (e: any) {
      aiResponseContent = `Error: ${e.message}`;
    }

    // 4. Save the full completed message and remove streaming state
    await store.updateMessageInSession(sessionId, aiMessageId, { 
        content: aiResponseContent, 
        streamingEventId: undefined 
    });
    await store.updateSession(sessionId, { updatedAt: Date.now() });

    return aiMessage;
  }

  // Set typing: false after animation finishes
  public finishTyping(sessionId: string, messageId: string) {
    const store = useAiServicesStore.getState();
    store.updateMessageInSession(sessionId, messageId, { typing: false });
  }

  /** Non-streaming one-shot provider call (no session side-effects) */
  private async callApiProviderOnce(
    providerId: string,
    apiKey: string,
    messages: ChatMessage[],
    model: string,
    temperature: number,
    systemPrompt: string,
    reasoningEffort?: 'low' | 'medium' | 'high'
  ): Promise<string> {
    const requestMessages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content })),
    ];

    const applyReasoning = (body: Record<string, unknown>, targetModel: string) => {
      if (!reasoningEffort) return;
      body.reasoning_effort = reasoningEffort;
      if (targetModel.toLowerCase().includes('glm')) {
        body.thinking = { type: 'enabled' };
      }
    };

    if (providerId === 'gemini-api') {
      const geminiModel = model || 'gemini-1.5-flash';
      const formattedContents = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      const requestBody: Record<string, unknown> = {
        contents: formattedContents,
        generationConfig: { temperature },
      };
      if (systemPrompt) {
        requestBody.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      const res = await invoke<any>('proxy_request', {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });

      const content = res?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof content !== 'string') throw new Error('Empty AI response');
      return content;
    }

    let url: string;
    let defaultModel: string;
    switch (providerId) {
      case 'openai-api':
        url = 'https://api.openai.com/v1/chat/completions';
        defaultModel = 'gpt-4o';
        break;
      case 'deepseek-api':
        url = 'https://api.deepseek.com/chat/completions';
        defaultModel = 'deepseek-chat';
        break;
      case 'groq-api':
        url = 'https://api.groq.com/openai/v1/chat/completions';
        defaultModel = 'llama-3.3-70b-specdec';
        break;
      case 'nvidia-api':
        url = 'https://integrate.api.nvidia.com/v1/chat/completions';
        defaultModel = 'meta/llama-3.1-8b-instruct';
        break;
      default:
        throw new Error(`Provider ${providerId} API not implemented yet.`);
    }

    const targetModel = model || defaultModel;
    const body: Record<string, unknown> = {
      model: targetModel,
      messages: requestMessages,
      temperature,
      stream: false,
    };
    applyReasoning(body, targetModel);

    const res = await invoke<any>('proxy_request', {
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });

    const content =
      res?.choices?.[0]?.message?.content ??
      res?.choices?.[0]?.text;
    if (typeof content !== 'string') throw new Error('Empty AI response');
    return content;
  }

  private async callApiProviderStream(
    providerId: string, 
    apiKey: string | undefined, 
    messages: ChatMessage[],
    model: string | undefined,
    temperature: number | undefined,
    systemPrompt: string,
    eventId: string,
    reasoningEffort?: 'low' | 'medium' | 'high'
  ): Promise<string> {
    if (!apiKey) throw new Error("API Key is missing");

    const requestMessages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    let fullText = "";
    let isReasoning = false;

    return new Promise((resolve, reject) => {
      let unlistenChunk: UnlistenFn;
      let unlistenClose: UnlistenFn;
      let unlistenAbort: UnlistenFn;

      const cleanup = () => {
        if (unlistenChunk) unlistenChunk();
        if (unlistenClose) unlistenClose();
        if (unlistenAbort) unlistenAbort();
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
              const delta = data.choices?.[0]?.delta;
              if (delta) {
                if (delta.reasoning_content) {
                  if (!isReasoning) {
                    isReasoning = true;
                    textPart += "<think>\n";
                  }
                  textPart += delta.reasoning_content;
                } else if (delta.content) {
                  if (isReasoning) {
                    isReasoning = false;
                    textPart += "\n</think>\n\n";
                  }
                  textPart += delta.content;
                }
              }
            }
          }
        } catch (e) {
          // ignore parsing error for partial lines
        }

        if (textPart) {
          fullText += textPart;
          emit(`ai-text-${eventId}`, textPart).catch(console.error);
        }
      };

      listen(`ai-chunk-${eventId}`, (event) => onChunk(event.payload)).then(u => unlistenChunk = u);
      listen(`ai-close-${eventId}`, () => {
        cleanup();
        resolve(fullText);
      }).then(u => unlistenClose = u);
      listen('ai-abort-stream', () => {
        cleanup();
        resolve(fullText);
      }).then(u => unlistenAbort = u);

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
            ...(reasoningEffort && { reasoning_effort: reasoningEffort }),
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
            ...(reasoningEffort && { reasoning_effort: reasoningEffort }),
            stream: true
          },
          eventId
        });
      } else if (providerId === 'groq-api') {
        promise = invoke('stream_ai_request', {
          url: 'https://api.groq.com/openai/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: {
            model: model || 'llama-3.3-70b-specdec',
            messages: requestMessages,
            temperature: temperature ?? 0.7,
            ...(reasoningEffort && { reasoning_effort: reasoningEffort }),
            stream: true
          },
          eventId
        });
      } else if (providerId === 'nvidia-api') {
        const targetModel = model || 'meta/llama-3.1-8b-instruct';
        promise = invoke('stream_ai_request', {
          url: 'https://integrate.api.nvidia.com/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: {
            model: targetModel,
            messages: requestMessages,
            temperature: temperature ?? 0.7,
            ...(reasoningEffort && { 
              reasoning_effort: reasoningEffort,
              ...(targetModel.toLowerCase().includes('glm') && { thinking: { type: "enabled" } })
            }),
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
