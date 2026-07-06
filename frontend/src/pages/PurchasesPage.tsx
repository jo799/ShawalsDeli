import { useState, useEffect, useCallback } from 'react';
import { Plus, Download, Eye, MoreVertical, Search, X, Printer, Phone } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, StatusBadge, Pagination, Modal, LoadingPage } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface PurchaseOrder {
  id: string; po_number: string; supplier_id: string; supplier_name?: string; supplier_phone?: string;
  status: string; order_date: string; expected_date?: string; received_date?: string;
  subtotal: number; discount: number; tax: number; total_amount: number;
  payment_status: string; notes?: string; received_percentage?: number;
  items?: POItem[];
}
interface POItem {
  id: string; item_name: string; unit: string; quantity_ordered: number;
  quantity_received: number; unit_price: number; total: number;
}
interface Supplier { id: string; name: string; phone?: string; }

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-surface-50 text-text-secondary',
  pending: 'bg-status-warning/10 text-status-warning',
  partially_received: 'bg-status-info/10 text-status-info',
  received: 'bg-status-success/10 text-status-success',
  cancelled: 'bg-status-error/10 text-status-error',
};

const TABS = ['All Purchases','Draft','Pending','Partially Received','Received','Cancelled'];
const tabStatus: Record<string, string> = {
  'All Purchases': 'all', 'Draft': 'draft', 'Pending': 'pending',
  'Partially Received': 'partially_received', 'Received': 'received', 'Cancelled': 'cancelled'
};

