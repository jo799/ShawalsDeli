import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Eye } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency, formatTime } from '@/lib/utils';
import { PageHeader, StatusBadge, Pagination } from '@/components/ui';
import Receipt from '@/components/Receipt';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface Order {
  id: string; order_number: string; type: string; status: string;
  table_number?: string; customer_name?: string; customer_full_name?: string;
  total: number; amount_paid: number; created_at: string;
  items?: Array<{ item_name: string; quantity: number; unit_price: number; total_price: number }>;
  subtotal?: number;
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
  // Refunding/voiding is money leaving the business — same restriction the
  // backend already enforces (see routes/index.ts: authorize('administrator',
  // 'manager')). Hiding the button for anyone else avoids a confusing 403
  // toast on a click that was never going to be allowed.
  const canRefund = user?.role === 'administrator' || user?.role === 'manager';

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

  const fetchOrders = async () => {
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
  };

  useEffect(() => { fetchOrders(); }, [activeTab, page]);
  useEffect(() => { const t = setTimeout(fetchOrders, 400); return () => clearTimeout(t); }, [search]);

  // Same print pattern POSPage uses: load the full order into state, and a
  // short delay after it renders, fire the browser print dialog. Kept
  // duplicated here (rather than importing a hook) since it's four lines
  // and tying it to this page's own receiptOrder state is simpler than
  // threading a shared hook through two unrelated pages.
  useEffect(() => {
    if (!receiptOrder) return;
    const t = setTimeout(() => window.print(), 150);
    return () => clearTimeout(t);
  }, [receiptOrder]);

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
    setRefunding(true);
    try {
      const res = await api.post(`/orders/${selected.id}/refund`, {
        amount, reason: refundReason || undefined, restock: refundRestock,
      });
      toast.success(res.data.message || 'Refund issued');
      setShowRefundModal(false);
      fetchOrders();
      viewOrder({ id: selected.id } as Order);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Refund failed';
      toast.error(msg);
    } finally { setRefunding(false); }
  };

  const typeIcon = (type: string) => ({ dine_in: '🪑', takeaway: '🛍️', delivery: '🛵' }[type] || '🪑');

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main list */}
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <PageHeader title="Orders" subtitle="Manage and track all restaurant orders">
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
                    <td className="table-cell"><StatusBadge status={order.status} /></td>
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
        <div className="w-[340px] shrink-0 border-l border-border bg-surface-card flex flex-col overflow-y-auto">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-bold">Order #{selected.order_number}</h2>
                <StatusBadge status={selected.status} />
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
              <h3 className="font-bold text-lg">Refund Order #{selected.order_number}</h3>
              <p className="text-xs text-text-muted mt-1">
                Paid so far: {formatCurrency(selected.amount_paid)}. A full refund of the remaining balance will void the order.
              </p>
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
              <label className="block text-xs font-medium text-text-secondary mb-1">Reason</label>
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
              <button onClick={submitRefund} disabled={refunding} className="btn-primary flex-1 text-status-error disabled:opacity-50">
                {refunding ? 'Processing…' : 'Issue Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Receipt order={receiptOrder} />
    </div>
  );
}