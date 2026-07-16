import { useState } from "react";
import { AiProvider, AI_PROVIDERS, AiServiceInstance } from "../../types/ai";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ArrowLeft, Webhook } from "lucide-react";
import { DEFAULT_SYSTEM_PROMPT } from "../../lib/AiServicesManager";

interface AddAiServicePanelProps {
  onBack: () => void;
  onSave: (newInstance: AiServiceInstance) => void;
}

export default function AddAiServicePanel({ onBack, onSave }: AddAiServicePanelProps) {
  const [providerId, setProviderId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);

  const handleAdd = () => {
    if (!providerId || !name) return;
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return;

    const newInstance: AiServiceInstance = {
      id: crypto.randomUUID(),
      providerId,
      name,
      systemPrompt,
      createdAt: Date.now(),
    };

    if (provider.type === 'api') {
      newInstance.apiKey = apiKey;
    }

    onSave(newInstance);
  };

  return (
    <div className="max-w-xl w-full self-center h-full flex flex-col animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={onBack}
          className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-500/10 rounded-md transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Add AI Service</h2>
          <p className="text-xs text-zinc-500">Configure a new AI provider instance</p>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar pb-6 space-y-5 text-zinc-800 dark:text-zinc-200">
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-500 font-medium">Provider</label>
          <Select value={providerId} onValueChange={setProviderId}>
            <SelectTrigger className="w-full bg-transparent border-zinc-500/20 text-zinc-800 dark:text-zinc-200">
              <SelectValue placeholder="Select a Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {AI_PROVIDERS.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <Webhook className="w-3.5 h-3.5 text-blue-500" />
                      {p.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-500 font-medium">Custom Name (e.g. My ChatGPT)</label>
          <Input 
            placeholder="Name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            className="bg-transparent border-zinc-500/20"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-zinc-500 font-medium">API Key</label>
          <Input 
            type="password"
            placeholder="sk-..." 
            value={apiKey} 
            onChange={e => setApiKey(e.target.value)} 
            className="bg-transparent border-zinc-500/20"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-zinc-500 font-medium">System Prompt</label>
          <textarea
            placeholder="You are a helpful assistant..."
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            className="w-full min-h-[120px] bg-transparent border border-zinc-500/20 dark:border-white/10 rounded-md p-2.5 text-xs focus:outline-none focus:border-zinc-500/40 dark:text-white font-sans scrollbar-thin resize-y"
          />
          <p className="text-[10px] text-zinc-500">
            System prompts define the assistant's personality, rules, or formatting preferences.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-zinc-500/10 dark:border-white/5">
        <Button variant="ghost" onClick={onBack}>Cancel</Button>
        <Button onClick={handleAdd} disabled={!providerId || !name}>Save Service</Button>
      </div>
    </div>
  );
}
