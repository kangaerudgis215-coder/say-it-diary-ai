import { useNavigate } from 'react-router-dom';
import { ProPaywall } from '@/components/ProPaywall';
import { useSubscription } from '@/hooks/useSubscription';
import { ArrowLeft, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Upgrade() {
  const navigate = useNavigate();
  const { startCheckout, isPro, openPortal } = useSubscription();

  if (isPro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
          <Crown className="w-10 h-10 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Proプラン利用中</h2>
        <p className="text-muted-foreground mb-6 font-japanese">
          すべての機能が使えます。
        </p>
        <div className="space-y-3">
          <Button variant="outline" onClick={openPortal}>
            サブスクリプション管理
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')}>
            ホームに戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col safe-bottom">
      <header className="flex items-center gap-4 p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </header>
      <div className="flex-1">
        <ProPaywall
          onUpgrade={startCheckout}
          onDismiss={() => navigate(-1)}
        />
      </div>
    </div>
  );
}
