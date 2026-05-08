import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { lovable } from '@/integrations/lovable';
import { useAuth } from '@/hooks/useAuth';
import slideChat from '@/assets/onboarding/v2-01-chat.webp';
import slideDiary from '@/assets/onboarding/v2-02-diary.webp';
import slideQuiz from '@/assets/onboarding/v2-03-quiz.webp';
import slideStreak from '@/assets/onboarding/v2-04-streak.webp';

interface Slide {
  image: string;
  title: string;
  body: string;
  accent?: string;
}

// Flow: Chat → Diary → Quiz → Streak
const slides: Slide[] = [
  {
    image: slideChat,
    accent: '① 話す',
    title: 'まずは話そう、SO-KIと。',
    body: 'マイクをタップして、今日あったことを英語で話すだけ。\n不完全でもOK。SO-KIがやさしく聞き返してくれます。',
  },
  {
    image: slideDiary,
    accent: '② 日記になる',
    title: '会話が、英語日記に変わる。',
    body: 'タップ1回で、AIが会話から自然な英語日記を生成。\n使える表現も自動で抽出され、日本語訳もすぐに確認できます。',
  },
  {
    image: slideQuiz,
    accent: '③ 身につける',
    title: '自分の日記が、教材になる。',
    body: '並び替えクイズで、今日使った表現を定着。\n自分の体験がフックになり、記憶への残り方が違います。',
  },
  {
    image: slideStreak,
    accent: '④ 続く',
    title: '毎日ちょっとずつ、ストリーク。',
    body: '続けるほど炎が育ち、表現が貯まっていく。\nサボった日も、過去の日記でリカバーできるやさしい仕様。',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [index, setIndex] = useState(0);
  const [signingIn, setSigningIn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // If already signed in, skip onboarding.
  useEffect(() => {
    if (!authLoading && user) navigate('/', { replace: true });
  }, [user, authLoading, navigate]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  const goTo = (i: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const handleGoogle = async () => {
    setSigningIn(true);
    try {
      // Mark as onboarded so post-OAuth landing skips onboarding.
      localStorage.setItem('soki_onboarded', '1');
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw new Error((result.error as Error).message ?? 'Sign-in failed');
      if (result.redirected) return;
      navigate('/', { replace: true });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'ログインできませんでした',
        description: err?.message ?? 'もう一度お試しください。',
      });
      setSigningIn(false);
    }
  };

  const isLast = index === slides.length - 1;

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Top bar: progress dots + clear close (skip) button */}
      <header className="flex items-center justify-between px-5 pt-5 pb-2 z-10">
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`スライド ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => goTo(slides.length - 1)}
          aria-label="スキップ"
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
        >
          スキップ
          <X className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Horizontally scrollable slides */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none' }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {slides.map((s, i) => (
          <section
            key={i}
            className="min-w-full snap-center flex flex-col items-center justify-start px-6 pt-2"
          >
            <div className="w-full max-w-sm flex flex-col items-center text-center">
              {s.accent && (
                <span className="inline-block px-3 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-medium tracking-wide mb-3">
                  {s.accent}
                </span>
              )}
              <h2 className="text-2xl sm:text-3xl font-bold leading-tight whitespace-pre-line mb-3">
                {s.title}
              </h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed mb-5">
                {s.body}
              </p>
              <div className="relative w-full flex justify-center">
                <div
                  className="absolute inset-0 pointer-events-none opacity-60 blur-3xl"
                  style={{
                    background:
                      'radial-gradient(ellipse at center, hsl(var(--primary) / 0.25), transparent 60%)',
                  }}
                />
                <img
                  src={s.image}
                  alt={s.title}
                  className="relative max-h-[55vh] w-auto object-contain drop-shadow-2xl"
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* Footer CTA */}
      <footer className="px-6 pb-8 pt-3 flex flex-col items-center gap-3">
        {isLast ? (
          <>
            <Button
              onClick={handleGoogle}
              disabled={signingIn}
              size="lg"
              variant="glow"
              className="w-full max-w-sm h-12 rounded-full bg-white text-slate-900 hover:bg-white/90 shadow-lg"
            >
              {signingIn ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-3 font-semibold">
                  <GoogleIcon />
                  Googleではじめる
                </span>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              登録は<span className="text-primary font-medium">無料</span>・タップ1回で始められます ✨
            </p>
          </>
        ) : (
          <>
            <Button
              onClick={() => goTo(index + 1)}
              size="lg"
              variant="glow"
              className="w-full max-w-sm h-12 rounded-full"
            >
              次へ
            </Button>
            <p className="text-xs text-muted-foreground">
              スワイプでも進めます →
            </p>
          </>
        )}
      </footer>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}