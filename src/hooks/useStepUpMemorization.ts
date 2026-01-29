import { useState, useCallback, useMemo } from 'react';

export interface Chunk {
  text: string;
  index: number;
}

export interface Sentence {
  text: string;
  chunks: Chunk[];
  index: number;
}

export type PracticeStep = 
  | { type: 'chunk'; sentenceIndex: number; chunkIndex: number }
  | { type: 'sentence'; sentenceIndex: number }
  | { type: 'combination'; startIndex: number; endIndex: number }
  | { type: 'full_recall' };

export type PracticePhase = 'chunks' | 'sentences' | 'combinations' | 'full_recall' | 'complete';

export interface StepUpState {
  sentences: Sentence[];
  currentPhase: PracticePhase;
  currentStep: PracticeStep;
  completedSteps: Set<string>;
  overallProgress: number;
}

// Split text into sentences
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation, keeping the punctuation
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

// Split a sentence into manageable chunks (phrase-level)
function splitIntoChunks(sentence: string): string[] {
  // Remove trailing punctuation for processing, we'll add it back to last chunk
  const punctuation = sentence.match(/[.!?]+$/)?.[0] || '';
  const cleanSentence = sentence.replace(/[.!?]+$/, '').trim();
  
  // Split on natural phrase boundaries: commas, "and", "but", "to", prepositions, etc.
  // But keep chunks reasonably sized (3-7 words ideally)
  const words = cleanSentence.split(/\s+/);
  
  if (words.length <= 4) {
    // Short sentence, keep as one chunk
    return [sentence];
  }
  
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  
  const breakWords = new Set(['and', 'but', 'or', 'so', 'then', 'after', 'before', 'because', 'when', 'while', 'although', 'to']);
  const prepositions = new Set(['in', 'on', 'at', 'with', 'for', 'from', 'about', 'into', 'through', 'during']);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const lowerWord = word.toLowerCase().replace(/,/g, '');
    
    // Check if we should break before this word
    const shouldBreak = (
      currentChunk.length >= 3 && (
        breakWords.has(lowerWord) ||
        (prepositions.has(lowerWord) && currentChunk.length >= 4) ||
        word.endsWith(',')
      )
    );
    
    if (shouldBreak && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
    }
    
    currentChunk.push(word.replace(/,$/g, ''));
    
    // Force break if chunk gets too long
    if (currentChunk.length >= 6 && i < words.length - 1) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
    }
  }
  
  // Add remaining words
  if (currentChunk.length > 0) {
    const lastChunk = currentChunk.join(' ') + punctuation;
    chunks.push(lastChunk);
  }
  
  // If we only got 1 chunk, try to split in half
  if (chunks.length === 1 && words.length > 4) {
    const mid = Math.ceil(words.length / 2);
    return [
      words.slice(0, mid).join(' '),
      words.slice(mid).join(' ') + punctuation
    ];
  }
  
  return chunks;
}

function getStepKey(step: PracticeStep): string {
  switch (step.type) {
    case 'chunk':
      return `chunk-${step.sentenceIndex}-${step.chunkIndex}`;
    case 'sentence':
      return `sentence-${step.sentenceIndex}`;
    case 'combination':
      return `combo-${step.startIndex}-${step.endIndex}`;
    case 'full_recall':
      return 'full_recall';
  }
}

