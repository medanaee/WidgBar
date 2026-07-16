import React from 'react';
import { LucideIcon } from 'lucide-react';

interface TipCardProps {
  icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  title: string;
  description: string;
}

export function TipCard({
  icon: Icon,
  iconBgClass,
  iconColorClass,
  title,
  description,
}: TipCardProps) {
  return (
    <div
      className="bg-white/40 dark:bg-zinc-900/40 p-5 rounded-2xl flex gap-4 hover:bg-white/60 dark:hover:bg-zinc-900/60 transition-colors border border-zinc-500/20"
    >
      <div className={`p-2.5 rounded-xl ${iconBgClass} ${iconColorClass} shrink-0 h-10 w-10 flex items-center justify-center`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">{title}</h3>
        <p className="text-xs text-zinc-500 leading-normal">{description}</p>
      </div>
    </div>
  );
}
