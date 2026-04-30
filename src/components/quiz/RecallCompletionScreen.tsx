import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Home, BookOpen } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useSuccessSound } from '@/hooks/useSuccessSound';

interface RecallCompletionScreenProps {
  /** ISO date (yyyy-MM-dd) of the diary that was recalled. */
  diaryDate: string;
}

/**
 * Celebration shown after completing a past-day recall quiz.
 * No streak — just a trophy + a big date stamp with a check overlay.
 */
export function RecallCompletionScreen({ diaryDate }: RecallCompletionScreenProps) {
  const navigate = useNavigate();
  const { playBigSuccess } = useSuccessSound();
  const [show, setShow] = useState(false);
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    playBigSuccess();
    const t1 = setTimeout(() => setShow(true), 80);
    const t2 = setTimeout(() => setShowCheck(true), 650);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [playBigSuccess]);

  let dt: Date;
  try {
    dt = parseISO(diaryDate);
    if (Number.isNaN(dt.getTime())) dt = new Date();
  } catch {
    dt = new Date();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 relative overflow-hidden bg-background">
      {/* Soft golden glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 32%, hsl(45 95% 60% / 0.22), transparent 62%)',
        }}
      />

      <div className="flex-1" />

      <div
        className={`relative z-10 flex flex-col items-center text-center transition-all duration-700 ${
          show ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'
        }`}
      >
        {/* Trophy */}
        <div className="w-44 h-44 -mb-2">
          <DotLottieReact
            src="/anim/trophy.lottie"
            autoplay
            loop={false}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Big date stamp with checkmark overlay */}
        <div className="relative mt-2">
          <div
            className="px-7 py-5 rounded-3xl border border-amber-400/40 bg-gradient-to-b from-amber-500/10 to-orange-500/10 backdrop-blur-sm shadow-[0_8px_30px_hsl(38_92%_55%/0.25)]"
          >
            <div className="text-[11px] tracking-[0.25em] uppercase text-amber-400/90 font-bold">
              {format(dt, 'EEEE')}
            </div>
            <div
              className="text-6xl font-black tabular-nums leading-none mt-1"
              style={{
                background: 'linear-gradient(135deg, hsl(45 95% 65%), hsl(28 95% 58%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {format(dt, 'MMM d')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {format(dt, 'yyyy')}
            </div>
          </div>

          {/* Check overlay */}
          <div
            className={`absolute -top-4 -right-4 w-24 h-24 transition-all duration-500 ${
              showCheck ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
            }`}
          >
            <DotLottieReact
              src="/anim/success.lottie"
              autoplay
              loop={false}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        <h2 className="mt-8 text-2xl font-extrabold text-foreground">
          復習完了！
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          お疲れさまでした。一つひとつの積み重ねが、確かな英語力になります ✨
        </p>
      </div>

      <div
        className={`relative z-10 w-full max-w-xs space-y-3 mt-8 transition-all duration-700 delay-300 ${
          show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <Button className="w-full" onClick={() => navigate('/')}>
          <Home className="w-4 h-4 mr-2" />
          ホームに戻る
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate('/quiz')}
        >
          <BookOpen className="w-4 h-4 mr-2" />
          他の復習を続ける
        </Button>
      </div>
    </div>
  );
}
