import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatBubble } from '@/components/ChatBubble';
import { VoiceRecordButton } from '@/components/VoiceRecordButton';
import { HelpCircle } from 'lucide-react';
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
import { format, parseISO, isToday as isTodayFn } from 'date-fns';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isGeneratingDiary, setIsGeneratingDiary] = useState(false);
  const [diaryDate, setDiaryDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [showHelp, setShowHelp] = useState(false);
  
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

    // Check for existing conversation for this diary date
    const { data: existing } = await supabase
      .from('conversations')
      .select('*, messages(*)')
      .eq('user_id', user.id)
      .eq('date', diaryDate)
      .single();

    if (existing) {
      setConversationId(existing.id);
      setMessages((existing.messages || []).map((m: any) => ({
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

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Save user message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: 'user',
      content: userMessage.content,
    });

    try {
      // Call AI for response
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
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
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save assistant message
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: assistantMessage.content,
      });
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

      // Save diary entry using the diaryDate (not necessarily today)
      // next_review_date is based on when the diary was created (now), not diary_date
      const { error: diaryError } = await supabase
        .from('diary_entries')
        .upsert({
          user_id: user.id,
          conversation_id: conversationId,
          date: diaryDate,
          content: data.diary,
          japanese_summary: data.japaneseSummary,
          word_count: data.diary.split(/\s+/).length,
          next_review_date: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
          important_sentences: data.importantSentences || [],
        }, { onConflict: 'user_id,date' });

      if (diaryError) throw diaryError;

      // Save expressions
      if (data.expressions && data.expressions.length > 0) {
        const { data: diaryEntry } = await supabase
          .from('diary_entries')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', diaryDate)
          .single();

        if (diaryEntry) {
          await supabase.from('expressions').insert(
            data.expressions.map((exp: any) => ({
              user_id: user.id,
              diary_entry_id: diaryEntry.id,
              expression: exp.expression,
              meaning: exp.meaning,
              example_sentence: exp.example,
              scene_or_context: exp.scene_or_context || null,
              pos_or_type: exp.pos_or_type || null,
            }))
          );
        }
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

      // Get the diary entry ID and navigate to review page
      const { data: savedEntry } = await supabase
        .from('diary_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', diaryDate)
        .single();

      if (savedEntry) {
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

  const handleVoiceTranscript = (text: string) => {
    setInput(prev => prev + (prev ? ' ' : '') + text);
    inputRef.current?.focus();
  };

  // Check if we have enough content for diary (at least 2 user messages)
  const hasEnoughContent = messages.filter(m => m.role === 'user').length >= 2;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
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
          </div>
          
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
        </div>
        
        {/* Prompt to finish when ready */}
        {hasEnoughContent && !isGeneratingDiary && (
          <p className="text-xs text-center text-primary mt-2 animate-pulse">
            Ready? Tap Done to create your diary! ✨
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
          />
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 glass border-t border-border p-4 safe-bottom">
        <div className="flex items-center gap-3">
          <VoiceRecordButton onTranscript={handleVoiceTranscript} />
          
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder="Type or speak in English..."
              className="pr-12 h-12 rounded-xl bg-muted border-0"
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
        </div>
      </div>
    </div>
  );
}
