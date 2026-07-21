import { useState, useEffect, useCallback } from 'react';
import { Plus, Download, Eye, Search, X, Printer, Phone, PackageCheck, ShoppingCart, Wallet, Truck, AlertTriangle, Calendar } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency, formatDate, toLocalDateString } from '@/lib/utils';
import { PageHeader, StatusBadge, Pagination, Modal, LoadingPage, FinancialSummaryExportButton } from '@/components/ui';
import PurchaseOrderPrint, { PurchaseOrderContent } from '@/components/PurchaseOrderDocument';
import toast from 'react-hot-toast';

interface PurchaseOrder {
  id: string; po_number: string; supplier_id: string; supplier_name?: string; supplier_phone?: string;
  status: string; order_date: string; expected_date?: string; received_date?: string;
  subtotal: number; discount: number; tax: number; total_amount: number;
  payment_status: string; notes?: string; received_percentage?: number;
  items?: POItem[];
}
interface POItem {
  id: string; inventory_item_id?: string; item_name: string; unit: string; quantity_ordered: number;
  quantity_received: number; unit_price: number; total: number;
}
interface Supplier { id: string; name: string; phone?: string; }
interface InventoryItemOption { id: string; name: string; unit: string; cost_per_unit: number; }

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
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryOptions, setInventoryOptions] = useState<InventoryItemOption[]>([]);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [stats, setStats] = useState({ total_pos: 0, total_spent: 0, draft: 0, pending: 0, partially_received: 0, received: 0, cancelled: 0, overdue: 0 });
  const [activeTab, setActiveTab] = useState('All Purchases');
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [printOrder, setPrintOrder] = useState<PurchaseOrder | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});
  const [receiving, setReceiving] = useState(false);

  const [form, setForm] = useState({
    supplier_id: '', expected_date: '', notes: '', discount: '0',
    items: [{ inventory_item_id: '', item_name: '', unit: 'Kg', quantity_ordered: '', unit_price: '' }]
  });
  // "+ New Supplier" — form.supplier_id becomes '__custom__' and these two
  // fields collect a brand-new supplier's details, created right before the
  // PO itself on submit (see createPO) rather than requiring a separate trip
  // to a suppliers management screen first.
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const status = tabStatus[activeTab];
      const { data } = await api.get('/purchases', {
        params: { status: status === 'all' ? undefined : status, search: search || undefined, supplier_id: supplierFilter || undefined, page, limit: 10 }
      });
      setOrders(data.data);
      setStats(data.stats);
      setPagination({ total: data.pagination.total, pages: data.pagination.pages });
    } catch { toast.error('Failed to load purchases'); }
    finally { setLoading(false); }
  }, [activeTab, search, supplierFilter, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { const t = setTimeout(fetchOrders, 400); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    api.get('/suppliers').then(r => setSuppliers(r.data.data)).catch(() => {});
    api.get('/inventory', { params: { limit: 200 } }).then(r => setInventoryOptions(r.data.data)).catch(() => {});
  }, []);

  const viewDetail = async (order: PurchaseOrder): Promise<PurchaseOrder> => {
    try {
      const { data } = await api.get(`/purchases/${order.id}`);
      setSelected(data.data);
      return data.data;
    } catch { setSelected(order); return order; }
  };

  const printPO = async (order: PurchaseOrder) => {
    const full = order.items ? order : await viewDetail(order);
    setPrintOrder(full);
  };

  const addFormItem = () => setForm(p => ({ ...p, items: [...p.items, { inventory_item_id: '', item_name: '', unit: 'Kg', quantity_ordered: '', unit_price: '' }] }));
  const removeFormItem = (i: number) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const updateFormItem = (i: number, key: string, value: string) => {
    setForm(p => ({ ...p, items: p.items.map((item, idx) => idx === i ? { ...item, [key]: value } : item) }));
  };
  // Picking an existing inventory item links this line to it (so receiving
  // the delivery later can actually credit stock) and auto-fills name/unit/a
  // suggested price from what it currently costs — editable afterward in
  // case this supplier's price differs.
  const selectInventoryItemForLine = (i: number, inventoryItemId: string) => {
    const opt = inventoryOptions.find(o => o.id === inventoryItemId);
    setForm(p => ({
      ...p,
      items: p.items.map((item, idx) => idx === i ? {
        ...item,
        inventory_item_id: inventoryItemId,
        item_name: opt?.name || item.item_name,
        unit: opt?.unit || item.unit,
        unit_price: opt ? String(opt.cost_per_unit) : item.unit_price,
      } : item),
    }));
  };

  const formTotal = form.items.reduce((s, i) => s + (parseFloat(i.quantity_ordered) || 0) * (parseFloat(i.unit_price) || 0), 0);

  // Real CSV export of the currently loaded purchase orders list — was a
  // dead button before, no onClick at all.
  const exportPurchasesCsv = () => {
    const rows: string[][] = [['PO Number', 'Supplier', 'Status', 'Order Date', 'Expected Date', 'Payment Status', 'Total Amount']];
    orders.forEach(o => rows.push([
      o.po_number, o.supplier_name || '', o.status, o.order_date?.slice(0, 10) || '',
      o.expected_date?.slice(0, 10) || '', o.payment_status, String(o.total_amount),
    ]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `purchase-orders-${toLocalDateString()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  // Minimal hand-rolled CSV parser rather than pulling in a new dependency
  // for a simple 4-column format — handles quoted fields (so a supplier's
  // item name containing a comma doesn't split into the wrong columns) but
  // doesn't attempt to support the full CSV spec (embedded newlines inside
  // a quoted field, for instance). Good enough for a price-list-style import.
  const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else field += c;
      } else if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(f => f.trim() !== '')) rows.push(row);
        row = [];
      } else field += c;
    }
    if (field !== '' || row.length > 0) { row.push(field); if (row.some(f => f.trim() !== '')) rows.push(row); }
    return rows;
  };

  // Imports a supplier's price list / order sheet as the item lines for a
  // NEW purchase order — the cashier still picks the supplier and reviews
  // quantities/prices before submitting, this just saves typing each line
  // by hand. Expected columns (case-insensitive, any order): Item Name,
  // Unit, Quantity, Unit Price.
  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) { toast.error('That CSV has no data rows to import'); return; }

      const header = rows[0].map(h => h.trim().toLowerCase());
      const findCol = (...names: string[]) => header.findIndex(h => names.includes(h));
      const nameIdx = findCol('item name', 'item', 'name');
      const unitIdx = findCol('unit');
      const qtyIdx = findCol('quantity', 'quantity_ordered', 'qty');
      const priceIdx = findCol('unit price', 'unit_price', 'price');

      if (nameIdx === -1 || qtyIdx === -1) {
        toast.error('CSV must have at least "Item Name" and "Quantity" columns');
        return;
      }

      const items = rows.slice(1)
        .map(r => ({
          inventory_item_id: '', item_name: (r[nameIdx] || '').trim(),
          unit: unitIdx >= 0 ? (r[unitIdx] || '').trim() || 'Kg' : 'Kg',
          quantity_ordered: (r[qtyIdx] || '').trim(),
          unit_price: priceIdx >= 0 ? (r[priceIdx] || '').trim() : '0',
        }))
        .filter(i => i.item_name && parseFloat(i.quantity_ordered) > 0);

      if (items.length === 0) { toast.error('No valid rows found — check the Quantity column has numbers greater than 0'); return; }

      setForm(p => ({ ...p, items }));
      setShowNew(true);
      toast.success(`Imported ${items.length} item${items.length === 1 ? '' : 's'} — pick a supplier and review before creating the order`);
    } catch {
      toast.error('Failed to read that file — make sure it\'s a plain CSV');
    }
  };

  const createPO = async () => {
    const isNewSupplier = form.supplier_id === '__custom__';
    if (!form.supplier_id) { toast.error('Select a supplier'); return; }
    if (isNewSupplier && !newSupplierName.trim()) { toast.error('Enter the new supplier\'s name'); return; }
    if (form.items.some(i => !i.item_name.trim())) { toast.error('Every item needs a name'); return; }
    if (form.items.some(i => !(parseFloat(i.quantity_ordered) > 0))) { toast.error('Every item needs a quantity greater than 0'); return; }
    try {
      let supplierId = form.supplier_id;
      if (isNewSupplier) {
        const created = await api.post('/suppliers', { name: newSupplierName.trim(), phone: newSupplierPhone || undefined });
        supplierId = created.data.data.id;
        setSuppliers(prev => [...prev, created.data.data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      await api.post('/purchases', {
        supplier_id: supplierId,
        expected_date: form.expected_date || undefined,
        notes: form.notes || undefined,
        discount: parseFloat(form.discount) || 0,
        items: form.items.map(i => ({
          ...i,
          // '__custom__' is a frontend-only sentinel meaning "no inventory
          // link, this is a free-text new item" — sending it as-is would try
          // to insert that literal string where a real UUID is expected.
          inventory_item_id: i.inventory_item_id === '__custom__' ? undefined : i.inventory_item_id || undefined,
          quantity_ordered: parseFloat(i.quantity_ordered),
          unit_price: parseFloat(i.unit_price) || 0,
        }))
      });
      toast.success(isNewSupplier ? `Purchase order created for new supplier "${newSupplierName.trim()}"` : 'Purchase order created');
      setShowNew(false);
      setNewSupplierName(''); setNewSupplierPhone('');
      setForm({ supplier_id: '', expected_date: '', notes: '', discount: '0', items: [{ inventory_item_id: '', item_name: '', unit: 'Kg', quantity_ordered: '', unit_price: '' }] });
      fetchOrders();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create purchase order';
      toast.error(msg);
    }
  };

  // ── Receiving a delivery ────────────────────────────────────────────
  const openReceive = (order: PurchaseOrder) => {
    const initial: Record<string, string> = {};
    order.items?.forEach(item => {
      const outstanding = Number(item.quantity_ordered) - Number(item.quantity_received);
      initial[item.id] = outstanding > 0 ? String(outstanding) : '0'; // default to "receive everything still outstanding"
    });
    setReceiveQtys(initial);
    setShowReceive(true);
  };

  const submitReceive = async () => {
    if (!selected) return;
    const items = Object.entries(receiveQtys)
      .map(([id, qty]) => ({ id, quantity_received_now: parseFloat(qty) || 0 }))
      .filter(i => i.quantity_received_now > 0);
    if (items.length === 0) { toast.error('Enter at least one quantity to receive'); return; }
    setReceiving(true);
    try {
      const res = await api.put(`/purchases/${selected.id}/receive`, { items });
      toast.success(res.data.message || 'Delivery recorded');
      setShowReceive(false);
      fetchOrders();
      const detail = await api.get(`/purchases/${selected.id}`);
      setSelected(detail.data.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to record delivery';
      toast.error(msg);
    } finally { setReceiving(false); }
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:overflow-hidden p-6">
        <PageHeader title="Purchases" subtitle="Manage purchase orders and supplier deliveries">
          <FinancialSummaryExportButton />
          <label className="btn-secondary flex items-center gap-1.5 text-sm cursor-pointer">
            <Download size={13} /> Import
            <input type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }} />
          </label>
          <button onClick={exportPurchasesCsv} disabled={orders.length === 0} className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50"><Download size={13} /> Export</button>
          <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={14} /> New Purchase</button>
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total POs', value: stats.total_pos, Icon: ShoppingCart, sub: 'This month', color: 'text-text-primary' },
            { label: 'Total Spent', value: formatCurrency(stats.total_spent || 0), Icon: Wallet, sub: 'This month', color: 'text-brand' },
            { label: 'Goods Received', value: stats.received || 0, Icon: PackageCheck, sub: 'This month', color: 'text-status-success' },
            { label: 'Pending Deliveries', value: stats.pending || 0, Icon: Truck, sub: 'Awaiting delivery', color: 'text-status-warning' },
            { label: 'Overdue POs', value: stats.overdue || 0, Icon: AlertTriangle, sub: 'Require attention', color: 'text-status-error' },
          ].map(s => (
            <div key={s.label} className="card p-3 flex items-start gap-2">
              <div className={`w-8 h-8 rounded-lg bg-surface-50 flex items-center justify-center shrink-0 ${s.color}`}>
                <s.Icon size={16} />
              </div>
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
            // Real counts from the backend — these used to be hardcoded
            // placeholder numbers (Draft, Partially Received, Cancelled
            // always showed 6/8/4 regardless of what was actually in the
            // database).
            const count = tab === 'All Purchases' ? stats.total_pos :
              tab === 'Draft' ? stats.draft : tab === 'Pending' ? stats.pending :
              tab === 'Partially Received' ? stats.partially_received : tab === 'Received' ? stats.received : stats.cancelled;
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
          <select className="select text-xs py-1.5 w-36" value={supplierFilter} onChange={e => { setSupplierFilter(e.target.value); setPage(1); }}>
            <option value="">All Suppliers</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={() => toast('Filtering by date range isn\'t built yet — coming in a future update.', { icon: 'ℹ️' })} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"><Calendar size={12} /> Date Range</button>
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
                          <button onClick={e => { e.stopPropagation(); viewDetail(order); }} className="btn-ghost p-1" title="View"><Eye size={13} /></button>
                          {!['received', 'cancelled'].includes(order.status) && (
                            <button
                              onClick={async e => { e.stopPropagation(); const full = await viewDetail(order); openReceive(full); }}
                              className="btn-ghost p-1 text-status-success" title="Receive delivery"
                            ><PackageCheck size={13} /></button>
                          )}
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
        <div className="w-full md:w-[320px] md:shrink-0 border-t md:border-t-0 md:border-l border-border bg-surface-card flex flex-col overflow-y-auto max-h-[60vh] md:max-h-none">
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
                {selected.supplier_phone && (
                  <a href={`tel:${selected.supplier_phone}`} className="btn-ghost p-1.5" title={`Call ${selected.supplier_phone}`}><Phone size={14} /></a>
                )}
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

            {!['received', 'cancelled'].includes(selected.status) && (
              <button onClick={() => openReceive(selected)} className="btn-primary w-full text-sm py-2 flex items-center justify-center gap-1.5 mt-3">
                <PackageCheck size={14} /> Receive Delivery
              </button>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => setShowInvoice(true)} className="btn-secondary text-xs py-1.5 flex items-center justify-center gap-1"><Eye size={11} /> View Invoice</button>
              <button onClick={() => printPO(selected)} className="btn-secondary text-xs py-1.5 flex items-center justify-center gap-1"><Printer size={11} /> Print</button>
            </div>
          </div>
        </div>
      )}

      {/* New PO Modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Purchase Order" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Supplier *</label>
              {form.supplier_id === '__custom__' ? (
                <div className="flex gap-1">
                  <input className="input flex-1" placeholder="New supplier name" value={newSupplierName}
                    onChange={e => setNewSupplierName(e.target.value)} />
                  <button type="button" onClick={() => { setForm(p => ({ ...p, supplier_id: '' })); setNewSupplierName(''); setNewSupplierPhone(''); }}
                    className="btn-ghost px-1.5 text-xs" title="Choose from existing suppliers instead">↺</button>
                </div>
              ) : (
                <select className="select" value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}>
                  <option value="">Select supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="__custom__">+ New supplier</option>
                </select>
              )}
              {form.supplier_id === '__custom__' && (
                <input className="input mt-1.5" placeholder="Phone (optional)" value={newSupplierPhone}
                  onChange={e => setNewSupplierPhone(e.target.value)} />
              )}
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
            <div className="overflow-x-auto">
            <div className="space-y-2 min-w-[600px]">
              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 items-end">
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-[10px] text-text-muted mb-0.5">Item</label>}
                    {/* Linking to a real inventory item (rather than free
                        text) is what lets Receive Delivery later credit
                        stock automatically — a line typed as free text has
                        nothing for receiving to credit against. "+ New item"
                        stays available for something not in inventory yet. */}
                    {item.inventory_item_id === '__custom__' ? (
                      <div className="flex gap-1">
                        <input className="input text-xs flex-1" placeholder="New item name" value={item.item_name}
                          onChange={e => updateFormItem(i, 'item_name', e.target.value)} />
                        <button type="button" onClick={() => selectInventoryItemForLine(i, '')} className="btn-ghost px-1.5 text-[10px]" title="Choose from inventory instead">↺</button>
                      </div>
                    ) : (
                      <select className="select text-xs" value={item.inventory_item_id}
                        onChange={e => {
                          if (e.target.value === '__custom__') {
                            setForm(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, inventory_item_id: '__custom__', item_name: '' } : it) }));
                          } else {
                            selectInventoryItemForLine(i, e.target.value);
                          }
                        }}>
                        <option value="">Select item...</option>
                        {inventoryOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        <option value="__custom__">+ New item (not in inventory)</option>
                      </select>
                    )}
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

      {/* Receive Delivery Modal */}
      <Modal open={showReceive} onClose={() => setShowReceive(false)} title={selected ? `Receive Delivery — ${selected.po_number}` : 'Receive Delivery'} size="lg">
        {selected && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Enter what actually arrived for each item. Partial deliveries are fine — leave the rest for a later delivery.
              Items linked to inventory will have their stock updated automatically.
            </p>
            <div className="overflow-x-auto">
            <div className="space-y-2 min-w-[550px]">
              {selected.items?.map(item => {
                const outstanding = Math.round((Number(item.quantity_ordered) - Number(item.quantity_received)) * 1000) / 1000;
                const fullyReceived = outstanding <= 0;
                return (
                  <div key={item.id} className={`grid grid-cols-5 gap-2 items-center p-2 rounded-lg ${fullyReceived ? 'bg-surface-50/50 opacity-60' : 'bg-surface-50'}`}>
                    <div className="col-span-2">
                      <p className="text-sm font-medium">{item.item_name}</p>
                      <p className="text-[11px] text-text-muted">
                        Ordered {item.quantity_ordered} {item.unit} · Received so far {item.quantity_received} {item.unit}
                        {!item.inventory_item_id && <span className="text-status-warning"> · not linked to inventory</span>}
                      </p>
                    </div>
                    <div className="text-xs text-text-muted">Outstanding: {fullyReceived ? '0' : outstanding} {item.unit}</div>
                    <div className="col-span-2">
                      <input
                        type="number" min={0} max={outstanding > 0 ? outstanding : undefined} step="any"
                        disabled={fullyReceived}
                        className="input text-sm disabled:opacity-50"
                        value={receiveQtys[item.id] ?? ''}
                        onChange={e => setReceiveQtys(q => ({ ...q, [item.id]: e.target.value }))}
                        placeholder={fullyReceived ? 'Fully received' : `Up to ${outstanding}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowReceive(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitReceive} disabled={receiving} className="btn-primary flex-1 disabled:opacity-50">
                {receiving ? 'Recording…' : 'Record Delivery'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Invoice */}
      <Modal open={showInvoice} onClose={() => setShowInvoice(false)} title="Purchase Order" size="xl">
        {selected && <PurchaseOrderContent po={selected} />}
      </Modal>

      <PurchaseOrderPrint po={printOrder} />
    </div>
  );
}