 import { useState, useCallback, useEffect } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { ArrowLeft, Shuffle, Loader2, Trophy, Star, Circle, HelpCircle } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { MatchingGame } from '@/components/MatchingGame';
 import { useAuth } from '@/hooks/useAuth';
 import { supabase } from '@/lib/supabase';
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
 } from '@/components/ui/dialog';
 
interface Expression {
  id: string;
  expression: string;
  meaning: string;
  mastery_level: number;
  created_at: string;
}
 
 type MasteryStatus = 'mastered' | 'in_progress' | 'not_learned';
 
 function getMasteryStatus(level: number): MasteryStatus {
   if (level >= 3) return 'mastered';
   if (level >= 1) return 'in_progress';
   return 'not_learned';
 }
 
 function MasteryIcon({ status }: { status: MasteryStatus }) {
   switch (status) {
     case 'mastered':
       return <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />;
     case 'in_progress':
       return <Star className="w-4 h-4 text-yellow-400/50" />;
     default:
       return <Circle className="w-4 h-4 text-muted-foreground" />;
   }
 }
 
 export default function InstantComposition() {
   const navigate = useNavigate();
   const { user } = useAuth();
   const [expressions, setExpressions] = useState<Expression[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [isPlaying, setIsPlaying] = useState(false);
   const [showHelp, setShowHelp] = useState(false);
 
   // Fetch all expressions with meanings
   useEffect(() => {
     if (user) {
       fetchExpressions();
     }
   }, [user]);
 
  const fetchExpressions = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('expressions')
      .select('id, expression, meaning, mastery_level, created_at')
      .eq('user_id', user.id)
      .not('meaning', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Error fetching expressions:', error);
    }

    if (data) {
      // Filter out expressions without valid meanings
      const valid = data.filter(e => e.meaning && e.meaning.trim().length > 0) as Expression[];
      setExpressions(valid);
    }
    setIsLoading(false);
  };

  // Calculate priority score for expression selection
  // Higher score = higher priority for practice
  const calculatePriorityScore = useCallback((expr: Expression) => {
    const mastery = expr.mastery_level || 0;
    const createdAt = new Date(expr.created_at).getTime();
    const now = Date.now();
    const daysSinceCreated = (now - createdAt) / (1000 * 60 * 60 * 24);
    
    // Weights for priority calculation
    const masteryWeight = 0.5;   // Lower mastery = higher priority
    const newWeight = 0.3;       // Newer expressions get a boost
    const randomWeight = 0.2;    // Some randomness for variety
    
    // Mastery score: 0 mastery = 1.0, 5 mastery = 0.0
    const masteryScore = 1 - (mastery / 5);
    
    // Recency score: newer is better (1.0 for today, decays over 30 days)
    const recencyScore = Math.max(0, 1 - (daysSinceCreated / 30));
    
    // Random factor for variety
    const randomScore = Math.random();
    
    return (masteryWeight * masteryScore) + (newWeight * recencyScore) + (randomWeight * randomScore);
  }, []);

  // Select expressions for the game, prioritizing newer/less-practiced
  const getGameExpressions = useCallback(() => {
    if (expressions.length < 2) return [];

    // Calculate priority score for each expression
    const scored = expressions.map(expr => ({
      ...expr,
      priority: calculatePriorityScore(expr)
    }));

    // Sort by priority (descending) and take top expressions
    const sorted = scored.sort((a, b) => b.priority - a.priority);

    // Take 6-8 expressions (dynamic based on available)
    const gameSize = Math.min(8, Math.max(6, sorted.length));
    return sorted.slice(0, gameSize);
  }, [expressions, calculatePriorityScore]);

  // Handle game completion - refresh expressions to get updated mastery
  const handleGameComplete = useCallback(async (matchedIds: string[]) => {
    console.log('Game completed with expressions:', matchedIds);
    // Refresh expressions to get updated mastery levels
    await fetchExpressions();
    // Stay in playing mode to allow "Play Again"
  }, []);
 
   const handleStartGame = useCallback(() => {
     setIsPlaying(true);
   }, []);
 
   if (isLoading) {
     return (
       <div className="min-h-screen flex flex-col items-center justify-center p-6">
         <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
         <p className="text-muted-foreground">Loading expressions...</p>
       </div>
     );
   }
 
   // Game is active
   if (isPlaying && expressions.length >= 2) {
     const gameExpressions = getGameExpressions();
 
     return (
       <div className="min-h-screen flex flex-col p-6 safe-bottom">
         <header className="flex items-center gap-4 mb-8">
           <Button variant="ghost" size="icon" onClick={() => setIsPlaying(false)}>
             <ArrowLeft className="w-5 h-5" />
           </Button>
           <div>
             <h1 className="font-bold text-xl flex items-center gap-2">
               <Shuffle className="w-5 h-5 text-primary" />
               Expression Memory Game
             </h1>
             <p className="text-sm text-muted-foreground">フレーズ神経衰弱</p>
           </div>
         </header>
 
         <MatchingGame
           expressions={gameExpressions}
           onComplete={handleGameComplete}
           onBack={() => setIsPlaying(false)}
         />
       </div>
     );
   }
 
   // Calculate mastery stats
   const masteredCount = expressions.filter(e => getMasteryStatus(e.mastery_level || 0) === 'mastered').length;
   const inProgressCount = expressions.filter(e => getMasteryStatus(e.mastery_level || 0) === 'in_progress').length;
   const notLearnedCount = expressions.filter(e => getMasteryStatus(e.mastery_level || 0) === 'not_learned').length;
 
   // Main menu screen
   return (
     <div className="min-h-screen flex flex-col p-6 safe-bottom">
       <header className="flex items-center gap-4 mb-8">
         <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
           <ArrowLeft className="w-5 h-5" />
         </Button>
         <div>
           <h1 className="font-bold text-xl">Expression Memory Game</h1>
           <p className="text-sm text-muted-foreground">フレーズ神経衰弱</p>
         </div>
 
         {/* Help button */}
         <Dialog open={showHelp} onOpenChange={setShowHelp}>
           <DialogTrigger asChild>
             <Button variant="ghost" size="icon" className="ml-auto">
               <HelpCircle className="w-5 h-5" />
             </Button>
           </DialogTrigger>
           <DialogContent className="max-w-sm">
             <DialogHeader>
               <DialogTitle className="font-japanese">フレーズ神経衰弱の遊び方</DialogTitle>
             </DialogHeader>
             <div className="space-y-4 text-sm font-japanese">
               <div>
                 <p className="font-medium mb-1">🎯 ゲームの目的</p>
                 <p className="text-muted-foreground">
                   日本語の意味と英語のフレーズを正しくマッチングしましょう。
                 </p>
               </div>
               <div>
                 <p className="font-medium mb-1">📝 遊び方</p>
                 <p className="text-muted-foreground">
                   1. 日本語カードをタップ<br />
                   2. 対応する英語カードをタップ<br />
                   3. 全てのペアをマッチさせよう！
                 </p>
               </div>
               <div>
                 <p className="font-medium mb-1">⭐ 習得度</p>
                 <p className="text-muted-foreground">
                   ★★ 習得済み / ★☆ 習得中 / ○ 未習得<br />
                   正解すると習得度がアップします。
                 </p>
               </div>
             </div>
           </DialogContent>
         </Dialog>
       </header>
 
       <div className="flex-1 flex flex-col items-center justify-center text-center">
         {expressions.length < 2 ? (
           <>
             <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
               <Shuffle className="w-10 h-10 text-muted-foreground" />
             </div>
             <h2 className="text-xl font-bold mb-3">Not enough expressions</h2>
             <p className="text-muted-foreground mb-6 max-w-sm">
               Complete some diary entries first to collect expressions for the memory game.
             </p>
             <Button variant="outline" onClick={() => navigate('/chat')}>
               Start Today's Diary
             </Button>
           </>
         ) : (
           <>
             <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-6">
               <Trophy className="w-12 h-12 text-primary" />
             </div>
             <h2 className="text-2xl font-bold mb-3">Ready to play?</h2>
             <p className="text-muted-foreground mb-6 max-w-sm">
               Match Japanese meanings with English expressions. Less-mastered phrases appear more often!
             </p>
 
             <Button variant="glow" size="lg" onClick={handleStartGame}>
               <Shuffle className="w-5 h-5 mr-2" />
               Start Game
             </Button>
 
             {/* Mastery stats */}
             <div className="bg-muted rounded-xl p-4 mt-8 w-full max-w-xs">
               <p className="text-sm text-muted-foreground mb-3">Your expressions</p>
               <div className="grid grid-cols-3 gap-2 text-center">
                 <div>
                   <div className="flex items-center justify-center gap-1 mb-1">
                     <MasteryIcon status="mastered" />
                     <span className="font-bold">{masteredCount}</span>
                   </div>
                   <p className="text-xs text-muted-foreground">Mastered</p>
                 </div>
                 <div>
                   <div className="flex items-center justify-center gap-1 mb-1">
                     <MasteryIcon status="in_progress" />
                     <span className="font-bold">{inProgressCount}</span>
                   </div>
                   <p className="text-xs text-muted-foreground">In progress</p>
                 </div>
                 <div>
                   <div className="flex items-center justify-center gap-1 mb-1">
                     <MasteryIcon status="not_learned" />
                     <span className="font-bold">{notLearnedCount}</span>
                   </div>
                   <p className="text-xs text-muted-foreground">New</p>
                 </div>
               </div>
             </div>
 
             {/* Browse expressions link */}
             <Button
               variant="ghost"
               size="sm"
               onClick={() => navigate('/expressions')}
               className="mt-4"
             >
               Browse all expressions →
             </Button>
           </>
         )}
       </div>
     </div>
   );
 }