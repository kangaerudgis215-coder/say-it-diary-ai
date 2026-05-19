import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Share2, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { ConfettiBurst } from '@/components/lottie/ConfettiBurst';
import { useToast } from '@/hooks/use-toast';

interface CompletionScreenProps {
  streak: number;
  expressions: string[];
  /** Optional richer details for each expression so we can render a
   * highlight list (with meanings) on the review-complete screen. */
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

export function CompletionScreen({ streak, expressions, expressionDetails, isPastDiary = false, diaryDate }: CompletionScreenProps) {
  const navigate = useNavigate();
  const { playBigSuccess } = useSuccessSound();
  const { toast } = useToast();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => playBigSuccess(), 320);
    setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, [playBigSuccess]);

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://say-it-diary-ai.lovable.app';
    const exprLine = expressions.length > 0
      ? `\n今日の表現: ${expressions.slice(0, 3).join(' / ')}`
      : '';
    const text = `AI英語日記 SO-KI で復習を完了しました ✨${exprLine}\n#SO-KI #英語学習 #英語日記`;
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
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, hsl(var(--primary) / 0.22), transparent 60%)',
        }}
      />
      <ConfettiBurst active={show} duration={2400} />

      <div className="flex-1" />

      <div
        className={`relative z-10 flex flex-col items-center text-center transition-all duration-700 ${
          show ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'
        }`}
      >
        <div className="w-24 h-24 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center shadow-[0_0_40px_hsl(var(--primary)/0.35)]">
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </div>
        <h2 className="mt-5 text-3xl font-black tracking-tight">復習完了 ✨</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          {isPastDiary && diaryDate
            ? `${diaryDate} の日記を復習しました。よく頑張ったにゃ！`
            : '並び替え問題を全部クリア！この調子で続けよう。'}
        </p>

        {/* Expressions learned — hero treatment so the spoils of today's
            diary feel like a reward, not a footnote. */}
        {(expressionDetails && expressionDetails.length > 0) || expressions.length > 0 ? (
          <div className="w-full max-w-sm mt-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-300 drop-shadow-[0_0_8px_hsl(38_92%_55%/0.6)]" />
              <p className="text-[11px] tracking-[0.22em] uppercase font-bold text-amber-700 dark:text-amber-200/90">
                今日獲得した表現
              </p>
              <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-300 drop-shadow-[0_0_8px_hsl(38_92%_55%/0.6)]" />
            </div>

            <div
              className="relative rounded-2xl p-4 border border-amber-400/50 dark:border-amber-300/30 bg-gradient-to-b from-amber-100/80 to-orange-100/60 dark:from-amber-500/10 dark:to-orange-600/5 shadow-[0_8px_30px_-8px_hsl(38_92%_55%/0.45)] backdrop-blur-sm"
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
                    className="flex flex-col gap-0.5 rounded-xl px-3 py-2 bg-white/70 dark:bg-card/40 border border-amber-300/40 dark:border-amber-200/20"
                    style={{
                      transform: show ? 'translateY(0)' : 'translateY(8px)',
                      opacity: show ? 1 : 0,
                      transition: `all 500ms ease-out ${900 + i * 110}ms`,
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold text-sm text-amber-900 dark:text-amber-100">
                        {exp.expression}
                      </span>
                      {exp.pos_or_type && (
                        <span className="text-[9px] uppercase tracking-wider text-amber-700/80 dark:text-amber-300/70">
                          {exp.pos_or_type}
                        </span>
                      )}
                    </div>
                    {exp.meaning && (
                      <p className="text-[11px] leading-snug text-amber-950/90 dark:text-amber-100/90">
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
