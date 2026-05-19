import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useUISound } from '@/hooks/useUISound';
import { cn } from '@/lib/utils';
import { speakAssistantImmediately } from '@/lib/assistantSpeech';
import { getChatWelcomeMessage } from '@/lib/chatWelcome';
import { ComposeModeSheet, getDefaultComposeMode } from './ComposeModeSheet';

interface ComposeFABProps {
  /** Optional date (yyyy-MM-dd) to start a diary for. */
  date?: string;
  /** When true, skip playing the welcome voice (e.g. an entry already exists). */
  skipWelcomeVoice?: boolean;
}

/**
 * Floating circular pencil button — primary diary-compose entry point.
 * Sits above the bottom tab bar in the lower-right corner.
 */
export function ComposeFAB({ date, skipWelcomeVoice = false }: ComposeFABProps) {
  const navigate = useNavigate();
  const { playNavigate } = useUISound();
  const [sheetOpen, setSheetOpen] = useState(false);
  const diaryDate = date ?? format(new Date(), 'yyyy-MM-dd');

  const handleClick = () => {
    playNavigate();
    const defaultMode = getDefaultComposeMode();
    if (defaultMode === 'speak') {
      navigate(`/speak?date=${diaryDate}`);
      return;
    }
    if (defaultMode === 'chat') {
      if (!skipWelcomeVoice) {
        speakAssistantImmediately(getChatWelcomeMessage(diaryDate).content);
      }
      navigate(`/chat?date=${diaryDate}&welcomeSpoken=1`);
      return;
    }
    setSheetOpen(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        aria-label="日記を書く"
        className={cn(
          'fixed right-5 z-50',
          'bottom-[88px]',
          'w-14 h-14 rounded-full',
          'bg-primary text-primary-foreground',
          'shadow-lg shadow-primary/30',
          'flex items-center justify-center',
          'transition-transform active:scale-95 hover:scale-105',
        )}
      >
        <Pencil className="w-6 h-6" />
      </button>
      <ComposeModeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        date={diaryDate}
        skipWelcomeVoice={skipWelcomeVoice}
      />
    </>
  );
}