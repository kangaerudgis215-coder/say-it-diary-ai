 import { useEffect, useState } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { ArrowLeft, TrendingUp, Trophy, Flame, RefreshCw, Loader2 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent } from '@/components/ui/card';
 import { useAuth } from '@/hooks/useAuth';
 import { useSubscription } from '@/hooks/useSubscription';
 import { ProPaywall } from '@/components/ProPaywall';
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
   const { isPro, startCheckout } = useSubscription();
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
     if (!isLoading && logs.length >= 0) {
       const timer = setTimeout(() => setAnimationStarted(true), 200);
       return () => clearTimeout(timer);
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
 
   const today = format(new Date(), 'yyyy-MM-dd');
   const todayLog = logs.find(l => l.date === today);
   const yesterdayLog = logs.find(l => l.date === format(subDays(new Date(), 1), 'yyyy-MM-dd'));
   const todayCount = todayLog?.word_count || 0;
   const yesterdayCount = yesterdayLog?.word_count || 0;
   const diff = todayCount - yesterdayCount;
   
   const last7Days = Array.from({ length: 7 }, (_, i) => {
     const date = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
     const log = logs.find(l => l.date === date);
     return {
       date,
       dayLabel: format(subDays(new Date(), 6 - i), 'EEE'),
       fullDate: format(subDays(new Date(), 6 - i), 'M/d'),
       count: log?.word_count || 0,
     };
   });
 
   const maxCount = Math.max(...last7Days.map(d => d.count), 10);
   const avgCount = last7Days.reduce((sum, d) => sum + d.count, 0) / 7;
   const bestDay = last7Days.reduce((best, day) => day.count > best.count ? day : best, last7Days[0]);
   const totalWeek = last7Days.reduce((sum, d) => sum + d.count, 0);
 
   const backfillVocabulary = async () => {
     if (!user) return;
     setIsBackfilling(true);
 
     try {
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
         'also', 'really', 'well', 'yeah', 'yes', 'ok', 'okay', 'um', 'uh', 'like'
       ]);
 
       const messagesByDate: { [date: string]: string[] } = {};
       for (const msg of messages) {
         const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
         if (!messagesByDate[date]) {
           messagesByDate[date] = [];
         }
         messagesByDate[date].push(msg.content);
       }
 
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
 
   if (!isPro) {
     return (
       <div className="min-h-screen flex flex-col safe-bottom">
         <header className="flex items-center gap-4 p-4">
           <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
             <ArrowLeft className="w-5 h-5" />
           </Button>
         </header>
         <ProPaywall
           onUpgrade={startCheckout}
           onDismiss={() => navigate('/')}
           context="語彙成長の統計はProプランで利用できます。"
         />
       </div>
     );
   }

   return (
     <div className="min-h-screen flex flex-col p-4 safe-bottom bg-gradient-to-b from-background to-muted/20">
       <header className="flex items-center gap-3 mb-6">
         <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
           <ArrowLeft className="w-5 h-5" />
         </Button>
         <div className="flex-1">
           <h1 className="font-bold text-xl">Speaking Progress</h1>
           <p className="text-xs text-muted-foreground">Track your vocabulary growth</p>
         </div>
         <Button
           variant="ghost"
           size="icon"
           onClick={backfillVocabulary}
           disabled={isBackfilling}
         >
           {isBackfilling ? (
             <Loader2 className="w-5 h-5 animate-spin" />
           ) : (
             <RefreshCw className="w-5 h-5" />
           )}
         </Button>
       </header>
 
       <Card className="mb-6 overflow-hidden border-0 bg-gradient-to-br from-primary via-primary/90 to-primary/70 shadow-xl">
         <CardContent className="py-8 px-6">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-sm text-primary-foreground/80 mb-2">Today's Words</p>
               <p className="text-6xl font-black text-primary-foreground tracking-tight">
                 {animationStarted ? todayCount : 0}
               </p>
               {diff !== 0 && (
                 <div className={cn(
                   "inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full text-sm font-medium",
                   diff > 0 
                     ? "bg-green-500/30 text-green-100" 
                     : "bg-primary-foreground/20 text-primary-foreground/70"
                 )}>
                   <TrendingUp className={cn("w-4 h-4", diff < 0 && "rotate-180")} />
                   {diff > 0 ? '+' : ''}{diff} vs yesterday
                 </div>
               )}
               {diff === 0 && todayCount === 0 && (
                 <p className="text-sm text-primary-foreground/60 mt-3">
                   Start speaking to track today!
                 </p>
               )}
             </div>
             <div className="w-20 h-20 rounded-full bg-primary-foreground/20 flex items-center justify-center backdrop-blur-sm">
               <Flame className="w-10 h-10 text-primary-foreground" />
             </div>
           </div>
         </CardContent>
       </Card>
 
       <Card className="mb-6 flex-1">
         <CardContent className="py-6">
           <div className="flex items-center justify-between mb-6">
             <h2 className="text-lg font-semibold">Last 7 Days</h2>
             <span className="text-sm text-muted-foreground">
               {totalWeek} words total
             </span>
           </div>
           
           <div className="flex items-end justify-between gap-3" style={{ height: '220px' }}>
             {last7Days.map((day, i) => {
               const heightPercent = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
               const isToday = day.date === today;
               const isBest = day.count === bestDay.count && day.count > 0;
               
               return (
                 <div key={day.date} className="flex-1 flex flex-col items-center h-full">
                   <span className={cn(
                     "text-sm font-medium mb-2 transition-all duration-500",
                     isToday ? "text-primary" : "text-muted-foreground",
                     animationStarted ? "opacity-100" : "opacity-0"
                   )}>
                     {day.count > 0 ? day.count : '–'}
                   </span>
                   
                   <div className="w-full flex-1 flex items-end relative">
                     {isBest && animationStarted && (
                       <div className="absolute -top-6 left-1/2 -translate-x-1/2 animate-fade-in">
                         <Trophy className="w-4 h-4 text-yellow-400" />
                       </div>
                     )}
                     
                     <div
                       className={cn(
                         "w-full rounded-xl transition-all ease-out",
                         isToday 
                           ? "bg-gradient-to-t from-primary to-primary/70 shadow-lg shadow-primary/30" 
                           : isBest 
                             ? "bg-gradient-to-t from-yellow-500/80 to-yellow-400/60"
                             : "bg-gradient-to-t from-muted-foreground/30 to-muted-foreground/20"
                       )}
                       style={{
                         height: animationStarted ? `${Math.max(heightPercent, 8)}%` : '4%',
                         minHeight: '8px',
                         transitionDuration: `${500 + i * 100}ms`,
                       }}
                     />
                   </div>
                   
                   <div className="mt-3 text-center">
                     <span className={cn(
                       "text-xs font-medium block",
                       isToday ? "text-primary" : "text-muted-foreground"
                     )}>
                       {day.dayLabel}
                     </span>
                     <span className="text-[10px] text-muted-foreground/70">
                       {day.fullDate}
                     </span>
                   </div>
                 </div>
               );
             })}
           </div>
         </CardContent>
       </Card>
 
       <div className="grid grid-cols-3 gap-3 mb-6">
         <Card className="bg-muted/40 border-0">
           <CardContent className="py-4 text-center">
             <p className="text-2xl font-bold text-foreground">{Math.round(avgCount)}</p>
             <p className="text-xs text-muted-foreground">Daily Avg</p>
           </CardContent>
         </Card>
         <Card className="bg-yellow-500/10 border-0">
           <CardContent className="py-4 text-center">
             <p className="text-2xl font-bold text-yellow-500">{bestDay.count}</p>
             <p className="text-xs text-muted-foreground">Best Day</p>
           </CardContent>
         </Card>
         <Card className="bg-primary/10 border-0">
           <CardContent className="py-4 text-center">
             <p className="text-2xl font-bold text-primary">{totalWeek}</p>
             <p className="text-xs text-muted-foreground">This Week</p>
           </CardContent>
         </Card>
       </div>
 
       {!isLoading && logs.length === 0 && (
         <Card className="bg-muted/30 border-dashed">
           <CardContent className="py-8 text-center">
             <Flame className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
             <p className="text-muted-foreground mb-4">
               No vocabulary data yet.<br />
               Start speaking to track your progress!
             </p>
             <div className="space-y-3">
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
               <p className="text-xs text-muted-foreground">or</p>
               <Button variant="outline" onClick={() => navigate('/chat')}>
                 Start today's diary
               </Button>
             </div>
           </CardContent>
         </Card>
       )}
 
       {!isLoading && logs.length > 0 && (
         <p className="text-xs text-center text-muted-foreground mt-auto pt-4">
           💡 Speak more unique words each day to grow your active vocabulary!
         </p>
       )}
     </div>
   );
 }