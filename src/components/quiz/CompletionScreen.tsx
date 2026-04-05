import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSuccessSound } from '@/hooks/useSuccessSound';

interface CompletionScreenProps {
  streak: number;
  expressions: string[];
}

function getStreakMessage(streak: number): string {
  if (streak >= 30) return '🏆 伝説的！あなたは英語学習の達人です！';
  if (streak >= 14) return '🔥 2週間連続！素晴らしい習慣ですね！';
  if (streak >= 7) return '🌟 1週間達成！この調子で続けよう！';
  if (streak >= 3) return '💪 3日連続！良いリズムだね！';
  if (streak >= 1) return '✨ いいスタート！明日も続けよう！';
  return '🌱 今日が新しいスタート！一歩ずつ進もう！';
}

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  delay: number;
}

function ShootingStars() {
  const stars = useMemo<Star[]>(() =>
    Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 3 + 2,
      opacity: Math.random() * 0.7 + 0.3,
      delay: Math.random() * 5,
    })),
  []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animation: `twinkle ${star.speed}s ease-in-out ${star.delay}s infinite alternate`,
          }}
        />
      ))}
      {/* Shooting stars */}
      {[0, 1, 2].map((i) => (
        <div
          key={`shoot-${i}`}
          className="absolute w-0.5 h-8 bg-gradient-to-b from-white to-transparent"
          style={{
            left: `${20 + i * 30}%`,
            top: '-10%',
            animation: `shooting-star ${3 + i}s linear ${i * 2.5}s infinite`,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}

export function CompletionScreen({ streak, expressions }: CompletionScreenProps) {
  const navigate = useNavigate();
  const { playBigSuccess } = useSuccessSound();
  const [show, setShow] = useState(false);

  useEffect(() => {
    playBigSuccess();
    setTimeout(() => setShow(true), 100);
  }, [playBigSuccess]);

  const handleShare = async () => {
    const text = `Say It Diaryで${streak}日連続学習中！🔥 今日も英語日記を完了しました ✨ #SayItDiary #英語学習`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative"
      style={{ background: 'linear-gradient(180deg, hsl(222 60% 8%) 0%, hsl(230 50% 12%) 50%, hsl(240 40% 6%) 100%)' }}
    >
      <ShootingStars />

      <div className={`relative z-10 flex flex-col items-center text-center transition-all duration-700 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Streak */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-2">連続記録</p>
          <p
            className="text-7xl font-bold"
            style={{
              background: 'linear-gradient(135deg, hsl(38 92% 60%), hsl(45 100% 70%), hsl(38 92% 60%))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 20px hsl(38 92% 60% / 0.4))',
            }}
          >
            {streak}
          </p>
          <p className="text-lg text-muted-foreground">日</p>
        </div>

        {/* Message */}
        <p className="text-lg font-medium text-foreground mb-8 max-w-xs">
          {getStreakMessage(streak)}
        </p>

        {/* Expressions learned */}
        {expressions.length > 0 && (
          <div className="w-full max-w-sm mb-8">
            <p className="text-sm text-muted-foreground mb-3">今日の表現</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {expressions.map((expr, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-full text-xs border border-primary/30 bg-primary/10 text-primary"
                >
                  {expr}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 w-full max-w-xs">
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
    </div>
  );
}
