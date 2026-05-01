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
import { ReadAloudPrompt } from './ReadAloudPrompt';
import { CompletionScreen } from './CompletionScreen';
import { RecallCompletionScreen } from './RecallCompletionScreen';
import { format } from 'date-fns';

type Phase = 'loading' | 'reorder' | 'readAloud' | 'complete';

export function QuizSession() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const diaryId = searchParams.get('diaryId');
  // When `recall=1`, also mark recall_sessions.completed on finish so the
  // diary disappears from the recall queue and the kira-kira badge appears.
  const isRecallMode = searchParams.get('recall') === '1';

  const [phase, setPhase] = useState<Phase>('loading');
  const [sentences, setSentences] = useState<PracticeSentence[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [expressions, setExpressions] = useState<string[]>([]);
  const [fullEnglish, setFullEnglish] = useState('');
  const [fullJapanese, setFullJapanese] = useState('');
  const [diaryDate, setDiaryDate] = useState<string>('');
  const [isPastDiary, setIsPastDiary] = useState(false);
  // True if this diary had NOT had its reorder review completed before this
  // session started. Drives whether we show the celebratory streak screen
  // (first time only) or the calmer recall-completion screen (subsequent runs).
  const [isFirstCompletion, setIsFirstCompletion] = useState(false);

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
      navigate('/');
      return;
    }

    setFullEnglish(entry.content || '');
    setFullJapanese(entry.japanese_summary || '');
    setDiaryDate(entry.date || '');
    const today = format(new Date(), 'yyyy-MM-dd');
    setIsPastDiary(Boolean(entry.date) && entry.date < today);
    // Capture first-completion state BEFORE we mark it completed at the end.
    setIsFirstCompletion(!entry.sentences_review_completed);

    // Get expressions
    const { data: exprs } = await supabase
      .from('expressions')
      .select('expression')
      .eq('diary_entry_id', entry.id);
    const exprStrings = (exprs || []).map((e: any) => e.expression);
    setExpressions(exprStrings);

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
      // Move to next sentence
      setTimeout(() => {
        setCurrentIdx((prev) => prev + 1);
      }, 300);
    } else {
      // All reorder done → read aloud
      setTimeout(() => {
        setPhase('readAloud');
      }, 300);
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

  const markRecallCompleted = async () => {
    if (!user || !diaryId) return;
    // Use upsert-style insert; the unique index on (user_id, diary_entry_id)
    // where completed=true makes this idempotent.
    await supabase
      .from('recall_sessions')
      .insert({
        user_id: user.id,
        diary_entry_id: diaryId,
        completed: true,
      } as any)
      // Ignore duplicate-key errors if already recalled.
      .then(({ error }) => {
        if (error && !/duplicate key|unique/i.test(error.message)) {
          console.warn('[recall_sessions] insert failed:', error.message);
        }
      });
  };

  const finishToRecall = async () => {
    await markReviewCompleted();
    if (isRecallMode) {
      await markRecallCompleted();
    }
    // Reorder + read-aloud are NOT recall. Recall is a separate manual step
    // the user kicks off from the bottom-tab badge or the recall page itself.
    // Just show the local celebration screen and let them choose what's next.
    setPhase('complete');
  };

  const handleReadAloudComplete = () => {
    finishToRecall();
  };

  const handleReadAloudSkip = () => {
    finishToRecall();
  };

  if (phase === 'loading') {
    return (
      <SandyLoader fullscreen label="問題を準備中..." />
    );
  }

  if (phase === 'complete') {
    // First-ever reorder completion for this diary → celebratory streak screen,
    // even if the diary itself is from a past date (back-filling streaks).
    // Any subsequent run (including recall mode) shows the calmer "review done"
    // screen.
    if (isFirstCompletion) {
      return (
        <CompletionScreen
          streak={streak}
          expressions={expressions}
          isPastDiary={isPastDiary}
          diaryDate={diaryDate}
        />
      );
    }
    return <RecallCompletionScreen diaryDate={diaryDate} />;
  }

  if (phase === 'readAloud') {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg">音読チャレンジ</h1>
        </header>
        <div className="flex-1">
          <ReadAloudPrompt
            englishText={fullEnglish}
            japaneseText={fullJapanese}
            onComplete={handleReadAloudComplete}
            onSkip={handleReadAloudSkip}
          />
        </div>
      </div>
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
