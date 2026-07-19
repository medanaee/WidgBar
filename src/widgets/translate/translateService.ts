import { invoke } from '@tauri-apps/api/core';
import { aiManager } from '../../lib/AiServicesManager';
import { langNameEn, TranslateTone } from './languages';

function buildSystemPrompt(
  sourceLang: string,
  targetLang: string,
  tone: TranslateTone,
  _uiLang: string
): string {
  const sourceName =
    sourceLang === 'auto'
      ? 'the source language (auto-detect)'
      : langNameEn(sourceLang);
  const targetName = langNameEn(targetLang);

  let prompt =
    `You are a precise translator. Translate the user's text from ${sourceName} to ${targetName}. ` +
    `Respond with ONLY the translated text. No explanations, no quotes, no preamble, no notes.`;

  if (sourceLang === 'auto') {
    prompt += ` Automatically detect the source language.`;
  }

  switch (tone) {
    case 'formal':
      prompt += ` Use a formal, polite register suitable for professional or official contexts.`;
      break;
    case 'casual':
      prompt += ` Use a casual, conversational register as people speak every day.`;
      break;
    case 'literary':
      prompt += ` Use an elegant, literary style with rich wording when natural.`;
      break;
    case 'technical':
      prompt += ` Prefer precise technical terminology and keep domain terms accurate.`;
      break;
    case 'friendly':
      prompt += ` Use a warm, friendly tone while staying natural.`;
      break;
    case 'default':
    default:
      break;
  }

  return prompt;
}

function parseGoogleResponse(data: any): string {
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Unexpected Google Translate response');
  }
  return data[0]
    .map((part: any) => (Array.isArray(part) ? part[0] : ''))
    .filter(Boolean)
    .join('');
}

export async function translateWithGoogle(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const sl = sourceLang || 'auto';
  const tl = targetLang || 'en';
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx` +
    `&sl=${encodeURIComponent(sl)}` +
    `&tl=${encodeURIComponent(tl)}` +
    `&dt=t&q=${encodeURIComponent(text)}`;

  const data = await invoke<any>('proxy_request', {
    url,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json',
    },
  });

  return parseGoogleResponse(data);
}

export async function translateWithAi(
  text: string,
  sourceLang: string,
  targetLang: string,
  tone: TranslateTone,
  instanceId: string,
  model: string | undefined,
  uiLang: string
): Promise<string> {
  return aiManager.promptOnce(instanceId, {
    content: text,
    model,
    systemPrompt: buildSystemPrompt(sourceLang, targetLang, tone, uiLang),
    temperature: 0.3,
    reasoningEffort: false,
    stripReasoning: true,
  });
}

export interface TranslateOptions {
  text: string;
  sourceLang: string;
  targetLang: string;
  useAi: boolean;
  tone: TranslateTone;
  aiInstanceId?: string;
  aiModel?: string;
  uiLang?: string;
}

export async function translateText(options: TranslateOptions): Promise<string> {
  const trimmed = options.text.trim();
  if (!trimmed) return '';

  if (options.useAi) {
    if (!options.aiInstanceId) throw new Error('Select an AI service first');
    return translateWithAi(
      trimmed,
      options.sourceLang,
      options.targetLang,
      options.tone,
      options.aiInstanceId,
      options.aiModel,
      options.uiLang || 'en'
    );
  }

  return translateWithGoogle(trimmed, options.sourceLang, options.targetLang);
}
