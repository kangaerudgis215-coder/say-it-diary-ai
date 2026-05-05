import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import { BookOpen, Share2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { ConfettiBurst } from '@/components/lottie/ConfettiBurst';
import fireAnimation from '@/assets/fire.json';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface CompletionScreenProps {
  streak: number;
  expressions: string[];
  /** Optional richer details for each expression so we can render a
   * highlight list (with meanings) on the streak screen. */
  expressionDetails?: {
    expression: string;
    meaning?: string | null;
    pos_or_type?: string | null;
  }[];
  /** True when the diary being completed is from a past date (back-filled). */
  isPastDiary?: boolean;
  /** yyyy-MM-dd of the diary's date — used to show date context for past entries. */
  diaryDate?: string;
}

function getStreakMessage(streak: number): string {
  if (streak >= 30) return '🏆 伝説的！あなたは英語学習の達人です！';
  if (streak >= 14) return '🔥 2週間連続！素晴らしい習慣ですね！';
  if (streak >= 7) return '🌟 1週間達成！この調子で続けよう！';
  if (streak >= 3) return '💪 3日連続！良いリズムだね！';
  if (streak >= 1) return '✨ いいスタート！明日も続けよう！';
  return '🌱 今日が新しいスタート！一歩ずつ進もう！';
}

function useCountUp(target: number, duration = 1400, startDelay = 350) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);
  useEffect(() => {
    startedRef.current = false;
    setValue(0);
    const startTimer = setTimeout(() => {
      startedRef.current = true;
      let raf = 0;
      let t0: number | null = null;
      const step = (ts: number) => {
        if (t0 === null) t0 = ts;
        const p = Math.min(1, (ts - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(Math.round(target * eased));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }, startDelay);
    return () => clearTimeout(startTimer);
  }, [target, duration, startDelay]);
  return value;
}

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function CompletionScreen({ streak, expressions, expressionDetails, isPastDiary = false, diaryDate }: CompletionScreenProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playBigSuccess } = useSuccessSound();
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const display = useCountUp(streak);
  const todayDow = (new Date().getDay() + 6) % 7; // Mon=0..Sun=6
  // Truthful per-day completion for the current Mon→Sun week.
  const [weekDone, setWeekDone] = useState<boolean[]>(() => Array(7).fill(false));

  useEffect(() => {
    playBigSuccess();
    setTimeout(() => setShow(true), 100);
  }, [playBigSuccess]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      // Build the 7 dates of the current week (Mon..Sun).
      const today = new Date();
      const monday = subDays(today, todayDow);
      const dates = Array.from({ length: 7 }, (_, i) =>
        format(subDays(monday, -i), 'yyyy-MM-dd'),
      );
      const { data } = await supabase
        .from('diary_entries')
        .select('date')
        .eq('user_id', user.id)
        .in('date', dates);
      if (cancelled) return;
      const set = new Set((data || []).map((r: any) => r.date));
      setWeekDone(dates.map((d) => set.has(d)));
    })();
    return () => {
      cancelled = true;
    };
  }, [user, todayDow]);

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://say-it-diary-ai.lovable.app';
    const exprLine = expressions.length > 0
      ? `\n今日の表現: ${expressions.slice(0, 3).join(' / ')}`
      : '';
    const text = `AI英語日記 SO-KI で${streak}日連続学習中！🔥\n今日も英語日記を完了しました ✨${exprLine}\n#SOKI #SayItDiary #英語学習`;
    const shareData: ShareData = {
      title: 'AI英語日記 SO-KI',
      text,
      url: shareUrl,
    };

    // Prefer the native share sheet when available (mobile + supported desktops).
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        if (typeof (navigator as any).canShare === 'function' && !(navigator as any).canShare(shareData)) {
          throw new Error('canShare returned false');
        }
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        // AbortError = user cancelled; do nothing
        if (err && (err.name === 'AbortError' || /aborted/i.test(err.message || ''))) return;
        // Otherwise fall through to clipboard fallback
      }
    }

    // Clipboard fallback with toast confirmation
    try {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      toast({
        title: 'シェア用テキストをコピーしました',
        description: 'SNSに貼り付けてシェアしてね ✨',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'シェアに失敗しました',
        description: 'もう一度お試しください。',
      });
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between p-6 relative overflow-hidden bg-background"
    >
      {/* Soft warm radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, hsl(38 92% 55% / 0.28), transparent 60%)',
        }}
      />
      <ConfettiBurst active={show} duration={2400} />

      <div className="flex-1" />

      <div
        className={`relative z-10 flex flex-col items-center text-center transition-all duration-700 ${
          show ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'
        }`}
      >
        {/* Fire animation */}
        <div className="w-48 h-48 streak-glow">
          <Lottie animationData={fireAnimation} loop autoplay className="w-full h-full" />
        </div>

        {/* Big count-up number */}
        <div
          className="-mt-2 text-[7rem] leading-none font-black tabular-nums"
          style={{
            background:
              'linear-gradient(135deg, hsl(38 95% 62%), hsl(20 95% 58%))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 6px 24px hsl(38 92% 55% / 0.45))',
          }}
        >
          {display}
        </div>
        <div
          className="mt-1 text-xl font-extrabold tracking-widest uppercase"
          style={{ color: 'hsl(38 92% 60%)' }}
        >
          {streak === 1 ? 'Day Streak!' : 'Day Streak!'}
        </div>

        {/* Message */}
        <p className="mt-4 text-base font-medium text-foreground/90 max-w-xs">
          {isPastDiary
            ? '過去の日記もどんどん埋めて、ストリークを繋げていこう！🔥'
            : getStreakMessage(streak)}
        </p>
        {isPastDiary && diaryDate && (
          <p className="mt-1 text-xs text-muted-foreground">
            {diaryDate} の日記を完了しました
          </p>
        )}

        {/* Weekday checks */}
        <div className="mt-6 flex gap-2">
          {WEEK_LABELS.map((d, i) => {
            const isToday = i === todayDow;
            const active = weekDone[i] || isToday; // today implicitly counts (we just finished)
            return (
              <div
                key={i}
                className={`w-9 h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold transition-all ${
                  active
                    ? 'bg-gradient-to-b from-amber-400/90 to-orange-500/90 text-white shadow-[0_4px_14px_hsl(38_92%_55%/0.4)]'
                    : 'bg-card/60 border border-border/60 text-muted-foreground'
                }`}
                style={{
                  transform: show ? 'translateY(0)' : 'translateY(8px)',
                  opacity: show ? 1 : 0,
                  transition: `all 400ms ease-out ${600 + i * 70}ms`,
                }}
              >
                <span>{d}</span>
                <span className="mt-1 text-base leading-none">{active ? '✓' : '·'}</span>
              </div>
            );
          })}
        </div>

        {/* Expressions learned — hero treatment so the spoils of today's
            diary feel like a reward, not a footnote. */}
        {(expressionDetails && expressionDetails.length > 0) || expressions.length > 0 ? (
          <div className="w-full max-w-sm mt-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-300 drop-shadow-[0_0_8px_hsl(38_92%_55%/0.6)]" />
              <p className="text-[11px] tracking-[0.22em] uppercase font-bold text-amber-200/90">
                今日獲得した表現
              </p>
              <Sparkles className="w-4 h-4 text-amber-300 drop-shadow-[0_0_8px_hsl(38_92%_55%/0.6)]" />
            </div>

            <div
              className="relative rounded-2xl p-4 border border-amber-300/30 bg-gradient-to-b from-amber-500/10 to-orange-600/5 shadow-[0_8px_30px_-8px_hsl(38_92%_55%/0.45)] backdrop-blur-sm"
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-md">
                +{(expressionDetails?.length || expressions.length)} new
              </div>

              <ul className="space-y-2 mt-2">
                {(expressionDetails && expressionDetails.length > 0
                  ? expressionDetails
                  : expressions.map((e) => ({ expression: e, meaning: null, pos_or_type: null }))
                ).map((exp, i) => (
                  <li
                    key={i}
                    className="flex flex-col gap-0.5 rounded-xl px-3 py-2 bg-card/40 border border-amber-200/20"
                    style={{
                      transform: show ? 'translateY(0)' : 'translateY(8px)',
                      opacity: show ? 1 : 0,
                      transition: `all 500ms ease-out ${900 + i * 110}ms`,
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold text-sm text-amber-100">
                        {exp.expression}
                      </span>
                      {exp.pos_or_type && (
                        <span className="text-[9px] uppercase tracking-wider text-amber-300/70">
                          {exp.pos_or_type}
                        </span>
                      )}
                    </div>
                    {exp.meaning && (
                      <p className="text-[11px] leading-snug text-foreground/70">
                        {exp.meaning}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div
        className={`relative z-10 w-full max-w-xs space-y-3 mt-8 transition-all duration-700 delay-300 ${
          show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
          <Button
            className="w-full"
            onClick={() => navigate('/expressions')}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            表現リストで確認する
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4 mr-2" />
            シェアする
          </Button>

          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => navigate('/')}
          >
            ホームに戻る
          </Button>
      </div>
    </div>
  );
}
