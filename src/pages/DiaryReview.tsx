import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Volume2, Loader2, BookOpen, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { SelectableText } from '@/components/SelectableText';
import { HighlightableText } from '@/components/HighlightableText';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { normalizeForExpression } from '@/lib/textComparison';
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
  const [isLoading, setIsLoading] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [highlightedExpression, setHighlightedExpression] = useState<string | null>(null);

  // Correction state
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    if (user && diaryId) {
      fetchDiaryEntry();
    }
  }, [user, diaryId]);

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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading diary...</p>
      </div>
    );
  }

  if (!diaryEntry) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <p className="text-muted-foreground mb-4">Diary not found.</p>
        <Button variant="ghost" onClick={() => navigate('/')}>Go home</Button>
      </div>
    );
  }

  const dateLabel = diaryDate ? format(new Date(diaryDate), 'MMMM d, yyyy') : 'Today';

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-xl">Review Diary</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
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
                {expressions.map((exp) => (
                  <button
                    key={exp.id}
                    className={cn(
                      "w-full text-left bg-muted rounded-lg p-3 transition-all duration-200",
                      highlightedExpression === exp.expression
                        ? "ring-2 ring-primary bg-primary/10"
                        : "hover:bg-muted/80"
                    )}
                    onClick={() => handleExpressionTap(exp.expression)}
                  >
                    <p className="font-medium text-sm text-primary">{exp.expression}</p>
                    {exp.meaning && <p className="text-xs text-muted-foreground mt-1">{exp.meaning}</p>}
                    {exp.example_sentence && (
                      <p className="text-xs text-muted-foreground/70 mt-1 italic">e.g. {exp.example_sentence}</p>
                    )}
                  </button>
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
          onClick={() => navigate(`/quiz?diaryId=${diaryId}&date=${diaryDate}`)}
        >
          🏋️ 並び替え問題に挑戦
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </div>
    </div>
  );
}