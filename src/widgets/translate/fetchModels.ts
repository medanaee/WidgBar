import { invoke } from '@tauri-apps/api/core';
import { AiServiceInstance } from '../../types/ai';

export async function fetchModelsForInstance(instance: AiServiceInstance): Promise<string[]> {
  const providerId = instance.providerId;
  const apiKey = instance.apiKey;

  if (providerId === 'nvidia-api' && apiKey) {
    const resData = await invoke<any>('proxy_request', {
      url: 'https://integrate.api.nvidia.com/v1/models',
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (resData && Array.isArray(resData.data)) {
      return resData.data
        .map((m: any) => m.id)
        .filter(
          (id: string) =>
            !id.includes('embed') &&
            !id.includes('rerank') &&
            !id.includes('similarity') &&
            !id.includes('vl')
        );
    }
    return [];
  }

  if (providerId === 'openai-api' && apiKey) {
    const resData = await invoke<any>('proxy_request', {
      url: 'https://api.openai.com/v1/models',
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (resData && Array.isArray(resData.data)) {
      return resData.data.map((m: any) => m.id).filter((id: string) => id.includes('gpt'));
    }
    return [];
  }

  if (providerId === 'groq-api' && apiKey) {
    const resData = await invoke<any>('proxy_request', {
      url: 'https://api.groq.com/openai/v1/models',
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (resData && Array.isArray(resData.data)) {
      return resData.data.map((m: any) => m.id).filter((id: string) => !id.includes('whisper'));
    }
    return [];
  }

  if (providerId === 'deepseek-api') {
    return ['deepseek-chat', 'deepseek-reasoner'];
  }

  if (providerId === 'gemini-api') {
    return ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
  }

  return [];
}
