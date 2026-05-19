/**
 * Review Hub - Diary review page from calendar (same layout as DiaryReview)
 */
import { useState, useEffect, useCallback, useRef, type TouchEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Volume2, Loader2, BookOpen, PenLine, ChevronLeft, ChevronRight, CalendarDays, Sparkles, Shuffle, Trash2 } from 'lucide-react';
import { SandyLoader } from '@/components/lottie/SandyLoader';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HighlightableText } from '@/components/HighlightableText';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { normalizeForExpression } from '@/lib/textComparison';
import { buildPracticeSentences, persistDiarySentences, type PracticeSentence } from '@/lib/practiceBuilder';
import { cleanupInvalidDiaryLinkedExpressions, partitionExpressionsForText } from '@/lib/expressionValidation';
import { cn } from '@/lib/utils';
import { speakDiary, cancelDiaryTTS } from '@/lib/diaryTTS';

export function ReviewHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const diaryId = searchParams.get('diaryId');
  const diaryDateParam = searchParams.get('date');

  const [diaryEntry, setDiaryEntry] = useState<any>(null);
  const [expressions, setExpressions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [highlightedExpression, setHighlightedExpression] = useState<string | null>(null);
  const [allEntries, setAllEntries] = useState<{ id: string; date: string; created_at: string }[]>([]);
  const [swipeDx, setSwipeDx] = useState(0);
  const [recallCompleted, setRecallCompleted] = useState(false);
  const touchRef = useRef<{ x: number; y: number; dx: number; locked: 'h' | 'v' | null } | null>(null);

  // Correction state
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Expression alternatives state
  const [altDialogOpen, setAltDialogOpen] = useState(false);
  const [altTargetExpr, setAltTargetExpr] = useState<any>(null);
  const [altLoading, setAltLoading] = useState(false);
  const [altOptions, setAltOptions] = useState<Array<{ expression: string; meaning?: string; tone?: string }>>([]);
  const [altApplying, setAltApplying] = useState(false);
  const [deletingExpressionId, setDeletingExpressionId] = useState<string | null>(null);

  useEffect(() => {
    if (user && diaryId) {
      loadDiary();
    }
  }, [user, diaryId]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from('diary_entries')
        .select('id, date, created_at')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      setAllEntries((data || []) as { id: string; date: string; created_at: string }[]);
    })();
  }, [user, diaryId]);

  const loadDiary = async () => {
    if (!user || !diaryId) return;
    setIsLoading(true);

    await cleanupInvalidDiaryLinkedExpressions(supabase, user.id);

    const { data: entry } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('id', diaryId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!entry) {
      setIsLoading(false);
      return;
    }

    setDiaryEntry(entry);

    const { data: exprs } = await supabase.from('expressions').select('*').eq('diary_entry_id', entry.id);
    const { valid } = partitionExpressionsForText(exprs || [], entry.content || '');
    setExpressions(valid);

    // Check if user has completed at least one recall session for this diary
    const { count } = await supabase
      .from('recall_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('diary_entry_id', entry.id)
      .eq('completed', true);
    setRecallCompleted((count ?? 0) > 0);

    setIsLoading(false);
  };

  const handlePlayAudio = useCallback(() => {
    if (!diaryEntry?.content || isPlayingAudio) return;
    setIsPlayingAudio(true);
    speakDiary(diaryEntry.content, {
      rate: 0.9,
      onEnd: () => setIsPlayingAudio(false),
      onError: () => setIsPlayingAudio(false),
    });
  }, [diaryEntry, isPlayingAudio]);

  const handleStopAudio = useCallback(() => {
    cancelDiaryTTS();
    setIsPlayingAudio(false);
  }, []);

  const handleExpressionTap = (expression: string) => {
    setHighlightedExpression(prev => prev === expression ? null : expression);
    setTimeout(() => {
      document.getElementById('highlight-target')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const openAlternatives = async (exp: any) => {
    setAltTargetExpr(exp);
    setAltOptions([]);
    setAltDialogOpen(true);
    setAltLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            type: 'expression_alternatives',
            diary: diaryEntry?.content,
            expression: exp.expression,
          }),
        }
      );
      if (!res.ok) throw new Error('Failed to fetch alternatives');
      const data = await res.json();
      const alts = Array.isArray(data?.alternatives) ? data.alternatives : [];
      setAltOptions(
        alts
          .map((a: any) => ({
            expression: String(a?.expression ?? '').trim(),
            meaning: a?.meaning ?? '',
            tone: a?.tone ?? '',
          }))
          .filter((a: any) => a.expression.length > 0)
      );
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'エラー', description: '言い換え候補の取得に失敗しました' });
      setAltDialogOpen(false);
    } finally {
      setAltLoading(false);
    }
  };

  const applyAlternative = async (replacement: string) => {
    if (!user || !diaryEntry || !altTargetExpr) return;
    const original = String(altTargetExpr.expression ?? '').trim();
    const repl = replacement.trim();
    if (!original || !repl || original === repl) {
      setAltDialogOpen(false);
      return;
    }
    setAltApplying(true);
    try {
      // Case-insensitive substring replacement (first occurrence) preserving surrounding text
      const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'i');
      const newContent: string = String(diaryEntry.content ?? '').replace(re, repl);
      if (newContent === diaryEntry.content) {
        toast({ variant: 'destructive', title: '差し替えできません', description: '元の表現が本文に見つかりませんでした' });
        setAltApplying(false);
        return;
      }

      // Update important_sentences too
      const oldImportant = Array.isArray(diaryEntry.important_sentences) ? diaryEntry.important_sentences : [];
      const newImportant = oldImportant.map((s: any) => {
        const eng = String(s?.english ?? '');
        const newEng = eng.replace(re, repl);
        const exprs = Array.isArray(s?.expressions)
          ? s.expressions.map((x: string) => (String(x).toLowerCase() === original.toLowerCase() ? repl : x))
          : [];
        return { ...s, english: newEng, expressions: exprs };
      });

      await supabase
        .from('diary_entries')
        .update({
          content: newContent,
          important_sentences: newImportant,
          word_count: newContent.split(/\s+/).length,
        })
        .eq('id', diaryEntry.id);

      // Update expressions table: replace the targeted expression row in place
      await supabase
        .from('expressions')
        .update({
          expression: repl,
          meaning: altOptions.find((o) => o.expression === repl)?.meaning || altTargetExpr.meaning || null,
        })
        .eq('id', altTargetExpr.id)
        .eq('user_id', user.id);

      // Rebuild practice sentences so STEP4 quiz uses the new wording
      const { data: refreshedExprs } = await supabase
        .from('expressions')
        .select('expression')
        .eq('user_id', user.id)
        .eq('diary_entry_id', diaryEntry.id);
      const exprList = (refreshedExprs || []).map((e: any) => e.expression);
      const practice = buildPracticeSentences(
        newContent,
        diaryEntry.japanese_summary,
        exprList,
        newImportant
      );
      await persistDiarySentences(supabase, user.id, diaryEntry.id, practice);

      toast({ title: '表現を差し替えました ✨', description: `${original} → ${repl}` });
      setAltDialogOpen(false);
      setAltTargetExpr(null);
      setAltOptions([]);
      await loadDiary();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'エラー', description: e?.message || '差し替えに失敗しました' });
    } finally {
      setAltApplying(false);
    }
  };

  const deleteExpression = async (exp: any) => {
    if (!user || !diaryEntry || !exp?.id) return;
    const expressionText = String(exp.expression ?? '').trim();
    setDeletingExpressionId(exp.id);
    try {
      const { error } = await supabase
        .from('expressions')
        .delete()
        .eq('id', exp.id)
        .eq('user_id', user.id);
      if (error) throw error;

      const oldImportant = Array.isArray(diaryEntry.important_sentences) ? diaryEntry.important_sentences : [];
      const newImportant = oldImportant.map((s: any) => ({
        ...s,
        expressions: Array.isArray(s?.expressions)
          ? s.expressions.filter((x: string) => String(x).toLowerCase() !== expressionText.toLowerCase())
          : [],
      }));

      await supabase
        .from('diary_entries')
        .update({ important_sentences: newImportant })
        .eq('id', diaryEntry.id)
        .eq('user_id', user.id);

      const remaining = expressions
        .filter((item) => item.id !== exp.id)
        .map((item) => item.expression);
      const practice = buildPracticeSentences(
        diaryEntry.content,
        diaryEntry.japanese_summary,
        remaining,
        newImportant,
      );
      await persistDiarySentences(supabase, user.id, diaryEntry.id, practice);

      toast({ title: '表現を削除しました', description: 'この日記の練習リストから外しました。' });
      await loadDiary();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'エラー', description: e?.message || '表現の削除に失敗しました' });
    } finally {
      setDeletingExpressionId(null);
    }
  };

  const currentIdx = allEntries.findIndex((e) => e.id === diaryId);
  const olderEntry = currentIdx >= 0 ? allEntries[currentIdx + 1] : undefined;
  const newerEntry = currentIdx > 0 ? allEntries[currentIdx - 1] : undefined;

  const goSibling = useCallback(
    (target?: { id: string; date: string }) => {
      if (!target) return;
      navigate(`/review?diaryId=${target.id}&date=${target.date}`);
    },
    [navigate],
  );

  const handleTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, dx: 0, locked: null };
  };

  const handleTouchMove = (e: TouchEvent) => {
    const s = touchRef.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (s.locked === null && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
      s.locked = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'h' : 'v';
    }
    if (s.locked === 'h') {
      s.dx = dx;
      setSwipeDx(Math.max(-140, Math.min(140, dx)));
    }
  };

  const handleTouchEnd = () => {
    const dx = touchRef.current?.dx ?? 0;
    const locked = touchRef.current?.locked;
    touchRef.current = null;
    setSwipeDx(0);
    if (locked !== 'h' || Math.abs(dx) < 72) return;
    if (dx > 0) goSibling(olderEntry);
    if (dx < 0) goSibling(newerEntry);
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

      const diaryNorm = normalizeForExpression(String(data.diary ?? ''));
      const candidates = Array.isArray(data.expressions) ? data.expressions : [];
      const validExprs = candidates
        .map((exp: any) => ({
          expression: String(exp?.expression ?? '').trim(),
          meaning: exp?.meaning ?? null,
          example: exp?.example ?? null,
          scene_or_context: exp?.scene_or_context ?? null,
          pos_or_type: exp?.pos_or_type === 'fixed phrase' ? 'idiom' : (exp?.pos_or_type ?? null),
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
      await loadDiary();
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

  const displayDate = diaryEntry?.date || diaryDateParam;
  const parsedDate = displayDate ? parseISO(displayDate) : new Date();
  const monthLabel = format(parsedDate, 'MMM').toUpperCase();
  const dayLabel = format(parsedDate, 'd');
  const yearLabel = format(parsedDate, 'yyyy');
  const weekdayLabel = format(parsedDate, 'EEEE');
  const reorderDone = Boolean(diaryEntry?.sentences_review_completed);

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

  return (
    <div className="min-h-screen flex flex-col p-5 safe-bottom overflow-hidden">
      <header className="mb-5 space-y-4">
        <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Home">
          <ArrowLeft className="w-5 h-5" />
        </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" disabled={!olderEntry} onClick={() => goSibling(olderEntry)} aria-label="Previous diary">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" disabled={!newerEntry} onClick={() => goSibling(newerEntry)} aria-label="Next diary">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 px-4 py-4 shadow-sm">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.20),transparent_62%)]" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_24px_hsl(var(--primary)/0.18)]">
              <span className="text-[10px] font-black tracking-[0.18em]">{monthLabel}</span>
              <span className="text-3xl font-black leading-none tabular-nums">{dayLabel}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/90">
                <CalendarDays className="h-3.5 w-3.5" /> Diary Date
              </div>
              <h1 className="mt-1 text-2xl font-black leading-tight text-foreground">{weekdayLabel}</h1>
              <p className="text-sm font-medium text-muted-foreground">{monthLabel} {dayLabel}, {yearLabel}</p>
            </div>
            {recallCompleted && (
              <div
                className="ml-auto shrink-0 drop-shadow-[0_0_18px_hsl(var(--primary)/0.7)]"
                aria-label="Recall completed"
                title="Recall completed"
              >
                <DotLottieReact
                  src="/anim/winner.lottie"
                  autoplay
                  loop
                  style={{ width: 96, height: 96 }}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      <div
        className="flex-1 space-y-4 overflow-y-auto touch-pan-y transition-transform duration-200"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${swipeDx}px)` }}
      >
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
            <HighlightableText text={diaryEntry.content} highlightTerm={highlightedExpression} />

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
                {expressions.map((exp: any) => (
                  <div
                    key={exp.id}
                    className={cn(
                      "w-full bg-muted rounded-lg p-3 transition-all duration-200",
                      highlightedExpression === exp.expression
                        ? "ring-2 ring-primary bg-primary/10"
                        : ""
                    )}
                  >
                    <button
                      className="w-full text-left"
                      onClick={() => handleExpressionTap(exp.expression)}
                    >
                      <p className="font-medium text-sm text-primary">{exp.expression}</p>
                      {exp.meaning && <p className="text-xs text-muted-foreground mt-1">{exp.meaning}</p>}
                      {exp.example_sentence && (
                        <p className="text-xs text-muted-foreground/70 mt-1 italic">e.g. {exp.example_sentence}</p>
                      )}
                    </button>
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingExpressionId === exp.id}
                        onClick={() => deleteExpression(exp)}
                      >
                        {deletingExpressionId === exp.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        削除
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => openAlternatives(exp)}
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        他の言い方
                      </Button>
                    </div>
                  </div>
                ))}
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
          onClick={() => navigate(`/quiz?diaryId=${diaryId}&date=${diaryDateParam ?? ''}`)}
        >
          🏋️ {reorderDone ? 'もう一度並び替え問題に挑戦' : '並び替え問題を解いて復習を完了する'}
        </Button>
      </div>

      <Dialog open={altDialogOpen} onOpenChange={(open) => { if (!altApplying) setAltDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              他の言い方
            </DialogTitle>
          </DialogHeader>
          {altTargetExpr && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">元の表現</p>
                <p className="text-sm font-semibold text-primary mt-0.5">{altTargetExpr.expression}</p>
              </div>
              {altLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  候補を生成中...
                </div>
              ) : altOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">候補が見つかりませんでした</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">タップで本文の表現を差し替え</p>
                  {altOptions.map((opt, i) => (
                    <button
                      key={`${opt.expression}-${i}`}
                      disabled={altApplying}
                      onClick={() => applyAlternative(opt.expression)}
                      className="w-full text-left rounded-lg border border-border/60 bg-card hover:bg-primary/5 hover:border-primary/40 transition-colors p-3 disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{opt.expression}</p>
                        {opt.tone && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                            {opt.tone}
                          </span>
                        )}
                      </div>
                      {opt.meaning && (
                        <p className="text-xs text-muted-foreground mt-1">{opt.meaning}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {altApplying && (
                <div className="flex items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  差し替え中...
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ReviewHub;
