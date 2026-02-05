/**
 * Types for the unified review flow
 */

export interface ReviewSentence {
  english: string;
  japanese: string;
  expressions: string[];
  index: number;
  /** True if this sentence has expressions and should show cloze step */
  hasExpressions: boolean;
}

export interface SentenceProgress {
  clozeCompleted: boolean;
  fullSentenceCompleted: boolean;
  completionCount: number; // Number of times step 2 has been completed
}

export interface DiaryProgress {
  sentenceProgress: Record<number, SentenceProgress>;
  loopsCompleted: number;
  fullDiaryChallengeUnlocked: boolean;
}

export type ReviewStep = 'cloze' | 'full_sentence';
