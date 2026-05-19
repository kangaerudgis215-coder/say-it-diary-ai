import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SandyLoader } from '@/components/lottie/SandyLoader';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { buildPracticeSentences, loadDiarySentences, PracticeSentence } from '@/lib/practiceBuilder';
import { ProgressDots } from './ProgressDots';
import { WordReorderQuiz } from './WordReorderQuiz';
import { CompletionScreen } from './CompletionScreen';
import { format } from 'date-fns';

type Phase = 'loading' | 'reorder' | 'complete' | 'notfound';

export function QuizSession() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const diaryId = searchParams.get('diaryId');

  const [phase, setPhase] = useState<Phase>('loading');
  const [sentences, setSentences] = useState<PracticeSentence[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [expressions, setExpressions] = useState<string[]>([]);
  const [expressionDetails, setExpressionDetails] = useState<
    { expression: string; meaning?: string | null; pos_or_type?: string | null }[]
  >([]);
  const [fullEnglish, setFullEnglish] = useState('');
  const [fullJapanese, setFullJapanese] = useState('');
  const [diaryDate, setDiaryDate] = useState<string>('');
  const [isPastDiary, setIsPastDiary] = useState(false);

  useEffect(() => {
    if (user && diaryId) loadData();
  }, [user, diaryId]);

  const loadData = async () => {
    if (!user || !diaryId) return;

    const { data: entry } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('id', diaryId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!entry) {
      // Don't bounce the user back home — surface a friendly message instead.
      setPhase('notfound');
      return;
    }

    setFullEnglish(entry.content || '');
    setFullJapanese(entry.japanese_summary || '');
    setDiaryDate(entry.date || '');
    const today = format(new Date(), 'yyyy-MM-dd');
    setIsPastDiary(Boolean(entry.date) && entry.date < today);

    // Get expressions
    const { data: exprs } = await supabase
      .from('expressions')
      .select('expression, meaning, pos_or_type')
      .eq('diary_entry_id', entry.id);
    const exprStrings = (exprs || []).map((e: any) => e.expression);
    setExpressions(exprStrings);
    setExpressionDetails(
      (exprs || []).map((e: any) => ({
        expression: e.expression,
        meaning: e.meaning,
        pos_or_type: e.pos_or_type,
      })),
    );

    // Load sentences from diary_sentences table first, fallback to building from content
    let allSentences = await loadDiarySentences(supabase, user.id, entry.id);
    
    if (!allSentences || allSentences.length === 0) {
      const importantSentences = entry.important_sentences as any[] | null;
      allSentences = buildPracticeSentences(
        entry.content,
        entry.japanese_summary,
        exprStrings,
        importantSentences
      );
    }

    // Use ALL sentences - quiz count matches diary sentence count
    let selected = allSentences;
    
    // Cap at 5 max just in case
    if (selected.length > 5) {
      selected = selected.slice(0, 5);
    }

    // Ensure at least 1 sentence
    if (selected.length === 0) {
      const fallback = buildPracticeSentences(entry.content, entry.japanese_summary, exprStrings, null);
      selected = fallback.slice(0, Math.min(3, fallback.length));
    }

    setSentences(selected);

    // Get streak
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_streak')
      .eq('user_id', user.id)
      .maybeSingle();
    setStreak(profile?.current_streak || 0);

    setPhase('reorder');
  };

  const handleReorderCorrect = () => {
    if (currentIdx < sentences.length - 1) {
      setTimeout(() => {
        setCurrentIdx((prev) => prev + 1);
      }, 300);
    } else {
      // All reorder done → mark complete & celebrate.
      finishReview();
    }
  };

  const markReviewCompleted = async () => {
    if (!user || !diaryId) return;
    await supabase
      .from('diary_entries')
      .update({ sentences_review_completed: true })
      .eq('id', diaryId)
      .eq('user_id', user.id);
  };

  const finishReview = async () => {
    await markReviewCompleted();
    setPhase('complete');
  };

  if (phase === 'loading') {
    return (
      <SandyLoader fullscreen label="問題を準備中..." />
    );
  }

  if (phase === 'notfound') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <p className="text-muted-foreground">この日記は見つかりませんでした。</p>
        <Button variant="outline" onClick={() => navigate('/quiz')}>
          復習リストに戻る
        </Button>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <CompletionScreen
        streak={streak}
        expressions={expressions}
        expressionDetails={expressionDetails}
        isPastDiary={isPastDiary}
        diaryDate={diaryDate}
      />
    );
  }

  const currentSentence = sentences[currentIdx];

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      <header className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-lg">並び替えクイズ</h1>
      </header>

      <ProgressDots current={currentIdx} total={sentences.length} />

      <div className="flex-1 mt-6">
        {currentSentence && (
          <WordReorderQuiz
            key={`${currentIdx}-${currentSentence.english}`}
            sentence={currentSentence.english}
            japaneseSentence={currentSentence.japanese}
            onCorrect={handleReorderCorrect}
          />
        )}
      </div>
    </div>
  );
}
