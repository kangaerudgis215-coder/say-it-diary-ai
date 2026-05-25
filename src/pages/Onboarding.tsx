import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleStart = () => {
    localStorage.setItem('soki_onboarded', '1');
    navigate('/', { replace: true });
  };

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
        {index < slides.length - 1 && (
          <button
            onClick={() => goTo(slides.length - 1)}
            aria-label="スキップ"
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
          >
            スキップ
            <X className="w-3.5 h-3.5" />
          </button>
        )}
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

      {/* Footer: jump straight into the app — data is saved on this device. */}
      <footer className="px-6 pb-8 pt-3 flex flex-col items-center gap-2 border-t border-border/40 bg-background/80 backdrop-blur">
        <Button
          onClick={handleStart}
          size="lg"
          variant="glow"
          className="w-full max-w-sm h-12 rounded-full shadow-lg"
        >
          <span className="flex items-center gap-2 font-semibold">
            <Sparkles className="w-4 h-4" />
            はじめる
          </span>
        </Button>
        <p className="text-[11px] text-muted-foreground">
          登録不要・データはこの端末に保存されます ✨
        </p>
      </footer>
    </div>
  );
}