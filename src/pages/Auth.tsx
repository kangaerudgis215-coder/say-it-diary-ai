import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Mail, Lock, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast({
          title: "Welcome back! 🌙",
          description: "Let's continue your journey.",
        });
        navigate('/');
      } else {
        const { error } = await signUp(email, password, displayName);
        if (error) throw error;
        toast({
          title: "Welcome to SO-KI! ✨",
          description: "Your journey begins now.",
        });
        navigate('/');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Oops!",
        description: error.message || "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* Logo & Title */}
      <div className="text-center mb-8 space-y-3">
        <div className="w-20 h-20 mx-auto bg-primary/20 rounded-3xl flex items-center justify-center float">
          <BookOpen className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">SO-KI</h1>
        <p className="text-muted-foreground">
          Speak your day, learn English naturally
        </p>
      </div>

      {/* Auth Form */}
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="pl-10 h-12 rounded-xl bg-card border-border"
              />
            </div>
          )}
          
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="pl-10 h-12 rounded-xl bg-card border-border"
            />
          </div>
          
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="pl-10 h-12 rounded-xl bg-card border-border"
            />
          </div>

          <Button
            type="submit"
            variant="glow"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isLogin ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin ? (
              <>Don't have an account? <span className="text-primary font-medium">Sign up</span></>
            ) : (
              <>Already have an account? <span className="text-primary font-medium">Sign in</span></>
            )}
          </button>
        </div>
      </div>

      {/* Decorative text */}
      <p className="mt-12 text-xs text-muted-foreground/60 text-center max-w-xs">
        Your personal English learning companion that turns daily moments into language growth.
      </p>
    </div>
  );
}
