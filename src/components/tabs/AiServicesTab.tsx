import { useState } from "react";
import { useAiServicesStore } from "../../stores/aiServicesStore";
import { AI_PROVIDERS, AiServiceInstance } from "../../types/ai";
import { Button } from "../ui/button";
import { Plus, Trash2, Settings, MessageSquare } from "lucide-react";
import { CompanyLogo } from "../CompanyLogo";
import { SettingCard } from "../ui/SettingCard";
import AddAiServicePanel from "./AddAiServicePanel";
import EditAiServicePanel from "./EditAiServicePanel";
import { invoke } from "@tauri-apps/api/core";

export default function AiServicesTab() {
  const { data, addInstance, removeInstance, updateInstance } = useAiServicesStore();
  const instances = data?.instances || [];
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingInstance, setEditingInstance] = useState<AiServiceInstance | null>(null);

  const openFullChat = (instanceId: string) => {
    invoke('request_popup', {
      x: window.screenX + 100,
      y: window.screenY + 100,
      width: 800,
      height: 600,
      route: `/ai-chat/${instanceId}`,
      closeOnBlur: false,
      xIsCenter: false,
      animated: true,
      belowBar: false,
      center: true,
      resizable: true,
      skipTaskbar: false,
      alwaysOnTop: false
    }).catch(console.error);
  };

  if (isAdding) {
    return (
      <div className="flex-1 h-full overflow-y-auto p-8 relative flex flex-col justify-start">
        <AddAiServicePanel 
          onBack={() => setIsAdding(false)} 
          onSave={(newInstance) => {
            addInstance(newInstance);
            setIsAdding(false);
          }}
        />
      </div>
    );
  }

  if (editingInstance) {
    return (
      <div className="flex-1 h-full overflow-y-auto p-8 relative flex flex-col justify-start">
        <EditAiServicePanel
          instance={editingInstance}
          onBack={() => setEditingInstance(null)}
          onSave={(updatedFields) => {
            updateInstance(editingInstance.id, updatedFields);
            setEditingInstance(null);
          }}
        />
      </div>
    );
  }

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
          <Button onClick={() => setIsAdding(true)} variant="default">
            <Plus className="w-4 h-4 mr-2" />
            Add AI Service
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {instances.map(instance => {
            const provider = AI_PROVIDERS.find(p => p.id === instance.providerId);
            return (
              <SettingCard 
                key={instance.id} 
                className="flex flex-col relative group h-44"
                style={{ borderRadius: '24px', cornerShape: 'squircle' } as React.CSSProperties}
              >
                <div className="flex justify-between items-start mb-4 w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shadow-sm overflow-hidden">
                      <CompanyLogo providerId={instance.providerId} size={24} fallbackIcon="cloud" className="text-blue-500" />
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
                      onClick={() => openFullChat(instance.id)}
                      title="Open Chat"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 h-7 w-7"
                      onClick={() => setEditingInstance(instance)}
                      title="Settings"
                    >
                      <Settings className="w-4 h-4" />
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
                
                <div className="mt-auto border-t border-zinc-500/30 w-full pt-3 space-y-1.5 text-xs text-zinc-500">
                  <div className="flex items-center justify-between">
                    <span>API Key</span>
                    <span className="font-mono bg-zinc-500/10 px-2 py-0.5 rounded-md text-[10px]">
                      {instance.apiKey ? `...${instance.apiKey.slice(-4)}` : 'Not Set'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Model</span>
                    <span className="font-mono bg-zinc-500/10 px-2 py-0.5 rounded-md text-[10px] truncate max-w-[140px]">
                      {instance.model ? instance.model.split('/').pop() : 'Default'}
                    </span>
                  </div>
                </div>
              </SettingCard>
            );
          })}
          {instances.length === 0 && (
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
