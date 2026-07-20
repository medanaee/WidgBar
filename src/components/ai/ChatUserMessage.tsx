import MarkdownChatContent from '../MarkdownChatContent';
import { AttachmentChips } from './AttachmentChips';
import { ChatMessage } from '../../types/ai';

interface ChatUserMessageProps {
  message: ChatMessage;
  /** Match AiChatRoute user bubble (dark/light inverted) */
  inBubble?: boolean;
  isWidget?: boolean;
  onScrollToBottom?: () => void;
  topOffset?: number;
}

/** Renders a user message: attachment chips + prompt markdown (not the wire blob). */
export default function ChatUserMessage({
  message,
  inBubble = false,
  isWidget = false,
  onScrollToBottom,
  topOffset,
}: ChatUserMessageProps) {
  const attachments = message.attachments || [];
  const prompt = message.content || '';

  return (
    <div className="flex flex-col gap-1.5 w-full min-w-0">
      {attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <AttachmentChips
            attachments={attachments}
            onDarkBubble={inBubble}
            compact={isWidget}
            topOffset={topOffset ?? (isWidget ? 8 : 36)}
          />
        </div>
      )}
      {prompt.trim() ? (
        <div className="flex flex-col gap-1 overflow-x-auto overflow-y-hidden break-words">
          <MarkdownChatContent
            content={prompt}
            streamingEventId={message.streamingEventId}
            isWidget={isWidget}
            onScrollToBottom={onScrollToBottom}
          />
        </div>
      ) : null}
      {!prompt.trim() && attachments.length === 0 ? (
        <span className="text-zinc-400 text-[10px] italic">(empty)</span>
      ) : null}
    </div>
  );
}
