import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Mic, Sparkles, Zap } from 'lucide-react';
import { format } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useUISound } from '@/hooks/useUISound';
import { speakAssistantImmediately } from '@/lib/assistantSpeech';
import { getChatWelcomeMessage } from '@/lib/chatWelcome';

export type ComposeMode = 'chat' | 'speak';

const STORAGE_KEY = 'soki_default_compose_mode';

export function getDefaultComposeMode(): ComposeMode | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'chat' || v === 'speak' ? v : null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** yyyy-MM-dd */
  date: string;
  /** When true, skip playing the chat welcome voice (entry already exists). */
  skipWelcomeVoice?: boolean;
}

/**
 * Bottom sheet that lets the user pick between SO-KI chat (beginner-friendly)
 * and Speak mode (advanced, mic-only diary capture).
 */
export function ComposeModeSheet({ open, onOpenChange, date, skipWelcomeVoice }: Props) {
  const navigate = useNavigate();
  const { playNavigate } = useUISound();
  const [remember, setRemember] = useState(false);

  const choose = (mode: ComposeMode) => {
    playNavigate();
    if (remember && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
    onOpenChange(false);
    if (mode === 'chat') {
      if (!skipWelcomeVoice) {
        speakAssistantImmediately(getChatWelcomeMessage(date).content);
      }
      navigate(`/chat?date=${date}&welcomeSpoken=1`);
    } else {
      navigate(`/speak?date=${date}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8 pt-6">
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="text-lg">
            {format(new Date(date), 'M月d日')} の日記をどう書く？
          </SheetTitle>
          <SheetDescription className="text-xs">
            お好みのモードを選んでください
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          <ModeCard
            icon={<MessageCircle className="w-5 h-5" />}
            title="SO-KIと会話する"
            badge="おすすめ"
            description="質問に答えていくだけ。英語が出てこなくても安心。"
            onClick={() => choose('chat')}
            tone="primary"
          />
          <ModeCard
            icon={<Mic className="w-5 h-5" />}
            title="話してそのまま日記化"
            badge="上級者向け"
            badgeIcon={<Zap className="w-3 h-3" />}
            description="マイクに話しかけるだけ。音声メモのようにためて日記に。"
            onClick={() => choose('speak')}
            tone="accent"
          />
        </div>

        <label className="mt-5 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Checkbox
            checked={remember}
            onCheckedChange={(v) => setRemember(Boolean(v))}
          />
          次回からこのモードをデフォルトにする
        </label>
      </SheetContent>
    </Sheet>
  );
}

function ModeCard({
  icon,
  title,
  badge,
  badgeIcon,
  description,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeIcon?: React.ReactNode;
  description: string;
  onClick: () => void;
  tone: 'primary' | 'accent';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-2xl border border-border/60 bg-card/70 p-4',
        'transition-all active:scale-[0.98] hover:border-primary/40 hover:bg-card',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            tone === 'primary'
              ? 'bg-primary/15 text-primary'
              : 'bg-amber-500/15 text-amber-400',
          )}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm">{title}</span>
            {badge && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                  tone === 'primary'
                    ? 'bg-primary/15 text-primary'
                    : 'bg-amber-500/15 text-amber-400',
                )}
              >
                {badgeIcon}
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
        <Sparkles className="w-4 h-4 text-muted-foreground/50" />
      </div>
    </button>
  );
}