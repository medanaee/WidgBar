export type AiProviderType = 'api';

export interface AiProvider {
  id: string;
  name: string;
  type: AiProviderType;
  description: string;
  icon?: string;
}

export interface AiServiceInstance {
  id: string;
  providerId: string;
  name: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  systemPrompt?: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  /** Visible prompt text (attachments are separate chips in the UI). */
  content: string;
  /** Attachments shown as chips; still included when talking to the model. */
  attachments?: SessionAttachment[];
  timestamp: number;
  typing?: boolean;
  streamingEventId?: string;
}

/** Attachment sitting in a session's unsent draft (injected by widgets or added manually). */
export type SessionAttachmentKind = 'text' | 'file';

export interface SessionAttachment {
  id: string;
  kind: SessionAttachmentKind;
  /** Short label shown on the chip */
  name: string;
  /** Text body, or file path / placeholder for files */
  content: string;
  mimeType?: string;
  createdAt: number;
}

/** Per-session composer state — prompt + attachments before send */
export interface SessionDraft {
  prompt: string;
  attachments: SessionAttachment[];
}

/** Stable empty draft — never allocate a new object in Zustand selectors */
export const EMPTY_SESSION_DRAFT: SessionDraft = Object.freeze({
  prompt: '',
  attachments: Object.freeze([]) as unknown as SessionAttachment[],
}) as SessionDraft;

export function emptySessionDraft(): SessionDraft {
  return { prompt: '', attachments: [] };
}

export interface ChatSession {
  id: string;
  instanceId: string;
  title: string;
  messages?: ChatMessage[];
  model?: string;
  updatedAt: number;
  createdAt: number;
}

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: 'openai-api',
    name: 'OpenAI API',
    type: 'api',
    description: 'Use OpenAI API directly with your API Key.',
  },
  {
    id: 'gemini-api',
    name: 'Google Gemini API',
    type: 'api',
    description: 'Use Gemini API directly with your API Key.',
  },
  {
    id: 'deepseek-api',
    name: 'DeepSeek API',
    type: 'api',
    description: 'Use DeepSeek API directly with your API Key.',
  },
  {
    id: 'nvidia-api',
    name: 'NVIDIA NIM API',
    type: 'api',
    description: 'Use NVIDIA Inference Microservice API (NIM) directly with your API Key.',
  },
  {
    id: 'groq-api',
    name: 'Groq API',
    type: 'api',
    description: 'Use Groq API directly with your API Key.',
  }
];
