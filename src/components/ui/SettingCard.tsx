import React from 'react';

export function SettingCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
      {children}
    </div>
  );
}

export function SettingCardNoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50">
      {children}
    </div>
  );
}
