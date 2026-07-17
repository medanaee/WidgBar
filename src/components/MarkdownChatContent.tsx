import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

interface MarkdownChatContentProps {
  content: string;
  streamingEventId?: string;
  isWidget?: boolean;
  onScrollToBottom?: () => void;
}

function preprocessMarkdown(text: string): string {
  if (!text) return text;
  
  // 1. Process lines that start with optional indentation, followed by $$equation$$
  let processed = text.replace(/^([ \t]*)\$\$([^\n\$]+)\$\$/gm, (_, indent, eq) => {
    return `${indent}$$\n${indent}${eq.trim()}\n${indent}$$`;
  });
  
  // 2. Process any remaining inline $$equation$$ that are inside other text
  processed = processed.replace(/\$\$([^\n\$]+)\$\$/g, (_, eq) => {
    return `\n$$\n${eq.trim()}\n$$\n`;
  });
  
  return processed;
}

function ThinkBlock({ content, isWidget, markdownComponents }: { content: string, isWidget: boolean, markdownComponents: any }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className={`my-2 border-l-2 border-zinc-400/40 dark:border-zinc-500/40 pl-3 ${isWidget ? 'text-[10px]' : 'text-[11px]'}`}>
      <div 
        className="flex items-center gap-2 cursor-pointer text-zinc-500 dark:text-zinc-400 font-medium mb-1 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-[12px]">🧠</span> 
        <span>Reasoning</span>
        <span className="text-[9px] opacity-70">{isOpen ? '▼' : '▶'}</span>
      </div>
      <div className={`relative overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[5000px] opacity-80' : 'max-h-20 opacity-50'}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={markdownComponents}
        >
          {preprocessMarkdown(content)}
        </ReactMarkdown>
        {!isOpen && (
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#f4f4f5] dark:from-[#18181b] to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  );
}

function MarkdownChatContent({
  content,
  streamingEventId,
  isWidget = false,
  onScrollToBottom
}: MarkdownChatContentProps) {
  const [displayText, setDisplayText] = useState(content);
  const scrollRef = useRef(onScrollToBottom);

  useEffect(() => {
    scrollRef.current = onScrollToBottom;
  }, [onScrollToBottom]);

  // Listen to live stream chunks
  useEffect(() => {
    if (streamingEventId) {
      setDisplayText(""); // Start empty for the stream
      
      let unlisten: UnlistenFn | undefined;
      let isCleanedUp = false;
      
      listen(`ai-text-${streamingEventId}`, (e: any) => {
        setDisplayText(prev => prev + (e.payload as string));
        if (scrollRef.current) scrollRef.current();
      }).then(u => {
        if (isCleanedUp) {
          u();
        } else {
          unlisten = u;
        }
      });

      return () => {
        isCleanedUp = true;
        if (unlisten) unlisten();
      };
    } else {
      setDisplayText(content);
    }
  }, [streamingEventId, content]);

  if (streamingEventId && !displayText) {
    return (
      <div className="flex items-center gap-2 text-zinc-500 py-1">
        <span className="animate-pulse">Thinking</span>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  // Adjust font sizes and paddings based on isWidget flag
  const h1Class = isWidget ? "text-[13px] font-bold mt-2 mb-1" : "text-lg font-bold mt-2 mb-1";
  const h2Class = isWidget ? "text-[12px] font-bold mt-2 mb-1" : "text-base font-bold mt-2 mb-1";
  const h3Class = isWidget ? "text-[11px] font-bold mt-1.5 mb-1" : "text-sm font-bold mt-1.5 mb-1";
  const codeInlineClass = isWidget ? "bg-zinc-500/10 dark:bg-white/10 rounded px-1 py-0.5 font-mono text-[9px]" : "bg-zinc-500/20 dark:bg-white/20 rounded px-1.5 py-0.5 font-mono text-[10px]";
  const codeBlockContainerClass = isWidget ? "relative my-1.5 rounded border border-zinc-500/10 overflow-hidden bg-zinc-100 dark:bg-black/30" : "relative my-2 rounded-lg overflow-hidden bg-zinc-900 dark:bg-black/40 border border-zinc-500/20";
  const codeBlockHeaderClass = isWidget ? "flex items-center justify-between px-2 py-1 bg-zinc-200 dark:bg-white/5 border-b border-zinc-500/10" : "flex items-center justify-between px-3 py-1.5 bg-zinc-800/50 dark:bg-white/5 border-b border-zinc-500/20";
  const codeBlockLangClass = isWidget ? "text-[8px] font-mono text-zinc-500 dark:text-zinc-400 uppercase" : "text-[9px] font-mono text-zinc-400 uppercase";
  const codeBlockPreClass = isWidget ? "p-2 overflow-x-auto text-[9px] text-zinc-800 dark:text-zinc-300 font-mono" : "p-3 overflow-x-auto text-[10px] text-zinc-300 font-mono";
  const quoteClass = isWidget ? "border-l-2 border-zinc-500/30 pl-2 italic opacity-80 my-1" : "border-l-2 border-zinc-500/40 pl-3 italic opacity-80 my-1";

  const markdownComponents: any = {
    p: ({node, ...props}: any) => <p dir="auto" {...props} />,
    a: ({node, ...props}: any) => <a className="text-blue-500 hover:underline" target="_blank" rel="noreferrer" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc list-inside w-[calc(100%-1px)]" dir="auto" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal list-inside w-[calc(100%-1px)]" dir="auto" {...props} />,
    li: ({node, ...props}: any) => <li className="mb-0.5" dir="auto" {...props} />,
    h1: ({node, ...props}: any) => <h1 className={h1Class} dir="auto" {...props} />,
    h2: ({node, ...props}: any) => <h2 className={h2Class} dir="auto" {...props} />,
    h3: ({node, ...props}: any) => <h3 className={h3Class} dir="auto" {...props} />,
    code: ({node, className, children, ...props}: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match && !className?.includes('language-');
      return isInline ? (
        <code className={codeInlineClass} {...props}>
          {children}
        </code>
      ) : (
        <div className={codeBlockContainerClass} dir="ltr">
          <div className={codeBlockHeaderClass}>
            <span className={codeBlockLangClass}>{match?.[1] || 'Code'}</span>
          </div>
          <pre className={codeBlockPreClass}>
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        </div>
      )
    },
    table: ({node, ...props}: any) => (
      <div className="overflow-x-auto my-2 rounded border border-zinc-500/20">
        <table className="min-w-full divide-y divide-zinc-500/20" {...props} />
      </div>
    ),
    thead: ({node, ...props}: any) => <thead className="bg-zinc-500/10 dark:bg-white/5" {...props} />,
    th: ({node, ...props}: any) => <th className="px-3 py-2 text-left text-[10px] font-semibold tracking-wider" {...props} />,
    td: ({node, ...props}: any) => <td className="px-3 py-2 text-[10px] border-t border-zinc-500/10" {...props} />,
    blockquote: ({node, ...props}: any) => <blockquote className={quoteClass} dir="auto" {...props} />,
    hr: ({node, ...props}: any) => <hr className="border-t border-zinc-500/15 dark:border-white/10 my-3" {...props} />,
  };

  const parts = [];
  const regex = /<think>([\s\S]*?)(?:<\/think>|$)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(displayText)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: displayText.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'think', content: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < displayText.length) {
    parts.push({ type: 'text', content: displayText.slice(lastIndex) });
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      {parts.map((part, i) => {
        if (part.type === 'think') {
          return <ThinkBlock key={i} content={part.content} isWidget={isWidget} markdownComponents={markdownComponents} />;
        }
        return (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={markdownComponents}
          >
            {preprocessMarkdown(part.content)}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

const MemoizedMarkdownChatContent = React.memo(MarkdownChatContent, (prevProps, nextProps) => {
  return (
    prevProps.content === nextProps.content &&
    prevProps.streamingEventId === nextProps.streamingEventId &&
    prevProps.isWidget === nextProps.isWidget
  );
});

export default MemoizedMarkdownChatContent;
