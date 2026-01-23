import { cn } from '@/lib/utils';

interface ChatBubbleProps {
  content: string;
  role: 'user' | 'assistant';
  isNew?: boolean;
}

export function ChatBubble({ content, role, isNew = false }: ChatBubbleProps) {
  const isUser = role === 'user';
  
  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
        isNew && "message-appear"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] px-4 py-3 rounded-2xl",
          isUser 
            ? "bg-primary text-primary-foreground rounded-br-sm" 
            : "bg-card border border-border rounded-bl-sm"
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
