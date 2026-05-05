import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, MessageSquare } from 'lucide-react';
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
  const [messages, setMessages] = useState<Message[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMessages(null);
      // Find the conversation tied to this diary date.
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId)
        .eq('date', diaryDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!conv) {
        setMessages([]);
        return;
      }
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, role, content, japanese')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      setMessages((msgs || []) as Message[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, diaryId, diaryDate]);

  return (
    <div className="rounded-2xl bg-card/60 border border-border/50 p-4 space-y-3 fade-in">
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

      {messages === null ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          会話を読み込み中…
        </div>
      ) : messages.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          この日の会話履歴は残っていません。
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