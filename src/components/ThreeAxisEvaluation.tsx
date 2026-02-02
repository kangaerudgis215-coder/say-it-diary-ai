import { cn } from '@/lib/utils';

export interface ThreeAxisScores {
  meaning: 'excellent' | 'good' | 'needs_work';
  structure: 'excellent' | 'good' | 'needs_work';
  fluency: 'excellent' | 'good' | 'needs_work';
}

interface ThreeAxisEvaluationProps {
  scores: ThreeAxisScores;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const gradeSymbols = {
  excellent: '◎',
  good: '○',
  needs_work: '△',
};

const gradeColors = {
  excellent: 'text-green-400',
  good: 'text-primary',
  needs_work: 'text-yellow-400',
};

const axisLabels = {
  meaning: { en: 'Meaning', ja: '意味' },
  structure: { en: 'Structure', ja: '構文' },
  fluency: { en: 'Fluency', ja: '流暢さ' },
};

export function calculatePassStatus(scores: ThreeAxisScores): { passed: boolean; ratio: number } {
  const values = Object.values(scores);
  const goodCount = values.filter(v => v === 'excellent' || v === 'good').length;
  const ratio = goodCount / values.length;
  return { passed: ratio >= 0.7, ratio };
}

export function mapScoreToGrade(score: number): 'excellent' | 'good' | 'needs_work' {
  if (score >= 85) return 'excellent';
  if (score >= 60) return 'good';
  return 'needs_work';
}

// Convert similarity score to three-axis evaluation
export function evaluateToThreeAxis(
  meaningScore: number,
  structureScore: number,
  fluencyScore: number
): ThreeAxisScores {
  return {
    meaning: mapScoreToGrade(meaningScore),
    structure: mapScoreToGrade(structureScore),
    fluency: mapScoreToGrade(fluencyScore),
  };
}

// Simple heuristic to compute 3 axis scores from a single similarity score + text analysis
export function computeThreeAxisFromText(
  userText: string,
  targetText: string,
  similarityScore: number
): ThreeAxisScores {
  const userWords = userText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const targetWords = targetText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  
  // Meaning: based on overall similarity
  const meaningScore = similarityScore;
  
  // Structure: rough heuristic based on word count ratio and ordering
  const wordCountRatio = Math.min(userWords.length / Math.max(targetWords.length, 1), 1.5);
  const structureBase = similarityScore * 0.7 + (wordCountRatio > 0.7 && wordCountRatio < 1.3 ? 30 : 10);
  const structureScore = Math.min(structureBase, 100);
  
  // Fluency: heuristic based on common filler detection and response length
  const fillers = ['um', 'uh', 'like', 'you know', '...'];
  const fillerCount = fillers.reduce((count, filler) => 
    count + (userText.toLowerCase().split(filler).length - 1), 0
  );
  const fluencyPenalty = fillerCount * 10;
  const fluencyScore = Math.max(0, similarityScore - fluencyPenalty);

  return evaluateToThreeAxis(meaningScore, structureScore, fluencyScore);
}

export function ThreeAxisEvaluation({ 
  scores, 
  showLabels = true,
  size = 'md',
  className 
}: ThreeAxisEvaluationProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  const labelSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const { passed } = calculatePassStatus(scores);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Three axis scores */}
      <div className="flex justify-center gap-6">
        {(Object.keys(scores) as Array<keyof ThreeAxisScores>).map((axis) => (
          <div key={axis} className="text-center">
            <span className={cn(sizeClasses[size], gradeColors[scores[axis]], "font-bold")}>
              {gradeSymbols[scores[axis]]}
            </span>
            {showLabels && (
              <p className={cn(labelSizeClasses[size], "text-muted-foreground mt-1")}>
                {axisLabels[axis].en}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Pass/Retry message */}
      <div className={cn(
        "text-center py-2 px-4 rounded-lg",
        passed ? "bg-green-500/20" : "bg-muted"
      )}>
        <p className={cn(
          "font-medium",
          passed ? "text-green-400" : "text-muted-foreground"
        )}>
          {passed ? "✓ Pass! Great work!" : "Keep trying! You're getting there."}
        </p>
      </div>
    </div>
  );
}
