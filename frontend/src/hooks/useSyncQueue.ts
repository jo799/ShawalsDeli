import { useState, useEffect, useCallback, useRef } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { listQueuedSales } from '@/lib/offlineSync/queue';
import { runSync } from '@/lib/offlineSync/syncEngine';
import type { QueuedSale } from '@/lib/offlineSync/types';
import toast from 'react-hot-toast';

interface SyncQueueState {
  isOnline: boolean;
  pendingSales: QueuedSale[];
  syncing: boolean;
  syncNow: () => Promise<void>;
  refresh: () => Promise<void>;
}

// The one place that decides WHEN to sync (connectivity just came back, or
// the user asked for it manually) — mount this once, high in the app shell,
// same as useAutoLogout. Anything that needs to show "3 sales pending" or
// offer a manual "Sync Now" button reads from this hook rather than each
// re-implementing its own connectivity/queue watching.
export function useSyncQueue(): SyncQueueState {
  const isOnline = useOnlineStatus();
  const [pendingSales, setPendingSales] = useState<QueuedSale[]>([]);
  const [syncing, setSyncing] = useState(false);
  const wasOnline = useRef(isOnline);

  const refresh = useCallback(async () => {
    setPendingSales(await listQueuedSales());
  }, []);

  const syncNow = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await runSync();
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} pending sale${result.synced === 1 ? '' : 's'}`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} sale${result.failed === 1 ? '' : 's'} still couldn't sync — will retry`);
      }
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [syncing, refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-sync the moment connectivity is confirmed restored (not just on
  // every render where isOnline happens to be true) — this only fires on
  // the actual offline -> online transition.
  useEffect(() => {
    if (isOnline && !wasOnline.current) {
      syncNow();
    }
    wasOnline.current = isOnline;
  }, [isOnline, syncNow]);

  return { isOnline, pendingSales, syncing, syncNow, refresh };
}