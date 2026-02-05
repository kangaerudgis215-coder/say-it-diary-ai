 import { useState, useEffect, useCallback } from 'react';
 import { Button } from '@/components/ui/button';
 import { Card } from '@/components/ui/card';
 import { Check, RotateCcw, Shuffle, Trophy } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 interface ExpressionPair {
   id: string;
   expression: string;
   meaning: string;
 }
 
 interface MatchingGameProps {
   expressions: ExpressionPair[];
   onComplete: () => void;
   onBack: () => void;
 }
 
 interface CardData {
   id: string;
   type: 'japanese' | 'english';
   text: string;
   pairId: string;
   isFlipped: boolean;
   isMatched: boolean;
 }
 
 export function MatchingGame({ expressions, onComplete, onBack }: MatchingGameProps) {
   const [cards, setCards] = useState<CardData[]>([]);
   const [selectedCards, setSelectedCards] = useState<CardData[]>([]);
   const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
   const [attempts, setAttempts] = useState(0);
   const [showResult, setShowResult] = useState(false);
   const [lastWrongPair, setLastWrongPair] = useState<string[] | null>(null);
 
   // Initialize game with shuffled cards
   const initializeGame = useCallback(() => {
     // Take first 4 expressions for the game
     const gameExpressions = expressions.slice(0, 4);
     
     if (gameExpressions.length < 2) {
       return;
     }
 
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
   }, [expressions]);
 
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
         
         setCards(prev => prev.map(c => 
           c.pairId === newSelected[0].pairId 
             ? { ...c, isMatched: true }
             : c
         ));
         
         // Clear selection after brief delay
         setTimeout(() => {
           setSelectedCards([]);
           // Check if game complete
           if (newMatched.size === Math.min(expressions.length, 4)) {
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
   }, [selectedCards, matchedPairs, expressions.length]);
 
   // Game complete screen
   if (showResult) {
     const totalPairs = Math.min(expressions.length, 4);
     const efficiency = Math.max(0, 100 - (attempts - totalPairs) * 10);
 
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
           <Button variant="glow" size="lg" className="w-full" onClick={initializeGame}>
             <Shuffle className="w-5 h-5 mr-2" />
             Play Again
           </Button>
           <Button variant="outline" size="lg" className="w-full" onClick={onComplete}>
             Continue Practice
           </Button>
           <Button variant="ghost" size="sm" className="w-full" onClick={onBack}>
             Back
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
         <span>Matched: {matchedPairs.size}/{Math.min(expressions.length, 4)}</span>
         <span>Attempts: {attempts}</span>
       </div>
 
       {/* Card grid */}
       <div className="grid grid-cols-2 gap-3">
         {cards.map(card => {
           const isSelected = selectedCards.some(c => c.id === card.id);
           const isWrong = lastWrongPair?.includes(card.id);
 
           return (
             <button
               key={card.id}
               onClick={() => handleCardClick(card)}
               disabled={card.isMatched}
               className={cn(
                 "p-4 rounded-xl border-2 text-center transition-all min-h-[80px] flex items-center justify-center",
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
                   "text-sm",
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