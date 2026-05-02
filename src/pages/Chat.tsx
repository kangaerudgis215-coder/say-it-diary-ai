import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, Check, BookOpen, Lock, Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatBubble } from '@/components/ChatBubble';
import { SandyLoader } from '@/components/lottie/SandyLoader';
import { HelpCircle } from 'lucide-react';
import Lottie from 'lottie-react';
import voiceAnim from '@/assets/voice.json';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useVocabularyLog } from '@/hooks/useVocabularyLog';
import { normalizeForExpression } from '@/lib/textComparison';
import { persistDiarySentences } from '@/lib/practiceBuilder';
import { format, parseISO, isToday as isTodayFn } from 'date-fns';

/**
 * Robust browser TTS for the AI's spoken reply. Works around three known
 * pain points:
 *   1. Chrome ignores `speak()` if called too soon after `cancel()`.
 *   2. Safari/iOS only has voices after `voiceschanged` fires.
 *   3. Long utterances pause silently in Chrome — `resume()` brings them back.
 */
// Tracks the keepAlive interval id of any in-flight TTS so we can kill it
// from outside (e.g. when the user taps the mic). Without this the Chrome
// "resume on pause" heartbeat can keep the speechSynthesis audio session
// alive for minutes after the utterance ends, which on iOS Safari blocks
// SpeechRecognition from starting (it immediately aborts).
let ttsKeepAliveId: ReturnType<typeof setInterval> | null = null;

