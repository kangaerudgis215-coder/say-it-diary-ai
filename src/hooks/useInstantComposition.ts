import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { ThreeAxisScores, computeThreeAxisFromText, calculatePassStatus } from '@/components/ThreeAxisEvaluation';
import { format } from 'date-fns';

interface ImportantSentence {
  english: string;
  japanese: string;
  expressions?: string[];
}

interface CompositionState {
  diaryId: string;
  sentence: ImportantSentence;
  sentenceIndex: number;
}

export function useInstantComposition() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [currentSentence, setCurrentSentence] = useState<CompositionState | null>(null);
  const [allSentences, setAllSentences] = useState<Array<{ diaryId: string; sentences: ImportantSentence[] }>>([]);
  const [stats, setStats] = useState({ practiced: 0, passed: 0 });

  // Fetch all important sentences from past diaries
  useEffect(() => {
    if (user) {
      fetchSentences();
      fetchTodayStats();
    }
  }, [user]);

  const fetchSentences = async () => {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data: diaries } = await supabase
      .from('diary_entries')
      .select('id, important_sentences, content, japanese_summary')
      .eq('user_id', user.id)
      .lt('date', today)
      .order('date', { ascending: false });

    if (!diaries) {
      setIsLoading(false);
      return;
    }

    // Collect all sentences with their diary IDs
    const sentencesWithDiary: Array<{ diaryId: string; sentences: ImportantSentence[] }> = [];

    for (const diary of diaries) {
      let sentences: ImportantSentence[] = [];
      
      // Try to use important_sentences first
      if (diary.important_sentences && Array.isArray(diary.important_sentences) && diary.important_sentences.length > 0) {
        sentences = (diary.important_sentences as unknown as ImportantSentence[]);
      } else {
        // Fallback: split content into sentences and pair with Japanese
        const englishSentences = diary.content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
        const japaneseParts = diary.japanese_summary?.split(/[。！？]+/).filter((s: string) => s.trim().length > 0) || [];
        
        sentences = englishSentences.slice(0, 5).map((eng: string, i: number) => ({
          english: eng.trim() + (eng.trim().endsWith('.') ? '' : '.'),
          japanese: japaneseParts[i]?.trim() || '',
          expressions: [],
        }));
      }

      if (sentences.length > 0) {
        sentencesWithDiary.push({ diaryId: diary.id, sentences });
      }
    }

    setAllSentences(sentencesWithDiary);
    setIsLoading(false);
  };

  const fetchTodayStats = async () => {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data } = await supabase
      .from('instant_composition_attempts')
      .select('id, passed')
      .eq('user_id', user.id)
      .gte('created_at', today);

    if (data) {
      setStats({
        practiced: data.length,
        passed: data.filter(a => a.passed).length,
      });
    }
  };

  const pickRandomSentence = useCallback(() => {
    if (allSentences.length === 0) {
      setCurrentSentence(null);
      return;
    }

    // Pick random diary
    const randomDiaryIndex = Math.floor(Math.random() * allSentences.length);
    const diary = allSentences[randomDiaryIndex];
    
    // Pick random sentence from that diary
    const randomSentenceIndex = Math.floor(Math.random() * diary.sentences.length);
    const sentence = diary.sentences[randomSentenceIndex];

    setCurrentSentence({
      diaryId: diary.diaryId,
      sentence,
      sentenceIndex: randomSentenceIndex,
    });
  }, [allSentences]);

  const evaluateAnswer = useCallback(async (
    userAnswer: string,
    similarityScore: number
  ): Promise<{ scores: ThreeAxisScores; passed: boolean }> => {
    if (!currentSentence || !user) {
      return { 
        scores: { meaning: 'needs_work', structure: 'needs_work', fluency: 'needs_work' },
        passed: false,
      };
    }

    const scores = computeThreeAxisFromText(
      userAnswer,
      currentSentence.sentence.english,
      similarityScore
    );

    const { passed } = calculatePassStatus(scores);

    // Save attempt to database
    await supabase.from('instant_composition_attempts').insert({
      user_id: user.id,
      diary_entry_id: currentSentence.diaryId,
      sentence_index: currentSentence.sentenceIndex,
      user_answer: userAnswer,
      meaning_grade: scores.meaning,
      structure_grade: scores.structure,
      fluency_grade: scores.fluency,
      passed,
    });

    // Update local stats
    setStats(prev => ({
      practiced: prev.practiced + 1,
      passed: prev.passed + (passed ? 1 : 0),
    }));

    return { scores, passed };
  }, [currentSentence, user]);

  const nextSentence = useCallback(() => {
    pickRandomSentence();
  }, [pickRandomSentence]);

  return {
    isLoading,
    currentSentence,
    hasAnySentences: allSentences.length > 0,
    stats,
    pickRandomSentence,
    evaluateAnswer,
    nextSentence,
  };
}
