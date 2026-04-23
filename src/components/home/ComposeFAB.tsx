import { Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUISound } from '@/hooks/useUISound';
import { cn } from '@/lib/utils';

interface ComposeFABProps {
  /** Optional date (yyyy-MM-dd) to start a diary for. */
  date?: string;
}

/**
 * Floating circular pencil button — primary diary-compose entry point.
 * Sits above the bottom tab bar in the lower-right corner.
 */
export function ComposeFAB({ date }: ComposeFABProps) {
  const navigate = useNavigate();
  const { playNavigate } = useUISound();

  const handleClick = () => {
    playNavigate();
    navigate(date ? `/chat?date=${date}` : '/chat');
  };

  return (
    <button
      onClick={handleClick}
      aria-label="日記を書く"
      className={cn(
        'fixed right-5 z-50',
        'bottom-[88px]', // sits above the 72px tab bar + safe area
        'w-14 h-14 rounded-full',
        'bg-primary text-primary-foreground',
        'shadow-lg shadow-primary/30',
        'flex items-center justify-center',
        'transition-transform active:scale-95 hover:scale-105',
      )}
    >
      <Pencil className="w-6 h-6" />
    </button>
  );
}