import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SandyLoader } from '@/components/lottie/SandyLoader';

// Auth has been folded into the onboarding screen — redirect there.
export default function Auth() {
  const { user, loading } = useAuth();
  if (loading) return <SandyLoader fullscreen />;
  return <Navigate to={user ? '/' : '/onboarding'} replace />;
}

// Keep the file exporting a default component; previous markup removed.
function _UnusedLegacyMarkup() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-10 space-y-3">
        {null}
      </div>
    </div>
  );
}