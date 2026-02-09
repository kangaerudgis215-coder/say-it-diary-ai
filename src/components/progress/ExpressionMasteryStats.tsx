import { useEffect, useState } from 'react';
import { Sparkles, BookOpen, TrendingUp, Award, Archive } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface MasteryBreakdown {
  total: number;
  newCount: number;
  inProgress: number;
  mastered: number;
  archived: number;
}

export function ExpressionMasteryStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<MasteryBreakdown>({ total: 0, newCount: 0, inProgress: 0, mastered: 0, archived: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('expressions')
      .select('mastery_level, status')
      .eq('user_id', user.id);

    if (data) {
      const active = data.filter(e => e.status === 'active');
      const archived = data.filter(e => e.status === 'archived');
      const newCount = active.filter(e => !e.mastery_level || e.mastery_level === 0).length;
      const inProgress = active.filter(e => e.mastery_level && e.mastery_level >= 1 && e.mastery_level <= 4).length;
      const mastered = active.filter(e => e.mastery_level && e.mastery_level >= 5).length;

      setStats({
        total: data.length,
        newCount,
        inProgress,
        mastered,
        archived: archived.length,
      });
    }
    setIsLoading(false);
  };

  const activeTotal = stats.newCount + stats.inProgress + stats.mastered;
  const masteryPercent = activeTotal > 0 ? Math.round((stats.mastered / activeTotal) * 100) : 0;

  if (isLoading) return null;

  const categories = [
    { label: 'New', count: stats.newCount, icon: Sparkles, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'In Progress', count: stats.inProgress, icon: TrendingUp, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { label: 'Mastered', count: stats.mastered, icon: Award, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Archived', count: stats.archived, icon: Archive, color: 'text-muted-foreground', bg: 'bg-muted/40' },
  ];

  return (
    <Card className="mb-6 transition-all duration-300 hover:shadow-lg hover:border-primary/20">
      <CardContent className="py-5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Expression Mastery</h2>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{stats.mastered} / {activeTotal} mastered</span>
            <span className="text-sm font-bold text-primary">{masteryPercent}%</span>
          </div>
          <Progress value={masteryPercent} className="h-3" />
        </div>

        {/* Breakdown grid */}
        <div className="grid grid-cols-4 gap-2">
          {categories.map(cat => (
            <div key={cat.label} className={cn("rounded-xl p-3 text-center transition-all duration-200 hover:scale-105", cat.bg)}>
              <cat.icon className={cn("w-4 h-4 mx-auto mb-1", cat.color)} />
              <p className={cn("text-xl font-bold", cat.color)}>{cat.count}</p>
              <p className="text-[10px] text-muted-foreground">{cat.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
