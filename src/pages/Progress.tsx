 import { useEffect, useState } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { ArrowLeft, TrendingUp, Calendar, Target, RefreshCw, Loader2 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { useAuth } from '@/hooks/useAuth';
 import { supabase } from '@/lib/supabase';
 import { format, subDays } from 'date-fns';
 import { cn } from '@/lib/utils';
 import { useToast } from '@/hooks/use-toast';
 
 interface VocabLog {
   date: string;
   word_count: number;
 }
 
 export default function Progress() {
   const navigate = useNavigate();
   const { user } = useAuth();
   const { toast } = useToast();
   const [logs, setLogs] = useState<VocabLog[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [animationStarted, setAnimationStarted] = useState(false);
   const [isBackfilling, setIsBackfilling] = useState(false);
 
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
 
   // Backfill vocabulary from past messages
   const backfillVocabulary = async () => {
     if (!user) return;
     setIsBackfilling(true);
 
     try {
       // Get all user messages grouped by date
       const { data: messages } = await supabase
         .from('messages')
         .select('content, created_at')
         .eq('user_id', user.id)
         .eq('role', 'user')
         .order('created_at', { ascending: true });
 
       if (!messages || messages.length === 0) {
         toast({ title: 'No messages found', description: 'Start a diary conversation first!' });
         setIsBackfilling(false);
         return;
       }
 
       // Common function words to exclude
       const STOP_WORDS = new Set([
         'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
         'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
         'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
         'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
         'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
         'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
         'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
         'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
         'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
         'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other',
         'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
         's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'd', 'll', 'm', 'o', 're',
         've', 'y', 'ain', 'aren', 'couldn', 'didn', 'doesn', 'hadn', 'hasn', 'haven', 'isn',
         'ma', 'mightn', 'mustn', 'needn', 'shan', 'shouldn', 'wasn', 'weren', 'won', 'wouldn',
         'also', 'really', 'well', 'yeah', 'yes', 'no', 'ok', 'okay', 'um', 'uh', 'like'
       ]);
 
       // Group messages by date
       const messagesByDate: { [date: string]: string[] } = {};
       for (const msg of messages) {
         const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
         if (!messagesByDate[date]) {
           messagesByDate[date] = [];
         }
         messagesByDate[date].push(msg.content);
       }
 
       // Calculate word counts for each date
       for (const [date, contents] of Object.entries(messagesByDate)) {
         const combinedText = contents.join(' ');
         const words = combinedText
           .toLowerCase()
           .replace(/[.,!?;:'"()\-]/g, ' ')
           .split(/\s+/)
           .filter(w => w.length > 2)
           .filter(w => !STOP_WORDS.has(w))
           .filter(w => !/^\d+$/.test(w));
         
         const uniqueWords = [...new Set(words)];
 
         if (uniqueWords.length > 0) {
           // Upsert the vocabulary log
           await supabase
             .from('spoken_vocabulary_logs')
             .upsert({
               user_id: user.id,
               date: date,
               unique_words: uniqueWords,
               word_count: uniqueWords.length,
             }, { onConflict: 'user_id,date' });
         }
       }
 
       toast({ title: 'Vocabulary synced!', description: `Updated ${Object.keys(messagesByDate).length} days of data.` });
       fetchVocabLogs();
     } catch (error) {
       console.error('Backfill error:', error);
       toast({ variant: 'destructive', title: 'Sync failed', description: 'Could not sync vocabulary data.' });
     } finally {
       setIsBackfilling(false);
     }
   };
 
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
 
         {/* Sync button */}
         <Button
           variant="ghost"
           size="icon"
           onClick={backfillVocabulary}
           disabled={isBackfilling}
           className="ml-auto"
         >
           {isBackfilling ? (
             <Loader2 className="w-5 h-5 animate-spin" />
           ) : (
             <RefreshCw className="w-5 h-5" />
           )}
         </Button>
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
           <div className="space-y-2">
             <Button variant="glow" onClick={backfillVocabulary} disabled={isBackfilling}>
               {isBackfilling ? (
                 <>
                   <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                   Syncing...
                 </>
               ) : (
                 <>
                   <RefreshCw className="w-4 h-4 mr-2" />
                   Sync from past diaries
                 </>
               )}
             </Button>
             <p className="text-xs text-muted-foreground">
               or
             </p>
             <Button variant="outline" onClick={() => navigate('/chat')}>
               Start today's diary
             </Button>
           </div>
         </div>
       )}
     </div>
   );
 }