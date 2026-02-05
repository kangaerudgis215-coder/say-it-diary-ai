 import { useState, useEffect, useCallback } from 'react';
 import { useAuth } from '@/hooks/useAuth';
 import { supabase } from '@/lib/supabase';
 import { ThreeAxisScores, computeThreeAxisFromText, calculatePassStatus } from '@/components/ThreeAxisEvaluation';
 import { format } from 'date-fns';
 
 interface ExpressionItem {
   id: string;
   expression: string;
   meaning: string | null;
   example_sentence: string | null;
 }
 
 export function useExpressionPractice() {
   const { user } = useAuth();
   const [isLoading, setIsLoading] = useState(true);
   const [expressions, setExpressions] = useState<ExpressionItem[]>([]);
   const [currentExpression, setCurrentExpression] = useState<ExpressionItem | null>(null);
   const [stats, setStats] = useState({ practiced: 0, passed: 0 });
 
   useEffect(() => {
     if (user) {
       fetchExpressions();
       fetchTodayStats();
     }
   }, [user]);
 
   const fetchExpressions = async () => {
     if (!user) return;
 
     const { data } = await supabase
       .from('expressions')
       .select('id, expression, meaning, example_sentence')
       .eq('user_id', user.id)
       .not('meaning', 'is', null)
       .order('created_at', { ascending: false });
 
     if (data) {
       setExpressions(data);
     }
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
 
   const pickRandomExpression = useCallback(() => {
     if (expressions.length === 0) {
       setCurrentExpression(null);
       return;
     }
 
     const randomIndex = Math.floor(Math.random() * expressions.length);
     setCurrentExpression(expressions[randomIndex]);
   }, [expressions]);
 
   const evaluateAnswer = useCallback(async (
     userAnswer: string,
   ): Promise<{ scores: ThreeAxisScores; passed: boolean }> => {
     if (!currentExpression || !user) {
       return { 
         scores: { meaning: 'needs_work', structure: 'needs_work', fluency: 'needs_work' },
         passed: false,
       };
     }
 
     // For expressions, we focus more on meaning match
     const userLower = userAnswer.toLowerCase().trim();
     const targetLower = currentExpression.expression.toLowerCase().trim();
     
     // Check if user's answer contains the expression
     const containsExpression = userLower.includes(targetLower) || 
       targetLower.includes(userLower) ||
       userLower.split(/\s+/).some(word => targetLower.includes(word));
     
     const scores: ThreeAxisScores = {
       meaning: containsExpression ? 'excellent' : 'needs_work',
       structure: containsExpression ? 'good' : 'needs_work',
       fluency: 'good', // Be generous for expression-level
     };
 
     const { passed } = calculatePassStatus(scores);
 
     // Update local stats
     setStats(prev => ({
       practiced: prev.practiced + 1,
       passed: prev.passed + (passed ? 1 : 0),
     }));
 
     return { scores, passed };
   }, [currentExpression, user]);
 
   return {
     isLoading,
     currentExpression,
     hasAnyExpressions: expressions.length > 0,
     stats,
     pickRandomExpression,
     evaluateAnswer,
   };
 }