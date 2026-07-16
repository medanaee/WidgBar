export type AiProviderType = 'api' | 'web';

export interface AiProvider {
  id: string;
  name: string;
  type: AiProviderType;
  description: string;
  icon?: string;
  url?: string; // Target URL for web providers
}

export interface AiServiceInstance {
  id: string;
  providerId: string;
  name: string;
  apiKey?: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  instanceId: string;
  title: string;
  messages: ChatMessage[];
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
    id: 'gemini-web',
    name: 'Gemini Web',
    type: 'web',
    description: 'Log in to Gemini via web interface.',
    url: 'https://gemini.google.com/app',
  },
  {
    id: 'chatgpt-web',
    name: 'ChatGPT Web',
    type: 'web',
    description: 'Log in to ChatGPT via web interface.',
    url: 'https://chatgpt.com/',
  },
  {
    id: 'claude-web',
    name: 'Claude Web',
    type: 'web',
    description: 'Log in to Claude via web interface.',
    url: 'https://claude.ai/new',
  }
];
