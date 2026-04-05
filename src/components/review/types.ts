/**
 * Types for the review flow
 */

export interface ReviewSentence {
  english: string;
  japanese: string;
  expressions: string[];
  index: number;
  hasExpressions: boolean;
}
