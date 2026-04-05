import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { buildPracticeSentences, PracticeSentence } from '@/lib/practiceBuilder';
import { ProgressDots } from './ProgressDots';
import { WordReorderQuiz } from './WordReorderQuiz';
import { ReadAloudPrompt } from './ReadAloudPrompt';
import { CompletionScreen } from './CompletionScreen';

type Phase = 'loading' | 'reorder' | 'readAloud' | 'complete';

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
  const [fullEnglish, setFullEnglish] = useState('');
  const [fullJapanese, setFullJapanese] = useState('');

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

    // Get expressions
    const { data: exprs } = await supabase
      .from('expressions')
      .select('expression')
      .eq('diary_entry_id', entry.id);
    const exprStrings = (exprs || []).map((e: any) => e.expression);
    setExpressions(exprStrings);

    // Build sentences
    const importantSentences = entry.important_sentences as any[] | null;
    const allSentences = buildPracticeSentences(
      entry.content,
      entry.japanese_summary,
      exprStrings,
      importantSentences
    );

    // Select 3-5 based on diary length
    const wordCount = (entry.content || '').split(/\s+/).length;
    let quizCount = 3;
    if (wordCount > 60) quizCount = 4;
    if (wordCount > 100) quizCount = 5;

    // Pick sentences (prefer ones with expressions, then fill with others)
    const withExpr = allSentences.filter(s => s.expressions.length > 0);
    const withoutExpr = allSentences.filter(s => s.expressions.length === 0);
    let selected: PracticeSentence[] = [];

    if (withExpr.length >= quizCount) {
      selected = withExpr.slice(0, quizCount);
    } else {
      selected = [...withExpr, ...withoutExpr].slice(0, quizCount);
    }

    // Ensure at least 1 sentence
    if (selected.length === 0 && allSentences.length > 0) {
      selected = allSentences.slice(0, Math.min(3, allSentences.length));
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

  const handleReadAloudComplete = () => {
    setPhase('complete');
  };

  const handleReadAloudSkip = () => {
    setPhase('complete');
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">問題を準備中...</p>
      </div>
    );
  }

  if (phase === 'complete') {
    return <CompletionScreen streak={streak} expressions={expressions} />;
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
