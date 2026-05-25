import { createContext, useContext, useMemo, ReactNode } from 'react';
import { getLocalUserId } from '@/lib/localDb';

/**
 * Local-only "auth". The app no longer signs in to any backend — it just
 * issues a stable per-browser user id on first launch and pretends to be
 * authenticated as that id forever. All the existing components that read
 * `useAuth().user.id` keep working unchanged.
 */
interface LocalUser {
  id: string;
  email: null;
  user_metadata: Record<string, unknown>;
}

interface AuthContextType {
  user: LocalUser | null;
  session: { user: LocalUser } | null;
  loading: boolean;
  signUp: () => Promise<{ error: Error | null }>;
  signIn: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextType>(() => {
    const id = getLocalUserId();
    const user: LocalUser = { id, email: null, user_metadata: {} };
    return {
      user,
      session: { user },
      loading: false,
      signUp: async () => ({ error: null }),
      signIn: async () => ({ error: null }),
      signOut: async () => {
        /* no-op in local mode */
      },
    };
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
