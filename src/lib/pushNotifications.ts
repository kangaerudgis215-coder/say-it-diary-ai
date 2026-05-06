import { supabase } from '@/integrations/supabase/client';

async function fetchVapidPublicKey(): Promise<string> {
  // Do not cache this in memory. During VAPID rotation, iOS installed PWAs can
  // keep the app process alive and would otherwise reuse the previously-fetched
  // bad key even after secrets are corrected server-side.
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notifications?action=public-key&t=${Date.now()}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
  });
  if (!res.ok) throw new Error('VAPID 公開鍵の取得に失敗しました。');
  const data = (await res.json()) as { publicKey?: string };
  if (!data.publicKey) throw new Error('VAPID 公開鍵が空です。');
  return data.publicKey;
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
  const normalized = base64String
    .replace(/\s+/g, '')
    .replace(/^['"]|['"]$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const base64 = (normalized + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function normalizeVapidPublicKey(base64String: string): string {
  return base64String
    .replace(/\s+/g, '')
    .replace(/^['"]|['"]$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function toExactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
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

  const VAPID_PUBLIC_KEY = normalizeVapidPublicKey(await fetchVapidPublicKey());

  // Always drop any pre-existing subscription before resubscribing. iOS
  // Safari refuses to reuse a subscription created with a different VAPID
  // key, and even silently keeps a "ghost" subscription whose
  // applicationServerKey isn't introspectable. Unsubscribing first
  // guarantees a clean slate.
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    try {
      await existing.unsubscribe();
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', existing.endpoint);
    } catch (e) {
      console.warn('Failed to unsubscribe old push sub', e);
    }
  }

  const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  // Defensive validation — a valid P-256 uncompressed public key is exactly
  // 65 bytes and starts with 0x04. iOS Safari throws the cryptic
  // "applicationServerKey must contain a valid P-256 public key" otherwise.
  if (keyBytes.length !== 65 || keyBytes[0] !== 0x04) {
    throw new Error(
      `VAPID 公開鍵の形式が不正です (length=${keyBytes.length}, first=0x${keyBytes[0]?.toString(16)})。鍵を再設定してください。`,
    );
  }

  let sub: PushSubscription | null = null;
  const subscribeOptions = [
    // Spec-compatible and best for most Safari versions.
    { label: 'base64url-string', key: VAPID_PUBLIC_KEY },
    // Some WebKit versions are pickier and accept the byte array instead.
    { label: 'uint8array', key: keyBytes as BufferSource },
    // Final fallback for engines that require a tightly-sized ArrayBuffer.
    { label: 'arraybuffer', key: toExactArrayBuffer(keyBytes) as BufferSource },
  ];

  let lastSubscribeError: unknown = null;
  for (const option of subscribeOptions) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: option.key,
      });
      lastSubscribeError = null;
      break;
    } catch (err) {
      lastSubscribeError = err;
      console.warn(`Push subscribe failed with ${option.label}`, err);
    }
  }

  if (!sub) {
    throw lastSubscribeError instanceof Error
      ? lastSubscribeError
      : new Error('プッシュ通知の購読に失敗しました。');
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
    } catch (e) {
      console.warn('Failed to unsubscribe push sub', e);
    }
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