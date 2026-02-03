import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/hooks/useAuth';

export default function SettingsPage() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col pb-nav">
      <header className="px-6 pt-6 pb-4">
        <h1 className="font-bold text-xl">Settings</h1>
      </header>

      <div className="flex-1 px-6 space-y-4">
        <div className="card-elevated p-4">
          <h2 className="font-semibold mb-4">Account</h2>
          <Button 
            variant="destructive" 
            className="w-full"
            onClick={signOut}
          >
            Sign Out
          </Button>
        </div>

        <div className="card-elevated p-4">
          <h2 className="font-semibold mb-2">About</h2>
          <p className="text-sm text-muted-foreground">
            VoiceDiary helps you practice English through daily journaling and spaced repetition.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
