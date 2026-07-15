import api from './api';

// Converts the VAPID public key from base64url (how the server hands it out)
// into the raw byte array the browser's Push API actually expects.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getPushSubscriptionStatus(): Promise<'subscribed' | 'unsubscribed' | 'unsupported' | 'denied'> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'unsubscribed';
  }
}

// The full opt-in flow: register the service worker (idempotent — safe to
// call even if already registered), ask for notification permission if not
// already granted, subscribe with the server's public key, then tell the
// backend about this specific device so it knows where to send future
// alerts.
export async function subscribeToKitchenAlerts(): Promise<{ success: boolean; message?: string }> {
  if (!isPushSupported()) {
    return { success: false, message: 'Push notifications are not supported in this browser.' };
  }
  try {
    const { data } = await api.get('/push/config');
    if (!data.data.configured || !data.data.publicKey) {
      return { success: false, message: 'Push notifications are not configured on the server yet.' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, message: 'Notification permission was not granted.' };
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.data.publicKey) as BufferSource,
      });
    }

    await api.post('/push/subscribe', { subscription: subscription.toJSON() });
    return { success: true };
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message || 'Could not enable notifications';
    return { success: false, message: msg };
  }
}

export async function unsubscribeFromKitchenAlerts(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch { /* best-effort — nothing more useful to do if this fails */ }
}