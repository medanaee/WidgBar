import { useState } from "react";
import { useAiServicesStore } from "../../stores/aiServicesStore";
import { AiProvider, AI_PROVIDERS, AiServiceInstance } from "../../types/ai";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Plus, Trash2, Webhook, Link as LinkIcon, MessageCircle } from "lucide-react";
import { SettingCard } from "../ui/SettingCard";
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
          <SettingCard className="border-primary/50 border bg-primary/5">
            <h3 className="text-sm font-medium mb-4">Add New Service</h3>
            <div className="space-y-4">
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
                              {p.type === 'api' ? <Webhook className="w-3 h-3 text-blue-500" /> : <LinkIcon className="w-3 h-3 text-green-500" />}
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

              {newProviderId && AI_PROVIDERS.find(p => p.id === newProviderId)?.type === 'api' && (
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-500">API Key</label>
                  <Input 
                    type="password"
                    placeholder="sk-..." 
                    value={newApiKey} 
                    onChange={e => setNewApiKey(e.target.value)} 
                  />
                </div>
              )}

              {newProviderId && AI_PROVIDERS.find(p => p.id === newProviderId)?.type === 'web' && (
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded text-xs text-zinc-600 dark:text-zinc-400">
                  Web-based providers don't require an API key. A hidden browser window will be used to interact with the service automatically.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                <Button onClick={handleAdd} disabled={!newProviderId || !newName}>Save Service</Button>
              </div>
            </div>
          </SettingCard>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {instances.map(instance => {
            const provider = AI_PROVIDERS.find(p => p.id === instance.providerId);
            return (
              <SettingCard key={instance.id} className="flex flex-col relative group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      {provider?.type === 'api' ? <Webhook className="w-4 h-4 text-blue-500" /> : <LinkIcon className="w-4 h-4 text-green-500" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{instance.name}</h3>
                      <p className="text-xs text-zinc-500">{provider?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={async () => {
                        if (provider?.type === 'web') {
                          try {
                            const url = provider.url || 'https://google.com';
                            await invoke('create_locked_popup', { id: instance.id, url });
                            await invoke('show_locked_popup', {
                              id: instance.id,
                              x: window.screenX + 50,
                              y: window.screenY + 50,
                              width: 800,
                              height: 600,
                            });
                          } catch (e) {
                            console.error("Failed to open locked popup:", e);
                          }
                        } else {
                          invoke('request_popup', {
                            x: window.screenX + 100,
                            y: window.screenY + 100,
                            width: 450,
                            height: 600,
                            route: `/ai-chat/${instance.id}`,
                            closeOnBlur: false,
                            xIsCenter: false,
                            animated: true,
                            belowBar: false,
                            center: true,
                            resizable: true,
                            skipTaskbar: false,
                            alwaysOnTop: false
                          }).catch(console.error);
                        }
                      }}
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1" />
                      Chat
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-red-500  h-7 w-7"
                      onClick={() => removeInstance(instance.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {provider?.type === 'api' ? (
                  <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="text-xs text-zinc-500 flex items-center justify-between">
                      <span>API Key</span>
                      <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                        {instance.apiKey ? `...${instance.apiKey.slice(-4)}` : 'Not Set'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="text-xs text-zinc-500">
                      Web automation enabled.
                    </div>
                  </div>
                )}
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
