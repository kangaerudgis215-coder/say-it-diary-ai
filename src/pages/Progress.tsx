 import { useEffect, useState } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { ArrowLeft, TrendingUp, Calendar, Target } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { useAuth } from '@/hooks/useAuth';
 import { supabase } from '@/lib/supabase';
 import { format, subDays } from 'date-fns';
 import { cn } from '@/lib/utils';
 
 interface VocabLog {
   date: string;
   word_count: number;
 }
 
 export default function Progress() {
   const navigate = useNavigate();
   const { user } = useAuth();
   const [logs, setLogs] = useState<VocabLog[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [animationStarted, setAnimationStarted] = useState(false);
 
   useEffect(() => {
     if (user) {
       fetchVocabLogs();
     }
   }, [user]);
 
   useEffect(() => {
     // Start animation after data loads
     if (!isLoading && logs.length > 0) {
       setTimeout(() => setAnimationStarted(true), 100);
     }
   }, [isLoading, logs]);
 
   const fetchVocabLogs = async () => {
     if (!user) return;
 
     const endDate = new Date();
     const startDate = subDays(endDate, 30);
 
     const { data } = await supabase
       .from('spoken_vocabulary_logs')
       .select('date, word_count')
       .eq('user_id', user.id)
       .gte('date', format(startDate, 'yyyy-MM-dd'))
       .order('date', { ascending: true });
 
     if (data) {
       setLogs(data);
     }
     setIsLoading(false);
   };
 
   // Calculate stats
   const today = format(new Date(), 'yyyy-MM-dd');
   const todayLog = logs.find(l => l.date === today);
   const yesterdayLog = logs.find(l => l.date === format(subDays(new Date(), 1), 'yyyy-MM-dd'));
   const todayCount = todayLog?.word_count || 0;
   const yesterdayCount = yesterdayLog?.word_count || 0;
   const diff = todayCount - yesterdayCount;
   
   // Get last 7 days for the chart
   const last7Days = Array.from({ length: 7 }, (_, i) => {
     const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
     const log = logs.find(l => l.date === date);
     return {
       date,
       dayLabel: format(subDays(new Date(), 6 - i), 'EEE'),
       count: log?.word_count || 0,
     };
   });
 
   const maxCount = Math.max(...last7Days.map(d => d.count), 1);
   const avgCount = last7Days.reduce((sum, d) => sum + d.count, 0) / 7;
 
   return (
     <div className="min-h-screen flex flex-col p-6 safe-bottom">
       <header className="flex items-center gap-4 mb-8">
         <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
           <ArrowLeft className="w-5 h-5" />
         </Button>
         <div>
           <h1 className="font-bold text-xl">Progress</h1>
           <p className="text-sm text-muted-foreground">Your speaking vocabulary trend</p>
         </div>
       </header>
 
       {/* Today's Summary */}
       <Card className="mb-6 bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
         <CardContent className="py-6">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-sm text-muted-foreground mb-1">Today's unique words</p>
               <p className="text-4xl font-bold text-primary">{todayCount}</p>
               {diff !== 0 && (
                 <p className={cn(
                   "text-sm mt-1",
                   diff > 0 ? "text-green-400" : "text-muted-foreground"
                 )}>
                   {diff > 0 ? '+' : ''}{diff} vs yesterday
                 </p>
               )}
             </div>
             <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
               <TrendingUp className="w-7 h-7 text-primary" />
             </div>
           </div>
         </CardContent>
       </Card>
 
       {/* 7-day Chart */}
       <Card className="mb-6">
         <CardHeader className="pb-2">
           <CardTitle className="text-base flex items-center gap-2">
             <Calendar className="w-4 h-4" />
             Last 7 Days
           </CardTitle>
         </CardHeader>
         <CardContent>
           <div className="flex items-end justify-between h-40 gap-2">
             {last7Days.map((day, i) => {
               const heightPercent = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
               const isToday = day.date === today;
               
               return (
                 <div key={day.date} className="flex-1 flex flex-col items-center">
                   {/* Count label */}
                   <span className="text-xs text-muted-foreground mb-1">
                     {day.count > 0 ? day.count : ''}
                   </span>
                   
                   {/* Bar */}
                   <div className="w-full flex-1 flex items-end">
                     <div
                       className={cn(
                         "w-full rounded-t-md transition-all duration-700 ease-out",
                         isToday ? "bg-primary" : "bg-primary/40"
                       )}
                       style={{
                         height: animationStarted ? `${Math.max(heightPercent, 4)}%` : '4%',
                         minHeight: '4px',
                       }}
                     />
                   </div>
                   
                   {/* Day label */}
                   <span className={cn(
                     "text-xs mt-2",
                     isToday ? "text-primary font-medium" : "text-muted-foreground"
                   )}>
                     {day.dayLabel}
                   </span>
                 </div>
               );
             })}
           </div>
           
           {/* Average line description */}
           <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
             <span className="text-muted-foreground">7-day average</span>
             <span className="font-medium">{Math.round(avgCount)} words/day</span>
           </div>
         </CardContent>
       </Card>
 
       {/* Goals / Tips */}
       <Card className="bg-muted/30">
         <CardContent className="py-4">
           <div className="flex items-start gap-3">
             <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
               <Target className="w-4 h-4 text-primary" />
             </div>
             <div>
               <p className="font-medium text-sm mb-1">Keep speaking!</p>
               <p className="text-xs text-muted-foreground">
                 The more you speak, the more words become part of your active vocabulary.
                 Try to beat your average each day! 💪
               </p>
             </div>
           </div>
         </CardContent>
       </Card>
 
       {/* Empty state */}
       {!isLoading && logs.length === 0 && (
         <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
           <p className="text-muted-foreground mb-4">
             No vocabulary data yet. Start speaking to track your progress!
           </p>
           <Button variant="outline" onClick={() => navigate('/chat')}>
             Start today's diary
           </Button>
         </div>
       )}
     </div>
   );
 }