export default function PurchasesPage() {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('purchases.manage');

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [stats, setStats] = useState({ total_pos: 0, total_spent: 0, received: 0, pending: 0, overdue: 0 });
  const [activeTab, setActiveTab] = useState('All Purchases');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const [form, setForm] = useState({
    supplier_id: '', expected_date: '', notes: '', discount: '0',
    items: [{ item_name: '', unit: 'Kg', quantity_ordered: '', unit_price: '' }]
  });

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const status = tabStatus[activeTab];
      const { data } = await api.get('/purchases', {
        params: { status: status === 'all' ? undefined : status, search: search || undefined, page, limit: 10 }
      });
      setOrders(data.data);
      setStats(data.stats);
      setPagination({ total: data.pagination.total, pages: data.pagination.pages });
    } catch { toast.error('Failed to load purchases'); }
    finally { setLoading(false); }
  }, [activeTab, search, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { const t = setTimeout(fetchOrders, 400); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    api.get('/suppliers').then(r => setSuppliers(r.data.data)).catch(() => {});
  }, []);

  const viewDetail = async (order: PurchaseOrder) => {
    try {
      const { data } = await api.get(`/purchases/${order.id}`);
      setSelected(data.data);
    } catch { setSelected(order); }
  };

  const addFormItem = () => setForm(p => ({ ...p, items: [...p.items, { item_name: '', unit: 'Kg', quantity_ordered: '', unit_price: '' }] }));
  const removeFormItem = (i: number) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const updateFormItem = (i: number, key: string, value: string) => {
    setForm(p => ({ ...p, items: p.items.map((item, idx) => idx === i ? { ...item, [key]: value } : item) }));
  };

  const formTotal = form.items.reduce((s, i) => s + (parseFloat(i.quantity_ordered) || 0) * (parseFloat(i.unit_price) || 0), 0);

  const createPO = async () => {
    try {
      await api.post('/purchases', {
        supplier_id: form.supplier_id,
        expected_date: form.expected_date,
        notes: form.notes,
        discount: parseFloat(form.discount) || 0,
        items: form.items.map(i => ({ ...i, quantity_ordered: parseFloat(i.quantity_ordered), unit_price: parseFloat(i.unit_price) }))
      });
      toast.success('Purchase order created');
      setShowNew(false);
      fetchOrders();
    } catch { toast.error('Failed to create purchase order'); }
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <PageHeader title="Purchases" subtitle="Manage purchase orders and supplier deliveries">
          <button className="btn-secondary flex items-center gap-1.5 text-sm"><Download size={13} /> Import</button>
          <button className="btn-secondary flex items-center gap-1.5 text-sm"><Download size={13} /> Export</button>
          {canManage && (
            <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={14} /> New Purchase</button>
          )}
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total POs', value: stats.total_pos, icon: '🛒', sub: 'This month', color: 'text-text-primary' },
            { label: 'Total Spent', value: formatCurrency(stats.total_spent || 0), icon: '💰', sub: 'This month', color: 'text-brand' },
            { label: 'Goods Received', value: stats.received || 0, icon: '📦', sub: 'This month', color: 'text-status-success' },
            { label: 'Pending Deliveries', value: stats.pending || 0, icon: '🚚', sub: 'Awaiting delivery', color: 'text-status-warning' },
            { label: 'Overdue POs', value: stats.overdue || 0, icon: '⚠️', sub: 'Require attention', color: 'text-status-error' },
          ].map(s => (
            <div key={s.label} className="card p-3 flex items-start gap-2">
              <span className="text-xl">{s.icon}</span>
              <div>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-text-muted">{s.label}</p>
                <p className="text-[10px] text-text-muted">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {TABS.map(tab => {
            const count = tab === 'All Purchases' ? stats.total_pos :
              tab === 'Draft' ? 6 : tab === 'Pending' ? stats.pending :
              tab === 'Partially Received' ? 8 : tab === 'Received' ? stats.received : 4;
            return (
              <button key={tab} onClick={() => { setActiveTab(tab); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === tab ? 'bg-brand text-black' : 'bg-surface-50 text-text-secondary hover:text-text-primary border border-border'}`}>
                {tab}
                {count !== undefined && <span className={`px-1.5 py-0.5 rounded text-[10px] ${activeTab === tab ? 'bg-black/20' : 'bg-surface-100'}`}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9"
              placeholder="Search by PO number, supplier or item..." />
          </div>
          <select className="select text-xs py-1.5 w-32">
            <option>All Status</option>
          </select>
          <select className="select text-xs py-1.5 w-36">
            <option>All Suppliers</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn-secondary text-xs py-1.5 px-3">📅 Date Range</button>
        </div>

        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="overflow-auto flex-1">
            {loading ? <LoadingPage /> : (
              <table className="w-full">
                <thead className="bg-surface-50 sticky top-0">
                  <tr>
                    {['PO Number','Supplier','Order Date','Expected Date','Total Amount','Status','Received','Actions'].map(h => (
                      <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} onClick={() => viewDetail(order)}
                      className={`table-row cursor-pointer ${selected?.id === order.id ? 'bg-brand/5' : ''}`}>
                      <td className="table-cell font-bold text-brand">{order.po_number}</td>
                      <td className="table-cell">
                        <p className="font-medium text-sm">{order.supplier_name}</p>
                        <p className="text-xs text-text-muted">{order.supplier_phone}</p>
                      </td>
                      <td className="table-cell text-text-muted">{formatDate(order.order_date)}</td>
                      <td className="table-cell text-text-muted">{order.expected_date ? formatDate(order.expected_date) : '—'}</td>
                      <td className="table-cell font-medium">{formatCurrency(order.total_amount)}</td>
                      <td className="table-cell">
                        <span className={`badge text-xs ${STATUS_BADGE[order.status] || 'badge-muted'}`}>
                          {order.status.replace('_',' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-50 rounded-full overflow-hidden min-w-[60px]">
                            <div className="h-full bg-status-success rounded-full transition-all"
                              style={{ width: `${order.received_percentage || 0}%` }} />
                          </div>
                          <span className="text-xs text-text-muted">{order.received_percentage || 0}%</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); viewDetail(order); }} className="btn-ghost p-1"><Eye size={13} /></button>
                          <button className="btn-ghost p-1"><MoreVertical size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Pagination page={page} pages={pagination.pages} total={pagination.total} limit={10} onChange={setPage} />
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="w-[320px] shrink-0 border-l border-border bg-surface-card flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-bold">Purchase Order</h2>
              <StatusBadge status={selected.status} />
            </div>
            <button onClick={() => setSelected(null)}><X size={14} className="text-text-muted" /></button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xl font-bold text-brand">{selected.po_number}</p>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{selected.supplier_name}</p>
                  {selected.supplier_phone && (
                    <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                      <Phone size={10} />{selected.supplier_phone}
                    </div>
                  )}
                </div>
                <button className="btn-ghost p-1.5"><Phone size={14} /></button>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              {[
                ['Order Date', selected.order_date ? formatDate(selected.order_date) : '—'],
                ['Expected Date', selected.expected_date ? formatDate(selected.expected_date) : '—'],
                ['Received Date', selected.received_date ? formatDate(selected.received_date) : '—'],
                ['Payment Status', selected.payment_status?.replace(/\b\w/g, l => l.toUpperCase()) || '—'],
                ['Total Amount', formatCurrency(selected.total_amount)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-text-muted">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>

            {selected.items && selected.items.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold mb-2">Order Items ({selected.items.length})</h3>
                <div className="space-y-2">
                  {selected.items.map(item => (
                    <div key={item.id} className="bg-surface-50 rounded-lg p-2 text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">{item.item_name}</span>
                        <span className="text-brand font-bold">{formatCurrency(item.total)}</span>
                      </div>
                      <div className="flex justify-between text-text-muted">
                        <span>{item.quantity_ordered} {item.unit} × {formatCurrency(item.unit_price)}</span>
                        <span className="text-status-success">Rcvd: {item.quantity_received}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1.5 text-xs border-t border-border pt-3">
                  <div className="flex justify-between"><span className="text-text-muted">Subtotal</span><span>{formatCurrency(selected.subtotal)}</span></div>
                  {selected.discount > 0 && <div className="flex justify-between"><span className="text-text-muted">Discount</span><span className="text-status-error">-{formatCurrency(selected.discount)}</span></div>}
                  <div className="flex justify-between font-bold"><span>Total Amount</span><span className="text-brand">{formatCurrency(selected.total_amount)}</span></div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 pt-2">
              <button className="btn-secondary text-xs py-1.5 flex items-center justify-center gap-1"><Eye size={11} /> View Invoice</button>
              <button className="btn-secondary text-xs py-1.5 flex items-center justify-center gap-1"><Printer size={11} /> Print</button>
              <button className="btn-secondary text-xs py-1.5 flex items-center justify-center gap-1"><MoreVertical size={11} /> More</button>
            </div>
          </div>
        </div>
      )}

      {/* New PO Modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Purchase Order" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Supplier *</label>
              <select className="select" value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}>
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Expected Date</label>
              <input type="date" className="input" value={form.expected_date} onChange={e => setForm(p => ({ ...p, expected_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Discount (KES)</label>
              <input type="number" className="input" value={form.discount} onChange={e => setForm(p => ({ ...p, discount: e.target.value }))} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-primary">Order Items</label>
              <button onClick={addFormItem} className="text-xs text-brand hover:text-brand-400">+ Add Item</button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 items-end">
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-[10px] text-text-muted mb-0.5">Item Name</label>}
                    <input className="input text-xs" placeholder="Item name" value={item.item_name}
                      onChange={e => updateFormItem(i, 'item_name', e.target.value)} />
                  </div>
                  <div>
                    {i === 0 && <label className="block text-[10px] text-text-muted mb-0.5">Unit</label>}
                    <select className="select text-xs" value={item.unit} onChange={e => updateFormItem(i, 'unit', e.target.value)}>
                      {['Kg','L','Pcs','G','Bags','Boxes'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    {i === 0 && <label className="block text-[10px] text-text-muted mb-0.5">Qty</label>}
                    <input type="number" className="input text-xs" placeholder="0" value={item.quantity_ordered}
                      onChange={e => updateFormItem(i, 'quantity_ordered', e.target.value)} />
                  </div>
                  <div className="flex gap-1">
                    <div className="flex-1">
                      {i === 0 && <label className="block text-[10px] text-text-muted mb-0.5">Unit Price</label>}
                      <input type="number" className="input text-xs" placeholder="0" value={item.unit_price}
                        onChange={e => updateFormItem(i, 'unit_price', e.target.value)} />
                    </div>
                    {form.items.length > 1 && (
                      <button onClick={() => removeFormItem(i)} className="btn-ghost p-1 text-status-error mt-auto"><X size={12} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm font-bold">
              <span>Estimated Total</span>
              <span className="text-brand">{formatCurrency(formTotal - (parseFloat(form.discount) || 0))}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={createPO} className="btn-primary flex-1">Create Purchase Order</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
