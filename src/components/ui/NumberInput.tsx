import * as React from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "../../lib/utils";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function NumberInput({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className
}: NumberInputProps) {
  const handleDecrement = () => {
    if (value - step >= min) {
      onChange(value - step);
    }
  };

  const handleIncrement = () => {
    if (value + step <= max) {
      onChange(value + step);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!isNaN(val)) {
      // Clamp values on manual typing if they go out of bounds
      const clampedVal = Math.max(min, Math.min(max, val));
      onChange(clampedVal);
    }
  };

  return (
    <div className={cn("flex items-center border border-zinc-500/20 dark:border-zinc-500/20 bg-zinc-500/20 rounded-lg overflow-hidden h-8 select-none shrink-0", className)}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className="px-2.5 h-full flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-500/10 dark:hover:bg-zinc-500/20 disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        className="w-12 text-center text-xs font-semibold bg-transparent border-x border-zinc-500/20 h-full focus:outline-none text-zinc-900 dark:text-zinc-100"
      />
      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        className="px-2.5 h-full flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-500/10 dark:hover:bg-zinc-500/20 disabled:opacity-20 disabled:hover:bg-transparent transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
