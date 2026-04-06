import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface HighlightableTextProps {
  text: string;
  highlightTerm: string | null;
  className?: string;
}

/**
 * Renders text with a specific term highlighted (with smooth animation).
 */
export function HighlightableText({ text, highlightTerm, className }: HighlightableTextProps) {
  const parts = useMemo(() => {
    if (!highlightTerm || !text) return [{ text, highlighted: false }];

    const term = highlightTerm.toLowerCase();
    const result: { text: string; highlighted: boolean }[] = [];
    let remaining = text;
    let lowerRemaining = remaining.toLowerCase();

    while (true) {
      const idx = lowerRemaining.indexOf(term);
      if (idx === -1) {
        if (remaining) result.push({ text: remaining, highlighted: false });
        break;
      }
      if (idx > 0) {
        result.push({ text: remaining.slice(0, idx), highlighted: false });
      }
      result.push({ text: remaining.slice(idx, idx + highlightTerm.length), highlighted: true });
      remaining = remaining.slice(idx + highlightTerm.length);
      lowerRemaining = remaining.toLowerCase();
    }

    return result;
  }, [text, highlightTerm]);

  return (
    <p className={cn('text-sm leading-relaxed', className)}>
      {parts.map((part, i) =>
        part.highlighted ? (
          <mark
            key={i}
            className="bg-primary/25 text-foreground rounded px-0.5 transition-all duration-500 animate-in fade-in"
            id={i === 0 ? 'highlight-target' : undefined}
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </p>
  );
}
