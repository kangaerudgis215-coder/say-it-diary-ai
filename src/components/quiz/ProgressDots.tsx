interface ProgressDotsProps {
  current: number;
  total: number;
}

export function ProgressDots({ current, total }: ProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
            i < current
              ? 'bg-primary scale-100'
              : i === current
              ? 'bg-primary animate-pulse scale-125'
              : 'bg-muted-foreground/30'
          }`}
        />
      ))}
      <span className="ml-2 text-xs text-muted-foreground">
        {current + 1} / {total}
      </span>
    </div>
  );
}
