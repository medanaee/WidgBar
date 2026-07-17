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
  content: string;
  timestamp: number;
  typing?: boolean;
  streamingEventId?: string;
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
