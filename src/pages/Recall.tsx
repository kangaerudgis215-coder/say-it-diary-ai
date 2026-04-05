import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SelectableText } from '@/components/SelectableText';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import {
  cleanupInvalidDiaryLinkedExpressions,
  partitionExpressionsForText,
} from '@/lib/expressionValidation';

export default function Recall() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const diaryIdFromUrl = searchParams.get('diaryId');
  const modeFromUrl = searchParams.get('mode');

  const [diaryEntry, setDiaryEntry] = useState<any>(null);
  const [expressions, setExpressions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceMode, setSourceMode] = useState<'latest' | 'calendar' | 'random'>('latest');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [didGlobalCleanup, setDidGlobalCleanup] = useState(false);

  useEffect(() => {
    fetchDiaryForRecall();
  }, [user, diaryIdFromUrl, modeFromUrl]);

  const fetchDiaryForRecall = async () => {
    if (!user) return;
    setIsLoading(true);
    setDiaryEntry(null);
    setExpressions([]);

    if (!didGlobalCleanup) {
      await cleanupInvalidDiaryLinkedExpressions(supabase, user.id);
      setDidGlobalCleanup(true);
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    let entry = null;

    if (diaryIdFromUrl) {
      setSourceMode(modeFromUrl === 'random' ? 'random' : 'calendar');
      const { data } = await supabase
        .from('diary_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('id', diaryIdFromUrl)
        .maybeSingle();
      entry = data;
    } else {
      setSourceMode('latest');
      const { data } = await supabase
        .from('diary_entries')
        .select('*')
        .eq('user_id', user.id)
        .lt('date', today)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      entry = data;
    }

    if (entry) {
      const { data: exprs } = await supabase
        .from('expressions')
        .select('*')
        .eq('diary_entry_id', entry.id);

      const exprList = exprs || [];
      const { valid, invalid } = partitionExpressionsForText(exprList, entry.content || '');
      if (invalid.length > 0) {
        await supabase
          .from('expressions')
          .update({ diary_entry_id: null })
          .in('id', invalid.map((x: any) => x.id))
          .eq('user_id', user.id);
      }

      setDiaryEntry(entry);
      setExpressions(valid);
    }

    setIsLoading(false);
  };

  const handlePlayAudio = useCallback(() => {
    if (!diaryEntry?.content || isPlayingAudio) return;
    setIsPlayingAudio(true);
    const utterance = new SpeechSynthesisUtterance(diaryEntry.content);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    speechSynthesis.speak(utterance);
  }, [diaryEntry, isPlayingAudio]);

  const handleStopAudio = useCallback(() => {
    speechSynthesis.cancel();
    setIsPlayingAudio(false);
  }, []);

  const handleGoBack = () => {
    if (sourceMode === 'calendar' || sourceMode === 'random') {
      navigate('/calendar');
    } else {
      navigate('/');
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
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">
          {sourceMode === 'calendar' ? 'No diary for this date' : 'No past diaries yet'}
        </h2>
        <p className="text-muted-foreground mb-6 max-w-xs">
          {sourceMode === 'calendar'
            ? 'There is no diary entry for this date. Try selecting a different day.'
            : "You don't have any past diaries yet. Please complete today's diary first! 💪"}
        </p>
        {sourceMode === 'latest' && (
          <Button variant="glow" onClick={() => navigate('/chat')}>
            Start today's diary
          </Button>
        )}
        <Button variant="ghost" onClick={handleGoBack} className="mt-3">
          {sourceMode !== 'latest' ? 'Back to calendar' : 'Go back home'}
        </Button>
      </div>
    );
  }

  const recallingDateLabel = format(new Date(diaryEntry.date), 'MMMM d, yyyy');
  const getModeLabel = () => {
    switch (sourceMode) {
      case 'random': return ' (random)';
      case 'latest': return ' (most recent)';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={handleGoBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-xl">Recall</h1>
          <p className="text-sm text-muted-foreground">
            {recallingDateLabel}
            <span className="text-primary">{getModeLabel()}</span>
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* Japanese Summary */}
        <Card className="bg-secondary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📖 What this diary was about</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-japanese text-secondary-foreground">
              {diaryEntry.japanese_summary || '(Japanese summary not available)'}
            </p>
          </CardContent>
        </Card>

        {/* English Diary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              📝 English Diary
              <Button
                variant="ghost"
                size="sm"
                onClick={isPlayingAudio ? handleStopAudio : handlePlayAudio}
              >
                {isPlayingAudio ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
                <span className="ml-1 text-xs">{isPlayingAudio ? 'Stop' : 'Listen'}</span>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SelectableText
              text={diaryEntry.content}
              diaryEntryId={diaryEntry.id}
              className="text-sm leading-relaxed"
              onExpressionSaved={fetchDiaryForRecall}
            />
          </CardContent>
        </Card>

        {/* Expressions */}
        {expressions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">💡 Key Expressions ({expressions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expressions.map((exp) => (
                  <div key={exp.id} className="bg-muted rounded-lg p-2">
                    <p className="font-medium text-sm text-primary">{exp.expression}</p>
                    {exp.meaning && (
                      <p className="text-xs text-muted-foreground">{exp.meaning}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-6">
        <Button variant="ghost" size="sm" className="w-full" onClick={handleGoBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
