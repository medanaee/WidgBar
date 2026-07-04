import * as React from "react";
import { cn } from "../../lib/utils";

interface Option<T> {
  value: T;
  label: string;
  preview: React.ReactNode;
}

interface VisualSelectorProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  label?: string;
  description?: string;
  gridCols?: number;
}

export function VisualSelector({
  value,
  onChange,
  options,
  label,
  description,
  gridCols = 3,
  className
}: VisualSelectorProps<any> & { className?: string }) {
  const gridColsClass = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  }[gridCols] || "grid-cols-3";

  return (
    <div className={cn("flex flex-col gap-2.5 p-3.5 rounded-xl bg-white/50 dark:bg-zinc-900/10 border border-zinc-500/20 dark:border-zinc-500/20 shadow-sm transition-all", className)}>
      {(label || description) && (
        <div>
          {label && <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</h3>}
          {description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}
        </div>
      )}
      
      <div className={cn("grid gap-2 w-full pt-1", gridColsClass)}>
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={String(option.value)}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex flex-col items-center gap-2 p-2 rounded-lg border text-center transition-all duration-200 cursor-pointer",
                isSelected
                  ? "border-indigo-500 dark:border-indigo-400 bg-indigo-500/5 dark:bg-indigo-500/10 shadow-[0_0_12px_rgba(99,102,241,0.1)]"
                  : "border-zinc-500/10 bg-zinc-950/5 dark:bg-zinc-950/20 hover:border-zinc-500/30"
              )}
            >
              {/* Preview Box */}
              <div className="h-14 w-full bg-zinc-950/25 dark:bg-zinc-900/30 border border-zinc-500/5 rounded flex items-center justify-center pointer-events-none p-1">
                {option.preview}
              </div>
              <span className={cn(
                "text-[10px] font-medium leading-tight",
                isSelected ? "text-indigo-600 dark:text-indigo-400 font-semibold" : "text-zinc-500 dark:text-zinc-400"
              )}>
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