function stopAssistantSpeech(): void {
  if (ttsKeepAliveId !== null) {
    clearInterval(ttsKeepAliveId);
    ttsKeepAliveId = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

async function speakAssistant(text: string): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  try {
    // Wait for voices to be loaded (Safari/iOS first-load workaround).
    if (synth.getVoices().length === 0) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 800);
        synth.addEventListener(
          'voiceschanged',
          () => {
            clearTimeout(t);
            resolve();
          },
          { once: true },
        );
      });
    }
    stopAssistantSpeech();
    // Small gap so Chrome doesn't swallow the next speak().
    await new Promise((r) => setTimeout(r, 80));

    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.95;
    u.pitch = 1.05;
    // Prefer an English voice if one is installed — avoids picking up the
    // system default (e.g. a JP voice) which can sound robotic for English.
    const voices = synth.getVoices();
    const en =
      voices.find((v) => v.lang === 'en-US' && v.localService) ||
      voices.find((v) => v.lang === 'en-US') ||
      voices.find((v) => v.lang.startsWith('en'));
    if (en) u.voice = en;
    synth.speak(u);

    // Chrome bug: long utterances stop after ~15s. Periodically nudge it.
    ttsKeepAliveId = setInterval(() => {
      if (!synth.speaking) {
        if (ttsKeepAliveId !== null) {
          clearInterval(ttsKeepAliveId);
          ttsKeepAliveId = null;
        }
        return;
      }
      if (synth.paused) synth.resume();
    }, 5000);
    const clear = () => {
      if (ttsKeepAliveId !== null) {
        clearInterval(ttsKeepAliveId);
        ttsKeepAliveId = null;
      }
    };
    u.onend = clear;
    u.onerror = clear;
  } catch {
    // ignore TTS errors
  }
}

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
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isGeneratingDiary, setIsGeneratingDiary] = useState(false);
  // Once a diary has been generated for this date, the chat becomes read-only
  // so the entry can't be re-edited or accidentally regenerated. The dedicated
  // "Edit / regenerate" flow lives on the Review screen.
  const [existingDiaryId, setExistingDiaryId] = useState<string | null>(null);
  const [diaryDate, setDiaryDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [showHelp, setShowHelp] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  // Buffer of finalized speech chunks committed to the input field for this
  // recording session. We track this separately so interim (in-progress)
  // results can be rendered live without overwriting earlier finals.
  const finalBufferRef = useRef<string>('');
  // Snapshot of `input` at the moment recording started, so we can append
  // to whatever the user had already typed.
  const baseInputRef = useRef<string>('');
  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Get the diary date from URL params or default to today
    const dateParam = searchParams.get('date');
    if (dateParam) {
      setDiaryDate(dateParam);
    }
  }, [searchParams]);

  useEffect(() => {
    initConversation();
  }, [user, diaryDate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      setMessages(ordered.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      })));
    } else {
      // Create new conversation for this diary date
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, date: diaryDate })
        .select()
        .single();

      if (newConv) {
        setConversationId(newConv.id);
        const isToday = isTodayFn(parseISO(diaryDate));
        const dateLabel = isToday ? 'today' : format(parseISO(diaryDate), 'MMMM d, yyyy');
        
        // Add welcome message
        const welcomeMessage = {
          id: 'welcome',
          role: 'assistant' as const,
          content: isToday 
            ? "Hi there! 🌙 How was your day today? Tell me about anything that happened - big or small. I'm here to listen and help you express it in English!"
            : `Hi there! 🌙 Let's write about ${dateLabel}. What happened that day? Tell me anything you remember!`,
        };
        setMessages([welcomeMessage]);
        
        // Save welcome message
        await supabase.from('messages').insert({
          conversation_id: newConv.id,
          user_id: user.id,
          role: 'assistant',
          content: welcomeMessage.content,
        });
      }
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || !conversationId || !user) return;
    // Hard guard: never accept new messages once the diary is finalised.
    if (existingDiaryId) return;

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

    // Soft cap: once user + AI messages combined reach 10 (excluding the
    // initial welcome bubble), ask the AI to wrap the conversation up
    // naturally on this turn, then auto-trigger diary generation after it
    // replies. This avoids the previous abrupt cut-off.
    const realCount = nextMessages.filter((m) => m.id !== 'welcome').length;
    const shouldWrapUp = realCount >= 10;

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

      // Speak the AI reply aloud. Browser TTS is famously flaky:
      //   • Chrome silently drops `speak()` if it's called immediately after
      //     `cancel()` — we add a short delay.
      //   • Safari/iOS only has voices ready *after* `voiceschanged`, so the
      //     first utterance of a session can be silent. We wait for voices.
      //   • If the engine ends up "paused" (Chrome bug), `resume()` revives it.
      void speakAssistant(assistantMessage.content);

      // Save assistant message
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: assistantMessage.content,
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

      // Triumphant chime on diary completion
      try {
        const a = new Audio('/sounds/diary-complete.mp3');
        a.volume = 0.75;
        void a.play().catch(() => {});
      } catch {
        /* no-op */
      }

      // Get the diary entry ID and navigate to review page
      const { data: savedEntry } = await supabase
        .from('diary_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', diaryDate)
        .single();

      if (savedEntry) {
        setExistingDiaryId(savedEntry.id);
        navigate(`/review?diaryId=${savedEntry.id}&date=${diaryDate}`);
      } else {
        navigate('/calendar');
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

  /**
   * Start the mic on a direct user gesture. We instantiate a fresh
   * SpeechRecognition each press (some browsers refuse to restart a stopped
   * instance) and stream both interim and final results straight into the
   * chat input so the user can see their English appear live.
   */
  const startMic = () => {
    console.log('[mic] startMic called', {
      speechSupported,
      isListening,
      hasExistingRec: !!recognitionRef.current,
    });
    if (!speechSupported) {
      toast({
        variant: 'destructive',
        title: '音声入力に未対応',
        description: 'お使いのブラウザは音声入力に対応していません。Chrome/Safariをお試しください。',
      });
      return;
    }
    // Defensive cleanup: if a stale recogniser is still attached (e.g. the
    // user backgrounded the PWA and came back, in which case onend may not
    // have fired), abort it before starting a fresh one. Without this,
    // calling start() on an already-started instance throws InvalidStateError
    // and the mic silently does nothing.
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    if (isListening) {
      // State got out of sync — reset and let the user tap again.
      setIsListening(false);
      return;
    }
    // CRITICAL — iOS Safari quirk: if speechSynthesis is currently speaking
    // (or even just has a queued utterance from a previous AI reply), the
    // audio session is held by the TTS engine and any new SpeechRecognition
    // .start() immediately fires `aborted`. We force-cancel TTS and ALSO
    // pause it so the engine releases the audio session before we capture
    // the mic.
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        // Some iOS builds need an explicit pause to release the session.
        try { window.speechSynthesis.pause(); } catch { /* ignore */ }
      }
    } catch {
      /* ignore */
    }
    const Ctor: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    finalBufferRef.current = '';
    baseInputRef.current = input;

    rec.onstart = () => {
      console.log('[mic] onstart fired');
      setIsListening(true);
    };
    rec.onerror = (e: any) => {
      // "aborted" fires when we intentionally stop — not a real error.
      const err = e?.error;
      console.warn('[mic] onerror', err);
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
      setIsListening(false);
    };
    rec.onend = () => {
      console.log('[mic] onend fired');
      setIsListening(false);
      // Commit any pending finals into input one last time.
      const base = baseInputRef.current;
      const finals = finalBufferRef.current.trim();
      if (finals) {
        setInput((base ? base + ' ' : '') + finals);
      }
      recognitionRef.current = null;
    };
    rec.onresult = (event: any) => {
      // Walk ALL results (not just from resultIndex) so we capture every
      // interim chunk currently in the buffer. Finalized chunks are committed
      // to a ref so they survive re-renders, while interim chunks are shown
      // live and overwritten on each event.
      let finals = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        const txt = (r[0]?.transcript ?? '').trim();
        if (!txt) continue;
        if (r.isFinal) {
          finals += (finals ? ' ' : '') + txt;
        } else {
          interim += (interim ? ' ' : '') + txt;
        }
      }
      finalBufferRef.current = finals;
      const base = baseInputRef.current;
      const live = [finals, interim].filter(Boolean).join(' ');
      setInput((base ? base + ' ' : '') + live);
    };

    try {
      recognitionRef.current = rec;
      rec.start();
      console.log('[mic] start() called successfully');
    } catch (err) {
      console.error('[mic] start() threw:', err);
      recognitionRef.current = null;
      setIsListening(false);
      toast({
        variant: 'destructive',
        title: 'マイクを起動できませんでした',
        description: '少し待ってからもう一度お試しください。',
      });
    }
  };

  const stopMic = () => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
  };

  // Stop the mic if the user navigates away mid-recording.
  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
      }
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
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
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
              onClick={() => navigate(`/review?diaryId=${existingDiaryId}&date=${diaryDate}`)}
            >
              <BookOpen className="w-4 h-4" />
              レビュー
            </Button>
          ) : (
            <Button
              variant="success"
              size="sm"
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
              onClick={() => navigate(`/review?diaryId=${existingDiaryId}&date=${diaryDate}`)}
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
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Type or tap the mic to speak…"
            className="pr-12 h-11 rounded-xl bg-muted border-0 text-sm"
            disabled={isLoading}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="absolute right-1 top-1/2 -translate-y-1/2"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>

        {/* Big centered mic — tap to start, tap again to stop. No silence
            auto-cutoff: the user controls the entire recording window so
            mid-sentence pauses don't cut them off. */}
        <div className="flex flex-col items-center justify-center gap-2">
          {speechSupported ? (
            <button
              type="button"
              onClick={isListening ? stopMic : startMic}
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
              {isListening ? (
                <Lottie
                  animationData={voiceAnim}
                  loop
                  autoplay
                  style={{ width: 115, height: 115 }}
                />
              ) : (
                <Mic style={{ width: 72, height: 72 }} />
              )}
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">
              このブラウザは音声入力に対応していません
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {isListening
              ? 'タップで停止 ・ 話した英語が入力欄に表示されます'
              : 'マイクをタップして英語で話す'}
          </p>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
