/**
 * Review Hub - Diary review page from calendar (same layout as DiaryReview)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Volume2, Loader2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HighlightableText } from '@/components/HighlightableText';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { cleanupInvalidDiaryLinkedExpressions, partitionExpressionsForText } from '@/lib/expressionValidation';
import { cn } from '@/lib/utils';

export function ReviewHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const diaryId = searchParams.get('diaryId');
  const diaryDateParam = searchParams.get('date');

  const [diaryEntry, setDiaryEntry] = useState<any>(null);
  const [expressions, setExpressions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [highlightedExpression, setHighlightedExpression] = useState<string | null>(null);

  useEffect(() => {
    if (user && diaryId) {
      loadDiary();
    }
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

  const dateLabel = diaryDateParam ? format(new Date(diaryDateParam), 'MMMM d, yyyy') : 'Today';

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

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={isPlayingAudio ? handleStopAudio : handlePlayAudio}
                disabled={!diaryEntry.content}
              >
                {isPlayingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                <span className="ml-1 text-xs">{isPlayingAudio ? 'Stop' : 'Listen'}</span>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HighlightableText text={diaryEntry.content} highlightTerm={highlightedExpression} />
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
          onClick={() => navigate(`/quiz?diaryId=${diaryId}&date=${diaryDateParam}`)}
        >
          🏋️ 並び替え問題に挑戦
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/calendar')}>
          Back to Calendar
        </Button>
      </div>
    </div>
  );
}

export default ReviewHub;
