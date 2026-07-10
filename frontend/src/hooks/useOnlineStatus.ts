import { useEffect } from 'react';
import { create } from 'zustand';

const HEARTBEAT_INTERVAL_MS = 5000;

// navigator.onLine is necessary but not sufficient — it only reflects
// whether the device's network adapter thinks it's connected to
// *something* (e.g. still "online" on a WiFi network with no real internet
// behind it). The only way to know the actual backend is reachable is to
// ask it, so this pairs the browser's own online/offline events (for fast
// reaction the moment a cable is pulled or WiFi drops) with a periodic
// heartbeat against the real API (to catch "connected to the router, but
// the server / internet is down" — the case navigator.onLine misses
// entirely).
//
// Backed by a shared store rather than component-local state — this hook
// used to run its own independent useState/useEffect/interval in every
// component that called it (POSPage, and separately the OfflineIndicator
// in AppLayout), meaning there were two separate heartbeats disagreeing
// with each other for however many seconds until they both happened to
// land. One shared store means one heartbeat, and every consumer reads the
// identical, current value at the same time.
//
// IMPORTANT CAVEAT if you're testing this locally: if the frontend dev
// server and the backend are running on the SAME machine (the normal local
// dev setup), disconnecting that machine's WiFi does NOT break the
// connection between the browser and localhost — localhost traffic never
// touches the network adapter at all, so this correctly keeps reporting
// "online" because it genuinely can still reach the backend. That's not a
// bug; it's what "offline" would actually mean in that topology. To test
// realistically, use your browser DevTools' Network tab → "Offline" (which
// intercepts fetch() itself, unlike physically disabling WiFi), or test
// against a real deployment where the device and the server are actually
// different machines reachable only over the real internet.
let checking = false;

const useOnlineStore = create<{ isOnline: boolean; setIsOnline: (v: boolean) => void }>((set) => ({
  isOnline: navigator.onLine,
  setIsOnline: (v) => set({ isOnline: v }),
}));

async function checkReachability() {
  if (checking) return;
  checking = true;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('/api/health', { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);
    useOnlineStore.getState().setIsOnline(res.ok);
  } catch {
    useOnlineStore.getState().setIsOnline(false);
  } finally {
    checking = false;
  }
}

let heartbeatStarted = false;

function startHeartbeatOnce() {
  if (heartbeatStarted) return;
  heartbeatStarted = true;

  // navigator.onLine saying "offline" is trusted immediately and
  // synchronously — when the browser is confident there's no network at
  // all, that signal is reliable even before the next heartbeat lands.
  // It is NOT trusted for "online" (see the caveat above), which is why
  // the 'online' event still triggers a real reachability check rather
  // than just flipping the flag back on.
  window.addEventListener('offline', () => useOnlineStore.getState().setIsOnline(false));
  window.addEventListener('online', () => checkReachability());

  checkReachability();
  setInterval(checkReachability, HEARTBEAT_INTERVAL_MS);
}

export function useOnlineStatus(): boolean {
  useEffect(() => { startHeartbeatOnce(); }, []);
  return useOnlineStore((s) => s.isOnline);
}