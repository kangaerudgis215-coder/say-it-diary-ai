import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ActionCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'accent';
  disabled?: boolean;
  badge?: string;
  statusMessage?: string | null;
  className?: string;
  hoverColor?: string;
}

export function ActionCard({
  icon,
  title,
  description,
  onClick,
  variant = 'secondary',
  disabled = false,
  badge,
  statusMessage,
  className,
  hoverColor,
}: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={hoverColor ? { '--hover-glow': hoverColor } as React.CSSProperties : undefined}
      className={cn(
        "relative w-full p-6 rounded-2xl text-left transition-all duration-300 group",
        "flex flex-col items-center gap-4",
        "hover:-translate-y-1 active:translate-y-0",
        disabled && "opacity-50 cursor-not-allowed hover:translate-y-0",
        variant === 'primary' && "bg-primary/10 border border-primary/30 hover:border-primary/50 hover:shadow-glow",
        variant === 'secondary' && "bg-card border border-border hover:border-[color:var(--hover-glow,hsl(var(--primary)))] card-glow",
        variant === 'accent' && "bg-accent/20 border border-accent/30 hover:border-accent/50",
        hoverColor && "hover:shadow-[0_0_25px_-5px_var(--hover-glow)]",
        className
      )}
    >
      {badge && (
        <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/20 text-primary">
          {badge}
        </span>
      )}
      
      <div 
        className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
          variant === 'primary' && "bg-primary/20 text-primary",
          variant === 'secondary' && "bg-muted text-foreground",
          variant === 'accent' && "bg-accent/30 text-accent-foreground"
        )}
      >
        {icon}
      </div>
      
      <div className="text-center space-y-1">
        <h3 className={cn(
          "font-bold text-lg",
          variant === 'primary' && "text-primary"
        )}>
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
        {statusMessage && (
          <p className="text-xs text-primary font-medium mt-2 animate-pulse">
            {statusMessage}
          </p>
        )}
      </div>
    </button>
  );
}
