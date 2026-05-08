import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Home from './Home';
import { SandyLoader } from '@/components/lottie/SandyLoader';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/onboarding', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <SandyLoader fullscreen />;
  }

  if (!user) {
    return null;
  }

  return <Home />;
}
