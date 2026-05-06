import { supabase } from '@/integrations/supabase/client';

// VAPID public key is fetched from the server at runtime so a key rotation
// never desyncs client and server (which would silently break notifications
// with Apple's "BadVapidPublicKey" error).
let cachedPublicKey: string | null = null;
async function fetchVapidPublicKey(): Promise<string> {
  if (cachedPublicKey) return cachedPublicKey;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notifications?action=public-key`;
  const res = await fetch(url, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
  });
  if (!res.ok) throw new Error('VAPID 公開鍵の取得に失敗しました。');
  const data = (await res.json()) as { publicKey?: string };
  if (!data.publicKey) throw new Error('VAPID 公開鍵が空です。');
  cachedPublicKey = data.publicKey;
  return cachedPublicKey;
}

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isPreviewHost(): boolean {
  const host = window.location.hostname;
  return host.includes('id-preview--') || host.includes('lovableproject.com');
}

/** Push is unavailable in iframes and Lovable preview hosts. */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (isInIframe() || isPreviewHost()) return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

/**
 * Ask permission, register SW, subscribe and persist to Supabase.
 * Returns true on success.
 */
export async function enablePushNotifications(): Promise<boolean> {
  if (!isPushSupported()) {
    throw new Error('この端末ではプッシュ通知が利用できません。');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('通知の許可が得られませんでした。');
  }

  const reg = await ensureRegistration();
  await navigator.serviceWorker.ready;

  const VAPID_PUBLIC_KEY = await fetchVapidPublicKey();

  let sub = await reg.pushManager.getSubscription();
  // If a stored subscription was created with a *different* VAPID key
  // (e.g. from before this rotation fix), Apple will reject every push with
  // "BadVapidPublicKey". Detect that and resubscribe with the current key.
  if (sub) {
    try {
      const currentKey = sub.options?.applicationServerKey
        ? btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
        : '';
      if (currentKey && currentKey !== VAPID_PUBLIC_KEY) {
        await sub.unsubscribe();
        sub = null;
      }
    } catch {
      // Ignore comparison failures — we'll just keep the existing sub.
    }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
  }

  const json = sub.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('プッシュ購読情報の取得に失敗しました。');
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('ログインが必要です。');

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 255),
        enabled: true,
      },
      { onConflict: 'endpoint' },
    );
  if (error) throw error;
  return true;
}

export async function disablePushNotifications(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    try {
      await sub.unsubscribe();
    } catch {}
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  }
}

/** Whether the current device already has an active push subscription saved. */
export async function isPushEnabledHere(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return !!sub;
}