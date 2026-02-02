import { useState, useCallback, useMemo } from 'react';

export interface PracticeSentence {
  english: string;
  japanese: string;
  index: number;
}

export type SentenceStep = 'repeat' | 'recall';
export type PracticePhase = 'sentences' | 'final' | 'complete';

export interface SentencePracticeState {
  sentences: PracticeSentence[];
  currentSentenceIndex: number;
  currentStep: SentenceStep;
  repeatCount: number; // 0, 1, 2 for 3 repeats
  phase: PracticePhase;
  clearedSentences: Set<number>;
}

// Split text into sentences
function splitIntoSentences(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

// Split Japanese text into sentences (rough split for now)
function splitJapanese(text: string | null): string[] {
  if (!text) return [];
  // Split on Japanese sentence endings or newlines
  const sentences = text.split(/(?<=[。！？])|(?:\n)/g)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  return sentences;
}

interface ImportantSentence {
  english: string;
  japanese: string;
  expressions?: string[];
}

export function useSentencePractice(
  diaryContent: string, 
  japaneseSummary: string | null,
  importantSentences?: ImportantSentence[]
) {
  // Parse the diary into sentences - use important sentences if provided
  const sentences: PracticeSentence[] = useMemo(() => {
    // If important sentences are provided, use those
    if (importantSentences && importantSentences.length > 0) {
      return importantSentences.map((s, index) => ({
        english: s.english,
        japanese: s.japanese,
        index,
      }));
    }
    
    // Otherwise, split diary content
    const englishSentences = splitIntoSentences(diaryContent);
    const japaneseSentences = splitJapanese(japaneseSummary);
    
    return englishSentences.map((text, index) => ({
      english: text,
      japanese: japaneseSentences[index] || japaneseSummary || '',
      index
    }));
  }, [diaryContent, japaneseSummary, importantSentences]);

  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState<SentenceStep>('repeat');
  const [repeatCount, setRepeatCount] = useState(0);
  const [phase, setPhase] = useState<PracticePhase>('sentences');
  const [clearedSentences, setClearedSentences] = useState<Set<number>>(new Set());

  const totalRepeatSteps = 3; // User repeats 3 times
  const currentSentence = sentences[currentSentenceIndex] || null;
  const totalSentences = sentences.length;

  const progress = useMemo(() => {
    if (phase === 'complete') return 100;
    if (phase === 'final') return 90; // Final quiz is last 10%
    
    // Each sentence has 3 repeats + 1 recall = 4 steps
    const stepsPerSentence = totalRepeatSteps + 1;
    const totalSteps = totalSentences * stepsPerSentence;
    
    const completedSentenceSteps = clearedSentences.size * stepsPerSentence;
    const currentSentenceProgress = currentStep === 'repeat' ? repeatCount : totalRepeatSteps;
    
    const completedSteps = completedSentenceSteps + currentSentenceProgress;
    return Math.round((completedSteps / totalSteps) * 90); // 90% for sentences, 10% for final
  }, [phase, clearedSentences.size, currentStep, repeatCount, totalSentences]);

  const recordRepeat = useCallback(() => {
    if (currentStep !== 'repeat') return;
    
    if (repeatCount < totalRepeatSteps - 1) {
      setRepeatCount(repeatCount + 1);
    } else {
      // Done with repeats, move to recall step
      setCurrentStep('recall');
    }
  }, [currentStep, repeatCount]);

  const markSentenceCleared = useCallback(() => {
    setClearedSentences(prev => new Set([...prev, currentSentenceIndex]));
    
    if (currentSentenceIndex < sentences.length - 1) {
      // Move to next sentence
      setCurrentSentenceIndex(currentSentenceIndex + 1);
      setCurrentStep('repeat');
      setRepeatCount(0);
    } else {
      // All sentences cleared, move to final quiz
      setPhase('final');
    }
  }, [currentSentenceIndex, sentences.length]);

  const retryCurrentSentence = useCallback(() => {
    // Reset to repeat step for current sentence
    setCurrentStep('repeat');
    setRepeatCount(0);
  }, []);

  const markComplete = useCallback(() => {
    setPhase('complete');
  }, []);

  const reset = useCallback(() => {
    setCurrentSentenceIndex(0);
    setCurrentStep('repeat');
    setRepeatCount(0);
    setPhase('sentences');
    setClearedSentences(new Set());
  }, []);

  const getStepInstruction = useCallback((): string => {
    if (phase === 'final') {
      return 'Now say the entire diary in English from memory';
    }
    
    if (currentStep === 'repeat') {
      return `Listen and repeat (${repeatCount + 1}/${totalRepeatSteps})`;
    }
    
    return 'Now recall this sentence in English (Japanese hint below)';
  }, [phase, currentStep, repeatCount]);

  return {
    sentences,
    currentSentence,
    currentSentenceIndex,
    currentStep,
    repeatCount,
    totalRepeatSteps,
    phase,
    clearedSentences,
    progress,
    totalSentences,
    recordRepeat,
    markSentenceCleared,
    retryCurrentSentence,
    markComplete,
    reset,
    getStepInstruction,
    isComplete: phase === 'complete',
    isFinalQuiz: phase === 'final'
  };
}
