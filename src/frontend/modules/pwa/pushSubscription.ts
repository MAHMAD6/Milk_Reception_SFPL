/** Browser-side Web Push registration shared by the PWA shell and notification settings. */

export type PushSetupResult = 'SUBSCRIBED' | 'UNSUPPORTED' | 'NOT_CONFIGURED' | 'DENIED' | 'SIGNED_OUT' | 'FAILED';

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Subscribes this browser (permission must already be granted) and registers it with the server. */
export async function registerPushSubscription(registration: ServiceWorkerRegistration): Promise<PushSetupResult> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return 'NOT_CONFIGURED';
  if (!isPushSupported()) return 'UNSUPPORTED';
  if (Notification.permission !== 'granted') return 'DENIED';

  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(key) }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return 'FAILED';

  const res = await fetch('/api/notifications/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      deviceLabel: navigator.userAgent.slice(0, 100),
    }),
  });
  if (res.status === 401) {
    // Not signed in: never leave a device subscribed without an owner.
    await subscription.unsubscribe().catch(() => null);
    return 'SIGNED_OUT';
  }
  return res.ok ? 'SUBSCRIBED' : 'FAILED';
}

/** Asks for permission (must run from a user gesture) and subscribes this browser. */
export async function enablePushOnThisDevice(): Promise<PushSetupResult> {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return 'NOT_CONFIGURED';
  if (!isPushSupported()) return 'UNSUPPORTED';
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') return 'DENIED';
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return await registerPushSubscription(registration);
  } catch {
    return 'FAILED';
  }
}
