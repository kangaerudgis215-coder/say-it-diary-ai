import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ChatBubbleProps {
  content: string;
  role: 'user' | 'assistant';
  isNew?: boolean;
  japaneseTranslation?: string;
}

export function ChatBubble({ content, role, isNew = false, japaneseTranslation }: ChatBubbleProps) {
  const isUser = role === 'user';
  const [showJapanese, setShowJapanese] = useState(false);
  
  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
        isNew && "message-appear"
      )}
    >
      <div className="max-w-[85%]">
        <div
          className={cn(
            "px-4 py-3 rounded-2xl",
            isUser 
              ? "bg-primary text-primary-foreground rounded-br-sm" 
              : "bg-card border border-border rounded-bl-sm"
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
        
        {/* Japanese translation toggle for assistant messages */}
        {!isUser && japaneseTranslation && (
          <div className="mt-1 ml-1">
            <button
              onClick={() => setShowJapanese(!showJapanese)}
              className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
            >
              🇯🇵 日本語訳
              {showJapanese ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showJapanese && (
              <p className="text-xs text-muted-foreground mt-1 font-japanese leading-relaxed pl-1">
                {japaneseTranslation}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