export function useStepUpMemorization(diaryContent: string) {
  // Parse the diary into sentences and chunks
  const sentences: Sentence[] = useMemo(() => {
    const sentenceTexts = splitIntoSentences(diaryContent);
    return sentenceTexts.map((text, index) => ({
      text,
      chunks: splitIntoChunks(text).map((chunkText, chunkIndex) => ({
        text: chunkText,
        index: chunkIndex
      })),
      index
    }));
  }, [diaryContent]);

  // Calculate total steps for progress
  const totalSteps = useMemo(() => {
    let count = 0;
    // Chunk steps
    sentences.forEach(s => {
      count += s.chunks.length; // Each chunk
    });
    // Sentence steps
    count += sentences.length;
    // Combination steps (pairs of sentences)
    if (sentences.length >= 2) {
      count += sentences.length - 1;
    }
    // Full recall
    count += 1;
    return count;
  }, [sentences]);

  const [currentPhase, setCurrentPhase] = useState<PracticePhase>('chunks');
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const currentStep: PracticeStep = useMemo(() => {
    switch (currentPhase) {
      case 'chunks':
        return { type: 'chunk', sentenceIndex: currentSentenceIndex, chunkIndex: currentChunkIndex };
      case 'sentences':
        return { type: 'sentence', sentenceIndex: currentSentenceIndex };
      case 'combinations':
        return { type: 'combination', startIndex: currentSentenceIndex, endIndex: currentSentenceIndex + 1 };
      case 'full_recall':
      case 'complete':
        return { type: 'full_recall' };
    }
  }, [currentPhase, currentSentenceIndex, currentChunkIndex]);

  const overallProgress = useMemo(() => {
    return Math.round((completedSteps.size / totalSteps) * 100);
  }, [completedSteps.size, totalSteps]);

  const getCurrentText = useCallback((): string => {
    switch (currentStep.type) {
      case 'chunk':
        return sentences[currentStep.sentenceIndex]?.chunks[currentStep.chunkIndex]?.text || '';
      case 'sentence':
        return sentences[currentStep.sentenceIndex]?.text || '';
      case 'combination':
        const start = sentences[currentStep.startIndex]?.text || '';
        const end = sentences[currentStep.endIndex]?.text || '';
        return `${start} ${end}`.trim();
      case 'full_recall':
        return diaryContent;
    }
  }, [currentStep, sentences, diaryContent]);

  const getCurrentSentence = useCallback((): Sentence | null => {
    if (currentStep.type === 'chunk' || currentStep.type === 'sentence') {
      return sentences[currentStep.type === 'chunk' ? currentStep.sentenceIndex : currentStep.sentenceIndex] || null;
    }
    return null;
  }, [currentStep, sentences]);

  const markStepComplete = useCallback(() => {
    const key = getStepKey(currentStep);
    setCompletedSteps(prev => new Set([...prev, key]));
  }, [currentStep]);

  const advanceToNextStep = useCallback(() => {
    markStepComplete();

    if (currentPhase === 'chunks') {
      const sentence = sentences[currentSentenceIndex];
      if (currentChunkIndex < sentence.chunks.length - 1) {
        // Next chunk in same sentence
        setCurrentChunkIndex(currentChunkIndex + 1);
      } else if (currentSentenceIndex < sentences.length - 1) {
        // Next sentence's chunks
        setCurrentSentenceIndex(currentSentenceIndex + 1);
        setCurrentChunkIndex(0);
      } else {
        // Done with all chunks, move to sentences
        setCurrentPhase('sentences');
        setCurrentSentenceIndex(0);
      }
    } else if (currentPhase === 'sentences') {
      if (currentSentenceIndex < sentences.length - 1) {
        setCurrentSentenceIndex(currentSentenceIndex + 1);
      } else if (sentences.length >= 2) {
        // Move to combinations
        setCurrentPhase('combinations');
        setCurrentSentenceIndex(0);
      } else {
        // Skip combinations if only 1 sentence
        setCurrentPhase('full_recall');
      }
    } else if (currentPhase === 'combinations') {
      if (currentSentenceIndex < sentences.length - 2) {
        setCurrentSentenceIndex(currentSentenceIndex + 1);
      } else {
        // Move to full recall
        setCurrentPhase('full_recall');
      }
    } else if (currentPhase === 'full_recall') {
      setCurrentPhase('complete');
    }
  }, [currentPhase, currentSentenceIndex, currentChunkIndex, sentences, markStepComplete]);

  const reset = useCallback(() => {
    setCurrentPhase('chunks');
    setCurrentSentenceIndex(0);
    setCurrentChunkIndex(0);
    setCompletedSteps(new Set());
  }, []);

  const getPhaseLabel = useCallback((): string => {
    switch (currentPhase) {
      case 'chunks':
        return 'Chunk Practice';
      case 'sentences':
        return 'Full Sentence Practice';
      case 'combinations':
        return 'Sentence Combinations';
      case 'full_recall':
        return 'Final Memory Test';
      case 'complete':
        return 'Complete!';
    }
  }, [currentPhase]);

  const getStepInstruction = useCallback((): string => {
    switch (currentStep.type) {
      case 'chunk':
        return `Listen and repeat this phrase (Sentence ${currentStep.sentenceIndex + 1}, Part ${currentStep.chunkIndex + 1})`;
      case 'sentence':
        return `Now repeat the full sentence ${currentStep.sentenceIndex + 1}`;
      case 'combination':
        return `Combine sentences ${currentStep.startIndex + 1} and ${currentStep.endIndex + 1}`;
      case 'full_recall':
        return 'Say the entire diary from memory';
    }
  }, [currentStep]);

  const getEncouragingMessage = useCallback((): string => {
    const messages = {
      chunks: [
        "Great, let's try the next chunk!",
        "Nice! Keep going!",
        "You're doing well!",
        "Perfect, onto the next part!"
      ],
      sentences: [
        "Excellent! Now let's practice full sentences.",
        "Great job with that sentence!",
        "You're making good progress!"
      ],
      combinations: [
        "Now let's put sentences together!",
        "You're almost there!",
        "Great flow!"
      ],
      full_recall: [
        "Final step! You've practiced well - now try the whole diary.",
        "It's okay if it's not perfect - you've already done great practice!"
      ]
    };
    const phaseMessages = messages[currentPhase] || messages.chunks;
    return phaseMessages[Math.floor(Math.random() * phaseMessages.length)];
  }, [currentPhase]);

  return {
    sentences,
    currentPhase,
    currentStep,
    completedSteps,
    overallProgress,
    totalSteps,
    getCurrentText,
    getCurrentSentence,
    advanceToNextStep,
    reset,
    getPhaseLabel,
    getStepInstruction,
    getEncouragingMessage,
    isComplete: currentPhase === 'complete'
  };
}
