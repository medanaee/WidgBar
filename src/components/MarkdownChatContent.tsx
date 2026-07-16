import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownChatContentProps {
  content: string;
  streamingEventId?: string;
  isWidget?: boolean;
  onScrollToBottom?: () => void;
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
      const handleChunk = (e: any) => {
        setDisplayText(prev => prev + e.detail);
        if (scrollRef.current) scrollRef.current();
      };

      const eventName = `ai-text-${streamingEventId}`;
      window.addEventListener(eventName, handleChunk);
      return () => {
        window.removeEventListener(eventName, handleChunk);
      };
    } else {
      setDisplayText(content);
    }
  }, [streamingEventId, content]);

  // Adjust font sizes and paddings based on isWidget flag
  const h1Class = isWidget ? "text-[13px] font-bold mt-2 mb-1" : "text-lg font-bold mt-2 mb-1";
  const h2Class = isWidget ? "text-[12px] font-bold mt-2 mb-1" : "text-base font-bold mt-2 mb-1";
  const h3Class = isWidget ? "text-[11px] font-bold mt-1.5 mb-1" : "text-sm font-bold mt-1.5 mb-1";
  const codeInlineClass = isWidget ? "bg-zinc-500/10 dark:bg-white/10 rounded px-1 py-0.5 font-mono text-[9px]" : "bg-zinc-500/20 dark:bg-white/20 rounded px-1.5 py-0.5 font-mono text-[10px]";
  const codeBlockContainerClass = isWidget ? "relative my-1.5 rounded border border-zinc-500/10 overflow-hidden bg-zinc-100 dark:bg-black/30" : "relative my-2 rounded-lg overflow-hidden bg-zinc-900 dark:bg-black/40 border border-zinc-500/20";
  const codeBlockHeaderClass = isWidget ? "flex items-center justify-between px-2 py-1 bg-zinc-200 dark:bg-white/5 border-b border-zinc-500/10" : "flex items-center justify-between px-3 py-1.5 bg-zinc-800/50 dark:bg-white/5 border-b border-zinc-500/20";
  const codeBlockLangClass = isWidget ? "text-[8px] font-mono text-zinc-500 dark:text-zinc-400 uppercase" : "text-[9px] font-mono text-zinc-400 uppercase";
  const codeBlockPreClass = isWidget ? "p-2 overflow-x-auto text-[9px] text-zinc-800 dark:text-zinc-300 font-mono scrollbar-thin" : "p-3 overflow-x-auto text-[10px] text-zinc-300 font-mono scrollbar-thin";
  const quoteClass = isWidget ? "border-l-2 border-zinc-500/30 pl-2 italic opacity-80 my-1" : "border-l-2 border-zinc-500/40 pl-3 italic opacity-80 my-1";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({node, ...props}) => <p className="mb-1 last:mb-0" dir="auto" {...props} />,
        a: ({node, ...props}) => <a className="text-blue-500 hover:underline" target="_blank" rel="noreferrer" {...props} />,
        ul: ({node, ...props}) => <ul className="list-disc list-inside mb-1 last:mb-0" dir="auto" {...props} />,
        ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-1 last:mb-0" dir="auto" {...props} />,
        li: ({node, ...props}) => <li className="mb-0.5" dir="auto" {...props} />,
        h1: ({node, ...props}) => <h1 className={h1Class} dir="auto" {...props} />,
        h2: ({node, ...props}) => <h2 className={h2Class} dir="auto" {...props} />,
        h3: ({node, ...props}) => <h3 className={h3Class} dir="auto" {...props} />,
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
        table: ({node, ...props}) => (
          <div className="overflow-x-auto my-2 rounded border border-zinc-500/20">
            <table className="min-w-full divide-y divide-zinc-500/20" {...props} />
          </div>
        ),
        thead: ({node, ...props}) => <thead className="bg-zinc-500/10 dark:bg-white/5" {...props} />,
        th: ({node, ...props}) => <th className="px-3 py-2 text-left text-[10px] font-semibold tracking-wider" {...props} />,
        td: ({node, ...props}) => <td className="px-3 py-2 text-[10px] border-t border-zinc-500/10" {...props} />,
        blockquote: ({node, ...props}) => <blockquote className={quoteClass} dir="auto" {...props} />,
      }}
    >
      {displayText}
    </ReactMarkdown>
  );
}

const MemoizedMarkdownChatContent = React.memo(MarkdownChatContent, (prevProps, nextProps) => {
  return (
    prevProps.content === nextProps.content &&
    prevProps.typing === nextProps.typing &&
    prevProps.messageId === nextProps.messageId &&
    prevProps.sessionId === nextProps.sessionId &&
    prevProps.isWidget === nextProps.isWidget
  );
});

export default MemoizedMarkdownChatContent;
