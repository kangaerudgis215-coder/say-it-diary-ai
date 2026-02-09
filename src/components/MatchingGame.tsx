import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Check, RotateCcw, Shuffle, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useSuccessSound } from '@/hooks/useSuccessSound';

interface ExpressionPair {
  id: string;
  expression: string;
  meaning: string;
}

interface MatchingGameProps {
  expressions: ExpressionPair[];
  onComplete: (matchedIds: string[]) => void;
  onBack: () => void;
  maxPairs?: number;
}

interface CardData {
  id: string;
  type: 'japanese' | 'english';
  text: string;
  pairId: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const DEFAULT_MAX_PAIRS = 6;

export function MatchingGame({ expressions, onComplete, onBack, maxPairs = DEFAULT_MAX_PAIRS }: MatchingGameProps) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [selectedCards, setSelectedCards] = useState<CardData[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [attempts, setAttempts] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [lastWrongPair, setLastWrongPair] = useState<string[] | null>(null);
  const [gameExpressionIds, setGameExpressionIds] = useState<string[]>([]);
  const { playSuccess, playBigSuccess } = useSuccessSound();

  // Calculate how many pairs to use (dynamic based on available expressions)
  const pairsToUse = Math.min(maxPairs, expressions.length);

  // Update stats when a pair is matched
  const updateExpressionStats = useCallback(async (expressionId: string, correct: boolean) => {
    try {
      const { data: currentExpr } = await supabase
        .from('expressions')
        .select('mastery_level, review_count, correct_streak')
        .eq('id', expressionId)
        .single();

      const currentLevel = (currentExpr as any)?.mastery_level || 0;
      const currentReviewCount = (currentExpr as any)?.review_count || 0;
      const currentStreak = (currentExpr as any)?.correct_streak || 0;

      const updates: any = {
        review_count: currentReviewCount + 1,
        last_reviewed_at: new Date().toISOString(),
      };

      if (correct) {
        updates.correct_streak = currentStreak + 1;
        updates.mastery_level = Math.min(currentLevel + 1, 3);
      } else {
        updates.correct_streak = 0;
      }

      await supabase
        .from('expressions')
        .update(updates)
        .eq('id', expressionId);
    } catch (error) {
      console.error('Error updating expression stats:', error);
    }
  }, []);

  // Initialize game with shuffled cards
  const initializeGame = useCallback(() => {
    // Use expressions up to pairsToUse (already prioritized by parent)
    const gameExpressions = expressions.slice(0, pairsToUse);
    
    if (gameExpressions.length < 2) {
      return;
    }

    // Track which expression IDs are in this game
    setGameExpressionIds(gameExpressions.map(e => e.id));

    const allCards: CardData[] = [];
    
    gameExpressions.forEach(expr => {
      // Japanese card
      allCards.push({
        id: `jp-${expr.id}`,
        type: 'japanese',
        text: expr.meaning,
        pairId: expr.id,
        isFlipped: false,
        isMatched: false,
      });
      // English card
      allCards.push({
        id: `en-${expr.id}`,
        type: 'english',
        text: expr.expression,
        pairId: expr.id,
        isFlipped: false,
        isMatched: false,
      });
    });

    // Shuffle cards
    const shuffled = [...allCards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setSelectedCards([]);
    setMatchedPairs(new Set());
    setAttempts(0);
    setShowResult(false);
    setLastWrongPair(null);
  }, [expressions, pairsToUse]);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  const handleCardClick = useCallback((card: CardData) => {
    // Ignore if already matched or already selected
    if (card.isMatched || selectedCards.find(c => c.id === card.id)) {
      return;
    }

    // Ignore if two cards already selected
    if (selectedCards.length >= 2) {
      return;
    }

    // Don't allow selecting two cards of the same type
    if (selectedCards.length === 1 && selectedCards[0].type === card.type) {
      // Deselect and select new one
      setSelectedCards([card]);
      setLastWrongPair(null);
      return;
    }

    const newSelected = [...selectedCards, card];
    setSelectedCards(newSelected);
    setLastWrongPair(null);

    // Check for match when two cards selected
    if (newSelected.length === 2) {
      setAttempts(prev => prev + 1);

      if (newSelected[0].pairId === newSelected[1].pairId) {
        // Match!
        const newMatched = new Set(matchedPairs);
        newMatched.add(newSelected[0].pairId);
        setMatchedPairs(newMatched);
        
        // Play success sound on match
        playSuccess();
        
        // Update stats for this expression (correct match)
        updateExpressionStats(newSelected[0].pairId, true);
        
        setCards(prev => prev.map(c => 
          c.pairId === newSelected[0].pairId 
            ? { ...c, isMatched: true }
            : c
        ));
        
        // Clear selection after brief delay
        setTimeout(() => {
          setSelectedCards([]);
          // Check if game complete
          if (newMatched.size === pairsToUse) {
            playBigSuccess();
            setShowResult(true);
          }
        }, 500);
      } else {
        // No match - show briefly then hide
        setLastWrongPair([newSelected[0].id, newSelected[1].id]);
        setTimeout(() => {
          setSelectedCards([]);
          setLastWrongPair(null);
        }, 1000);
      }
    }
  }, [selectedCards, matchedPairs, pairsToUse, updateExpressionStats]);

  // Game complete screen
  if (showResult) {
    const efficiency = Math.max(0, 100 - (attempts - pairsToUse) * 10);

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
          <Trophy className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-green-400 mb-2">All Matched!</h2>
        <p className="text-muted-foreground mb-6">
          Completed in {attempts} attempts
          <br />
          <span className="text-sm">Efficiency: {efficiency}%</span>
        </p>

        <div className="space-y-3 w-full max-w-xs">
          <Button variant="glow" size="lg" className="w-full" onClick={() => onComplete(gameExpressionIds)}>
            <Shuffle className="w-5 h-5 mr-2" />
            Play Again
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={onBack}>
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  if (cards.length < 4) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Not enough expressions for matching game.</p>
        <Button variant="outline" className="mt-4" onClick={onBack}>Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>Matched: {matchedPairs.size}/{pairsToUse}</span>
        <span>Attempts: {attempts}</span>
      </div>

      {/* Card grid - 2 columns for <= 4 pairs, 3 columns for more */}
      <div className={cn(
        "grid gap-3",
        pairsToUse <= 4 ? "grid-cols-2" : "grid-cols-3"
      )}>
        {cards.map(card => {
          const isSelected = selectedCards.some(c => c.id === card.id);
          const isWrong = lastWrongPair?.includes(card.id);

          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(card)}
              disabled={card.isMatched}
              className={cn(
                "p-3 rounded-xl border-2 text-center transition-all min-h-[70px] flex items-center justify-center",
                card.isMatched && "bg-green-500/20 border-green-500/50 opacity-60",
                isSelected && !card.isMatched && "border-primary bg-primary/10",
                isWrong && "border-destructive bg-destructive/10 animate-shake",
                !isSelected && !card.isMatched && !isWrong && "border-border bg-card hover:border-primary/50",
                card.type === 'japanese' ? "font-japanese" : ""
              )}
            >
              <div>
                {card.isMatched && <Check className="w-4 h-4 text-green-400 mx-auto mb-1" />}
                <span className={cn(
                  "text-xs",
                  card.type === 'japanese' ? "text-secondary-foreground" : "text-foreground"
                )}>
                  {card.text}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Instructions */}
      <p className="text-xs text-center text-muted-foreground">
        Tap a Japanese meaning, then tap its English expression
      </p>

      {/* Reset button */}
      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={initializeGame}>
          <RotateCcw className="w-4 h-4 mr-1" />
          Reset Game
        </Button>
      </div>
    </div>
  );
}