import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Home from './Home';

export default function Index() {
  const navigate = useNavigate();

  // First-launch redirect to onboarding intro. Once the user finishes the
  // intro we stamp `soki_onboarded=1` so subsequent visits go straight Home.
  useEffect(() => {
    if (!localStorage.getItem('soki_onboarded')) {
      navigate('/onboarding', { replace: true });
    }
  }, [navigate]);

  return <Home />;
}
