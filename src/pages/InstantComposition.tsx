import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, RotateCcw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface ExpressionCard {
  id: string;
  expressionId: string;
  text: string;
  type: 'english' | 'japanese';
  isFlipped: boolean;
  isMatched: boolean;
}

export default function InstantComposition() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cards, setCards] = useState<ExpressionCard[]>([]);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [moves, setMoves] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [totalPairs, setTotalPairs] = useState(0);

  useEffect(() => {
    if (user) loadExpressions();
  }, [user]);

  const loadExpressions = async () => {
    if (!user) return;
    setIsLoading(true);

    // Fetch expressions with meaning, prioritize low mastery
    const { data } = await supabase
      .from('expressions')
      .select('id, expression, meaning, mastery_level, created_at')
      .eq('user_id', user.id)
      .not('meaning', 'is', null)
      .order('mastery_level', { ascending: true })
      .limit(50);

    if (!data || data.length === 0) {
      setIsLoading(false);
      return;
    }

    // Weighted selection: 30% newness, 50% low mastery, 20% random
    const scored = data.map(e => {
      const age = (Date.now() - new Date(e.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const newnessScore = Math.max(0, 1 - age / 30) * 0.3;
      const masteryScore = (1 - (e.mastery_level || 0) / 100) * 0.5;
      const randomScore = Math.random() * 0.2;
      return { ...e, score: newnessScore + masteryScore + randomScore };
    });

    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, Math.min(6, scored.length));

    // Build card pairs
    const cardPairs: ExpressionCard[] = [];
    selected.forEach(expr => {
      cardPairs.push({
        id: `en-${expr.id}`,
        expressionId: expr.id,
        text: expr.expression,
        type: 'english',
        isFlipped: false,
        isMatched: false,
      });
      cardPairs.push({
        id: `jp-${expr.id}`,
        expressionId: expr.id,
        text: expr.meaning!,
        type: 'japanese',
        isFlipped: false,
        isMatched: false,
      });
    });

    // Shuffle
    for (let i = cardPairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardPairs[i], cardPairs[j]] = [cardPairs[j], cardPairs[i]];
    }

    setCards(cardPairs);
    setTotalPairs(selected.length);
    setIsLoading(false);
  };

  const handleCardClick = useCallback((cardId: string) => {
    if (isChecking) return;
    if (flipped.includes(cardId)) return;
    if (matched.has(cardId)) return;

    const newFlipped = [...flipped, cardId];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setIsChecking(true);
      setMoves(m => m + 1);

      const [first, second] = newFlipped;
      const card1 = cards.find(c => c.id === first)!;
      const card2 = cards.find(c => c.id === second)!;

      if (card1.expressionId === card2.expressionId && card1.type !== card2.type) {
        // Match!
        setTimeout(() => {
          const newMatched = new Set(matched);
          newMatched.add(first);
          newMatched.add(second);
          setMatched(newMatched);
          setFlipped([]);
          setIsChecking(false);

          // Update mastery in DB
          if (user) {
            supabase
              .from('expressions')
              .update({ mastery_level: Math.min(100, ((cards.find(c => c.id === first) as any)?.mastery_level || 0) + 10) })
              .eq('id', card1.expressionId)
              .eq('user_id', user.id)
              .then(() => {});
          }

          // Check completion
          if (newMatched.size === cards.length) {
            setGameComplete(true);
          }
        }, 600);
      } else {
        // No match
        setTimeout(() => {
          setFlipped([]);
          setIsChecking(false);
        }, 1000);
      }
    }
  }, [flipped, matched, cards, isChecking, user]);

  const handleRestart = () => {
    setFlipped([]);
    setMatched(new Set());
    setMoves(0);
    setGameComplete(false);
    loadExpressions();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">カードを準備中...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <p className="text-muted-foreground mb-4">表現がまだありません。まず日記を書きましょう！</p>
        <Button variant="ghost" onClick={() => navigate('/')}>ホームへ</Button>
      </div>
    );
  }

  if (gameComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Trophy className="w-16 h-16 text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">🎉 Complete!</h2>
        <p className="text-muted-foreground mb-1">{totalPairs} ペア全クリア！</p>
        <p className="text-sm text-muted-foreground mb-6">{moves} 回で達成</p>
        <div className="space-y-2 w-full max-w-xs">
          <Button className="w-full gap-2" onClick={handleRestart}>
            <RotateCcw className="w-4 h-4" /> もう一度
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
            ホームへ戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      <header className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-lg">フレーズ神経衰弱</h1>
          <p className="text-xs text-muted-foreground">{matched.size / 2} / {totalPairs} ペア • {moves} 回</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRestart}>
          <RotateCcw className="w-4 h-4" />
        </Button>
      </header>

      <div className="grid grid-cols-3 gap-2 flex-1 auto-rows-fr">
        {cards.map(card => {
          const isOpen = flipped.includes(card.id) || matched.has(card.id);
          const isMatchedCard = matched.has(card.id);

          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              className={cn(
                "rounded-xl border-2 p-2 flex items-center justify-center text-center transition-all duration-300 min-h-[70px]",
                isMatchedCard && "border-primary/40 bg-primary/10 opacity-60",
                isOpen && !isMatchedCard && "border-primary bg-primary/20",
                !isOpen && "border-border bg-muted hover:bg-muted/80 cursor-pointer"
              )}
              disabled={isMatchedCard}
            >
              {isOpen ? (
                <span className={cn(
                  "text-xs font-medium leading-tight",
                  card.type === 'english' ? 'text-primary' : 'text-foreground'
                )}>
                  {card.text}
                </span>
              ) : (
                <span className="text-lg">?</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
