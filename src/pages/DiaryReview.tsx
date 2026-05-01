import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Volume2, Loader2, BookOpen, PenLine, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { SandyLoader } from '@/components/lottie/SandyLoader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { SelectableText } from '@/components/SelectableText';
import { HighlightableText } from '@/components/HighlightableText';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { normalizeForExpression } from '@/lib/textComparison';
import { findSimilarExpressions } from '@/lib/expressionSimilarity';
import { persistDiarySentences } from '@/lib/practiceBuilder';
import {
  cleanupInvalidDiaryLinkedExpressions,
  partitionExpressionsForText,
} from '@/lib/expressionValidation';
import { cn } from '@/lib/utils';

export default function DiaryReview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const diaryId = searchParams.get('diaryId');
  const diaryDate = searchParams.get('date');

  const [diaryEntry, setDiaryEntry] = useState<any>(null);
  const [expressions, setExpressions] = useState<any[]>([]);
  // expression.id -> { count: number; isReused: boolean }
  // count = total number of times an idea like this expression appears across the user's history (>=1).
  // isReused = at least one *earlier* diary already had a similar expression.
  const [reuseStats, setReuseStats] = useState<Record<string, { count: number; isReused: boolean }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [highlightedExpression, setHighlightedExpression] = useState<string | null>(null);
  // Sibling diaries for swipe navigation (sorted desc by date).
  const [allEntries, setAllEntries] = useState<{ id: string; date: string }[]>([]);
  const [swipeDx, setSwipeDx] = useState(0);
  const touchRef = useRef<{ x: number; y: number; locked: 'h' | 'v' | null } | null>(null);

  // Correction state
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    if (user && diaryId) {
      fetchDiaryEntry();
    }
  }, [user, diaryId]);

  // Load sibling list once per user — used for swipe navigation.
  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from('diary_entries')
        .select('id, date')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      setAllEntries((data || []) as { id: string; date: string }[]);
    })();
  }, [user]);

  const currentIdx = allEntries.findIndex((e) => e.id === diaryId);
  const prevEntry = currentIdx >= 0 ? allEntries[currentIdx + 1] : undefined; // older
  const nextEntry = currentIdx > 0 ? allEntries[currentIdx - 1] : undefined; // newer

  const goSibling = useCallback(
    (target?: { id: string; date: string }) => {
      if (!target) return;
      navigate(`/review?diaryId=${target.id}&date=${target.date}`);
    },
    [navigate],
  );

  // Touch handlers — horizontal swipe to flip between diaries.
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, locked: null };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touchRef.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (s.locked === null) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        s.locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
    }
    if (s.locked === 'h') {
      setSwipeDx(Math.max(-160, Math.min(160, dx)));
    }
  };
  const onTouchEnd = () => {
    const s = touchRef.current;
    touchRef.current = null;
    if (!s) return;
    if (s.locked === 'h') {
      if (swipeDx > 80 && prevEntry) goSibling(prevEntry);
      else if (swipeDx < -80 && nextEntry) goSibling(nextEntry);
    }
    setSwipeDx(0);
  };

  const fetchDiaryEntry = async () => {
    if (!user || !diaryId) return;
    setIsLoading(true);

    await cleanupInvalidDiaryLinkedExpressions(supabase, user.id);

    const { data: entry } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('id', diaryId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (entry) {
      setDiaryEntry(entry);

      const { data: exprs } = await supabase.from('expressions').select('*').eq('diary_entry_id', entry.id);
      const exprList = exprs || [];
      const { valid, invalid } = partitionExpressionsForText(exprList, entry.content || '');
      if (invalid.length > 0) {
        await supabase
          .from('expressions')
          .update({ diary_entry_id: null })
          .in('id', invalid.map((x: any) => x.id))
          .eq('user_id', user.id);
      }
      setExpressions(valid);

      // ----- Reuse / praise stats -----
      // Pull every expression the user has ever had so we can compare ideas
      // across diaries. We praise as soon as a similar expression exists
      // *anywhere else* in the user's history (different id) — including
      // expressions extracted around the same time. This makes the praise
      // pop visibly the moment a phrase is genuinely repeated, rather than
      // depending on strict created_at ordering.
      const { data: allExprs } = await supabase
        .from('expressions')
        .select('id, expression, created_at, diary_entry_id')
        .eq('user_id', user.id);
      const stats: Record<string, { count: number; isReused: boolean }> = {};
      const pool = allExprs || [];
      for (const cur of valid) {
        const matches = findSimilarExpressions(cur.expression, pool);
        const others = matches.filter((m: any) => m.id !== cur.id);
        stats[cur.id] = { count: matches.length, isReused: others.length > 0 };
      }
      setReuseStats(stats);
    }

    setIsLoading(false);
  };

  const handlePlayAudio = useCallback(() => {
    if (!diaryEntry?.content || isPlayingAudio) return;
    setIsPlayingAudio(true);
    const u = new SpeechSynthesisUtterance(diaryEntry.content);
    u.lang = 'en-US';
    u.rate = 0.9;
    u.onend = () => setIsPlayingAudio(false);
    u.onerror = () => setIsPlayingAudio(false);
    speechSynthesis.speak(u);
  }, [diaryEntry, isPlayingAudio]);

  const handleStopAudio = useCallback(() => {
    speechSynthesis.cancel();
    setIsPlayingAudio(false);
  }, []);

  const handleExpressionTap = (expression: string) => {
    setHighlightedExpression(prev => prev === expression ? null : expression);
    setTimeout(() => {
      document.getElementById('highlight-target')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleRegenerate = async () => {
    if (!user || !diaryEntry || !correctionText.trim()) return;
    setIsRegenerating(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            type: 'regenerate_diary',
            diary: diaryEntry.content,
            correction: correctionText.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to regenerate diary');
      }

      const data = await response.json();

      // Sanitize important sentences
      const importantSentences = Array.isArray(data.importantSentences)
        ? data.importantSentences.map((s: any) => {
            const sentNorm = normalizeForExpression(String(s?.english ?? ''));
            const exprs = Array.isArray(s?.expressions)
              ? s.expressions
                  .map((x: any) => String(x ?? '').trim())
                  .filter(Boolean)
                  .filter((x: string) => sentNorm.includes(normalizeForExpression(x)))
              : [];
            return {
              english: String(s?.english ?? '').trim(),
              japanese: String(s?.japanese ?? '').trim(),
              expressions: exprs,
            };
          })
        : [];

      // Update diary entry
      await supabase
        .from('diary_entries')
        .update({
          content: data.diary,
          japanese_summary: data.japaneseSummary,
          word_count: data.diary.split(/\s+/).length,
          important_sentences: importantSentences,
          sentences_review_completed: false,
        })
        .eq('id', diaryEntry.id);

      // Replace expressions
      const diaryNorm = normalizeForExpression(String(data.diary ?? ''));
      const candidates = Array.isArray(data.expressions) ? data.expressions : [];
      const validExprs = candidates
        .map((exp: any) => ({
          expression: String(exp?.expression ?? '').trim(),
          meaning: exp?.meaning ?? null,
          example: exp?.example ?? null,
          scene_or_context: exp?.scene_or_context ?? null,
          pos_or_type: exp?.pos_or_type ?? null,
        }))
        .filter((exp: any) => exp.expression.length > 0)
        .filter((exp: any) => diaryNorm.includes(normalizeForExpression(exp.expression)));

      await supabase
        .from('expressions')
        .delete()
        .eq('user_id', user.id)
        .eq('diary_entry_id', diaryEntry.id)
        .eq('is_user_added', false);

      if (validExprs.length > 0) {
        await supabase.from('expressions').insert(
          validExprs.map((exp: any) => ({
            user_id: user.id,
            diary_entry_id: diaryEntry.id,
            expression: exp.expression,
            meaning: exp.meaning,
            example_sentence: exp.example,
            scene_or_context: exp.scene_or_context,
            pos_or_type: exp.pos_or_type,
          }))
        );
      }

      // Persist diary_sentences
      if (importantSentences.length > 0) {
        await persistDiarySentences(supabase, user.id, diaryEntry.id, importantSentences.map((s: any) => ({
          english: s.english,
          japanese: s.japanese,
          expressions: s.expressions || [],
        })));
      }

      toast({ title: '日記を修正しました ✨' });
      setCorrectionText('');
      setShowCorrection(false);
      await fetchDiaryEntry();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'エラー',
        description: error.message || '再生成に失敗しました',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  if (isLoading) {
    return <SandyLoader fullscreen label="Loading diary..." />;
  }

  if (!diaryEntry) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <p className="text-muted-foreground mb-4">Diary not found.</p>
        <Button variant="ghost" onClick={() => navigate('/')}>Go home</Button>
      </div>
    );
  }

  const d = diaryDate ? parseISO(diaryDate) : new Date();

  return (
    <div
      className="min-h-screen flex flex-col px-6 pt-6 pb-24 safe-bottom"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform: swipeDx ? `translateX(${swipeDx * 0.5}px)` : undefined,
        transition: swipeDx ? 'none' : 'transform 0.25s ease-out',
      }}
    >
      {/* Stylish date header */}
      <header className="relative mb-6 rounded-3xl overflow-hidden border border-border/60 bg-card/60 px-5 py-5">
        <div
          className="absolute inset-0 pointer-events-none opacity-70"
          style={{
            background:
              'radial-gradient(circle at 20% 0%, hsl(var(--primary) / 0.22), transparent 55%)',
          }}
        />
        <div className="relative flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goSibling(prevEntry)}
            disabled={!prevEntry}
            aria-label="Older diary"
            className={cn(
              'shrink-0 w-9 h-9 rounded-full flex items-center justify-center border border-border/60 bg-background/40',
              !prevEntry && 'opacity-30 pointer-events-none',
              prevEntry && 'hover:bg-background/70 transition-colors',
            )}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              {format(d, 'EEEE')}
            </p>
            <div className="mt-1 flex items-baseline justify-center gap-2">
              <span
                className="text-5xl font-black leading-none text-foreground tabular-nums"
                style={{ textShadow: '0 4px 18px hsl(var(--primary) / 0.35)' }}
              >
                {format(d, 'd')}
              </span>
              <span className="text-lg font-semibold text-muted-foreground tracking-wide">
                {format(d, 'MMM')}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground tracking-widest">
              {format(d, 'yyyy')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => goSibling(nextEntry)}
            disabled={!nextEntry}
            aria-label="Newer diary"
            className={cn(
              'shrink-0 w-9 h-9 rounded-full flex items-center justify-center border border-border/60 bg-background/40',
              !nextEntry && 'opacity-30 pointer-events-none',
              nextEntry && 'hover:bg-background/70 transition-colors',
            )}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        {(prevEntry || nextEntry) && (
          <p className="relative mt-3 text-center text-[10px] text-muted-foreground/70">
            ← swipe between diaries →
          </p>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              📝 English Diary
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCorrection(prev => !prev)}
                >
                  <PenLine className="w-4 h-4" />
                  <span className="ml-1 text-xs">修正</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={isPlayingAudio ? handleStopAudio : handlePlayAudio}
                  disabled={!diaryEntry.content}
                >
                  {isPlayingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                  <span className="ml-1 text-xs">{isPlayingAudio ? 'Stop' : 'Listen'}</span>
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {highlightedExpression ? (
              <HighlightableText text={diaryEntry.content} highlightTerm={highlightedExpression} />
            ) : (
              <SelectableText
                text={diaryEntry.content}
                diaryEntryId={diaryEntry.id}
                className="text-sm leading-relaxed"
                onExpressionSaved={fetchDiaryEntry}
              />
            )}

            {showCorrection && (
              <div className="mt-4 space-y-2 border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  修正したい箇所を入力してください（日本語OK）
                </p>
                <Textarea
                  value={correctionText}
                  onChange={e => setCorrectionText(e.target.value)}
                  placeholder="例：最初にカフェに行って、その後に買い物をしました（順番が逆です）"
                  className="text-sm min-h-[80px]"
                  disabled={isRegenerating}
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleRegenerate}
                  disabled={!correctionText.trim() || isRegenerating}
                >
                  {isRegenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      再生成中...
                    </>
                  ) : (
                    '✏️ この内容で日記を修正する'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {expressions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                💡 Key Expressions ({expressions.length})
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/expressions')}
                  className="text-xs"
                >
                  <BookOpen className="w-4 h-4 mr-1" />
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-2">タップで本文中の該当箇所をハイライト</p>
              <div className="space-y-3">
                {expressions.map((exp) => {
                  const stat = reuseStats[exp.id];
                  const isReused = !!stat?.isReused;
                  return (
                    <button
                        key={exp.id}
                        className={cn(
                          'w-full text-left rounded-lg p-3 transition-all duration-200 border',
                          isReused
                            ? 'bg-amber-500/10 border-amber-400/40 hover:bg-amber-500/15'
                            : 'bg-muted border-transparent hover:bg-muted/80',
                          highlightedExpression === exp.expression && 'ring-2 ring-primary bg-primary/10',
                        )}
                        onClick={() => handleExpressionTap(exp.expression)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              'font-medium text-sm',
                              isReused ? 'text-amber-300' : 'text-primary',
                            )}
                          >
                            {exp.expression}
                          </p>
                          {stat && stat.count > 1 && (
                            <span
                              className={cn(
                                'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full',
                                isReused
                                  ? 'bg-amber-400/20 text-amber-300'
                                  : 'bg-muted-foreground/15 text-muted-foreground',
                              )}
                            >
                              ×{stat.count}
                            </span>
                          )}
                        </div>
                        {exp.meaning && (
                          <p className="text-xs text-muted-foreground mt-1">{exp.meaning}</p>
                        )}
                        {exp.example_sentence && (
                          <p className="text-xs text-muted-foreground/70 mt-1 italic">e.g. {exp.example_sentence}</p>
                        )}
                        {isReused && (
                          <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                            <Sparkles className="w-3 h-3" />
                            身についていてすごい！前にも使えていた表現です
                          </p>
                        )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {diaryEntry.japanese_summary && (
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">🇯🇵 日本語訳</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-japanese leading-relaxed text-muted-foreground">
                {diaryEntry.japanese_summary}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-6 space-y-2">
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={() => navigate(`/quiz?diaryId=${diaryId}&date=${diaryDate}`)}
        >
          🏋️ 並び替え問題に挑戦
        </Button>
      </div>
    </div>
  );
}