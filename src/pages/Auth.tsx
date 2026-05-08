import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { lovable } from '@/integrations/lovable';

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate('/', { replace: true });
  }, [user, authLoading, navigate]);

  const handleGoogle = async () => {
    setSigningIn(true);
    try {
      localStorage.setItem('soki_onboarded', '1');
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw new Error((result.error as Error).message ?? 'Sign-in failed');
      if (result.redirected) return;
      navigate('/', { replace: true });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'ログインできませんでした',
        description: err?.message ?? 'もう一度お試しください。',
      });
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-10 space-y-3">
        <div className="w-20 h-20 mx-auto bg-primary/20 rounded-3xl flex items-center justify-center float">
          <BookOpen className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">SO-KI</h1>
        <p className="text-muted-foreground text-sm">話して書く、毎晩の英語日記</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <Button
          onClick={handleGoogle}
          disabled={signingIn}
          size="lg"
          className="w-full h-12 rounded-full bg-white text-slate-900 hover:bg-white/90 shadow-lg"
        >
          {signingIn ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <span className="flex items-center gap-3 font-semibold">
              <GoogleIcon />
              Googleではじめる
            </span>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          登録は<span className="text-primary font-medium">無料</span>・タップ1回で始められます ✨
        </p>
      </div>

      <p className="mt-12 text-xs text-muted-foreground/60 text-center max-w-xs">
        毎日の出来事を英語で残し、AIが自然な表現に整えます。
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}