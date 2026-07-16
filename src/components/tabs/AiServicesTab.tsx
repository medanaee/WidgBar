import { useState } from "react";
import { useAiServicesStore } from "../../stores/aiServicesStore";
import { AiProvider, AI_PROVIDERS, AiServiceInstance } from "../../types/ai";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Plus, Trash2, Webhook, Link as LinkIcon, MessageCircle, Pencil } from "lucide-react";
import { SettingCard, SettingCardNoLayout } from "../ui/SettingCard";
import { invoke } from "@tauri-apps/api/core";

export default function AiServicesTab() {
  const { data, addInstance, removeInstance, updateInstance } = useAiServicesStore();
  const instances = data?.instances || [];
  
  const [isAdding, setIsAdding] = useState(false);
  const [newProviderId, setNewProviderId] = useState<string>("");
  const [newName, setNewName] = useState<string>("");
  const [newApiKey, setNewApiKey] = useState<string>("");

  const handleAdd = () => {
    if (!newProviderId || !newName) return;
    const provider = AI_PROVIDERS.find(p => p.id === newProviderId);
    if (!provider) return;

    const newInstance: AiServiceInstance = {
      id: crypto.randomUUID(),
      providerId: newProviderId,
      name: newName,
      createdAt: Date.now(),
    };

    if (provider.type === 'api') {
      newInstance.apiKey = newApiKey;
    }

    addInstance(newInstance);
    setIsAdding(false);
    setNewProviderId("");
    setNewName("");
    setNewApiKey("");
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-8 relative">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">AI Services</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              Configure AI providers to use across your widgets.
            </p>
          </div>
          <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "secondary" : "default"}>
            <Plus className="w-4 h-4 mr-2" />
            Add AI Service
          </Button>
        </div>

        {isAdding && (
          <SettingCardNoLayout className="border-primary/50 border bg-primary/5 flex flex-col content-end">
            <h3 className="text-sm font-medium mb-4">Add New Service</h3>
            <div className="space-y-4 w-full">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-500">Provider</label>
                  <Select value={newProviderId} onValueChange={setNewProviderId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {AI_PROVIDERS.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2">
                              <Webhook className="w-3 h-3 text-blue-500" />
                              {p.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-500">Custom Name (e.g. My ChatGPT)</label>
                  <Input 
                    placeholder="Name" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)} 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-500">API Key</label>
                <Input 
                  type="password"
                  placeholder="sk-..." 
                  value={newApiKey} 
                  onChange={e => setNewApiKey(e.target.value)} 
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                <Button onClick={handleAdd} disabled={!newProviderId || !newName}>Save Service</Button>
              </div>
            </div>
          </SettingCardNoLayout>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {instances.map(instance => {
            const provider = AI_PROVIDERS.find(p => p.id === instance.providerId);
            return (
              <SettingCard 
                key={instance.id} 
                className="flex flex-col relative group h-40"
                style={{ borderRadius: '24px', cornerShape: 'superellipse(1.5)' } as React.CSSProperties}
              >
                <div className="flex justify-between items-start mb-4 w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shadow-sm">
                      <Webhook className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{instance.name}</h3>
                      <p className="text-xs text-zinc-500">{provider?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 h-7 w-7"
                      onClick={() => console.log("Edit not implemented yet")}
                      title="Edit Service"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-7 w-7"
                      onClick={() => removeInstance(instance.id)}
                      title="Delete Service"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800/50 w-full">
                  <div className="text-xs text-zinc-500 flex items-center justify-between">
                    <span>API Key</span>
                    <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md text-[10px]">
                      {instance.apiKey ? `...${instance.apiKey.slice(-4)}` : 'Not Set'}
                    </span>
                  </div>
                </div>
              </SettingCard>
            );
          })}
          {instances.length === 0 && !isAdding && (
            <div className="col-span-full py-12 text-center border border-dashed rounded-xl border-zinc-300 dark:border-zinc-700">
              <p className="text-zinc-500 mb-2">No AI Services configured yet.</p>
              <Button variant="link" onClick={() => setIsAdding(true)}>Add your first service</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
