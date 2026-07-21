import React, { useState } from 'react';
import { CopyRegular, CheckmarkRegular } from '@fluentui/react-icons';

interface CopyMessageButtonProps {
  text: string;
  isWidget?: boolean;
  className?: string;
  inDarkBubble?: boolean;
}

export function CopyMessageButton({
  text,
  isWidget = false,
  className = '',
  inDarkBubble = false,
}: CopyMessageButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const baseTextClass = inDarkBubble
    ? 'text-white/70 hover:text-white dark:text-zinc-700 dark:hover:text-zinc-900'
    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200';

  return (
    <button
      onClick={handleCopy}
      type="button"
      className={`inline-flex items-center gap-1 opacity-75 hover:opacity-100 transition-all select-none cursor-pointer focus:outline-none ${
        isWidget ? 'text-[9px]' : 'text-[10px]'
      } ${baseTextClass} ${className}`}
      title="Copy message"
    >
      {copied ? (
        <span className="text-green-500 flex items-center gap-1 font-semibold animate-in fade-in duration-150">
          <CheckmarkRegular fontSize={isWidget ? 11 : 13} />
          <span>Copied</span>
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <CopyRegular fontSize={isWidget ? 11 : 13} />
          <span>Copy</span>
        </span>
      )}
    </button>
  );
}
