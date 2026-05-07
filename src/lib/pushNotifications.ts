import { supabase } from '@/integrations/supabase/client';

interface OneSignalConfig {
  appId: string;
  safariWebId?: string;
}

type OneSignalSDK = {
  init: (options: Record<string, unknown>) => Promise<void> | void;
  login?: (externalId: string) => Promise<void> | void;
  logout?: () => Promise<void> | void;
  Notifications?: {
    requestPermission?: () => Promise<boolean | void> | boolean | void;
  };
  User?: {
    addTag?: (key: string, value: string) => Promise<void> | void;
    PushSubscription?: {
      id?: string | null;
      optedIn?: boolean;
      optIn?: () => Promise<void> | void;
      optOut?: () => Promise<void> | void;
    };
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalSDK) => void | Promise<void>>;
    OneSignal?: OneSignalSDK;
  }
}

let oneSignalConfigPromise: Promise<OneSignalConfig> | null = null;
let oneSignalInitPromise: Promise<OneSignalSDK> | null = null;
let legacyCleanupPromise: Promise<void> | null = null;

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

/** OneSignal Web Push is unavailable in iframes and Lovable preview hosts. */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (isInIframe() || isPreviewHost()) return false;
  return 'serviceWorker' in navigator && 'Notification' in window && window.isSecureContext;
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

async function fetchOneSignalConfig(): Promise<OneSignalConfig> {
  if (!oneSignalConfigPromise) {
    oneSignalConfigPromise = (async () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onesignal-config?t=${Date.now()}`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
      });
      if (!res.ok) throw new Error('OneSignal設定の取得に失敗しました。');
      const data = (await res.json()) as { appId?: string; safariWebId?: string };
      if (!data.appId) {
        throw new Error('OneSignal App ID が未設定です。App IDを入力後、もう一度試してください。');
      }
      return { appId: data.appId, safariWebId: data.safariWebId };
    })();
  }
  return oneSignalConfigPromise;
}

function loadOneSignalScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-onesignal-sdk="true"]');
    if (existing) {
      if (window.OneSignal || window.OneSignalDeferred) resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('OneSignal SDKの読み込みに失敗しました。')), { once: true });
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.async = true;
    script.dataset.onesignalSdk = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('OneSignal SDKの読み込みに失敗しました。'));
    document.head.appendChild(script);
  });
}

async function cleanupLegacyWebPush(): Promise<void> {
  if (!legacyCleanupPromise) {
    legacyCleanupPromise = (async () => {
      if (!('serviceWorker' in navigator)) return;
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (registration) => {
          const scriptUrl =
            registration.active?.scriptURL ||
            registration.waiting?.scriptURL ||
            registration.installing?.scriptURL ||
            '';
          const isLegacySokiWorker = scriptUrl.includes('/sw.js');
          if (!isLegacySokiWorker) return;
          try {
            const sub = await registration.pushManager.getSubscription();
            await sub?.unsubscribe();
          } catch (e) {
            console.warn('Failed to unsubscribe legacy push subscription', e);
          }
          await registration.unregister();
        }),
      );
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
      localStorage.removeItem('soki:push-optin-dismissed');
    })();
  }
  return legacyCleanupPromise;
}

async function initOneSignal(): Promise<OneSignalSDK> {
  if (!isPushSupported()) {
    throw new Error('この環境ではプッシュ通知が利用できません。公開アプリをブラウザで開いて試してください。');
  }
  if (!oneSignalInitPromise) {
    oneSignalInitPromise = (async () => {
      await cleanupLegacyWebPush();
      const config = await fetchOneSignalConfig();
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      await loadOneSignalScript();

      return await new Promise<OneSignalSDK>((resolve, reject) => {
        window.OneSignalDeferred!.push(async (OneSignal) => {
          try {
            await OneSignal.init({
              appId: config.appId,
              ...(config.safariWebId ? { safari_web_id: config.safariWebId } : {}),
              notifyButton: { enable: false },
              serviceWorkerParam: { scope: '/' },
              serviceWorkerPath: 'OneSignalSDKWorker.js',
              serviceWorkerUpdaterPath: 'OneSignalSDKUpdaterWorker.js',
            });
            resolve(OneSignal);
          } catch (e) {
            reject(e);
          }
        });
      });
    })();
  }
  return oneSignalInitPromise;
}

/** Ask permission, initialize OneSignal, and associate this device with the logged-in user. */
export async function enablePushNotifications(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('ログインが必要です。');

  const OneSignal = await initOneSignal();
  await OneSignal.login?.(user.id);
  await OneSignal.Notifications?.requestPermission?.();

  if (Notification.permission !== 'granted') {
    throw new Error('通知の許可が得られませんでした。');
  }

  await OneSignal.User?.PushSubscription?.optIn?.();
  await OneSignal.User?.addTag?.('app', 'soki');
  await OneSignal.User?.addTag?.('reminder_hour_jst', '21');
  await OneSignal.User?.addTag?.('platform', /iphone|ipad|android/i.test(navigator.userAgent) ? 'mobile' : 'desktop');
  return true;
}

export async function disablePushNotifications(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const OneSignal = await initOneSignal();
    await OneSignal.User?.PushSubscription?.optOut?.();
    await OneSignal.logout?.();
  } catch (e) {
    console.warn('Failed to disable OneSignal push notifications', e);
  }
}

/** Whether the current device already has an active OneSignal push subscription. */
export async function isPushEnabledHere(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    const OneSignal = await initOneSignal();
    return Boolean(OneSignal.User?.PushSubscription?.optedIn || OneSignal.User?.PushSubscription?.id);
  } catch {
    return false;
  }
}
