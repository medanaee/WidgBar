import { useState, useEffect } from "react";
import { AiServiceInstance } from "../../types/ai";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Slider } from "../ui/slider";
import { ArrowLeft } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_SYSTEM_PROMPT } from "../../lib/AiServicesManager";

interface EditAiServicePanelProps {
  instance: AiServiceInstance;
  onBack: () => void;
  onSave: (updatedFields: Partial<AiServiceInstance>) => void;
}

export default function EditAiServicePanel({ instance, onBack, onSave }: EditAiServicePanelProps) {
  const [editName, setEditName] = useState(instance.name);
  const [editApiKey, setEditApiKey] = useState(instance.apiKey || "");
  const [editModel, setEditModel] = useState(instance.model || "");
  const [editTemperature, setEditTemperature] = useState<number>(instance.temperature ?? 0.7);
  const [editSystemPrompt, setEditSystemPrompt] = useState(instance.systemPrompt || DEFAULT_SYSTEM_PROMPT);
  const [editModels, setEditModels] = useState<string[]>([]);
  const [isLoadingEditModels, setIsLoadingEditModels] = useState(false);

  useEffect(() => {
    setEditModels([]);
    setIsLoadingEditModels(true);
    
    const providerId = instance.providerId;
    const apiKey = editApiKey || instance.apiKey || "";
    
    if (providerId === 'nvidia-api' && apiKey) {
      invoke<any>('proxy_request', {
        url: 'https://integrate.api.nvidia.com/v1/models',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      .then(resData => {
        if (resData && Array.isArray(resData.data)) {
          const chatModels = resData.data
            .map((m: any) => m.id)
            .filter((id: string) => 
              !id.includes('embed') && 
              !id.includes('rerank') && 
              !id.includes('similarity') && 
              !id.includes('vl')
            );
          setEditModels(chatModels);
        }
      })
      .catch(err => console.error("Error fetching Nvidia models for edit:", err))
      .finally(() => setIsLoadingEditModels(false));
    } else if (providerId === 'openai-api' && apiKey) {
      invoke<any>('proxy_request', {
        url: 'https://api.openai.com/v1/models',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      .then(resData => {
        if (resData && Array.isArray(resData.data)) {
          const chatModels = resData.data
            .map((m: any) => m.id)
            .filter((id: string) => id.includes('gpt'));
          setEditModels(chatModels);
        }
      })
      .catch(err => console.error("Error fetching OpenAI models for edit:", err))
      .finally(() => setIsLoadingEditModels(false));
    } else if (providerId === 'deepseek-api') {
      setEditModels(['deepseek-chat', 'deepseek-reasoner']);
      setIsLoadingEditModels(false);
    } else if (providerId === 'gemini-api') {
      setEditModels(['gemini-1.5-flash', 'gemini-1.5-pro']);
      setIsLoadingEditModels(false);
    } else {
      setIsLoadingEditModels(false);
    }
  }, [instance.providerId, instance.apiKey]);

  const handleSave = () => {
    onSave({
      name: editName,
      apiKey: editApiKey,
      model: editModel,
      temperature: editTemperature,
      systemPrompt: editSystemPrompt
    });
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
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Service Settings</h2>
          <p className="text-xs text-zinc-500">Configure parameters for {instance.name}</p>
        </div>
      </div>

      <div className="grow pr-2 custom-scrollbar pb-6 space-y-5 text-zinc-800 dark:text-zinc-200 ">
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-500 font-medium">Custom Name</label>
          <Input 
            placeholder="Name" 
            value={editName} 
            onChange={e => setEditName(e.target.value)} 
            className="bg-transparent border-zinc-500/20"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-zinc-500 font-medium">API Key</label>
          <Input 
            type="password"
            placeholder="sk-..." 
            value={editApiKey} 
            onChange={e => setEditApiKey(e.target.value)} 
            className="bg-transparent border-zinc-500/20"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-zinc-500 font-medium">Default Model</label>
          {isLoadingEditModels ? (
            <div className="text-xs text-zinc-400 py-2 animate-pulse">Fetching models...</div>
          ) : editModels.length > 0 ? (
            <Select value={editModel} onValueChange={setEditModel}>
              <SelectTrigger className="w-full bg-transparent border-zinc-500/20 text-zinc-800 dark:text-zinc-200">
                <SelectValue placeholder="Select a Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {editModels.map(m => (
                    <SelectItem key={m} value={m}>
                      {m.split('/').pop()}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <Input 
              placeholder="Model identifier (e.g. gpt-4o)" 
              value={editModel} 
              onChange={e => setEditModel(e.target.value)} 
              className="bg-transparent border-zinc-500/20"
            />
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs text-zinc-500 font-medium flex justify-between">
            <span>Thinking Level (Temperature)</span>
            <span className="font-semibold">{editTemperature.toFixed(1)}</span>
          </label>
          <div className="flex items-center gap-3 pt-1">
            <span className="text-[10px] text-zinc-400">Deterministic</span>
            <Slider
              value={[editTemperature]}
              onValueChange={val => setEditTemperature(val[0])}
              min={0.0}
              max={1.5}
              step={0.1}
              className="flex-grow"
            />
            <span className="text-[10px] text-zinc-400">Creative</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-zinc-500 font-medium">System Prompt</label>
          <textarea
            placeholder="You are a helpful assistant..."
            value={editSystemPrompt}
            onChange={e => setEditSystemPrompt(e.target.value)}
            className="w-full min-h-[120px] bg-transparent border border-zinc-500/20 dark:border-white/10 rounded-md p-2.5 text-xs focus:outline-none focus:border-zinc-500/40 dark:text-white font-sans scrollbar-thin resize-y"
          />
          <p className="text-[10px] text-zinc-500">
            System prompts define the assistant's personality, rules, or formatting preferences.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-zinc-500/10 dark:border-white/5">
        <Button variant="ghost" onClick={onBack}>Cancel</Button>
        <Button onClick={handleSave} disabled={!editName}>Save Settings</Button>
      </div>
    </div>
  );
}
