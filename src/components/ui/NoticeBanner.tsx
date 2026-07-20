import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NoticeBannerTone =
  | 'green'
  | 'yellow'
  | 'red'
  | 'blue'
  | 'primary'
  | 'neutral';

const TONE_STYLES: Record<
  NoticeBannerTone,
  { box: string; iconWrap: string; title: string; desc: string }
> = {
  green: {
    box: 'bg-emerald-500/10 border-emerald-500/20',
    iconWrap: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    title: 'text-emerald-700 dark:text-emerald-300',
    desc: 'text-emerald-700/80 dark:text-emerald-400/80',
  },
  yellow: {
    box: 'bg-amber-500/10 border-amber-500/20',
    iconWrap: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    title: 'text-amber-700 dark:text-amber-300',
    desc: 'text-amber-700/80 dark:text-amber-400/80',
  },
  red: {
    box: 'bg-red-500/10 border-red-500/20',
    iconWrap: 'bg-red-500/15 text-red-600 dark:text-red-400',
    title: 'text-red-700 dark:text-red-300',
    desc: 'text-red-700/80 dark:text-red-400/80',
  },
  blue: {
    box: 'bg-sky-500/10 border-sky-500/20',
    iconWrap: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    title: 'text-sky-700 dark:text-sky-300',
    desc: 'text-sky-700/80 dark:text-sky-400/80',
  },
  primary: {
    box: 'bg-primary/10 border-primary/20',
    iconWrap: 'bg-primary/15 text-primary',
    title: 'text-primary',
    desc: 'text-primary',
  },
  neutral: {
    box: 'bg-zinc-900/5 dark:bg-white/5 border-zinc-900/10 dark:border-white/10',
    iconWrap: 'bg-zinc-900/10 dark:bg-white/10 text-zinc-700 dark:text-zinc-200',
    title: 'text-zinc-900 dark:text-zinc-100',
    desc: 'text-zinc-600 dark:text-zinc-400',
  },
};

interface NoticeBannerProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: NoticeBannerTone;
  className?: string;
}

export function NoticeBanner({
  icon: Icon,
  title,
  description,
  tone = 'yellow',
  className,
}: NoticeBannerProps) {
  const styles = TONE_STYLES[tone];

  return (
    <div
      className={cn(
        'p-3.5 rounded-xl border text-xs flex gap-3 leading-normal animate-in fade-in duration-200',
        styles.box,
        className,
      )}
    >
      <div
        className={cn(
          'shrink-0 h-8 w-8 rounded-lg flex items-center justify-center',
          styles.iconWrap,
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <span className={cn('font-semibold', styles.title)}>{title}</span>
        <span className={styles.desc}>{description}</span>
      </div>
    </div>
  );
}
