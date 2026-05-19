import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Mic, MicOff, Loader2, Sparkles, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useUISound } from '@/hooks/useUISound';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { useVocabularyLog } from '@/hooks/useVocabularyLog';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { normalizeForExpression } from '@/lib/textComparison';
import { persistDiarySentences } from '@/lib/practiceBuilder';
import {
  clearActiveRecognition,
  releaseSpeechRecognition,
  releaseSpeechRecognitionBeforeNavigation,
  setActiveRecognition,
} from '@/lib/speechRecognition';
import { SandyLoader } from '@/components/lottie/SandyLoader';

interface Turn {
  id: string;
  text: string;
}

const MAX_TURNS = 10;
const MAX_WORDS = 300;
const MIN_WORDS_TO_GENERATE = 40;

function countWords(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export default function Speak() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { playNavigate } = useUISound();
  const { playBigSuccess } = useSuccessSound();
  const { logSpokenWords } = useVocabularyLog();

  const diaryDate = searchParams.get('date') ?? format(new Date(), 'yyyy-MM-dd');

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [existingDiaryId, setExistingDiaryId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const recognitionRef = useRef<any>(null);
  const finalRef = useRef('');
  const baseRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const totalText = turns.map((t) => t.text).join(' ') + (draft ? ' ' + draft : '');
  const totalWords = countWords(totalText);
  const turnCount = turns.length;
  const limitReached = turnCount >= MAX_TURNS || totalWords >= MAX_WORDS;
  const canGenerate = totalWords >= MIN_WORDS_TO_GENERATE && !isGenerating;

  // Init: load or create the speak conversation for this date
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: existingDiary } = await supabase
        .from('diary_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', diaryDate)
        .maybeSingle();
      if (cancelled) return;
      setExistingDiaryId(existingDiary?.id ?? null);

      const { data: conv } = await supabase
        .from('conversations')
        .select('id, mode, messages(id, role, content, created_at)')
        .eq('user_id', user.id)
        .eq('date', diaryDate)
        .eq('mode', 'speak')
        .maybeSingle();
      if (cancelled) return;

      if (conv) {
        setConversationId(conv.id);
        const userMsgs = ((conv as any).messages || [])
          .filter((m: any) => m.role === 'user')
          .sort(
            (a: any, b: any) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          );
        setTurns(userMsgs.map((m: any) => ({ id: m.id, text: m.content })));
      } else {
        const { data: created } = await supabase
          .from('conversations')
          .insert({ user_id: user.id, date: diaryDate, mode: 'speak' })
          .select('id')
          .single();
        if (!cancelled && created) setConversationId(created.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, diaryDate]);

  // Release mic on unmount
  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      if (rec) releaseSpeechRecognition(rec, 'abort');
    };
  }, []);

  const stopMic = () => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    setIsListening(false);
    if (rec) releaseSpeechRecognition(rec, 'abort');
  };

  const startMic = () => {
    if (!speechSupported) {
      toast({
        variant: 'destructive',
        title: '音声入力に未対応',
        description: 'お使いのブラウザは音声入力に対応していません。',
      });
      return;
    }
    if (limitReached) return;
    const Ctor: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    baseRef.current = draft.trim();
    finalRef.current = '';

    rec.onstart = () => setIsListening(true);
    rec.onerror = (e: any) => {
      const err = e?.error;
      if (err === 'no-speech') return;
      recognitionRef.current = null;
      clearActiveRecognition(rec);
      setIsListening(false);
      if (!err || err === 'aborted') return;
      toast({
        variant: 'destructive',
        title: '音声入力エラー',
        description: String(err),
      });
    };
    rec.onend = () => {
      recognitionRef.current = null;
      clearActiveRecognition(rec);
      setIsListening(false);
    };
    rec.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const txt = (r[0]?.transcript ?? '').trim();
        if (!txt) continue;
        if (r.isFinal) {
          finalRef.current += (finalRef.current ? ' ' : '') + txt;
        } else {
          interim += (interim ? ' ' : '') + txt;
        }
      }
      const live = [finalRef.current, interim].filter(Boolean).join(' ');
      setDraft((baseRef.current ? baseRef.current + ' ' : '') + live);
    };

    try {
      recognitionRef.current = rec;
      setActiveRecognition(rec);
      rec.start();
    } catch (err) {
      recognitionRef.current = null;
      clearActiveRecognition(rec);
    }
  };

  const toggleMic = () => {
    if (recognitionRef.current) stopMic();
    else startMic();
  };

  const commitDraft = async () => {
    const text = draft.trim();
    if (!text || !user || !conversationId) return;
    if (limitReached) return;

    stopMic();

    // Optimistic local
    const tempId = `t-${Date.now()}`;
    setTurns((prev) => [...prev, { id: tempId, text }]);
    setDraft('');
    logSpokenWords(text, diaryDate);

    const { data: saved } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: text,
      })
      .select('id')
      .single();

    if (saved) {
      setTurns((prev) => prev.map((t) => (t.id === tempId ? { ...t, id: saved.id } : t)));
    }
  };

  const removeTurn = async (id: string) => {
    setTurns((prev) => prev.filter((t) => t.id !== id));
    if (!id.startsWith('t-')) {
      await supabase.from('messages').delete().eq('id', id);
    }
  };

  const handleGenerate = async () => {
    if (!user || !conversationId) return;
    const text = draft.trim();
    // Auto-commit any pending draft first
    if (text) await commitDraft();
    stopMic();
    await releaseSpeechRecognitionBeforeNavigation(recognitionRef.current);

    // Build messages payload — all user turns
    const finalTurns = text
      ? [...turns, { id: 'pending', text }]
      : turns;
    if (finalTurns.length === 0) return;

    setIsGenerating(true);
    try {
      const aiMessages = finalTurns.map((t) => ({ role: 'user', content: t.text }));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: aiMessages, type: 'generate_diary' }),
        },
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate diary');
      }
      const data = await response.json();

      const importantSentences = Array.isArray(data.importantSentences)
        ? data.importantSentences.map((s: any) => {
            const sentNorm = normalizeForExpression(String(s?.english ?? ''));
            const exprs = Array.isArray(s?.expressions)
              ? s.expressions
                  .map((x: any) => String(x ?? '').trim())
                  .filter(Boolean)
                  .filter((x: string) =>
                    sentNorm.includes(normalizeForExpression(x)),
                  )
              : [];
            return {
              english: String(s?.english ?? '').trim(),
              japanese: String(s?.japanese ?? '').trim(),
              expressions: exprs,
            };
          })
        : [];

      const { error: diaryError } = await supabase.from('diary_entries').upsert(
        {
          user_id: user.id,
          conversation_id: conversationId,
          date: diaryDate,
          content: data.diary,
          japanese_summary: data.japaneseSummary,
          word_count: data.diary.split(/\s+/).length,
          next_review_date: format(
            new Date(Date.now() + 24 * 60 * 60 * 1000),
            'yyyy-MM-dd',
          ),
          important_sentences: importantSentences,
        },
        { onConflict: 'user_id,date' },
      );
      if (diaryError) throw diaryError;

      const { data: diaryEntry } = await supabase
        .from('diary_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', diaryDate)
        .single();

      if (diaryEntry && data.expressions?.length > 0) {
        const diaryNorm = normalizeForExpression(String(data.diary ?? ''));
        const valid = data.expressions
          .map((exp: any) => ({
            expression: String(exp?.expression ?? '').trim(),
            meaning: exp?.meaning ?? null,
            example: exp?.example ?? null,
            scene_or_context: exp?.scene_or_context ?? null,
            pos_or_type:
              exp?.pos_or_type === 'fixed phrase' ? 'idiom' : exp?.pos_or_type ?? null,
          }))
          .filter((e: any) => e.expression.length > 0)
          .filter((e: any) =>
            diaryNorm.includes(normalizeForExpression(e.expression)),
          );

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
            })),
          );
        }
      }

      if (diaryEntry && importantSentences.length > 0) {
        await persistDiarySentences(
          supabase,
          user.id,
          diaryEntry.id,
          importantSentences.map((s: any) => ({
            english: s.english,
            japanese: s.japanese,
            expressions: s.expressions || [],
          })),
        );
      }

      await supabase
        .from('conversations')
        .update({ status: 'completed' })
        .eq('id', conversationId);

      try {
        playBigSuccess();
      } catch {
        /* no-op */
      }
      toast({ title: 'Diary saved! ✨', description: "Now let's review it!" });

      if (diaryEntry) {
        navigate(`/review?diaryId=${diaryEntry.id}&date=${diaryDate}`);
      } else {
        navigate('/');
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e?.message ?? 'Failed to generate diary',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (existingDiaryId) {
    // Already finalised — bounce to review
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            この日の日記はすでに生成されています。
          </p>
          <Button
            onClick={() =>
              navigate(`/review?diaryId=${existingDiaryId}&date=${diaryDate}`)
            }
          >
            レビューを開く
          </Button>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <SandyLoader />
        <p className="text-sm text-muted-foreground">日記を生成しています…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            playNavigate();
            stopMic();
            navigate('/');
          }}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="text-sm font-medium">
          🎙 {format(new Date(diaryDate), 'M月d日')} のスピーク
        </div>
        <div className="w-9" />
      </header>

      {/* Turn counter */}
      <div className="px-5 pt-3 pb-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {turnCount} / {MAX_TURNS} 区切り
        </span>
        <span>
          {totalWords} / {MAX_WORDS} words
        </span>
      </div>
      <div className="mx-5 h-1 bg-muted/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{
            width: `${Math.min(100, (totalWords / MAX_WORDS) * 100)}%`,
          }}
        />
      </div>

      {/* Turns list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {turns.length === 0 && !draft && (
          <div className="text-center text-muted-foreground text-sm py-12">
            <Mic className="w-8 h-8 mx-auto mb-2 opacity-40" />
            マイクで話すか、下のテキストエリアに直接入力してください。
            <br />
            <span className="text-[11px]">
              話し終わったら「＋ 追加」で区切りを増やせます。
            </span>
          </div>
        )}
        {turns.map((t, i) => (
          <div
            key={t.id}
            className="group rounded-2xl bg-card/70 border border-border/50 px-4 py-3 text-sm leading-relaxed relative"
          >
            <div className="text-[10px] text-muted-foreground mb-1">#{i + 1}</div>
            {t.text}
            <button
              onClick={() => removeTurn(t.id)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive"
              aria-label="削除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-border/50 bg-card/50 px-4 pt-3 pb-5 space-y-2 sticky bottom-0">
        {limitReached && (
          <div className="text-[11px] text-amber-400 text-center">
            制限に達しました。日記を生成しましょう ✨
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            limitReached
              ? '制限に達しました'
              : isListening
              ? '🎙 聞いています…'
              : '話したことを書き留める、または直接入力'
          }
          disabled={limitReached}
          className="min-h-[80px] resize-none rounded-2xl bg-background/80"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={toggleMic}
            disabled={limitReached}
            aria-label={isListening ? '録音を停止' : '録音を開始'}
            className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all',
              limitReached && 'opacity-40',
              isListening
                ? 'bg-destructive text-destructive-foreground animate-pulse'
                : 'bg-primary text-primary-foreground active:scale-95',
            )}
          >
            {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <Button
            variant="outline"
            className="flex-1"
            onClick={commitDraft}
            disabled={!draft.trim() || limitReached}
          >
            <Plus className="w-4 h-4 mr-1" />
            追加
          </Button>
        </div>

        {canGenerate && (
          <Button
            variant="glow"
            className="w-full gap-2 mt-2"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            日記を生成する
          </Button>
        )}
      </div>
    </div>
  );
}