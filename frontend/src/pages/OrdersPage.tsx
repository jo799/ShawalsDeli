import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Eye, X, Bell, BellOff } from 'lucide-react';
import api from '@/lib/api';
import { confirmDelete } from '@/lib/confirmPreference';
import { formatCurrency, formatTime } from '@/lib/utils';
import { PageHeader, StatusBadge, Pagination } from '@/components/ui';
import Receipt from '@/components/Receipt';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { getPushSubscriptionStatus, subscribeToKitchenAlerts, unsubscribeFromKitchenAlerts } from '@/lib/pushNotifications';

interface Order {
  id: string; order_number: string; type: string; status: string;
  table_number?: string; customer_name?: string; customer_full_name?: string;
  total: number; amount_paid: number; created_at: string;
  items?: Array<{ item_name: string; quantity: number; unit_price: number; total_price: number }>;
  subtotal?: number;
  served_by_name?: string; prepared_by_name?: string;
  has_refund?: boolean; // present on list rows
  refunds?: Array<{ id: string; amount: number; reason: string | null; created_at: string }>; // present on the detail fetch
}

interface RefundRequest {
  id: string; order_id: string; order_number: string; order_type: string; order_total: number;
  amount: number | null; reason: string; status: 'pending' | 'approved' | 'declined';
  requested_by_name?: string; reviewed_by_name?: string; decline_reason?: string;
  created_at: string; reviewed_at?: string;
}

