import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SandyLoader } from '@/components/lottie/SandyLoader';

// Auth has been folded into the onboarding screen — this route now just redirects.
export default function Auth() {
  const { user, loading } = useAuth();
  if (loading) return <SandyLoader fullscreen />;
  return <Navigate to={user ? '/' : '/onboarding'} replace />;
}
