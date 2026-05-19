import { useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import { Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { ConfettiBurst } from '@/components/lottie/ConfettiBurst';
import fireAnimation from '@/assets/fire.json';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Props {
  streak: number;
  onClose: () => void;
}

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

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
    const t = setTimeout(() => {
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
    return () => clearTimeout(t);
  }, [target, duration, startDelay]);
  return value;
}

/**
 * Streak celebration shown on Home once after the user finishes generating
 * a diary. Sets a localStorage flag in Chat/Speak and Home reads it.
 */
export function StreakCelebrationOverlay({ streak, onClose }: Props) {
  const { user } = useAuth();
  const { playBigSuccess } = useSuccessSound();
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const display = useCountUp(streak);
  const todayDow = (new Date().getDay() + 6) % 7;
  const [weekDone, setWeekDone] = useState<boolean[]>(() => Array(7).fill(false));

  useEffect(() => {
    const t = window.setTimeout(() => playBigSuccess(), 320);
    setTimeout(() => setShow(true), 60);
    return () => clearTimeout(t);
  }, [playBigSuccess]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
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
    const shareUrl =
      typeof window !== 'undefined' ? window.location.origin : 'https://say-it-diary-ai.lovable.app';
    const text = `AI英語日記 SO-KI で${streak}日連続学習中！🔥\n今日も英語日記を完了しました ✨\n#SOKI #SayItDiary #英語学習`;
    const shareData: ShareData = { title: 'AI英語日記 SO-KI', text, url: shareUrl };
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err && (err.name === 'AbortError' || /aborted/i.test(err.message || ''))) return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      toast({ title: 'シェア用テキストをコピーしました', description: 'SNSに貼り付けてね ✨' });
    } catch {
      toast({ variant: 'destructive', title: 'シェアに失敗しました' });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between p-6 overflow-hidden bg-background animate-fade-in">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, hsl(38 92% 55% / 0.28), transparent 60%)',
        }}
      />
      <ConfettiBurst active={show} duration={2400} />

      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 rounded-full p-2 bg-card/60 backdrop-blur-sm border border-border/60 text-muted-foreground hover:text-foreground"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      <div
        className={`relative z-10 flex flex-col items-center text-center transition-all duration-700 ${
          show ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'
        }`}
      >
        <div className="w-48 h-48 streak-glow">
          <Lottie animationData={fireAnimation} loop autoplay className="w-full h-full" />
        </div>

        <div
          className="-mt-2 text-[7rem] leading-none font-black tabular-nums"
          style={{
            background: 'linear-gradient(135deg, hsl(38 95% 62%), hsl(20 95% 58%))',
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
          Day Streak!
        </div>

        <p className="mt-4 text-base font-medium text-foreground/90 max-w-xs">
          {getStreakMessage(streak)}
        </p>

        <div className="mt-6 flex gap-2">
          {WEEK_LABELS.map((d, i) => {
            const isToday = i === todayDow;
            const active = weekDone[i] || isToday;
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
      </div>

      <div
        className={`relative z-10 w-full max-w-xs space-y-3 mt-8 transition-all duration-700 delay-300 ${
          show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <Button variant="outline" className="w-full" onClick={handleShare}>
          <Share2 className="w-4 h-4 mr-2" />
          シェアする
        </Button>
        <Button className="w-full" onClick={onClose}>
          ホームを見る
        </Button>
      </div>
    </div>
  );
}

export const DIARY_CELEBRATION_FLAG = 'soki:celebrateDiary';
