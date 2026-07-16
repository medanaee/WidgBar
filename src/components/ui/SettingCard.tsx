import React from 'react';
import { cn } from '../../lib/utils';

interface SettingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function SettingCard({ children, className, ...props }: SettingCardProps) {
  return (
    <div 
      className={cn("flex items-center justify-between p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function SettingCardNoLayout({ children, className, ...props }: SettingCardProps) {
  return (
    <div 
      className={cn("p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all hover:bg-white/80 dark:hover:bg-zinc-900/50", className)}
      {...props}
    >
      {children}
    </div>
  );
}
