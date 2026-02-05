 import { useCallback, useState } from 'react';
 import { useAuth } from '@/hooks/useAuth';
 import { supabase } from '@/lib/supabase';
 import { format } from 'date-fns';
 
 // Common function words to exclude from vocabulary count
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
 
 /**
  * Extract unique meaningful words from text
  */
 function extractMeaningfulWords(text: string): string[] {
   const words = text
     .toLowerCase()
     .replace(/[.,!?;:'"()\-]/g, ' ')
     .split(/\s+/)
     .filter(w => w.length > 2)
     .filter(w => !STOP_WORDS.has(w))
     .filter(w => !/^\d+$/.test(w)); // Exclude pure numbers
   
   return [...new Set(words)];
 }
 
 /**
  * Hook to log spoken vocabulary words
  */
 export function useVocabularyLog() {
   const { user } = useAuth();
   const [isLogging, setIsLogging] = useState(false);
 
   /**
    * Log spoken words for today
    * This upserts the vocabulary log for today, adding new words to the existing list
    */
   const logSpokenWords = useCallback(async (spokenText: string): Promise<boolean> => {
     if (!user || !spokenText.trim()) return false;
 
     if (isLogging) return false; // Prevent concurrent logging
     setIsLogging(true);
 
     const today = format(new Date(), 'yyyy-MM-dd');
     const newWords = extractMeaningfulWords(spokenText);
     
     if (newWords.length === 0) {
       setIsLogging(false);
       return false;
     }
 
     console.log('[VocabLog] Logging', newWords.length, 'new words for', today);
 
     try {
       // First, try to get existing log for today
       const { data: existingLog } = await supabase
         .from('spoken_vocabulary_logs')
         .select('id, unique_words')
         .eq('user_id', user.id)
         .eq('date', today)
         .maybeSingle();
 
       if (existingLog) {
         // Merge new words with existing
         const existingWords = new Set(existingLog.unique_words || []);
         newWords.forEach(w => existingWords.add(w));
         const allWords = [...existingWords];
 
         await supabase
           .from('spoken_vocabulary_logs')
           .update({
             unique_words: allWords,
             word_count: allWords.length,
             updated_at: new Date().toISOString(),
           })
           .eq('id', existingLog.id);
 
         console.log('[VocabLog] Updated log, total words:', allWords.length);
       } else {
         // Create new log for today
         const { error } = await supabase
           .from('spoken_vocabulary_logs')
           .insert({
             user_id: user.id,
             date: today,
             unique_words: newWords,
             word_count: newWords.length,
           });
 
         if (error) {
           console.error('[VocabLog] Insert error:', error);
         } else {
           console.log('[VocabLog] Created new log with', newWords.length, 'words');
         }
       }
 
       setIsLogging(false);
       return true;
     } catch (error) {
       console.error('Failed to log vocabulary:', error);
       setIsLogging(false);
       return false;
     }
   }, [user, isLogging]);
 
   return { logSpokenWords, isLogging };
 }