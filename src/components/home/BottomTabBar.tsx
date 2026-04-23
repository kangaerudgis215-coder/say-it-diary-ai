import { useNavigate, useLocation } from 'react-router-dom';
import { Brain, Sparkles, Shuffle, TrendingUp, List, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUISound } from '@/hooks/useUISound';

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
  }> = [
    {
      key: 'calendar',
      label: 'カレンダー',
      icon: CalendarDays,
      onClick: () => switchHome('calendar'),
      active: isHome && homeTab === 'calendar',
    },
    {
      key: 'list',
      label: 'リスト',
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
    },
    {
      key: 'expressions',
      label: '表現',
      icon: Sparkles,
      onClick: () => go('/expressions'),
      active: location.pathname.startsWith('/expressions'),
    },
    {
      key: 'game',
      label: 'ゲーム',
      icon: Shuffle,
      onClick: () => go('/instant'),
      active: location.pathname.startsWith('/instant'),
    },
    {
      key: 'progress',
      label: '進捗',
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
                <Icon className="w-5 h-5" strokeWidth={item.active ? 2.4 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}