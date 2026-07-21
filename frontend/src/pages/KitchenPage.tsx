import { useState, useEffect, useCallback, useRef } from 'react';
import { ChefHat, Volume2, VolumeX, Maximize2, RefreshCw, CheckCircle, ShoppingCart, Flame, CheckCheck, Timer, Pencil, Bell, BellOff, UserCheck, UserPlus, X } from 'lucide-react';
import api from '@/lib/api';
import { formatTime, toLocalDateString } from '@/lib/utils';
import { getPushSubscriptionStatus, subscribeToKitchenAlerts, unsubscribeFromKitchenAlerts } from '@/lib/pushNotifications';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface Order {
  id: string; order_number: string; type: string; status: string;
  table_number?: string; customer_name?: string;
  created_at: string; updated_at?: string; completed_at?: string;
  total?: number; amount_paid?: number;
  special_instructions?: string;
  prepared_by?: string; prepared_by_name?: string;
  items?: Array<{ item_name: string; quantity: number }>;
}

interface Chef { id: string; full_name: string; role: string; }

const typeIcon = (type: string) => ({ dine_in: '🪑', takeaway: '🛍️', delivery: '🛵' }[type] || '🪑');

const minutesSince = (date: string) => Math.floor((Date.now() - new Date(date).getTime()) / 60000);

