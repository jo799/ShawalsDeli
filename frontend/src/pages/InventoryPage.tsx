import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, Edit2, ArrowLeftRight, Trash2, X, RefreshCw, Wheat, Beef, Droplet, Carrot, Flame, Cookie, Milk, Package, ShoppingCart, XCircle, Shuffle, Settings2, Wallet, AlertTriangle, Download } from 'lucide-react';
import api from '@/lib/api';
import { confirmDelete } from '@/lib/confirmPreference';
import { formatCurrency, formatDate, toLocalDateString } from '@/lib/utils';
import { PageHeader, Pagination, Modal, LoadingPage } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface InventoryItem {
  id: string; sku: string; name: string; description?: string;
  category?: string; supplier_id?: string; supplier_name?: string;
  quantity: number; unit: string; cost_per_unit: number;
  reorder_level: number; expiry_date?: string; location?: string;
  image_url?: string; stock_status: string; stock_value: number;
}
interface Activity {
  id: string; type: string; quantity_change: number;
  quantity_before: number; quantity_after: number;
  notes?: string; performed_by_name?: string; created_at: string; item_name: string;
}

// Maps the underlying transaction type to something immediately
// understandable at a glance, rather than the raw enum value. 'sale' in
// particular used to just read "Sale" — but this is never a sale
// transaction in the storefront sense, it's ingredients automatically
// deducted from stock when an order consumes them (see
// inventoryService.deductInventoryForOrder), so "Kitchen Consumption" is
// what it actually means to whoever's reading this list.
const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  sale: 'Kitchen Consumption',
  purchase: 'Purchase Received',
  adjustment: 'Stock Count Variance',
  waste: 'Waste / Spoilage',
  transfer: 'Stock Transfer',
};

// type='adjustment' is used for two genuinely different things: a manual
// "count fix" entered through the Adjust Stock modal, and the automatic
// restock that happens when a cancelled order's ingredients are returned
// (see inventoryService.restockInventoryForOrder) — a real, traceable
// reversal, not a count variance. The automatic path always writes the
// same notes text, which is what distinguishes the two here.
const activityLabel = (act: Activity): string => {
  if (act.type === 'adjustment' && act.notes?.startsWith('Stock restored')) return 'Order Cancelled (Restocked)';
  return ACTIVITY_TYPE_LABEL[act.type] || act.type.replace('_', ' ');
};

const STOCK_STATUS_BADGE: Record<string, string> = {
  in_stock: 'bg-status-success/10 text-status-success border border-status-success/20',
  low_stock: 'bg-status-warning/10 text-status-warning border border-status-warning/20',
  out_of_stock: 'bg-status-error/10 text-status-error border border-status-error/20',
};

// Real icon components instead of emoji — each category maps to a proper
// lucide icon, with Package as the fallback for anything not in this list
// (category is free text now, so a custom category like "Beverages" falls
// through to the generic icon rather than breaking).
const CATEGORY_ICONS: Record<string, typeof Package> = {
  Grains: Wheat, Meat: Beef, Oils: Droplet, Vegetables: Carrot,
  Spices: Flame, Baking: Cookie, Dairy: Milk, Others: Package,
};
const CategoryIcon = ({ category, size = 16 }: { category?: string; size?: number }) => {
  const Icon = (category && CATEGORY_ICONS[category]) || Package;
  return <Icon size={size} />;
};

