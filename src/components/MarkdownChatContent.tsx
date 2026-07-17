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

function CopyButton({ text, isWidget }: { text: string; isWidget: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors focus:outline-none flex items-center gap-1 font-medium ${
        isWidget ? 'text-[8px]' : 'text-[9px]'
      }`}
    >
      {copied ? (
        <span className="text-green-500 flex items-center gap-0.5 font-semibold">
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          Copy
        </span>
      )}
    </button>
  );
}

function SimpleCodeHighlighter({ children, language }: { children: string; language: string }) {
  if (typeof children !== 'string') return <>{children}</>;
  
  const lang = (language || '').toLowerCase();
  const supported = ['javascript', 'js', 'typescript', 'ts', 'rust', 'rs', 'python', 'py', 'json', 'bash', 'sh', 'html', 'css'];
  if (!supported.includes(lang)) {
    return <>{children}</>;
  }

  const regex = /(\/\/[^\n]*|#[^\n]*)|("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`)|(\b\w+(?=\())|(\b(?:[A-Z]\w*|i32|u32|i64|u64|f32|f64|str|String|bool|Option|Result|Self|self)\b)|(\b(?:const|let|var|function|return|import|export|from|class|if|else|for|while|fn|mut|pub|use|impl|struct|enum|def|as|in|try|except|break|continue|new|static|type|async|await|interface|private|public|protected|throw|catch|match)\b)|(\b\d+\b)/g;

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(children)) !== null) {
    if (match.index > lastIdx) {
      parts.push(children.substring(lastIdx, match.index));
    }

    if (match[1]) { // Comment
      parts.push(<span key={match.index} className="text-zinc-400 dark:text-zinc-500 italic">{match[0]}</span>);
    } else if (match[2]) { // String
      parts.push(<span key={match.index} className="text-emerald-600 dark:text-sky-300">{match[0]}</span>);
    } else if (match[3]) { // Function
      parts.push(<span key={match.index} className="text-blue-600 dark:text-purple-400">{match[0]}</span>);
    } else if (match[4]) { // Type/Class
      parts.push(<span key={match.index} className="text-amber-605 dark:text-orange-350">{match[0]}</span>);
    } else if (match[5]) { // Keyword
      parts.push(<span key={match.index} className="text-violet-600 dark:text-pink-400 font-semibold">{match[0]}</span>);
    } else if (match[6]) { // Number
      parts.push(<span key={match.index} className="text-amber-600 dark:text-blue-400">{match[0]}</span>);
    }

    lastIdx = regex.lastIndex;
  }

  if (lastIdx < children.length) {
    parts.push(children.substring(lastIdx));
  }

  return <>{parts}</>;
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
  const codeBlockContainerClass = isWidget 
    ? "relative my-1.5 rounded border border-zinc-500/20 overflow-hidden bg-zinc-100 dark:bg-black/30" 
    : "relative my-2 rounded-lg overflow-hidden bg-zinc-50 dark:bg-black/30 border border-zinc-500/20";
  const codeBlockHeaderClass = isWidget 
    ? "flex items-center justify-between px-2 py-1 bg-zinc-200 dark:bg-white/5 border-b border-zinc-500/20" 
    : "flex items-center justify-between px-3 py-1.5  bg-zinc-200 dark:bg-white/5 border-b border-zinc-500/20";
  const codeBlockLangClass = isWidget ? "text-[8px] font-mono text-zinc-500 dark:text-zinc-400 uppercase" : "text-[9px] font-mono text-zinc-400 uppercase";
  const codeBlockPreClass = isWidget ? "p-2 overflow-x-auto text-[9px] text-zinc-800 dark:text-zinc-300 font-mono" : "p-3 overflow-x-auto text-[10px] text-zinc-850 dark:text-zinc-300 font-mono";
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
      const codeString = String(children).replace(/\n$/, '');
      return isInline ? (
        <code className={codeInlineClass} {...props}>
          {children}
        </code>
      ) : (
        <div className={codeBlockContainerClass} dir="ltr">
          <div className={codeBlockHeaderClass}>
            <span className={codeBlockLangClass}>{match?.[1] || 'Code'}</span>
            <CopyButton text={codeString} isWidget={isWidget} />
          </div>
          <pre className={codeBlockPreClass}>
            <code className={className} {...props}>
              <SimpleCodeHighlighter children={codeString} language={match?.[1] || ''} />
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