// "2205m" reads like a glitch even when it's a mathematically correct
// elapsed time — an order that sat forgotten for a day and a half is a real
// (if rare) thing that can happen, and it deserves to be visible rather than
// hidden, but "36h 45m" communicates that at a glance where "2205m" doesn't.
const formatMinutesToServe = (mins: number): string => {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

function OrderCard({
  order, onAction, compact, isAdmin, chefs, assigningOrderId, onOpenAssign, onCloseAssign, onAssign, assignBusy, currentUserId, canOverrideAssignment,
}: {
  order: Order; onAction: (id: string, status: string) => void; compact?: boolean;
  isAdmin: boolean; chefs: Chef[]; assigningOrderId: string | null;
  onOpenAssign: (orderId: string) => void; onCloseAssign: () => void;
  onAssign: (orderId: string, chefId: string) => void; assignBusy: boolean;
  currentUserId?: string; canOverrideAssignment: boolean;
}) {
  const mins = minutesSince(order.created_at);
  const isUrgent = mins > 20 && order.status === 'preparing';
  // "Prep time"/"Ready time" specifically mean time spent in that status —
  // using order.created_at here would overstate it, potentially by a lot,
  // for any order that sat a while in an earlier status first (e.g. waiting
  // in the new-orders queue before a chef actually started cooking it).
  // updated_at is bumped on every status transition (see
  // ordersController.updateOrderStatus), so for an order currently sitting
  // in preparing/ready, it correctly marks the moment that status began.
  const minsInStatus = minutesSince(order.updated_at || order.created_at);

  return (
    <div className={`card p-3 ${isUrgent ? 'border-status-error/50' : ''} ${compact ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-brand">#{order.order_number}</span>
            {order.status === 'new' && (
              <span className="badge bg-brand/10 text-brand text-[9px] font-bold animate-pulse">NEW</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
            <span>{typeIcon(order.type)}</span>
            {order.table_number && <span>Table {order.table_number}</span>}
            <span className="capitalize">{order.type.replace('_', ' ')}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted">{formatTime(order.created_at)}</p>
          <p className={`text-xs font-medium mt-0.5 ${isUrgent ? 'text-status-error' : 'text-text-muted'}`}>
            {mins}m ago
          </p>
        </div>
      </div>

      <div className="space-y-1 mb-3">
        {order.items?.slice(0, 4).map((item, i) => (
          <p key={i} className="text-xs text-text-secondary flex items-center gap-1">
            <span className="text-text-muted">•</span>
            {item.quantity > 1 && <span className="text-brand font-medium">{item.item_name} x{item.quantity}</span>}
            {item.quantity === 1 && item.item_name}
          </p>
        ))}
        {(order.items?.length || 0) > 4 && (
          <p className="text-xs text-text-muted">+{(order.items?.length || 0) - 4} more items</p>
        )}
      </div>

      {order.special_instructions && (
        <div className="flex items-start gap-1.5 bg-status-warning/10 border border-status-warning/30 rounded-lg px-2 py-1.5 mb-3">
          <Pencil size={11} className="text-status-warning shrink-0 mt-0.5" />
          <p className="text-xs text-status-warning font-medium">{order.special_instructions}</p>
        </div>
      )}

      {order.status === 'new' && (
        <div className="space-y-1.5">
          {/* Whoever it's assigned to shows for everyone, not just admins —
              a chef glancing at the board should be able to tell at a
              glance whether this one's already someone else's. Only the
              controls to actually change the assignment are admin-gated. */}
          {assigningOrderId === order.id ? (
            <div className="flex items-center gap-1.5">
              <select
                autoFocus
                disabled={assignBusy}
                onChange={e => { if (e.target.value) onAssign(order.id, e.target.value); }}
                defaultValue=""
                className="select text-[11px] py-1 flex-1 disabled:opacity-50"
              >
                <option value="" disabled>Select a chef…</option>
                {chefs.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
              <button onClick={onCloseAssign} className="btn-ghost p-1 shrink-0"><X size={12} /></button>
            </div>
          ) : order.prepared_by_name ? (
            <div className="flex items-center justify-between gap-1 text-[11px] text-text-muted bg-surface-50 rounded-lg px-2 py-1.5">
              <span className="flex items-center gap-1 min-w-0">
                <UserCheck size={11} className="shrink-0" /> <span className="truncate">Assigned to {order.prepared_by_name}</span>
              </span>
              {isAdmin && (
                <button onClick={() => onOpenAssign(order.id)} className="text-brand hover:text-brand-400 font-medium shrink-0">Reassign</button>
              )}
            </div>
          ) : isAdmin ? (
            <button
              onClick={() => onOpenAssign(order.id)}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] text-brand hover:text-brand-400 border border-dashed border-border rounded-lg py-1.5 transition-colors"
            >
              <UserPlus size={12} /> Assign to chef
            </button>
          ) : null}
          {(() => {
            const lockedToSomeoneElse = !!order.prepared_by && order.prepared_by !== currentUserId && !canOverrideAssignment;
            return (
              <button
                onClick={() => !lockedToSomeoneElse && onAction(order.id, 'preparing')}
                disabled={lockedToSomeoneElse}
                title={lockedToSomeoneElse ? `Assigned to ${order.prepared_by_name || 'another chef'} — only they or an admin can start it` : undefined}
                className="w-full btn-primary py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {lockedToSomeoneElse ? `Only ${order.prepared_by_name || 'the assigned chef'} can start this` : 'Start Preparing'}
              </button>
            );
          })()}
        </div>
      )}
      {order.status === 'preparing' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-xs text-status-warning">
            <span className="w-2 h-2 rounded-full bg-status-warning animate-pulse" />
            Prep time: {String(Math.floor(minsInStatus / 60)).padStart(2, '0')}:{String(minsInStatus % 60).padStart(2, '0')}
          </div>
          {order.prepared_by_name && (
            <div className="flex items-center gap-1 text-[11px] text-text-muted">
              <UserCheck size={11} /> {order.prepared_by_name}
            </div>
          )}
          <button
            onClick={() => onAction(order.id, 'ready')}
            className="w-full btn-primary py-1.5 text-xs"
          >
            Mark Ready
          </button>
        </div>
      )}
      {order.status === 'ready' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-xs text-status-success">
            <span className="w-2 h-2 rounded-full bg-status-success" />
            Ready time: {minsInStatus}m
          </div>
          {order.prepared_by_name && (
            <div className="flex items-center gap-1 text-[11px] text-text-muted">
              <UserCheck size={11} /> {order.prepared_by_name}
            </div>
          )}
          {order.type === 'dine_in' && Number(order.amount_paid ?? 0) < Number(order.total ?? 0) - 0.01 && (
            <p className="text-[11px] text-status-warning">
              ⚠ Not fully paid yet — this table's bill needs settling before it can be marked served.
            </p>
          )}
          <button
            onClick={() => onAction(order.id, 'completed')}
            className="w-full bg-status-success/10 text-status-success border border-status-success/30 rounded-lg py-1.5 text-xs font-medium hover:bg-status-success/20 transition-colors flex items-center justify-center gap-1"
          >
            <CheckCircle size={12} /> Mark Served
          </button>
        </div>
      )}
    </div>
  );
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchFailing, setFetchFailing] = useState(false);
  const consecutiveFailures = useRef(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [refreshSeconds, setRefreshSeconds] = useState(30);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const knownOrderIds = useRef<Set<string> | null>(null);
  const [pushStatus, setPushStatus] = useState<'subscribed' | 'unsubscribed' | 'unsupported' | 'denied' | 'loading'>('loading');
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'administrator';
  const canOverrideAssignment = user?.role === 'administrator' || user?.role === 'manager';
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);

  useEffect(() => { getPushSubscriptionStatus().then(setPushStatus); }, []);

  const handleTogglePush = async () => {
    if (pushStatus === 'subscribed') {
      await unsubscribeFromKitchenAlerts();
      setPushStatus('unsubscribed');
      toast.success('Phone alerts turned off on this device');
      return;
    }
    if (pushStatus === 'denied') {
      // Once a browser has denied a site's notification permission, no
      // amount of JS can re-trigger that prompt — this is a deliberate
      // browser security restriction, not something a "try again" button
      // can work around. The only way forward is the person manually
      // resetting it in their own browser settings.
      toast.error(
        'Notifications are blocked for this site. On Android Chrome: tap the ⓘ or 🔒 icon next to the address bar → Permissions → Notifications → Allow. Then reload this page and try again.',
        { duration: 8000 }
      );
      return;
    }
    setPushStatus('loading');
    const result = await subscribeToKitchenAlerts();
    if (result.success) {
      setPushStatus('subscribed');
      toast.success('This device will now get a notification for every new order');
    } else {
      setPushStatus(await getPushSubscriptionStatus());
      toast.error(result.message || 'Could not enable phone alerts', { duration: 7000 });
    }
  };

  // Short beep via the Web Audio API — no audio file to ship.
  //
  // The real bug this fixes: browsers only let audio actually play after a
  // genuine user gesture (a click, a keypress) — a setInterval callback
  // firing on its own doesn't count, no matter how it's wrapped. Creating a
  // brand new AudioContext per beep (the previous version) meant every
  // single one came up "suspended" and produced no audible sound at all,
  // with no error thrown — it looked like the feature was on but nothing
  // ever played. Fixed by keeping ONE AudioContext for the page's lifetime
  // and explicitly resuming it the moment the user interacts with the page
  // at all (clicking "Start Preparing", the Sound toggle, anywhere) — by
  // the time a real new order needs to beep, it's already unlocked.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    return audioCtxRef.current;
  };

  useEffect(() => {
    const unlock = () => { getAudioCtx().resume().catch(() => {}); setSoundUnlocked(true); };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  const playAlertTone = useCallback(() => {
    try {
      const ctx = getAudioCtx();
      // Belt-and-suspenders: some browsers re-suspend a context after a
      // period of inactivity, so resume defensively every time, not just once.
      ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    } catch { /* Web Audio unavailable — silently skip rather than break the page */ }
  }, []);

  useEffect(() => {
    api.get('/settings').then(r => {
      const s = r.data.data;
      if (s.kds_sound_alert_enabled !== undefined) setSoundEnabled(s.kds_sound_alert_enabled === 'true');
      if (s.kds_refresh_interval_seconds) setRefreshSeconds(parseInt(s.kds_refresh_interval_seconds) || 30);
    }).catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      // Two separate, purpose-built fetches rather than one shared
      // `limit=50` list filtered client-side for everything. That shared
      // list is sorted by created_at (not completed_at) and mixes every
      // status — once a business has more than 50 orders total, a
      // just-completed order that happens to have an older creation
      // timestamp (sat in 'ready' for a while before being served, or was
      // simply created earlier in a busy day) can fall completely outside
      // that window and never appear here, even though it just completed.
      // A dedicated status=completed query has no such blind spot.
      // A live kitchen display should answer "what's happened today", not
      // "what's ever happened" — the Completed column's badge was
      // technically correct (a real, uncapped total) but that total was
      // all-time, accumulated over however long this restaurant has used
      // the system. That's a materially different, far less useful number
      // than "completed today", and it disagreed with the bottom stat card
      // (which was already correctly scoped to today) — 43 vs 5 for the
      // same shift makes the screen look broken even though both numbers
      // were individually accurate for what they measured. Scoping the
      // fetch itself to completed_date=today makes everything derived from
      // it — the badge, "View all", and the median time-to-serve — agree.
      const today = toLocalDateString();
      const [activeRes, completedRes] = await Promise.all([
        api.get('/orders', { params: { limit: 50 } }),
        api.get('/orders', { params: { status: 'completed', completed_date: today, limit: 50, sort: 'completed_at' } }),
      ]);

      const activeOrders = activeRes.data.data.filter((o: Order) =>
        ['new', 'preparing', 'ready'].includes(o.status)
      );
      const withItems = await Promise.all(
        activeOrders.slice(0, 20).map(async (order: Order) => {
          try {
            const { data: detail } = await api.get(`/orders/${order.id}`);
            return detail.data;
          } catch { return order; }
        })
      );

      // A "new" order is one that wasn't in the previous poll's id set — not
      // just "orders.length changed", which would also fire when one gets
      // marked complete and drops off this active-orders list. The very
      // first fetch establishes the baseline silently (nothing should beep
      // just because the page was opened).
      const currentIds = new Set(withItems.map((o: Order) => o.id));
      if (knownOrderIds.current) {
        const hasNew = [...currentIds].some(id => !knownOrderIds.current!.has(id));
        if (hasNew && soundEnabled) playAlertTone();
      }
      knownOrderIds.current = currentIds;

      setOrders(withItems);
      setLastUpdated(new Date());

      // This whole column used to be hardcoded — eight fake orders
      // (#1020...#1013) that never changed no matter what actually
      // happened. Now sourced from a dedicated fetch, already scoped to
      // today and already sorted by completed_at (not created_at — an order
      // created yesterday but only just served today should still show up,
      // and sorting by creation time would bury or entirely miss it).
      const completed = (completedRes.data.data as Order[]).filter(o => o.completed_at);
      setCompletedOrders(completed.slice(0, 8));
      // pagination.total here is scoped to today (completed_date=today was
      // passed above), so it's the real count of everything completed
      // today, not capped at 8 and not an all-time total either.
      setCompletedTotal(completedRes.data.pagination?.total ?? completed.length);
      setCompletedToday(completed.length);
      consecutiveFailures.current = 0;
      setFetchFailing(false);
    } catch {
      // This used to be entirely silent — if the poll started failing for
      // any reason (an expired session, a network drop, the backend
      // restarting), the whole display would just freeze exactly where it
      // was, showing stale data forever with absolutely no indication
      // anything was wrong. That's indistinguishable from "nothing is
      // happening" and "the app is stuck" from the outside — a real
      // possibility worth ruling in or out is exactly this. Two consecutive
      // failures (not one, to avoid flickering a warning over an ordinary
      // single dropped request) now surface a visible banner instead.
      consecutiveFailures.current += 1;
      if (consecutiveFailures.current >= 2) setFetchFailing(true);
    }
    finally { setLoading(false); }
  }, [soundEnabled, playAlertTone]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, refreshSeconds * 1000);
    return () => clearInterval(interval);
  }, [fetchOrders, refreshSeconds]);

  const handleAction = async (id: string, status: string) => {
    try {
      await api.put(`/orders/${id}/status`, { status });
      toast.success(`Order marked as ${status}`);
      fetchOrders();
    } catch (e: unknown) {
      // This used to always show a generic "Failed to update order" — the
      // most common real reason this fails is a dine-in order with an
      // unpaid balance (completing it is what frees the table, so the
      // backend deliberately blocks it until payment is collected). Without
      // the real message, "Mark Served" looked like it worked to whoever
      // clicked it, and the order just silently never showed up as
      // completed anywhere — this is almost certainly why.
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update order';
      toast.error(msg, { duration: 6000 });
    }
  };

  // Reuses the existing /staff endpoint (already returns full_name/role,
  // already admin/manager-authorized) rather than standing up a dedicated
  // one — fetched with a generous limit and filtered client-side to the two
  // genuine kitchen roles, since /staff's role filter only accepts one
  // value at a time and a chef could reasonably be either.
  useEffect(() => {
    if (!isAdmin) return;
    api.get('/staff', { params: { limit: 100 } })
      .then(r => setChefs((r.data.data as Chef[]).filter(u => u.role === 'kitchen_staff' || u.role === 'head_chef')))
      .catch(() => { /* non-critical — assignment UI just won't have anyone to pick if this fails */ });
  }, [isAdmin]);

  const handleAssign = async (orderId: string, chefId: string) => {
    setAssignBusy(true);
    try {
      const { data } = await api.post(`/orders/${orderId}/assign-chef`, { chef_id: chefId });
      toast.success(data.message || 'Order assigned');
      setAssigningOrderId(null);
      fetchOrders();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not assign this order';
      toast.error(msg, { duration: 6000 });
    } finally {
      setAssignBusy(false);
    }
  };

  const newOrders = orders.filter(o => o.status === 'new');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  // Median (not mean) time from created_at to completed_at across the
  // completed orders currently loaded — median resists being dragged around
  // by one order that sat forgotten for an hour, which a straight average
  // wouldn't. Genuinely computed now, not the placeholder it used to be.
  const avgPrepTime = (() => {
    if (completedOrders.length === 0) return '—';
    const minutesEach = completedOrders
      .map(o => (new Date(o.completed_at!).getTime() - new Date(o.created_at).getTime()) / 60000)
      .filter(m => m >= 0) // guards against any clock-skew oddity producing a negative
      .sort((a, b) => a - b);
    if (minutesEach.length === 0) return '—';
    const mid = Math.floor(minutesEach.length / 2);
    const median = minutesEach.length % 2 === 0 ? (minutesEach[mid - 1] + minutesEach[mid]) / 2 : minutesEach[mid];
    return String(Math.round(median));
  })();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-300">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-3 sm:px-5 py-3 bg-surface-card border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <ChefHat size={20} className="text-brand shrink-0" />
          <div className="min-w-0">
            <h1 className="font-bold text-text-primary truncate">Kitchen Display</h1>
            <p className="hidden sm:block text-xs text-text-muted">Real-time kitchen order management</p>
          </div>
          <div className="hidden sm:flex items-center gap-1 ml-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
            <span className="text-xs text-status-success">Live</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
          <p className={`hidden md:block text-xs ${fetchFailing ? 'text-status-error font-medium' : 'text-text-muted'}`}>
            {fetchFailing ? '⚠ Connection issue — showing last known data' : `Last updated: ${formatTime(lastUpdated)}`}
          </p>
          <button onClick={fetchOrders} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-2 sm:px-3">
            <RefreshCw size={12} /> <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={() => { setSoundUnlocked(true); setSoundEnabled(v => { const next = !v; if (next) playAlertTone(); return next; }); }} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-2 sm:px-3" title="Click to hear a test beep">
            {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />} <span className="hidden sm:inline">Sound {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>
          {pushStatus !== 'unsupported' && (
            <button
              onClick={handleTogglePush}
              disabled={pushStatus === 'loading'}
              title={pushStatus === 'denied' ? 'Notifications blocked — enable them in your browser/phone settings' : 'Get a phone notification the moment a new order comes in, even with this tab in the background'}
              className={`btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-2 sm:px-3 disabled:opacity-50 ${pushStatus === 'subscribed' ? 'border-status-success/40 text-status-success' : pushStatus === 'denied' ? 'border-status-warning/40 text-status-warning' : ''}`}
            >
              {pushStatus === 'subscribed' ? <Bell size={12} /> : <BellOff size={12} />}
              <span className="hidden sm:inline">
                {pushStatus === 'loading' ? 'Loading…' : pushStatus === 'denied' ? 'Alerts blocked' : pushStatus === 'subscribed' ? 'Phone alerts ON' : 'Enable phone alerts'}
              </span>
            </button>
          )}
          <button onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }}
            className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-2 sm:px-3">
            <Maximize2 size={12} /> <span className="hidden sm:inline">Fullscreen</span>
          </button>
        </div>
      </div>

      {fetchFailing && (
        <div className="w-full bg-status-error/15 text-status-error text-xs py-2 text-center font-medium">
          ⚠ Lost connection to the server — this screen has stopped updating and is showing stale data. Check your network, or that you're still logged in, then hit Refresh.
        </div>
      )}

      {soundEnabled && !soundUnlocked && (
        <button
          onClick={() => { getAudioCtx().resume().catch(() => {}); setSoundUnlocked(true); playAlertTone(); }}
          className="w-full bg-status-warning/10 text-status-warning text-xs py-2 text-center hover:bg-status-warning/20 transition-colors"
        >
          🔈 Click anywhere here to enable sound alerts for new orders — browsers block audio until this screen is touched once.
        </button>
      )}

      {/* Kanban columns */}
      <div className="flex-1 flex gap-0 overflow-x-auto">
        {/* New Orders */}
        <div className="flex-1 min-w-[280px] flex flex-col border-r border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-brand">🛒</span>
              <span className="font-semibold text-brand">New Orders</span>
              <span className="w-5 h-5 rounded-full bg-brand text-black text-xs flex items-center justify-center font-bold">{newOrders.length}</span>
            </div>
            <span className="text-xs text-text-muted">{newOrders.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-border border-t-brand rounded-full animate-spin" /></div>
            ) : newOrders.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm">No new orders</div>
            ) : newOrders.map(order => (
              <OrderCard key={order.id} order={order} onAction={handleAction} isAdmin={isAdmin} chefs={chefs} assigningOrderId={assigningOrderId} onOpenAssign={setAssigningOrderId} onCloseAssign={() => setAssigningOrderId(null)} onAssign={handleAssign} assignBusy={assignBusy} currentUserId={user?.id} canOverrideAssignment={canOverrideAssignment} />
            ))}
          </div>
        </div>

        {/* Preparing */}
        <div className="flex-1 min-w-[280px] flex flex-col border-r border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-status-warning">🍳</span>
              <span className="font-semibold text-status-warning">Preparing</span>
              <span className="w-5 h-5 rounded-full bg-status-warning text-black text-xs flex items-center justify-center font-bold">{preparingOrders.length}</span>
            </div>
            <span className="text-xs text-text-muted">{preparingOrders.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {preparingOrders.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm">No orders preparing</div>
            ) : preparingOrders.map(order => (
              <OrderCard key={order.id} order={order} onAction={handleAction} isAdmin={isAdmin} chefs={chefs} assigningOrderId={assigningOrderId} onOpenAssign={setAssigningOrderId} onCloseAssign={() => setAssigningOrderId(null)} onAssign={handleAssign} assignBusy={assignBusy} currentUserId={user?.id} canOverrideAssignment={canOverrideAssignment} />
            ))}
          </div>
        </div>

        {/* Ready */}
        <div className="flex-1 min-w-[280px] flex flex-col border-r border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-status-success">✅</span>
              <span className="font-semibold text-status-success">Ready</span>
              <span className="w-5 h-5 rounded-full bg-status-success text-black text-xs flex items-center justify-center font-bold">{readyOrders.length}</span>
            </div>
            <span className="text-xs text-text-muted">{readyOrders.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {readyOrders.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm">No orders ready</div>
            ) : readyOrders.map(order => (
              <OrderCard key={order.id} order={order} onAction={handleAction} isAdmin={isAdmin} chefs={chefs} assigningOrderId={assigningOrderId} onOpenAssign={setAssigningOrderId} onCloseAssign={() => setAssigningOrderId(null)} onAssign={handleAssign} assignBusy={assignBusy} currentUserId={user?.id} canOverrideAssignment={canOverrideAssignment} />
            ))}
          </div>
        </div>

        {/* Completed */}
        <div className="flex-1 min-w-[280px] flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-status-purple">✓</span>
              <span className="font-semibold text-status-purple">Completed</span>
              <span className="w-5 h-5 rounded-full bg-status-purple text-white text-xs flex items-center justify-center font-bold">{completedTotal}</span>
            </div>
            <span className="text-xs text-text-muted">{completedTotal}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {completedOrders.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm">No completed orders yet</div>
            ) : completedOrders.map(order => {
              const minsToServe = Math.round((new Date(order.completed_at!).getTime() - new Date(order.created_at).getTime()) / 60000);
              return (
                <div key={order.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface-50 transition-colors">
                  <span className="text-xs font-medium text-text-secondary">#{order.order_number}</span>
                  <span className="text-xs text-text-muted">{order.table_number ? `Table ${order.table_number}` : order.type.replace('_', ' ')}</span>
                  <span className="text-xs text-text-muted">{formatTime(order.completed_at!)}</span>
                  {minsToServe >= 0 && <span className="text-[11px] text-status-purple font-medium">{formatMinutesToServe(minsToServe)}</span>}
                  <CheckCircle size={14} className="text-status-success" />
                </div>
              );
            })}
          </div>
          <div className="px-4 py-2 border-t border-border">
            <button onClick={() => toast('Showing the 8 most recently completed — a full history is on the Orders page.', { icon: 'ℹ️' })}
              className="text-xs text-brand hover:text-brand-400 transition-colors">View all ({completedTotal})</button>
          </div>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border-t border-border bg-surface-card">
        {[
          { Icon: ShoppingCart, label: 'New Orders', value: newOrders.length, sub: 'Total pending' },
          { Icon: Flame, label: 'Preparing', value: preparingOrders.length, sub: 'In progress' },
          { Icon: CheckCircle, label: 'Ready', value: readyOrders.length, sub: 'Ready to serve' },
          { Icon: CheckCheck, label: 'Completed Today', value: completedToday, sub: 'Completed orders' },
          { Icon: Timer, label: 'Avg. Prep Time', value: avgPrepTime, sub: 'Minutes' },
        ].map(stat => (
          <div key={stat.label} className="flex items-center gap-3 px-5 py-3 border-r border-border last:border-0">
            <stat.Icon size={20} className="text-brand shrink-0" />
            <div>
              <p className="text-lg font-bold text-text-primary">{stat.value}</p>
              <p className="text-xs text-text-muted">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}