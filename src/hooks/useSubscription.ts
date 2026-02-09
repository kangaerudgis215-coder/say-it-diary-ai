import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export type Plan = 'free' | 'pro';

interface SubscriptionState {
  plan: Plan;
  isLoading: boolean;
  subscriptionEnd: string | null;
}

export function useSubscription() {
  const { user, session } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    plan: 'free',
    isLoading: true,
    subscriptionEnd: null,
  });

  const checkSubscription = useCallback(async () => {
    if (!user || !session) {
      setState({ plan: 'free', isLoading: false, subscriptionEnd: null });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;

      setState({
        plan: data.plan || 'free',
        isLoading: false,
        subscriptionEnd: data.subscription_end || null,
      });
    } catch (err) {
      console.error('Error checking subscription:', err);
      // Fallback: read from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('user_id', user.id)
        .maybeSingle();

      setState({
        plan: (profile as any)?.plan || 'free',
        isLoading: false,
        subscriptionEnd: null,
      });
    }
  }, [user, session]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const isPro = state.plan === 'pro';

  const startCheckout = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('create-checkout');
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, '_blank');
    }
  }, []);

  const openPortal = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('customer-portal');
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, '_blank');
    }
  }, []);

  return {
    plan: state.plan,
    isPro,
    isLoading: state.isLoading,
    subscriptionEnd: state.subscriptionEnd,
    checkSubscription,
    startCheckout,
    openPortal,
  };
}
