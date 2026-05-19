import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, Check, BookOpen, Lock, Mic, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatBubble } from '@/components/ChatBubble';
import { SandyLoader } from '@/components/lottie/SandyLoader';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useVocabularyLog } from '@/hooks/useVocabularyLog';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { normalizeForExpression } from '@/lib/textComparison';
import { persistDiarySentences } from '@/lib/practiceBuilder';
import { createAssistantUtterance, speakAssistant, stopAssistantSpeech } from '@/lib/assistantSpeech';
import { getChatWelcomeMessage } from '@/lib/chatWelcome';
import {
  releaseSpeechRecognition,
  releaseSpeechRecognitionBeforeNavigation,
  setActiveRecognition,
  clearActiveRecognition,
  forceReleaseActiveRecognition,
} from '@/lib/speechRecognition';
import { format, parseISO, isToday as isTodayFn } from 'date-fns';
 

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  japanese?: string;
}

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { logSpokenWords } = useVocabularyLog();
  const { playBigSuccess } = useSuccessSound();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isGeneratingDiary, setIsGeneratingDiary] = useState(false);
  const [isClosingMicForNavigation, setIsClosingMicForNavigation] = useState(false);
  // Once a diary has been generated for this date, the chat becomes read-only
  // so the entry can't be re-edited or accidentally regenerated. The dedicated
  // "Edit / regenerate" flow lives on the Review screen.
  const [existingDiaryId, setExistingDiaryId] = useState<string | null>(null);
  // diaryDate is derived directly from the URL on every render. This avoids
  // the previous double-mount bug where the component first initialised with
  // "today" and then reset to the URL's date — which caused initConversation
  // to run twice, double-inserting the welcome message and triggering the
  // welcome chime / TTS multiple times when opening a past diary.
  const diaryDate = searchParams.get('date') ?? format(new Date(), 'yyyy-MM-dd');
  const welcomeSpoken = searchParams.get('welcomeSpoken') === '1';
  const [showHelp, setShowHelp] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isStartingMicRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const transcriptBaseRef = useRef<string>('');
  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Single source of truth: when the user (or diaryDate) changes, wipe
  // transient state and re-initialise the conversation for that date. One
  // effect = one welcome message = one TTS = one chime.
  useEffect(() => {
    setInput('');
    setMessages([]);
    setExistingDiaryId(null);
    setConversationId(null);
    stopMic('abort');
    if (!welcomeSpoken) stopAssistantSpeech();
    if (user) void initConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, diaryDate, welcomeSpoken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Warm up the speech-synthesis voice list. Some browsers (Chrome, Edge)
  // load voices asynchronously, so the first utterance can fall back to the
  // robotic default voice if we don't trigger a load early.
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.getVoices();
      const handler = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener?.('voiceschanged', handler);
      return () => {
        window.speechSynthesis.removeEventListener?.('voiceschanged', handler);
      };
    } catch {
      /* ignore */
    }
  }, []);

  const initConversation = async () => {
    if (!user) return;

    // Check whether a diary already exists for this date. If so, we lock the
    // chat and route the user to the review/edit screen instead of letting
    // them keep talking and re-tapping Done.
    const { data: existingDiary } = await supabase
      .from('diary_entries')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', diaryDate)
      .maybeSingle();
    setExistingDiaryId(existingDiary?.id ?? null);

    // Check for existing conversation for this diary date
    const { data: existing } = await supabase
      .from('conversations')
      .select('*, messages(*)')
      .eq('user_id', user.id)
      .eq('date', diaryDate)
      .eq('mode', 'chat')
      .maybeSingle();

    if (existing) {
      setConversationId(existing.id);
      // CRITICAL: Postgres does NOT preserve insertion order on related
      // selects. Without an explicit sort, returning to a conversation can
      // shuffle the messages (e.g. AI reply appearing before its user prompt).
      // Sort by created_at ascending so the chat always reads top-to-bottom
      // in the order it actually happened.
      const ordered = [...(existing.messages || [])].sort((a: any, b: any) => {
        const ta = new Date(a.created_at ?? 0).getTime();
        const tb = new Date(b.created_at ?? 0).getTime();
        return ta - tb;
      });
      const restoredMessages = ordered.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        japanese: m.japanese ?? undefined,
      }));
      setMessages(restoredMessages);
      // Replay TTS only when the conversation is brand new (just the welcome
      // bubble, user hasn't replied yet). Otherwise we'd jarringly replay the
      // first welcome line on every reopen — even mid-conversation.
      const onlyWelcome =
        restoredMessages.length === 1 && restoredMessages[0].role === 'assistant';
      if (!existingDiary?.id && onlyWelcome && !welcomeSpoken) {
        window.setTimeout(() => speakAssistant(restoredMessages[0].content), 250);
      }
    } else {
      // Create new conversation for this diary date
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, date: diaryDate, mode: 'chat' })
        .select()
        .single();

      if (newConv) {
        setConversationId(newConv.id);
        // Add welcome message
        const welcome = getChatWelcomeMessage(diaryDate);
        const welcomeMessage = {
          id: 'welcome',
          role: 'assistant' as const,
          content: welcome.content,
          japanese: welcome.japanese,
        };
        setMessages([welcomeMessage]);
        if (!welcomeSpoken) speakAssistant(welcomeMessage.content);
        
        // Save welcome message
        await supabase.from('messages').insert({
          conversation_id: newConv.id,
          user_id: user.id,
          role: 'assistant',
          content: welcomeMessage.content,
          japanese: welcomeMessage.japanese,
        });
      }
    }
  };

  const stopMic = (mode: 'stop' | 'abort' = 'stop') => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    isStartingMicRef.current = false;
    setIsListening(false);
    releaseSpeechRecognition(rec, mode);
  };

  const navigateAfterClosingMic = async (to: string) => {
    if (isClosingMicForNavigation) return;
    setIsClosingMicForNavigation(true);
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    isStartingMicRef.current = false;
    setIsListening(false);
    stopAssistantSpeech();
    await releaseSpeechRecognitionBeforeNavigation(rec);
    navigate(to);
  };

  /**
   * Emergency reset: wipes ALL messages for this date's conversation
   * (both server-side and locally) and starts a brand-new welcome.
   * Used when the chat got into a stuck/duplicated state from a bug.
   * Disabled once a diary has been generated.
   */
  const handleResetConversation = async () => {
    if (!user || !conversationId || existingDiaryId) return;
    try {
      stopAssistantSpeech();
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      isStartingMicRef.current = false;
      setIsListening(false);
      if (rec) releaseSpeechRecognition(rec, 'abort');

      // Delete every message in this conversation, then drop the conversation
      // row so initConversation() recreates a clean one + fresh welcome.
      const { error: msgErr } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);
      if (msgErr) throw msgErr;
      const { error: convErr } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);
      if (convErr) throw convErr;

      // Clear local state BEFORE re-initialising so the UI visibly resets.
      setMessages([]);
      setInput('');
      setConversationId(null);
      setExistingDiaryId(null);
      toast({
        title: 'チャットをリセットしました',
        description: '一からやり直せます ✨',
      });
      await initConversation();
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'リセットに失敗しました',
        description: e?.message ?? 'もう一度お試しください',
      });
    }
  };

  const sendMessage = async (content: string, preparedUtterance?: SpeechSynthesisUtterance | null) => {
    if (!content.trim() || !conversationId || !user) return;
    // Hard guard: never accept new messages once the diary is finalised.
    if (existingDiaryId) return;

    const rec = recognitionRef.current;
    recognitionRef.current = null;
    isStartingMicRef.current = false;
    setIsListening(false);
    await releaseSpeechRecognitionBeforeNavigation(rec);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    // Save user message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: 'user',
      content: userMessage.content,
    });

    // Log spoken vocabulary — attribute to the diary's date (supports past diaries)
    logSpokenWords(userMessage.content, diaryDate);

    // Soft cap: once the user has sent 10 turns (10 やりとり), ask the AI to
    // wrap the conversation up naturally on this turn, then auto-trigger
    // diary generation after it replies. We count *user* messages only so the
    // spec ("合計で10のやりとり") matches reality.
    const userTurnCount = nextMessages.filter(
      (m) => m.role === 'user' && m.id !== 'welcome',
    ).length;
    const shouldWrapUp = userTurnCount >= 10;

    try {
      // Call AI for response. If we're wrapping up, append a system nudge so
      // the AI gives a warm closing line ("Sounds great! Let's create your
      // diary now ✨") instead of asking another question.
      const aiMessages: { role: string; content: string }[] = [
        ...messages,
        userMessage,
      ].map((m) => ({ role: m.role as string, content: m.content }));
      if (shouldWrapUp) {
        aiMessages.push({
          role: 'system',
          content:
            'IMPORTANT: This is the final turn. Do NOT ask another question. Briefly acknowledge what the user just shared in one warm sentence, then say something like "Sounds great! Let\'s turn this into your diary now ✨". Keep it under 30 words.',
        });
      }
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: aiMessages,
          type: 'conversation',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error(errorData.error || 'Rate limit reached. Please wait a moment and try again.');
        }
        if (response.status === 402) {
          throw new Error(errorData.error || 'Usage limit reached. Please add credits.');
        }
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: Date.now().toString() + '-ai',
        role: 'assistant',
        content: data.content,
        japanese: data.japanese || undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);

      speakAssistant(assistantMessage.content, preparedUtterance);

      // Save assistant message
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: assistantMessage.content,
        japanese: assistantMessage.japanese ?? null,
      });

      // Auto-finish the diary after the AI's closing line.
      if (shouldWrapUp) {
        toast({
          title: '十分話せました ✨',
          description: '日記を自動で生成します…',
        });
        // Wait a beat so the user can read the AI's closing message.
        setTimeout(() => {
          void handleGenerateDiary();
        }, 1800);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to send message',
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleGenerateDiary = async () => {
    if (!conversationId || !user) return;

    // Make sure recording is fully released before long async work + the final
    // completion chime, especially on mobile audio routes.
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    isStartingMicRef.current = false;
    setIsListening(false);
    await releaseSpeechRecognitionBeforeNavigation(rec);

    setIsGeneratingDiary(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          type: 'generate_diary',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error(errorData.error || 'Rate limit reached. Please wait a moment.');
        }
        if (response.status === 402) {
          throw new Error(errorData.error || 'Usage limit reached. Please add credits.');
        }
        throw new Error(errorData.error || 'Failed to generate diary');
      }

      const data = await response.json();

      // Sanitize important sentences: keep only expressions that actually appear in that sentence.
      const importantSentences = Array.isArray(data.importantSentences)
        ? data.importantSentences.map((s: any) => {
            const sentNorm = normalizeForExpression(String(s?.english ?? ''));
            const exprs = Array.isArray(s?.expressions)
              ? s.expressions
                  .map((x: any) => String(x ?? '').trim())
                  .filter(Boolean)
                  .filter((x: string) => sentNorm.includes(normalizeForExpression(x)))
              : [];
            return {
              english: String(s?.english ?? '').trim(),
              japanese: String(s?.japanese ?? '').trim(),
              expressions: exprs,
            };
          })
        : [];

      // Save diary entry using the diaryDate (not necessarily today)
      // next_review_date is based on when the diary was created (now), not diary_date
      const { error: diaryError } = await supabase
        .from('diary_entries')
        .upsert(
          {
            user_id: user.id,
            conversation_id: conversationId,
            date: diaryDate,
            content: data.diary,
            japanese_summary: data.japaneseSummary,
            word_count: data.diary.split(/\s+/).length,
            next_review_date: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
            important_sentences: importantSentences,
          },
          { onConflict: 'user_id,date' }
        );

      if (diaryError) throw diaryError;

      // Save expressions (STRICT): only store expressions that appear in the diary English text.
      if (data.expressions && data.expressions.length > 0) {
        const { data: diaryEntry } = await supabase
          .from('diary_entries')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', diaryDate)
          .single();

        if (diaryEntry) {
          const diaryNorm = normalizeForExpression(String(data.diary ?? ''));

          const candidates = Array.isArray(data.expressions) ? data.expressions : [];
          const valid = candidates
            .map((exp: any) => ({
              expression: String(exp?.expression ?? '').trim(),
              meaning: exp?.meaning ?? null,
              example: exp?.example ?? null,
              scene_or_context: exp?.scene_or_context ?? null,
              // Merge legacy "fixed phrase" tag into "idiom" so the new unified
              // "イディオム・決まり文句" bucket stays consistent.
              pos_or_type: exp?.pos_or_type === 'fixed phrase' ? 'idiom' : (exp?.pos_or_type ?? null),
            }))
            .filter((exp: any) => exp.expression.length > 0)
            .filter((exp: any) => diaryNorm.includes(normalizeForExpression(exp.expression)));

          const rejectedCount = candidates.length - valid.length;
          if (rejectedCount > 0) {
            console.warn(
              `[expression-validation] Dropped ${rejectedCount} expression(s) because they do not appear in the diary text.`
            );
          }

          // Remove old AI-extracted expressions for this diary (keep user-added ones)
          await supabase
            .from('expressions')
            .delete()
            .eq('user_id', user.id)
            .eq('diary_entry_id', diaryEntry.id)
            .eq('is_user_added', false);

          if (valid.length > 0) {
            await supabase.from('expressions').insert(
              valid.map((exp: any) => ({
                user_id: user.id,
                diary_entry_id: diaryEntry.id,
                expression: exp.expression,
                meaning: exp.meaning,
                example_sentence: exp.example,
                scene_or_context: exp.scene_or_context,
                pos_or_type: exp.pos_or_type,
              }))
            );
          }
        }
      }

      // Persist diary_sentences for quiz (always, even without expressions)
      const { data: savedDiaryForSentences } = await supabase
        .from('diary_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', diaryDate)
        .single();
      
      if (savedDiaryForSentences && importantSentences.length > 0) {
        const sentencesForPersist = importantSentences.map((s: any) => ({
          english: s.english,
          japanese: s.japanese,
          expressions: s.expressions || [],
        }));
        await persistDiarySentences(supabase, user.id, savedDiaryForSentences.id, sentencesForPersist);
      }

      // Profile streak is now auto-updated by database trigger on diary_entries changes

      // Update conversation status
      await supabase
        .from('conversations')
        .update({ status: 'completed' })
        .eq('id', conversationId);

      toast({
        title: "Diary saved! ✨",
        description: "Now let's review and memorize it!",
      });

      // Flag the streak celebration to play on Home (next mount).
      try {
        localStorage.setItem(
          'soki:celebrateDiary',
          JSON.stringify({ date: diaryDate, ts: Date.now() }),
        );
      } catch { /* no-op */ }

      // Get the diary entry ID and navigate to review page
      const { data: savedEntry } = await supabase
        .from('diary_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', diaryDate)
        .single();

      if (savedEntry) {
        setExistingDiaryId(savedEntry.id);
        navigateAfterClosingMic(`/review?diaryId=${savedEntry.id}&date=${diaryDate}`);
      } else {
        navigateAfterClosingMic('/');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to generate diary',
      });
    } finally {
      setIsGeneratingDiary(false);
    }
  };

  const toggleMic = () => {
    // Tap-to-toggle: if already listening, stop. Otherwise start.
    if (recognitionRef.current || isStartingMicRef.current) {
      stopMic('stop');
      return;
    }
    if (!speechSupported) {
      toast({
        variant: 'destructive',
        title: '音声入力に未対応',
        description: 'お使いのブラウザは音声入力に対応していません。Chrome/Safariをお試しください。',
      });
      return;
    }

    stopAssistantSpeech();
    const Ctor: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = 'en-US';
    // Manual control: keep the mic open until the user taps again or sends.
    // Using `continuous = true` lets the browser maintain a single session
    // across natural pauses, which avoids the start/stop loop that previously
    // pinned the iOS Safari mic indicator on indefinitely.
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    transcriptBaseRef.current = input.trim();
    finalTranscriptRef.current = '';

    rec.onstart = () => {
      if (recognitionRef.current !== rec) return;
      isStartingMicRef.current = false;
      setIsListening(true);
    };
    rec.onerror = (e: any) => {
      if (recognitionRef.current !== rec) return;
      const err = e?.error;
      // Ignore transient `no-speech` events so a brief silence does not kill
      // the manual session the user explicitly opened.
      if (err === 'no-speech') return;
      recognitionRef.current = null;
      clearActiveRecognition(rec);
      isStartingMicRef.current = false;
      setIsListening(false);
      if (!err || err === 'aborted' || err === 'no-speech') return;
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        toast({
          variant: 'destructive',
          title: 'マイクが許可されていません',
          description:
            'ブラウザの設定でこのサイトのマイク使用を許可してください。プレビューでは許可が制限される場合があります。',
        });
      } else if (err === 'audio-capture') {
        toast({
          variant: 'destructive',
          title: 'マイクが見つかりません',
          description: 'デバイスにマイクが接続されているか確認してください。',
        });
      } else {
        toast({
          variant: 'destructive',
          title: '音声入力エラー',
          description: String(err),
        });
      }
    };
    rec.onend = () => {
      if (recognitionRef.current !== rec) return;
      // Session ended (user toggled off, navigated, or browser closed it).
      // Do NOT auto-restart — that was what kept the Safari mic route alive.
      recognitionRef.current = null;
      clearActiveRecognition(rec);
      isStartingMicRef.current = false;
      setIsListening(false);
    };
    rec.onresult = (event: any) => {
      if (recognitionRef.current !== rec) return;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const txt = (r[0]?.transcript ?? '').trim();
        if (!txt) continue;
        if (r.isFinal) {
          finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + txt;
        } else {
          interim += (interim ? ' ' : '') + txt;
        }
      }
      const base = transcriptBaseRef.current;
      const live = [finalTranscriptRef.current, interim].filter(Boolean).join(' ');
      setInput((base ? base + ' ' : '') + live);
    };

    try {
      recognitionRef.current = rec;
      isStartingMicRef.current = true;
      setActiveRecognition(rec);
      rec.start();
    } catch (err) {
      recognitionRef.current = null;
      isStartingMicRef.current = false;
      setIsListening(false);
      toast({
        variant: 'destructive',
        title: 'マイクを起動できませんでした',
        description: '少し待ってからもう一度お試しください。',
      });
    }
  };

  // Stop the mic if the user navigates away mid-recording. Safari can keep
  // the system mic route alive until we explicitly abort before/while leaving.
  useEffect(() => {
    // The global guard in `@/lib/speechRecognition` already handles
    // popstate / pagehide / beforeunload / visibilitychange. Here we only
    // need to make sure unmount (e.g. browser back gesture on iOS Safari)
    // releases the mic immediately and forcefully.
    return () => {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      isStartingMicRef.current = false;
      setIsListening(false);
      if (rec) releaseSpeechRecognition(rec, 'abort');
      forceReleaseActiveRecognition();
    };
  }, []);

  // Check if we have enough content for diary (at least 2 user messages)
  const hasEnoughContent = messages.filter(m => m.role === 'user').length >= 2;
  const isLocked = !!existingDiaryId;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Full-screen loader while generating the diary */}
      {isGeneratingDiary && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center">
          <SandyLoader label="日記を生成中..." />
        </div>
      )}
      {isClosingMicForNavigation && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center">
          <SandyLoader label="マイクを閉じています..." />
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" silent onClick={() => navigateAfterClosingMic('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            {/* Help button */}
            <Dialog open={showHelp} onOpenChange={setShowHelp}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="font-japanese">使い方ガイド</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm font-japanese">
                  <div>
                    <p className="font-medium mb-1">📝 日記の書き方</p>
                    <p className="text-muted-foreground">
                      今日あったことを英語で話してみましょう。日本語混じりでもOK！AIが自然な英語に直してくれます。
                    </p>
                  </div>
                  <div>
                    <p className="font-medium mb-1">🎤 音声入力</p>
                    <p className="text-muted-foreground">
                      左下のマイクボタンを押すと音声で入力できます。
                    </p>
                  </div>
                  <div>
                    <p className="font-medium mb-1">✅ 完了するタイミング</p>
                    <p className="text-muted-foreground">
                      2〜3個のトピックについて話したら「Done」ボタンを押して日記を完成させましょう。完璧でなくてOK！
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Emergency reset — only available before the diary is locked */}
            {!isLocked && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="チャットをリセット"
                    title="チャットをリセット"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-japanese">
                      この日のチャットをリセットしますか？
                    </AlertDialogTitle>
                    <AlertDialogDescription className="font-japanese">
                      これまでのやりとりがすべて消えて、最初のウェルカムメッセージから
                      やり直します。日記がうまく作れない／別の日のチャットが混ざって
                      しまった時の緊急用です。日記生成後はリセットできません。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-japanese">キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void handleResetConversation()}
                      className="font-japanese"
                    >
                      リセットする
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          
          <div className="text-center">
            <h1 className="font-bold">
              {isTodayFn(parseISO(diaryDate)) ? "Today's Diary" : format(parseISO(diaryDate), 'MMM d, yyyy')}
            </h1>
            {!isTodayFn(parseISO(diaryDate)) && (
              <span className="mt-0.5 inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                Past Diary
              </span>
            )}
          </div>
          
          {isLocked ? (
            <Button
              variant="secondary"
              size="sm"
              silent
              onClick={() => navigateAfterClosingMic(`/review?diaryId=${existingDiaryId}&date=${diaryDate}`)}
            >
              <BookOpen className="w-4 h-4" />
              レビュー
            </Button>
          ) : (
            <Button
              variant="success"
              size="sm"
              silent
              onClick={handleGenerateDiary}
              disabled={!hasEnoughContent || isGeneratingDiary}
              className={hasEnoughContent ? 'animate-pulse' : ''}
            >
              {isGeneratingDiary ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Done
                </>
              )}
            </Button>
          )}
        </div>
        
        {/* Prompt to finish when ready */}
        {!isLocked && hasEnoughContent && !isGeneratingDiary && (
          <p className="text-xs text-center text-primary mt-2 animate-pulse">
            Ready? Tap Done to create your diary! ✨
          </p>
        )}
        {isLocked && (
          <p className="text-xs text-center text-muted-foreground mt-2 inline-flex items-center gap-1 justify-center w-full">
            <Lock className="w-3 h-3" />
            この日の日記は作成済みです。修正はレビュー画面から。
          </p>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((message, index) => (
          <ChatBubble
            key={message.id}
            content={message.content}
            role={message.role}
            isNew={index === messages.length - 1}
            japaneseTranslation={message.japanese}
            onSpeak={message.role === 'assistant' ? () => speakAssistant(message.content) : undefined}
          />
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Prominent CTA to finish diary */}
        {!isLocked && hasEnoughContent && !isGeneratingDiary && !isLoading && (
          <div className="flex justify-center py-4">
            <Button
              variant="glow"
              size="lg"
              silent
              onClick={handleGenerateDiary}
              className="gap-2 px-8 text-base animate-pulse"
            >
              <Check className="w-5 h-5" />
              日記を完成させて練習へ ✨
            </Button>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area — speaking-first layout */}
      <div className="sticky bottom-0 glass border-t border-border px-4 pt-3 pb-5 safe-bottom">
        {isLocked ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              この日の日記は完成済みのためチャットはロックされています
            </p>
            <Button
              variant="glow"
              size="lg"
              silent
              onClick={() => navigateAfterClosingMic(`/review?diaryId=${existingDiaryId}&date=${diaryDate}`)}
              className="gap-2 px-8"
            >
              <BookOpen className="w-5 h-5" />
              日記レビューへ
            </Button>
          </div>
        ) : (
        <>
        {/* Compact text input row (kept for typing fallback) */}
        <div className="relative mb-4">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                const utterance = createAssistantUtterance();
                void sendMessage(input, utterance);
              }
            }}
            placeholder="Type or tap the mic to speak…"
            className="pr-12 h-11 rounded-xl bg-muted border-0 text-sm"
            disabled={isLoading}
          />
          <Button
            variant="ghost"
            size="icon"
            silent
            onClick={() => {
              const utterance = createAssistantUtterance();
              void sendMessage(input, utterance);
            }}
            disabled={!input.trim() || isLoading}
            className="absolute right-1 top-1/2 -translate-y-1/2"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>

        {/* Big centered mic — tap once to record, tap again to stop. */}
        <div className="flex flex-col items-center justify-center gap-2">
          {speechSupported ? (
            <button
              type="button"
              onClick={toggleMic}
              aria-label={isListening ? '録音を停止' : '録音を開始'}
              className={cn(
                'relative inline-flex items-center justify-center rounded-full shrink-0 h-32 w-32',
                'transition-all duration-200 active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isListening
                  ? 'bg-primary/15 ring-2 ring-primary/50'
                  : 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/50',
              )}
            >
              {!isListening && (
                <span className="absolute inset-0 rounded-full bg-primary/30 blur-xl -z-10" />
              )}
              {isListening && <span className="absolute inset-3 rounded-full border border-primary/40 animate-ping" />}
              <Mic className={cn('h-16 w-16', isListening && 'text-primary')} />
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">
              このブラウザは音声入力に対応していません
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {isListening
              ? 'タップで停止 — 英語で話してください'
              : 'タップして英語で話す（もう一度タップで停止）'}
          </p>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
