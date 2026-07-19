import { aiManager } from '../../lib/AiServicesManager';
import { useAiServicesStore } from '../../stores/aiServicesStore';
import { useWidgetRegistryStore } from '../../stores/widgetRegistryStore';

export interface ClipboardAiTarget {
  instanceId: string;
  sessionId: string;
}

/**
 * Resolve clipboard's global AI instance + session.
 * Creates a default "Clipboard" session when none is selected / missing.
 */
export function resolveClipboardAiTarget(): ClipboardAiTarget {
  const registry = useWidgetRegistryStore.getState();
  const settings = registry.settings['clipboard'] || {};
  const { instances, sessions } = useAiServicesStore.getState().data;

  if (instances.length === 0) {
    throw new Error('No AI service configured');
  }

  let instanceId = settings.aiInstanceId;
  if (!instanceId || !instances.some((i) => i.id === instanceId)) {
    instanceId = instances[0].id;
  }

  const instanceSessions = sessions.filter((s) => s.instanceId === instanceId);
  let sessionId = settings.aiSessionId;
  if (!sessionId || !instanceSessions.some((s) => s.id === sessionId)) {
    const existing = instanceSessions.find((s) => s.title === 'Clipboard');
    if (existing) {
      sessionId = existing.id;
    } else {
      sessionId = aiManager.createSession(instanceId, 'Clipboard').id;
    }
  }

  // Persist resolved ids so settings UI stays in sync
  if (settings.aiInstanceId !== instanceId || settings.aiSessionId !== sessionId) {
    registry.updateWidgetType('clipboard', { aiInstanceId: instanceId, aiSessionId: sessionId });
  }

  return { instanceId, sessionId };
}