const TABS = ['All Orders', 'Awaiting Payment', 'New', 'Preparing', 'Ready', 'Completed', 'Cancelled'];
const statusMap: Record<string, string> = {
  'All Orders': 'all',
  'Awaiting Payment': 'awaiting_payment',
  'New': 'new',
  'Preparing': 'preparing',
  'Ready': 'ready',
  'Completed': 'completed',
  'Cancelled': 'cancelled',
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  // Both roles can start a refund, but what actually happens differs:
  // administrators refund directly (backend: authorize('administrator') on
  // /orders/:id/refund), while managers and cashiers submit a request that
  // sits pending until an admin approves it (see submitRefund below and the
  // Refund Requests panel). Hiding the button entirely for anyone else
  // avoids a confusing 403 toast on a click that was never going to be
  // allowed.
  const canRefund = user?.role === 'administrator' || user?.role === 'manager' || user?.role === 'cashier';
  const isAdmin = user?.role === 'administrator';

  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState('All Orders');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [receiptOrder, setReceiptOrder] = useState<Record<string, unknown> | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundRestock, setRefundRestock] = useState(false);
  const [refunding, setRefunding] = useState(false);
  // Admin-only review queue for refund requests managers have submitted.
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [showRefundRequestsPanel, setShowRefundRequestsPanel] = useState(false);
  const [decliningRequestId, setDecliningRequestId] = useState<string | null>(null);
  const [declineReasonInput, setDeclineReasonInput] = useState('');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<'subscribed' | 'unsubscribed' | 'unsupported' | 'denied' | 'loading'>('loading');

  useEffect(() => { if (isAdmin) getPushSubscriptionStatus().then(setPushStatus); }, [isAdmin]);

  const handleTogglePush = async () => {
    if (pushStatus === 'subscribed') {
      await unsubscribeFromKitchenAlerts();
      setPushStatus('unsubscribed');
      toast.success('Refund request alerts turned off on this device');
      return;
    }
    if (pushStatus === 'denied') {
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
      toast.success('This device will now get a notification for every refund request');
    } else {
      setPushStatus(await getPushSubscriptionStatus());
      toast.error(result.message || 'Could not enable phone alerts', { duration: 7000 });
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const status = statusMap[activeTab];
      const { data } = await api.get('/orders', {
        params: { status: status === 'all' ? undefined : status, search: search || undefined, page, limit: 10 }
      });
      setOrders(data.data);
      setPagination({ total: data.pagination.total, pages: data.pagination.pages });
    } catch { toast.error('Failed to load orders'); }
    finally { setLoading(false); }
  }, [activeTab, search, page]);

  useEffect(() => { fetchOrders(); }, [activeTab, page, fetchOrders]);
  useEffect(() => { const t = setTimeout(fetchOrders, 400); return () => clearTimeout(t); }, [search, fetchOrders]);

  const printReceipt = async (orderId: string) => {
    try {
      const { data } = await api.get(`/orders/${orderId}`);
      setReceiptOrder(data.data);
    } catch { toast.error('Could not load this order to print'); }
  };

  const viewOrder = async (order: Order) => {
    try {
      const { data } = await api.get(`/orders/${order.id}`);
      setSelected(data.data);
    } catch { setSelected(order); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/orders/${id}/status`, { status });
      toast.success('Order updated');
      fetchOrders();
      if (selected?.id === id) viewOrder({ id } as Order); // re-fetch full detail (amount_paid etc.) rather than trusting the stale local copy
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update order';
      toast.error(msg);
    }
  };

  // Previously the only way forward for an order stuck with an unpaid
  // balance was the "Refund" button — but that's disabled whenever nothing
  // has been paid yet at all, since there's nothing to refund. That left
  // genuinely no way to clear an order the customer walked out on, despite
  // the backend's own error message explicitly suggesting "cancel the order"
  // as the way out. This calls the same status-update endpoint the backend
  // already supports for cancellation — it was only ever missing a button.
  const cancelOrder = (order: Order) => {
    if (!confirmDelete(`Cancel order #${order.order_number}? This can't be undone.`)) return;
    updateStatus(order.id, 'cancelled');
  };

  const openRefund = () => {
    if (!selected) return;
    const balance = Math.max(0, Number(selected.total) - Number(selected.amount_paid || 0));
    setRefundAmount(String(Number(selected.amount_paid || 0) > 0 ? selected.amount_paid : balance));
    setRefundReason('');
    setRefundRestock(false);
    setShowRefundModal(true);
  };

  const submitRefund = async () => {
    if (!selected) return;
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Enter a valid refund amount'); return; }
    if (!refundReason.trim()) { toast.error('A reason is required'); return; }
    setRefunding(true);
    try {
      // Administrators refund directly (they're the approval authority for
      // everyone else's requests, so there's no one left to check them).
      // Anyone else submits a request instead — no money moves until an
      // admin explicitly approves it.
      const endpoint = isAdmin ? `/orders/${selected.id}/refund` : `/orders/${selected.id}/refund-request`;
      const res = await api.post(endpoint, {
        amount, reason: refundReason.trim(), restock: refundRestock,
      });
      toast.success(res.data.message || (isAdmin ? 'Refund issued' : 'Refund request submitted — awaiting admin approval'));
      setShowRefundModal(false);
      fetchOrders();
      if (isAdmin) viewOrder({ id: selected.id } as Order);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Refund failed';
      toast.error(msg);
    } finally { setRefunding(false); }
  };

  // Admin-only: fetch the pending refund-request queue, and poll it so a
  // new request shows up without needing a manual refresh. Managers never
  // call this — they only ever see the requests they've personally
  // submitted reflected in the order they requested it on, not the full
  // cross-staff queue.
  const fetchRefundRequests = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await api.get('/refund-requests', { params: { status: 'pending' } });
      setRefundRequests(data.data);
    } catch { /* silent — this is a supplementary panel, not the main page */ }
  }, [isAdmin]);

  useEffect(() => {
    fetchRefundRequests();
    const interval = setInterval(fetchRefundRequests, 30000);
    return () => clearInterval(interval);
  }, [fetchRefundRequests]);

  const approveRequest = async (r: RefundRequest) => {
    if (!confirm(`Approve this refund? ${formatCurrency(Number(r.amount ?? r.order_total))} will be refunded on order #${r.order_number}.`)) return;
    setProcessingRequestId(r.id);
    try {
      const { data } = await api.post(`/refund-requests/${r.id}/approve`);
      toast.success(data.message || 'Refund approved and issued');
      fetchRefundRequests();
      fetchOrders();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not approve';
      toast.error(msg);
    } finally { setProcessingRequestId(null); }
  };

  const declineRequest = async (r: RefundRequest) => {
    setProcessingRequestId(r.id);
    try {
      const { data } = await api.post(`/refund-requests/${r.id}/decline`, { decline_reason: declineReasonInput.trim() || undefined });
      toast.success(data.message || 'Refund request declined');
      setDecliningRequestId(null);
      setDeclineReasonInput('');
      fetchRefundRequests();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not decline';
      toast.error(msg);
    } finally { setProcessingRequestId(null); }
  };

  // The backend stores a full refund as status='cancelled' (same value as a
  // plain, never-paid cancellation) — cleanly reusing an existing status
  // rather than adding a new enum value the rest of the system would need
  // to account for everywhere it checks for 'cancelled'. That's the right
  // call for the data model, but it means the two cases were showing up
  // identically in the UI with no way to tell them apart. This is purely a
  // display-layer fix: a cancelled order with an associated refund record
  // shows as "Refunded" instead, without touching what's actually stored.
  const orderDisplayStatus = (order: Order): string =>
    order.status === 'cancelled' && (order.has_refund || (order.refunds?.length ?? 0) > 0) ? 'refunded' : order.status;

  const typeIcon = (type: string) => ({ dine_in: '🪑', takeaway: '🛍️', delivery: '🛵' }[type] || '🪑');

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      {/* Main list */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:overflow-hidden p-6">
        <PageHeader title="Orders" subtitle="Manage and track all restaurant orders">
          {isAdmin && pushStatus !== 'unsupported' && (
            <button
              onClick={handleTogglePush}
              disabled={pushStatus === 'loading'}
              title={pushStatus === 'denied' ? 'Notifications blocked — enable them in your browser/phone settings' : 'Get a phone notification the moment a manager requests a refund'}
              className={`btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50 ${pushStatus === 'subscribed' ? 'border-status-success/40 text-status-success' : pushStatus === 'denied' ? 'border-status-warning/40 text-status-warning' : ''}`}
            >
              {pushStatus === 'subscribed' ? <Bell size={15} /> : <BellOff size={15} />}
              <span className="hidden sm:inline">
                {pushStatus === 'loading' ? 'Loading…' : pushStatus === 'denied' ? 'Alerts blocked' : pushStatus === 'subscribed' ? 'Refund alerts ON' : 'Enable refund alerts'}
              </span>
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowRefundRequestsPanel(true)} className="btn-secondary flex items-center gap-2 relative">
              Refund Requests
              {refundRequests.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-status-warning rounded-full text-[10px] font-bold flex items-center justify-center text-black">
                  {refundRequests.length}
                </span>
              )}
            </button>
          )}
          <button onClick={() => navigate('/pos')} className="btn-primary flex items-center gap-2"><Plus size={15} /> New Order</button>
        </PageHeader>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-surface-card p-1 rounded-lg border border-border w-fit">
          {TABS.map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setPage(1); }}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === tab ? 'bg-brand text-black' : 'text-text-secondary hover:text-text-primary'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Search orders by ID, customer, table..." />
          </div>
          <button className="btn-secondary flex items-center gap-2"><Filter size={13} /> Filters</button>
        </div>

        {/* Table */}
        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-surface-50 sticky top-0">
                <tr>
                  {['Order ID','Type','Table','Customer','Status','Amount','Payment','Time','Actions'].map(h => (
                    <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="py-16 text-center"><div className="flex justify-center"><div className="w-8 h-8 border-2 border-border border-t-brand rounded-full animate-spin" /></div></td></tr>
                ) : orders.map(order => (
                  <tr key={order.id} className={`table-row cursor-pointer ${selected?.id === order.id ? 'bg-brand/5' : ''}`} onClick={() => viewOrder(order)}>
                    <td className="table-cell font-medium text-brand">#{order.order_number}</td>
                    <td className="table-cell">
                      <span className="flex items-center gap-1.5">
                        <span>{typeIcon(order.type)}</span>
                        <span className="capitalize">{order.type.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="table-cell">{order.table_number || '—'}</td>
                    <td className="table-cell">{order.customer_full_name || order.customer_name || 'Walk-in'}</td>
                    <td className="table-cell"><StatusBadge status={orderDisplayStatus(order)} /></td>
                    <td className="table-cell font-medium">{formatCurrency(order.total)}</td>
                    <td className="table-cell">
                      <span className="text-xs text-text-muted">
                        {Number(order.amount_paid) > 0 ? formatCurrency(order.amount_paid) : '—'}
                      </span>
                    </td>
                    <td className="table-cell text-text-muted">{formatTime(order.created_at)}</td>
                    <td className="table-cell">
                      <button onClick={e => { e.stopPropagation(); viewOrder(order); }} className="btn-ghost p-1"><Eye size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pagination.pages} total={pagination.total} limit={10} onChange={setPage} />
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-full md:w-[340px] md:shrink-0 border-t md:border-t-0 md:border-l border-border bg-surface-card flex flex-col overflow-y-auto max-h-[60vh] md:max-h-none">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-bold">Order #{selected.order_number}</h2>
                <StatusBadge status={orderDisplayStatus(selected)} />
              </div>
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span>🪑 {selected.type?.replace('_', ' ')}</span>
                {selected.table_number && <span>Table {selected.table_number}</span>}
                <span>{formatTime(selected.created_at)}</span>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="btn-ghost p-1 text-lg">×</button>
          </div>

          <div className="p-5 space-y-5">
            {selected.customer_full_name && (
              <div>
                <p className="text-xs text-text-muted mb-1">Customer</p>
                <p className="font-medium text-sm">{selected.customer_full_name}</p>
              </div>
            )}

            {(selected.served_by_name || selected.prepared_by_name) && (
              <div className="grid grid-cols-2 gap-3">
                {selected.served_by_name && (
                  <div>
                    <p className="text-xs text-text-muted mb-1">Taken by</p>
                    <p className="text-sm">{selected.served_by_name}</p>
                  </div>
                )}
                {selected.prepared_by_name && (
                  <div>
                    <p className="text-xs text-text-muted mb-1">Prepared by</p>
                    <p className="text-sm">{selected.prepared_by_name}</p>
                  </div>
                )}
              </div>
            )}

            {(selected.refunds?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs text-text-muted mb-2">Refund History</p>
                <div className="space-y-2">
                  {selected.refunds!.map(r => (
                    <div key={r.id} className="bg-status-purple/5 border border-status-purple/20 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-status-purple">{formatCurrency(Number(r.amount))}</span>
                        <span className="text-[11px] text-text-muted">{formatTime(r.created_at)}</span>
                      </div>
                      {r.reason && <p className="text-xs text-text-secondary mt-0.5">"{r.reason}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-text-muted mb-2">Order Items</p>
              <div className="space-y-2">
                {selected.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-text-secondary">• {item.item_name} <span className="text-text-muted">x{item.quantity}</span></span>
                    <span>{formatCurrency(item.total_price)}</span>
                  </div>
                )) || <p className="text-xs text-text-muted">No items loaded</p>}
              </div>
            </div>

            {/* No service charge / VAT line — the business charges menu
                prices as-is, so Subtotal and Total are the same figure. */}
            <div className="space-y-1.5 pt-3 border-t border-border">
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-brand">{formatCurrency(selected.total)}</span>
              </div>
              {Number(selected.amount_paid) > 0 && Number(selected.amount_paid) < Number(selected.total) - 0.01 && (
                <div className="flex justify-between text-sm text-status-warning">
                  <span>Balance due</span>
                  <span>{formatCurrency(Number(selected.total) - Number(selected.amount_paid))}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              {selected.status === 'new' && (
                <button onClick={() => updateStatus(selected.id, 'preparing')} className="btn-primary w-full py-2 text-sm">Mark as Preparing</button>
              )}
              {selected.status === 'preparing' && (
                <button onClick={() => updateStatus(selected.id, 'ready')} className="btn-primary w-full py-2 text-sm">Mark as Ready</button>
              )}
              {selected.status === 'ready' && (
                <button onClick={() => updateStatus(selected.id, 'completed')} className="btn-primary w-full py-2 text-sm">Mark as Completed</button>
              )}
              {!['completed', 'cancelled'].includes(selected.status) && (
                <button onClick={() => cancelOrder(selected)} className="btn-secondary w-full py-2 text-sm text-status-error">Cancel Order</button>
              )}
              <div className={`grid ${canRefund ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                <button onClick={() => printReceipt(selected.id)} className="btn-secondary text-xs py-2">🖨 Print Receipt</button>
                {canRefund && (
                  <button
                    onClick={openRefund}
                    disabled={!(Number(selected.amount_paid) > 0) || selected.status === 'cancelled'}
                    className="btn-secondary text-xs py-2 text-status-error disabled:opacity-40 disabled:cursor-not-allowed"
                    title={!(Number(selected.amount_paid) > 0) ? 'Nothing has been paid on this order yet' : selected.status === 'cancelled' ? 'Order is already cancelled' : undefined}
                  >
                    ↩ Refund
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund modal */}
      {showRefundModal && selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowRefundModal(false)}>
          <div className="bg-surface-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="font-bold text-lg">{isAdmin ? 'Refund' : 'Request Refund for'} Order #{selected.order_number}</h3>
              <p className="text-xs text-text-muted mt-1">
                Paid so far: {formatCurrency(selected.amount_paid)}. A full refund of the remaining balance will void the order.
              </p>
              {!isAdmin && (
                <p className="text-xs text-status-warning mt-2 bg-status-warning/10 border border-status-warning/30 rounded-lg px-2.5 py-2">
                  This won't refund anything immediately — it goes to an administrator to approve or decline first.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Refund amount (KES)</label>
              <input
                type="number" min={0} step={1}
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
                className="input font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Reason *</label>
              <input
                type="text"
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                placeholder="e.g. Wrong item, customer complaint…"
                className="input"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={refundRestock} onChange={e => setRefundRestock(e.target.checked)} />
              Return items to stock (only if the food wasn't actually served)
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowRefundModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitRefund} disabled={refunding || !refundReason.trim()} className="btn-primary flex-1 text-status-error disabled:opacity-50">
                {refunding ? 'Processing…' : isAdmin ? 'Issue Refund' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Requests panel — admin review queue */}
      {showRefundRequestsPanel && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowRefundRequestsPanel(false)}>
          <div className="bg-surface-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Pending Refund Requests</h3>
              <button onClick={() => setShowRefundRequestsPanel(false)} className="btn-ghost p-1"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {refundRequests.length === 0 && (
                <p className="text-sm text-text-muted text-center py-8">No refund requests waiting on you.</p>
              )}
              {refundRequests.map(r => (
                <div key={r.id} className="border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">#{r.order_number}</span>
                    <span className="font-bold text-status-error">{formatCurrency(Number(r.amount ?? r.order_total))}</span>
                  </div>
                  <p className="text-xs text-text-secondary">"{r.reason}"</p>
                  <p className="text-[11px] text-text-muted">Requested by {r.requested_by_name || 'Unknown'} · {new Date(r.created_at).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>

                  {decliningRequestId === r.id ? (
                    <div className="space-y-2 pt-1">
                      <input
                        type="text" autoFocus
                        value={declineReasonInput}
                        onChange={e => setDeclineReasonInput(e.target.value)}
                        placeholder="Why decline? (optional, shown to the requester)"
                        className="input text-xs"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => { setDecliningRequestId(null); setDeclineReasonInput(''); }} className="btn-secondary flex-1 text-xs py-1.5">Cancel</button>
                        <button
                          onClick={() => declineRequest(r)}
                          disabled={processingRequestId === r.id}
                          className="btn-primary flex-1 text-xs py-1.5 text-status-error disabled:opacity-50"
                        >
                          {processingRequestId === r.id ? 'Declining…' : 'Confirm Decline'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setDecliningRequestId(r.id)}
                        disabled={processingRequestId === r.id}
                        className="btn-secondary flex-1 text-xs py-1.5 disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => approveRequest(r)}
                        disabled={processingRequestId === r.id}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-status-success/10 text-status-success border border-status-success/30 hover:bg-status-success/20 transition-colors disabled:opacity-50 font-medium"
                      >
                        {processingRequestId === r.id ? 'Approving…' : 'Approve'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Receipt order={receiptOrder} />
    </div>
  );
}