import { Crown, BookOpen, Sparkles, TrendingUp, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ProPaywallProps {
  onUpgrade: () => void;
  onDismiss?: () => void;
  context?: string;
}

const benefits = [
  { icon: BookOpen, text: '過去のすべての日記を復習できる' },
  { icon: Sparkles, text: 'フレーズバンクを無制限に閲覧' },
  { icon: Shuffle, text: 'フレーズ神経衰弱ゲーム' },
  { icon: TrendingUp, text: '語彙成長のグラフ・統計' },
];

export function ProPaywall({ onUpgrade, onDismiss, context }: ProPaywallProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400/20 to-amber-500/20 flex items-center justify-center mb-6">
        <Crown className="w-10 h-10 text-yellow-500" />
      </div>

      <h2 className="text-2xl font-bold mb-2">Pro にアップグレード</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">
        {context || 'この機能はProプランで利用できます。'}
      </p>

      <Card className="w-full max-w-sm mb-6 border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="p-5 space-y-3">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-center gap-3 text-left">
              <b.icon className="w-5 h-5 text-yellow-500 shrink-0" />
              <span className="text-sm font-japanese">{b.text}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-3 w-full max-w-sm">
        <Button
          variant="glow"
          size="lg"
          className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white"
          onClick={onUpgrade}
        >
          <Crown className="w-5 h-5 mr-2" />
          Proを始める（500円/月）
        </Button>

        <p className="text-xs text-muted-foreground font-japanese">
          いつでも解約OK・月額500円（税込）
        </p>

        {onDismiss && (
          <Button variant="ghost" size="sm" className="w-full font-japanese" onClick={onDismiss}>
            あとで
          </Button>
        )}
      </div>
    </div>
  );
}