export default function InventoryPage() {
  const { user } = useAuthStore();
  // Add/edit/delete are restricted server-side to admin/manager (routes/index.ts)
  // — gate the UI the same way so cashiers don't hit a confusing 403.
  const canManage = user?.role === 'administrator' || user?.role === 'manager';

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [activityLimit, setActivityLimit] = useState(5);
  const [stats, setStats] = useState({ total_items: 0, total_value: 0, low_stock: 0, out_of_stock: 0 });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null); // null = adding new
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState<'adjustment' | 'waste' | 'transfer'>('adjustment');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newItem, setNewItem] = useState({
    sku: '', name: '', description: '', category: '', quantity: '', unit: 'Kg',
    cost_per_unit: '', reorder_level: '', location: 'Main Store', expiry_date: ''
  });

  const categories = ['Grains', 'Meat', 'Oils', 'Vegetables', 'Spices', 'Baking', 'Dairy'];
  const units = ['Kg', 'L', 'Pcs', 'G', 'ML', 'Boxes', 'Bags', 'Cans'];

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/inventory', {
        params: { search: search || undefined, category: categoryFilter || undefined, status: statusFilter || undefined, page, limit: 10 }
      });
      setItems(data.data);
      setStats(data.stats);
      setPagination({ total: data.pagination.total, pages: data.pagination.pages });
    } catch { toast.error('Failed to load inventory'); }
    finally { setLoading(false); }
  }, [search, categoryFilter, statusFilter, page]);

  // Exports every matching item, not just the current page — `items` only
  // ever holds 10 rows at a time (see fetchItems above), and a stock-take
  // or accounting export that silently dropped everything past page 1
  // would be far less useful than what this is actually for.
  const [exportingCsv, setExportingCsv] = useState(false);
  const exportCsv = async () => {
    setExportingCsv(true);
    try {
      const { data } = await api.get('/inventory', {
        params: { search: search || undefined, category: categoryFilter || undefined, status: statusFilter || undefined, limit: 10000 }
      });
      const all: InventoryItem[] = data.data;
      const rows = [['SKU', 'Name', 'Category', 'Supplier', 'Quantity', 'Unit', 'Cost Per Unit', 'Stock Value', 'Reorder Level', 'Stock Status', 'Expiry Date', 'Location']];
      all.forEach(i => rows.push([
        i.sku, i.name, i.category || '', i.supplier_name || '',
        String(i.quantity), i.unit, String(i.cost_per_unit), String(i.stock_value),
        String(i.reorder_level), i.stock_status.replace(/_/g, ' '), i.expiry_date?.slice(0, 10) || '', i.location || '',
      ]));
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `inventory-${toLocalDateString()}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export inventory');
    } finally {
      setExportingCsv(false);
    }
  };

  const fetchActivity = useCallback(async (itemId?: string, limit = 5) => {
    try {
      const { data } = await api.get('/inventory/activity', { params: { item_id: itemId, limit } });
      setActivity(data.data);
    } catch { /* silent */ }
  }, []);

  const saveActivityNotes = async (activityId: string) => {
    setSavingNotes(true);
    try {
      await api.put(`/inventory/activity/${activityId}`, { notes: editingNotesValue.trim() || null });
      toast.success('Reason updated');
      setEditingActivityId(null);
      if (selected) fetchActivity(selected.id, activityLimit);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not update the reason';
      toast.error(msg);
    } finally {
      setSavingNotes(false);
    }
  };

  const startEditingActivityNotes = (act: Activity) => {
    if (!canManage) return;
    setEditingActivityId(act.id);
    setEditingNotesValue(act.notes || '');
  };

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { const t = setTimeout(fetchItems, 400); return () => clearTimeout(t); }, [search]);

  const selectItem = (item: InventoryItem) => {
    setSelected(item);
    setActivityLimit(5);
    fetchActivity(item.id, 5);
  };

  const handleAdjust = async () => {
    if (!selected || !adjustQty) return;
    setAdjusting(true);
    try {
      await api.post(`/inventory/${selected.id}/adjust`, {
        quantity_change: parseFloat(adjustQty),
        notes: adjustNotes,
        type: adjustType,
      });
      toast.success(`Stock adjusted by ${adjustQty} ${selected.unit}`);
      setShowAdjust(false);
      setAdjustQty('');
      setAdjustNotes('');
      setAdjustType('adjustment');
      fetchItems();
      fetchActivity(selected.id, activityLimit);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to adjust stock';
      toast.error(msg);
    }
    finally { setAdjusting(false); }
  };

  const openAddItem = () => {
    setEditingItem(null);
    setNewItem({ sku: '', name: '', description: '', category: '', quantity: '', unit: 'Kg', cost_per_unit: '', reorder_level: '', location: 'Main Store', expiry_date: '' });
    setShowAdd(true);
  };

  const openEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setNewItem({
      sku: item.sku, name: item.name, description: item.description || '', category: item.category || '',
      quantity: String(item.quantity), unit: item.unit, cost_per_unit: String(item.cost_per_unit),
      reorder_level: String(item.reorder_level), location: item.location || 'Main Store', expiry_date: item.expiry_date?.slice(0, 10) || '',
    });
    setShowAdd(true);
  };

  const handleSaveItem = async () => {
    if (!newItem.sku.trim()) { toast.error('SKU is required'); return; }
    if (!newItem.name.trim()) { toast.error('Item name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...newItem,
        cost_per_unit: parseFloat(newItem.cost_per_unit) || 0,
        reorder_level: parseFloat(newItem.reorder_level) || 0,
      };
      if (editingItem) {
        // quantity is deliberately NOT sent here — editing never touches
        // stock count, only Adjust Stock does, so every quantity change
        // stays in the audit trail (see updateInventoryItem on the backend).
        await api.put(`/inventory/${editingItem.id}`, payload);
        toast.success('Item updated');
        if (selected?.id === editingItem.id) {
          // The UPDATE...RETURNING response doesn't carry the joined/computed
          // columns (supplier_name, stock_status, stock_value) that only
          // getInventory's SELECT produces — recompute them client-side
          // instead of showing a stale or blank detail panel until the next
          // full list refresh. `payload.quantity` is the raw string from the
          // form and was never sent to the backend for an edit — excluded
          // here so it doesn't overwrite editingItem's real numeric quantity.
          const { quantity: _unusedFormQuantity, ...staticFields } = payload;
          void _unusedFormQuantity;
          const quantity = editingItem.quantity;
          const stock_status = quantity === 0 ? 'out_of_stock' : quantity <= payload.reorder_level ? 'low_stock' : 'in_stock';
          setSelected({ ...editingItem, ...staticFields, stock_status, stock_value: quantity * payload.cost_per_unit });
        }
      } else {
        await api.post('/inventory', { ...payload, quantity: parseFloat(newItem.quantity) || 0 });
        toast.success('Item added to inventory');
      }
      setShowAdd(false);
      fetchItems();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save item';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const deleteItem = async (item: InventoryItem) => {
    if (!confirmDelete(`Remove "${item.name}" from inventory? This can't be undone from here.`)) return;
    try {
      await api.delete(`/inventory/${item.id}`);
      toast.success(`${item.name} removed`);
      if (selected?.id === item.id) setSelected(null);
      fetchItems();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to remove item';
      toast.error(msg);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:overflow-hidden p-6">
        <PageHeader title="Inventory" subtitle="Track and manage your stock items in real-time">
          <button onClick={exportCsv} disabled={exportingCsv} className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50">
            <Download size={13} /> {exportingCsv ? 'Exporting…' : 'Export CSV'}
          </button>
          <button onClick={() => { if (selected) setShowAdjust(true); else toast.error('Select an item first'); }}
            className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowLeftRight size={14} /> Adjust Stock
          </button>
          <button onClick={() => toast('Moving stock between locations isn\'t built yet — coming in a future update.', { icon: 'ℹ️' })}
            className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowLeftRight size={14} /> Stock Transfer
          </button>
          {canManage && (
            <button onClick={openAddItem} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Add Item
            </button>
          )}
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Items', value: stats.total_items, Icon: Package, sub: 'All inventory items', color: 'text-text-primary' },
            { label: 'Total Stock Value', value: formatCurrency(stats.total_value || 0), Icon: Wallet, sub: 'Current inventory value', color: 'text-brand' },
            { label: 'Low Stock Items', value: stats.low_stock, Icon: AlertTriangle, sub: 'Items running low', color: 'text-status-warning' },
            { label: 'Out of Stock', value: stats.out_of_stock, Icon: XCircle, sub: 'Items out of stock', color: 'text-status-error' },
          ].map(s => (
            <div key={s.label} className="card p-4 flex items-start gap-3">
              <div className={`w-10 h-10 bg-surface-50 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}><s.Icon size={18} /></div>
              <div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-text-muted">{s.label}</p>
                <p className="text-[10px] text-text-muted">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9"
              placeholder="Search by item name, SKU or barcode..." />
          </div>
          <select className="select text-xs py-1.5 w-36" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="select text-xs py-1.5 w-32" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
          <button onClick={fetchItems} className="btn-secondary p-2"><RefreshCw size={14} /></button>
          <button className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><Filter size={12} /> Filters</button>
        </div>

        {/* Table */}
        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="overflow-auto flex-1">
            {loading ? <LoadingPage /> : (
              <table className="w-full">
                <thead className="bg-surface-50 sticky top-0">
                  <tr>
                    {['Item Name','SKU','Category','Quantity','Unit','Cost/Unit','Stock Value','Status','Actions'].map(h => (
                      <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} onClick={() => selectItem(item)}
                      className={`table-row cursor-pointer ${selected?.id === item.id ? 'bg-brand/5 border-l-2 border-l-brand' : ''}`}>
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-surface-50 rounded-lg flex items-center justify-center text-brand shrink-0">
                            <CategoryIcon category={item.category} size={16} />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-[11px] text-text-muted">{item.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-text-muted text-xs font-mono">{item.sku}</td>
                      <td className="table-cell text-text-secondary">{item.category || '—'}</td>
                      <td className={`table-cell font-semibold ${item.quantity === 0 ? 'text-status-error' : item.quantity <= item.reorder_level ? 'text-status-warning' : 'text-text-primary'}`}>
                        {item.quantity}
                      </td>
                      <td className="table-cell text-text-muted">{item.unit}</td>
                      <td className="table-cell">{formatCurrency(item.cost_per_unit)}</td>
                      <td className="table-cell font-medium">{formatCurrency(item.stock_value)}</td>
                      <td className="table-cell">
                        <span className={`badge text-xs ${STOCK_STATUS_BADGE[item.stock_status] || 'badge-muted'}`}>
                          {item.stock_status === 'in_stock' ? 'In Stock' : item.stock_status === 'low_stock' ? 'Low Stock' : 'Out of Stock'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          {canManage && (
                            <button onClick={e => { e.stopPropagation(); openEditItem(item); }}
                              className="btn-ghost p-1 text-brand" title="Edit item details"><Edit2 size={13} /></button>
                          )}
                          <button onClick={e => { e.stopPropagation(); selectItem(item); setShowAdjust(true); }}
                            className="btn-ghost p-1" title="Adjust Stock"><ArrowLeftRight size={13} /></button>
                          {canManage && (
                            <button onClick={e => { e.stopPropagation(); deleteItem(item); }}
                              className="btn-ghost p-1 text-status-error" title="Remove item"><Trash2 size={13} /></button>
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

      {/* Right detail panel */}
      {selected && (
        <div className="w-full md:w-[280px] md:shrink-0 border-t md:border-t-0 md:border-l border-border bg-surface-card flex flex-col overflow-y-auto max-h-[60vh] md:max-h-none">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="section-title text-sm">Item Details</h2>
            <button onClick={() => setSelected(null)}><X size={14} className="text-text-muted" /></button>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-12 h-12 bg-surface-50 rounded-xl flex items-center justify-center text-brand">
                <CategoryIcon category={selected.category} size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">{selected.name}</h3>
                  <span className={`badge text-[10px] ${STOCK_STATUS_BADGE[selected.stock_status]}`}>
                    {selected.stock_status === 'in_stock' ? 'In Stock' : selected.stock_status === 'low_stock' ? 'Low Stock' : 'Out of Stock'}
                  </span>
                </div>
                <p className="text-xs text-text-muted">{selected.description}</p>
                <p className="text-sm font-bold text-brand mt-0.5">{formatCurrency(selected.cost_per_unit)} / {selected.unit}</p>
                <p className="text-[10px] text-text-muted">SKU: {selected.sku}</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                ['Category', selected.category || '—'],
                ['Supplier', selected.supplier_name || '—'],
                ['Quantity', `${selected.quantity} ${selected.unit}`],
                ['Reorder Level', `${selected.reorder_level} ${selected.unit}`],
                ['Cost per Unit', formatCurrency(selected.cost_per_unit)],
                ['Stock Value', formatCurrency(selected.stock_value)],
                ['Expiry Date', selected.expiry_date ? formatDate(selected.expiry_date) : '—'],
                ['Location', selected.location || 'Main Store'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-text-muted">{label}</span>
                  <span className="font-medium text-right">{value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAdjust(true)} className="btn-secondary flex-1 text-xs py-1.5 flex items-center justify-center gap-1">
                <ArrowLeftRight size={12} /> Adjust Stock
              </button>
              {canManage && (
                <button onClick={() => openEditItem(selected)} className="btn-primary flex-1 text-xs py-1.5 flex items-center justify-center gap-1">
                  <Edit2 size={12} /> Edit Item
                </button>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="border-t border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-text-primary">Recent Activity</h3>
              {activityLimit <= 5 ? (
                <button onClick={() => { setActivityLimit(50); fetchActivity(selected.id, 50); }} className="text-[11px] text-brand hover:underline">View All</button>
              ) : (
                <button onClick={() => { setActivityLimit(5); fetchActivity(selected.id, 5); }} className="text-[11px] text-brand hover:underline">Show less</button>
              )}
            </div>
            <div className="space-y-3">
              {activity.length === 0 ? (
                <p className="text-xs text-text-muted">No recent activity</p>
              ) : activity.map(act => (
                <div key={act.id} className="flex items-start gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${act.quantity_change > 0 ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'}`}>
                    {act.type === 'purchase' ? <ShoppingCart size={13} /> : act.type === 'sale' ? <Package size={13} /> : act.type === 'waste' ? <XCircle size={13} /> : act.type === 'transfer' ? <Shuffle size={13} /> : <Settings2 size={13} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{activityLabel(act)}</p>
                    {editingActivityId === act.id ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          autoFocus
                          value={editingNotesValue}
                          onChange={e => setEditingNotesValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveActivityNotes(act.id); if (e.key === 'Escape') setEditingActivityId(null); }}
                          disabled={savingNotes}
                          placeholder="Reason for this…"
                          className="input text-[10px] py-1 flex-1 disabled:opacity-50"
                        />
                        <button onClick={() => saveActivityNotes(act.id)} disabled={savingNotes} className="text-brand text-[10px] font-medium shrink-0 disabled:opacity-50">Save</button>
                        <button onClick={() => setEditingActivityId(null)} className="btn-ghost p-0.5 shrink-0"><X size={11} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditingActivityNotes(act)}
                        disabled={!canManage}
                        className={`text-left text-[11px] mt-0.5 ${act.notes ? 'text-text-secondary' : 'text-text-muted italic'} ${canManage ? 'hover:text-brand cursor-pointer' : 'cursor-default'}`}
                        title={canManage ? 'Click to edit the reason' : undefined}
                      >
                        {act.notes || (canManage ? 'Add a reason…' : 'No reason given')}
                      </button>
                    )}
                    <p className="text-[10px] text-text-muted mt-0.5">By {act.performed_by_name} · {new Date(act.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${act.quantity_change > 0 ? 'text-status-success' : 'text-status-error'}`}>
                    {act.quantity_change > 0 ? '+' : ''}{act.quantity_change} {selected?.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      <Modal open={showAdjust} onClose={() => setShowAdjust(false)} title="Adjust Stock">
        {selected && (
          <div className="space-y-4">
            <div className="card p-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-surface-50 rounded-lg flex items-center justify-center text-brand">
                <CategoryIcon category={selected.category} size={18} />
              </div>
              <div>
                <p className="font-semibold">{selected.name}</p>
                <p className="text-xs text-text-muted">Current: {selected.quantity} {selected.unit}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Reason</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'adjustment', label: 'Count fix' },
                  { value: 'waste', label: 'Waste/spoilage' },
                  { value: 'transfer', label: 'Transfer' },
                ] as const).map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setAdjustType(t.value)}
                    className={`py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                      adjustType === t.value ? 'bg-brand text-black border-brand' : 'border-border text-text-secondary hover:border-brand/40'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Quantity Change (use - to subtract)</label>
              <input type="number" value={adjustQty} onChange={e => setAdjustQty(e.target.value)}
                className="input" placeholder="e.g. +20 or -5" />
              <p className="text-xs text-text-muted mt-1">
                New quantity: <strong className="text-brand">{selected.quantity + (parseFloat(adjustQty) || 0)} {selected.unit}</strong>
              </p>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Notes</label>
              <textarea value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)}
                className="input" rows={2} placeholder="Reason for adjustment..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdjust(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleAdjust} disabled={adjusting || !adjustQty} className="btn-primary flex-1">
                {adjusting ? 'Adjusting...' : 'Adjust Stock'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Item Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editingItem ? `Edit ${editingItem.name}` : 'Add Inventory Item'} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'SKU *', key: 'sku', placeholder: 'ING-XXXX' },
            { label: 'Item Name *', key: 'name', placeholder: 'e.g. Rice' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs text-text-muted mb-1">{f.label}</label>
              <input className="input" placeholder={f.placeholder} value={(newItem as Record<string,string>)[f.key]}
                onChange={e => setNewItem(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs text-text-muted mb-1">Description</label>
            <input className="input" placeholder="Short description" value={newItem.description}
              onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Category</label>
            {/* Free-text with suggestions, not a locked dropdown — `category`
                is a plain text column with no fixed set of allowed values on
                the backend, so restricting it to only these 7 presets was an
                artificial frontend limitation (e.g. "Beverages" or "Cleaning
                Supplies" were impossible to enter at all). */}
            <input className="input" list="inventory-categories" placeholder="e.g. Grains, Beverages..."
              value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} />
            <datalist id="inventory-categories">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Unit</label>
            <select className="select" value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))}>
              {units.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          {[
            // Quantity is only settable at creation — editing an existing
            // item never touches stock count (see handleSaveItem), so the
            // field is hidden entirely once you're editing rather than
            // shown-but-ignored, which would be confusing.
            ...(editingItem ? [] : [{ label: 'Initial Quantity', key: 'quantity', placeholder: '0' }]),
            { label: 'Cost per Unit (KES)', key: 'cost_per_unit', placeholder: '0' },
            { label: 'Reorder Level', key: 'reorder_level', placeholder: '0' },
            { label: 'Location', key: 'location', placeholder: 'Main Store' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs text-text-muted mb-1">{f.label}</label>
              <input className="input" type={['quantity','cost_per_unit','reorder_level'].includes(f.key) ? 'number' : 'text'}
                placeholder={f.placeholder} value={(newItem as Record<string,string>)[f.key]}
                onChange={e => setNewItem(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="block text-xs text-text-muted mb-1">Expiry Date</label>
            <input type="date" className="input" value={newItem.expiry_date}
              onChange={e => setNewItem(p => ({ ...p, expiry_date: e.target.value }))} />
          </div>
        </div>
        {editingItem && (
          <p className="text-[11px] text-text-muted mt-3">
            Current stock ({editingItem.quantity} {editingItem.unit}) isn't editable here — use Adjust Stock so the change stays in the audit trail.
          </p>
        )}
        <div className="flex gap-3 mt-5">
          <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSaveItem} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Add to Inventory'}
          </button>
        </div>
      </Modal>
    </div>
  );
}