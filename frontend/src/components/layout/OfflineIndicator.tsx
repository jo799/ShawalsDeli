import { WifiOff, RefreshCw } from 'lucide-react';
import { useSyncQueue } from '@/hooks/useSyncQueue';

// Mounted once in AppLayout so it's visible from anywhere in the app, not
// just POS — a sale rung up offline still needs syncing even if the
// cashier has since moved to another page. Renders nothing at all in the
// common case (online, nothing pending) rather than an empty placeholder.
export default function OfflineIndicator() {
  const { isOnline, pendingSales, syncing, syncNow } = useSyncQueue();

  if (isOnline && pendingSales.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium ${isOnline ? 'bg-status-warning/10 text-status-warning' : 'bg-status-error/10 text-status-error'}`}>
      {!isOnline && (
        <span className="flex items-center gap-1.5">
          <WifiOff size={13} /> Offline — sales will sync automatically once reconnected
        </span>
      )}
      {pendingSales.length > 0 && (
        <span className="flex items-center gap-1.5 ml-auto">
          {pendingSales.length} sale{pendingSales.length === 1 ? '' : 's'} pending sync
          {isOnline && (
            <button onClick={syncNow} disabled={syncing} className="btn-ghost py-0.5 px-2 flex items-center gap-1 disabled:opacity-50">
              <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          )}
        </span>
      )}
    </div>
  );
}