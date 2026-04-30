import { useNavigate, useLocation } from 'react-router-dom';
import { Brain, Sparkles, Shuffle, TrendingUp, List, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUISound } from '@/hooks/useUISound';
import { usePendingRecallCount } from '@/hooks/usePendingRecallCount';

interface BottomTabBarProps {
  /** Optional in-page tab (calendar/list) handlers for the home screen. */
  homeTab?: 'calendar' | 'list';
  onHomeTabChange?: (tab: 'calendar' | 'list') => void;
}

/**
 * Persistent icon-only bottom navigation.
 * On the Home screen we show two extra "view-mode" tabs (calendar / list)
 * so the user can flip between the calendar and the diary list.
 */
export function BottomTabBar({ homeTab, onHomeTabChange }: BottomTabBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { playNavigate } = useUISound();
  const pendingRecall = usePendingRecallCount();

  const isHome = location.pathname === '/';

  const go = (path: string) => {
    playNavigate();
    navigate(path);
  };

  const switchHome = (tab: 'calendar' | 'list') => {
    playNavigate();
    if (!isHome) navigate('/');
    onHomeTabChange?.(tab);
  };

  const items: Array<{
    key: string;
    label: string;
    icon: typeof Brain;
    onClick: () => void;
    active: boolean;
    badge?: number;
  }> = [
    {
      key: 'calendar',
      label: 'Home',
      icon: CalendarDays,
      onClick: () => switchHome('calendar'),
      active: isHome && homeTab === 'calendar',
    },
    {
      key: 'list',
      label: 'Entries',
      icon: List,
      onClick: () => switchHome('list'),
      active: isHome && homeTab === 'list',
    },
    {
      key: 'recall',
      label: 'Recall',
      icon: Brain,
      onClick: () => go('/quiz'),
      active: location.pathname.startsWith('/quiz'),
      badge: pendingRecall,
    },
    {
      key: 'expressions',
      label: 'Phrases',
      icon: Sparkles,
      onClick: () => go('/expressions'),
      active: location.pathname.startsWith('/expressions'),
    },
    {
      key: 'game',
      label: 'Flashcards',
      icon: Shuffle,
      onClick: () => go('/instant'),
      active: location.pathname.startsWith('/instant'),
    },
    {
      key: 'progress',
      label: 'Progress',
      icon: TrendingUp,
      onClick: () => go('/progress'),
      active: location.pathname.startsWith('/progress'),
    },
  ];

  return (
    <nav
      className={cn(
        'fixed bottom-0 inset-x-0 z-40',
        'bg-background/85 backdrop-blur-md border-t border-border/60',
        'safe-bottom',
      )}
    >
      <ul className="flex items-stretch justify-around max-w-lg mx-auto px-2 py-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex-1">
              <button
                onClick={item.onClick}
                aria-label={item.label}
                className={cn(
                  'w-full flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg',
                  'transition-colors',
                  item.active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="relative inline-flex">
                  <Icon className="w-5 h-5" strokeWidth={item.active ? 2.4 : 2} />
                  {item.badge && item.badge > 0 ? (
                    <span
                      className={cn(
                        'absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full',
                        'bg-destructive text-destructive-foreground',
                        'text-[10px] font-bold leading-none flex items-center justify-center',
                        'shadow-[0_0_8px_hsl(var(--destructive)/0.6)] animate-pulse ring-2 ring-background',
                      )}
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}