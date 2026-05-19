import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, MessageSquare, Mic } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { ChatBubble } from '@/components/ChatBubble';
import { Button } from '@/components/ui/button';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  japanese: string | null;
}

interface ConvData {
  id: string;
  mode: 'chat' | 'speak';
  messages: Message[];
}

interface Props {
  userId: string;
  diaryId: string;
  diaryDate: string; // yyyy-MM-dd
}

/**
 * Read-only preview of the conversation that produced a given day's diary.
 * Shown directly on the Home calendar tab when the selected date has an
 * existing diary, so users can revisit the chat that became their entry
 * without leaving Home. Provides quick links to the full review page and
 * the (locked) chat screen.
 */
export function SelectedDayChatPreview({ userId, diaryId, diaryDate }: Props) {
  const navigate = useNavigate();
  const [convs, setConvs] = useState<ConvData[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setConvs(null);
      const { data: rows } = await supabase
        .from('conversations')
        .select('id, mode')
        .eq('user_id', userId)
        .eq('date', diaryDate)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (!rows || rows.length === 0) {
        setConvs([]);
        return;
      }
      const results: ConvData[] = [];
      for (const c of rows) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, role, content, japanese')
          .eq('conversation_id', c.id)
          .order('created_at', { ascending: true });
        results.push({
          id: c.id,
          mode: ((c as any).mode ?? 'chat') as 'chat' | 'speak',
          messages: (msgs || []) as Message[],
        });
      }
      if (!cancelled) setConvs(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, diaryId, diaryDate]);

  if (convs === null) {
    return (
      <div className="rounded-2xl bg-card/60 border border-border/50 p-4 text-center text-xs text-muted-foreground">
        会話を読み込み中…
      </div>
    );
  }

  if (convs.length === 0) {
    return (
      <div className="rounded-2xl bg-card/60 border border-border/50 p-4 space-y-3">
        <div className="py-6 text-center text-xs text-muted-foreground">
          この日の会話履歴は残っていません。
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="w-full text-xs"
          onClick={() => navigate(`/review?diaryId=${diaryId}&date=${diaryDate}`)}
        >
          <BookOpen className="w-3.5 h-3.5 mr-1" />
          レビューを開く
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 fade-in">
      {convs.map((c) =>
        c.mode === 'speak' ? (
          <SpeakPreviewCard
            key={c.id}
            messages={c.messages}
            diaryId={diaryId}
            diaryDate={diaryDate}
          />
        ) : (
          <ChatPreviewCard
            key={c.id}
            messages={c.messages}
            diaryId={diaryId}
            diaryDate={diaryDate}
          />
        ),
      )}
    </div>
  );
}

function ChatPreviewCard({
  messages,
  diaryId,
  diaryDate,
}: {
  messages: Message[];
  diaryId: string;
  diaryDate: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl bg-card/60 border border-border/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/90">
          <MessageSquare className="w-3.5 h-3.5" />
          {format(new Date(diaryDate), 'M/d')} の会話
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs"
          onClick={() => navigate(`/review?diaryId=${diaryId}&date=${diaryDate}`)}
        >
          <BookOpen className="w-3.5 h-3.5 mr-1" />
          レビュー
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
      {messages.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          (履歴なし)
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {messages.map((m) => (
            <ChatBubble
              key={m.id}
              role={m.role}
              content={m.content}
              japaneseTranslation={m.japanese ?? undefined}
            />
          ))}
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => navigate(`/chat?date=${diaryDate}`)}
      >
        チャット画面で開く
      </Button>
    </div>
  );
}

function SpeakPreviewCard({
  messages,
  diaryId,
  diaryDate,
}: {
  messages: Message[];
  diaryId: string;
  diaryDate: string;
}) {
  const navigate = useNavigate();
  const userTurns = messages.filter((m) => m.role === 'user');
  return (
    <div className="rounded-2xl bg-card/60 border border-amber-500/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
          <Mic className="w-3.5 h-3.5" />
          {format(new Date(diaryDate), 'M/d')} のスピーク
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs"
          onClick={() => navigate(`/review?diaryId=${diaryId}&date=${diaryDate}`)}
        >
          <BookOpen className="w-3.5 h-3.5 mr-1" />
          レビュー
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
      {userTurns.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          (スピーク履歴なし)
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {userTurns.map((m, i) => (
            <div
              key={m.id}
              className="rounded-2xl bg-background/60 border border-border/40 px-3 py-2 text-sm leading-relaxed"
            >
              <div className="text-[10px] text-muted-foreground mb-0.5">
                #{i + 1}
              </div>
              {m.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}