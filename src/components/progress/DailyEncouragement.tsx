import { useEffect, useState } from 'react';
import { MessageCircleHeart, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface EncouragementData {
  message: string;
  cachedDate: string;
}

const STORAGE_KEY = 'soki_daily_encouragement';

export function DailyEncouragement() {
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) loadMessage();
  }, [user]);

  const loadMessage = async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Check local cache first
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed: EncouragementData = JSON.parse(cached);
        if (parsed.cachedDate === today && parsed.message) {
          setMessage(parsed.message);
          setIsLoading(false);
          return;
        }
      }
    } catch { /* ignore */ }

    // Fetch from edge function
    try {
      const { data, error } = await supabase.functions.invoke('daily-encouragement', {
        body: { userId: user?.id },
      });

      if (error) throw error;

      const msg = data?.message || "Keep going! Every word you speak builds your confidence. 💪";
      setMessage(msg);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ message: msg, cachedDate: today }));
    } catch (e) {
      console.error('Encouragement fetch error:', e);
      setMessage("You're doing great — every diary entry is a step forward! 🌟");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="py-5 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading today's message...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/10 to-accent/10 overflow-hidden">
      <CardContent className="py-5">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <MessageCircleHeart className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-medium">Today's Encouragement ✨</p>
            <p className="text-sm leading-relaxed text-foreground/90">{message}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
