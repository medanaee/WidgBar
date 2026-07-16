import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Window } from '@tauri-apps/api/window';
import { 
  Dismiss12Regular,
  Square12Regular, 
  Subtract12Regular, 
} from '@fluentui/react-icons';
import { Logo } from './Logo';
import { useTranslation } from '../lib/i18n';

const appWindow = Window.getCurrent();

export const Titlebar: React.FC = () => {
  const { t } = useTranslation();
  
  const handleMinimize = async () => {
    await appWindow.minimize();
  };

  const handleToggleMaximize = async () => {
    await appWindow.toggleMaximize();
  };

  const handleHide = async () => {
    try {
      if (appWindow.label === 'main') {
        await invoke('hide_window');
      } else {
        await invoke('hide_popup', { selfClose: true });
      }
    } catch (error) {
      console.error("Failed to close/hide window via Rust command:", error);
    }
  };

  return (
    <div 
      data-tauri-drag-region 
      className="flex justify-between items-center h-7.5 bg-transparent border-b border-zinc-200/50 dark:border-zinc-800/50 text-zinc-700 dark:text-zinc-300 font-sans select-none w-full shrink-0"
    >
      {/* App Title and Logo */}
      <div 
        data-tauri-drag-region 
        className="px-2 text-xs font-semibold flex items-center gap-2.5 h-full flex-grow cursor-default"
      >
        <Logo className="w-4 h-4" />
        WidgBar
      </div>

      {/* Window Controls */}
      <div className="flex h-full items-center">
        <button 
          onClick={handleMinimize} 
          title="Minimize"
          className="inline-flex justify-center items-center w-11 h-full bg-transparent border-none text-zinc-900 dark:text-zinc-100 cursor-default transition-colors duration-150 hover:bg-zinc-200/50 hover:dark:bg-zinc-800/50 hover:text-zinc-900 hover:dark:text-zinc-100 outline-none p-0"
        >
          <Subtract12Regular />
        </button>

        <button 
          onClick={handleToggleMaximize} 
          title="Maximize"
          className="inline-flex justify-center items-center w-11 h-full bg-transparent border-none text-zinc-900 dark:text-zinc-100 cursor-default transition-colors duration-150 hover:bg-zinc-200/50 hover:dark:bg-zinc-800/50 hover:text-zinc-900 hover:dark:text-zinc-100 outline-none p-0"
        >
          <Square12Regular />
        </button>

        <button 
          onClick={handleHide} 
          title="Close"
          className="inline-flex justify-center items-center w-11 h-full bg-transparent border-none text-zinc-900 dark:text-zinc-100 cursor-default transition-colors duration-150 hover:bg-red-500 hover:text-white outline-none p-0"
        >
          <Dismiss12Regular />
        </button>
      </div>
    </div>
  );
};