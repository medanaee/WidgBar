import React from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  disabled = false,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div className={`inline-flex items-center gap-1 p-0.5 rounded-lg bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-500/15 ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}>
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`flex items-center justify-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer select-none ${
              isSelected
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
