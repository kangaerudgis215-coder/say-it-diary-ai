/**
 * Review Hub - Diary review page showing diary content and expressions
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Volume2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { cleanupInvalidDiaryLinkedExpressions, partitionExpressionsForText } from '@/lib/expressionValidation';

export function ReviewHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const diaryId = searchParams.get('diaryId');
  const diaryDateParam = searchParams.get('date');

  const [diaryEntry, setDiaryEntry] = useState<any>(null);
  const [expressions, setExpressions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnglishExpanded, setIsEnglishExpanded] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

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
    const exprStrings = valid.map((e: any) => e.expression);
    setExpressions(exprStrings);

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

  const handleDone = useCallback(() => {
    navigate('/calendar');
  }, [navigate]);

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
        {/* Japanese summary */}
        {diaryEntry.japanese_summary && (
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">🇯🇵 What this diary was about</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-japanese">{diaryEntry.japanese_summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Collapsible English diary */}
        <Collapsible open={isEnglishExpanded} onOpenChange={setIsEnglishExpanded}>
          <Card>
            <CardHeader className="pb-2">
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full">
                  <CardTitle className="text-sm flex items-center gap-2">
                    📝 English Diary
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        isPlayingAudio ? handleStopAudio() : handlePlayAudio();
                      }}
                    >
                      {isPlayingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                  </CardTitle>
                  {isEnglishExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <p className="text-sm leading-relaxed">{diaryEntry.content}</p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Key expressions */}
        {expressions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">💡 Key Expressions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {expressions.filter((e, i, arr) => arr.indexOf(e) === i).map((expr, i) => (
                  <span key={i} className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/15">
                    {expr}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-6">
        <Button variant="ghost" size="sm" className="w-full" onClick={handleDone}>
          Back to Calendar
        </Button>
      </div>
    </div>
  );
}

export default ReviewHub;
