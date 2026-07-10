import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Phone, Mail, MapPin, Star, ShoppingCart, Wallet, ShoppingBag } from 'lucide-react';
import api from '@/lib/api';
import { confirmDelete } from '@/lib/confirmPreference';
import { formatCurrency, formatDate, formatTime, getInitials } from '@/lib/utils';
import { PageHeader, StatusBadge, Pagination, Modal, LoadingPage } from '@/components/ui';
import toast from 'react-hot-toast';

interface Customer {
  id: string; customer_code: string; full_name: string; phone?: string; email?: string;
  address?: string; city?: string; tags?: string[]; is_vip: boolean;
  status: string;
  total_orders?: number; total_spent?: number; last_visit?: string;
  total_points?: number; available_points?: number; redeemed_points?: number; loyalty_tier?: string;
  notes?: string; sms_notifications?: boolean; email_notifications?: boolean;
  whatsapp_notifications?: boolean; marketing_offers?: boolean;
  recent_orders?: Array<{ id: string; order_number: string; total: number; status: string; created_at: string }>;
  loyalty_history?: Array<{ id: string; type: string; points: number; description: string; created_at: string }>;
  created_at?: string;
}

const TIER_COLORS: Record<string, string> = {
  Gold: 'text-brand bg-brand/10',
  Silver: 'text-gray-400 bg-gray-400/10',
  Bronze: 'text-amber-600 bg-amber-600/10',
};

const EMPTY_FORM = {
  full_name: '', phone: '', email: '', city: 'Nairobi', address: '', is_vip: false, notes: '',
  sms_notifications: true, email_notifications: true, whatsapp_notifications: false, marketing_offers: true,
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = adding new
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [redeemInput, setRedeemInput] = useState('');
  const [pointValueKes, setPointValueKes] = useState(1);
  const [redeeming, setRedeeming] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/customers', { params: { search: search || undefined, page, limit: 10 } });
      setCustomers(data.data);
      setPagination({ total: data.pagination.total, pages: data.pagination.pages });
    } catch { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { api.get('/loyalty/stats').then(r => setPointValueKes(r.data.data.point_value_kes)).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(fetchCustomers, 400); return () => clearTimeout(t); }, [search]);

  const viewCustomer = async (c: Customer) => {
    try {
      const { data } = await api.get(`/customers/${c.id}`);
      setSelected(data.data);
      setNotesDraft(data.data.notes || '');
      setActiveTab('Overview');
    } catch { setSelected(c); }
  };

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setShowAdd(true); };

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({
      full_name: c.full_name, phone: c.phone || '', email: c.email || '', city: c.city || 'Nairobi',
      address: c.address || '', is_vip: c.is_vip, notes: c.notes || '',
      sms_notifications: c.sms_notifications ?? true, email_notifications: c.email_notifications ?? true,
      whatsapp_notifications: c.whatsapp_notifications ?? false, marketing_offers: c.marketing_offers ?? true,
    });
    setShowAdd(true);
  };

  // Soft delete (status='inactive') — order history and the loyalty ledger
  // stay intact, the customer just stops showing up in the active list.
  const deleteCustomer = async (c: Customer) => {
    if (!confirmDelete(`Delete ${c.full_name}? Their order and points history will be kept, but they won't appear in the customer list anymore.`)) return;
    try {
      await api.delete(`/customers/${c.id}`);
      toast.success('Customer deleted');
      if (selected?.id === c.id) setSelected(null);
      fetchCustomers();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete customer';
      toast.error(msg);
    }
  };

  const saveCustomer = async () => {
    if (!form.full_name.trim()) { toast.error('Full name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (editingId) {
        const { data } = await api.put(`/customers/${editingId}`, payload);
        toast.success('Customer updated');
        if (selected?.id === editingId) setSelected(prev => prev ? { ...prev, ...data.data } : prev);
      } else {
        await api.post('/customers', payload);
        toast.success('Customer added');
      }
      setShowAdd(false);
      fetchCustomers();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save customer';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    try {
      await api.put(`/customers/${selected.id}`, {
        full_name: selected.full_name, phone: selected.phone, email: selected.email, city: selected.city,
        address: selected.address, is_vip: selected.is_vip, notes: notesDraft,
        sms_notifications: selected.sms_notifications, email_notifications: selected.email_notifications,
        whatsapp_notifications: selected.whatsapp_notifications, marketing_offers: selected.marketing_offers,
      });
      setSelected(prev => prev ? { ...prev, notes: notesDraft } : prev);
      toast.success('Notes saved');
    } catch { toast.error('Failed to save notes'); }
    finally { setSavingNotes(false); }
  };

  const redeemPoints = async () => {
    if (!selected) return;
    const points = parseInt(redeemInput);
    if (!Number.isFinite(points) || points <= 0) { toast.error('Enter a valid number of points'); return; }
    setRedeeming(true);
    try {
      await api.post(`/customers/${selected.id}/redeem-points`, { points });
      toast.success(`${points} points redeemed`);
      setRedeemInput('');
      const { data } = await api.get(`/customers/${selected.id}`);
      setSelected(data.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to redeem points';
      toast.error(msg);
    } finally { setRedeeming(false); }
  };

  const avgSpend = selected && selected.total_orders ? (selected.total_spent || 0) / selected.total_orders : 0;
  const LEDGER_ICON: Record<string, string> = { earn: '⭐', redeem: '🎁', adjust: '⚙', expire: '⏳' };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      {/* Main list */}
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <PageHeader title="Customers" subtitle="View and manage customer information">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9 w-64"
              placeholder="Search customers..." />
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Add Customer
          </button>
        </PageHeader>

        {/* Customer table */}
        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="overflow-auto flex-1">
            {loading ? <LoadingPage /> : (
              <table className="w-full">
                <thead className="bg-surface-50 sticky top-0">
                  <tr>
                    {['Customer','Phone','Email','Total Orders','Total Spent','Last Visit','Status','Actions'].map(h => (
                      <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id} onClick={() => viewCustomer(c)}
                      className={`table-row cursor-pointer ${selected?.id === c.id ? 'bg-brand/5 border-l-2 border-l-brand' : ''}`}>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${c.is_vip ? 'bg-brand text-black' : 'bg-surface-50 text-text-primary'}`}>
                            {getInitials(c.full_name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-sm">{c.full_name}</p>
                              {c.is_vip && <Star size={11} className="text-brand fill-brand" />}
                            </div>
                            <p className="text-[11px] text-text-muted">{c.customer_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-text-secondary">{c.phone || '—'}</td>
                      <td className="table-cell text-text-secondary text-xs">{c.email || '—'}</td>
                      <td className="table-cell font-medium">{c.total_orders || 0}</td>
                      <td className="table-cell font-medium text-brand">{formatCurrency(c.total_spent || 0)}</td>
                      <td className="table-cell text-text-muted text-xs">{c.last_visit ? formatDate(c.last_visit) : '—'}</td>
                      <td className="table-cell"><StatusBadge status={c.status} /></td>
                      <td className="table-cell">
                        <button onClick={e => { e.stopPropagation(); openEdit(c); }} className="btn-ghost p-1"><Edit2 size={13} /></button>
                        <button onClick={e => { e.stopPropagation(); deleteCustomer(c); }} className="btn-ghost p-1 text-status-error"><Trash2 size={13} /></button>
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

      {/* Customer Detail Panel */}
      {selected && (
        <div className="w-full md:w-[380px] md:shrink-0 border-t md:border-t-0 md:border-l border-border bg-surface-card flex flex-col overflow-y-auto max-h-[60vh] md:max-h-none">
          {/* Back + actions */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <button onClick={() => setSelected(null)} className="btn-ghost text-xs flex items-center gap-1">
              ← Back to Customers
            </button>
            <div className="flex gap-2">
              <button onClick={() => openEdit(selected)} className="btn-secondary text-xs py-1.5 flex items-center gap-1">
                <Edit2 size={11} /> Edit
              </button>
              <button onClick={() => deleteCustomer(selected)} className="btn-secondary text-xs py-1.5 flex items-center gap-1 text-status-error border-status-error/30 hover:bg-status-error/10">
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </div>

          {/* Profile */}
          <div className="p-5 border-b border-border">
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${selected.is_vip ? 'bg-brand text-black' : 'bg-surface-50 text-text-primary'}`}>
                {getInitials(selected.full_name)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">{selected.full_name}</h2>
                  <StatusBadge status={selected.status} />
                </div>
                {selected.is_vip && (
                  <div className="flex items-center gap-1 text-brand text-xs font-medium mt-0.5">
                    <Star size={11} className="fill-brand" /> VIP Customer
                  </div>
                )}
                <div className="space-y-1 mt-2 text-xs text-text-muted">
                  {selected.phone && <p className="flex items-center gap-1.5"><Phone size={11} />{selected.phone}</p>}
                  {selected.email && <p className="flex items-center gap-1.5"><Mail size={11} />{selected.email}</p>}
                  {selected.city && <p className="flex items-center gap-1.5"><MapPin size={11} />{selected.city}{selected.address ? `, ${selected.address}` : ''}</p>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 text-xs text-text-muted gap-2">
              <div><span className="block">Customer Since</span><span className="font-medium text-text-primary">{selected.created_at ? formatDate(selected.created_at) : '—'}</span></div>
              <div><span className="block">Last Visit</span><span className="font-medium text-text-primary">{selected.last_visit ? formatDate(selected.last_visit) : '—'}</span></div>
              <div><span className="block">Customer ID</span><span className="font-medium text-text-primary">{selected.customer_code}</span></div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border px-4 overflow-x-auto">
            {['Overview','Orders','Loyalty','Notes'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'Overview' && (
            <div className="p-4 space-y-4">
              {/* Stats cards — real numbers only. This used to include a
                  fabricated "Last 3 Months" figure (total_spent * 0.34 with
                  a hardcoded "+18.6%") with nothing behind it. */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Visits', Icon: ShoppingCart, value: selected.total_orders || 0, color: 'bg-status-info/10 text-status-info' },
                  { label: 'Total Spent', Icon: Wallet, value: formatCurrency(selected.total_spent || 0), color: 'bg-status-success/10 text-status-success' },
                  { label: 'Average Spend', Icon: ShoppingBag, value: formatCurrency(avgSpend), color: 'bg-brand/10 text-brand' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
                    <s.Icon size={14} className="mb-1" />
                    <p className="text-sm font-bold text-text-primary">{s.value}</p>
                    <p className="text-[11px] text-text-muted">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Recent orders */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-semibold">Recent Orders</h3>
                  {(selected.recent_orders?.length || 0) > 5 && (
                    <button onClick={() => setActiveTab('Orders')} className="text-[11px] text-brand hover:underline">View All</button>
                  )}
                </div>
                <div className="space-y-2">
                  {selected.recent_orders?.slice(0, 5).map(order => (
                    <div key={order.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                      <div>
                        <p className="font-medium text-brand">#{order.order_number}</p>
                        <p className="text-text-muted">{formatDate(order.created_at)} {formatTime(order.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={order.status} />
                        <p className="font-bold mt-0.5">{formatCurrency(order.total)}</p>
                      </div>
                    </div>
                  )) || <p className="text-xs text-text-muted">No orders yet</p>}
                </div>
              </div>

              {/* Notes preview */}
              {selected.notes && (
                <div>
                  <h3 className="text-xs font-semibold mb-2">Notes</h3>
                  <div className="bg-surface-50 rounded-lg p-3">
                    {selected.notes.split('\n').map((note, i) => (
                      <p key={i} className="text-xs text-text-secondary flex items-start gap-1.5 mb-1">
                        <span className="text-brand mt-0.5">•</span>{note}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selected.tags && selected.tags.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold mb-2">Customer Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map(tag => (
                      <span key={tag} className="px-2.5 py-1 rounded-full text-xs border border-border bg-surface-50 text-text-secondary">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Orders' && (
            <div className="p-4">
              <h3 className="text-xs font-semibold mb-2">All Orders ({selected.recent_orders?.length || 0})</h3>
              <div className="space-y-2">
                {selected.recent_orders?.length ? selected.recent_orders.map(order => (
                  <div key={order.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                    <div>
                      <p className="font-medium text-brand">#{order.order_number}</p>
                      <p className="text-text-muted">{formatDate(order.created_at)} {formatTime(order.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={order.status} />
                      <p className="font-bold mt-0.5">{formatCurrency(order.total)}</p>
                    </div>
                  </div>
                )) : <p className="text-xs text-text-muted">No orders yet</p>}
              </div>
              <p className="text-[10px] text-text-muted mt-3">Showing up to the 20 most recent orders.</p>
            </div>
          )}

          {activeTab === 'Loyalty' && (
            <div className="p-4 space-y-4">
              <div className="card p-4 text-center">
                <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Star size={20} className="text-brand" />
                </div>
                <p className="text-2xl font-bold text-brand">{selected.total_points || 0} pts</p>
                <p className="text-xs text-text-muted">Total Points Earned (lifetime)</p>
                {selected.loyalty_tier && (
                  <span className={`mt-2 inline-flex items-center gap-1 badge ${TIER_COLORS[selected.loyalty_tier] || 'badge-muted'}`}>
                    👑 {selected.loyalty_tier} Tier
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="card p-3">
                  <p className="text-lg font-bold">{selected.available_points || 0}</p>
                  <p className="text-xs text-text-muted">Available Points</p>
                </div>
                <div className="card p-3">
                  <p className="text-lg font-bold">{selected.redeemed_points || 0}</p>
                  <p className="text-xs text-text-muted">Redeemed Points</p>
                </div>
              </div>

              {/* Redeem Points — points now convert directly to a KES value
                  (like Kenyan supermarket loyalty schemes) rather than a
                  catalog of named rewards. The schema (redeemed_points, the
                  'redeem' transaction type) already existed for this, but
                  nothing ever actually let a customer spend their points. */}
              {(selected.available_points || 0) > 0 && (
                <div className="card p-4">
                  <h3 className="text-xs font-semibold mb-2">Redeem Points</h3>
                  <p className="text-[11px] text-text-muted mb-2">Available: {selected.available_points} pts = {formatCurrency((selected.available_points || 0) * pointValueKes)}</p>
                  <div className="flex gap-2">
                    <input
                      type="number" min={1} max={selected.available_points}
                      className="input flex-1" placeholder={`Up to ${selected.available_points}`}
                      value={redeemInput} onChange={e => setRedeemInput(e.target.value)}
                    />
                    <button
                      onClick={() => redeemPoints()}
                      disabled={redeeming || !redeemInput || Number(redeemInput) <= 0}
                      className="btn-primary text-xs px-4 disabled:opacity-50"
                    >{redeeming ? '…' : 'Redeem'}</button>
                  </div>
                  {redeemInput && Number(redeemInput) > 0 && (
                    <p className="text-[11px] text-brand mt-1.5">= {formatCurrency(Number(redeemInput) * pointValueKes)}</p>
                  )}
                  <p className="text-[11px] text-text-muted mt-2">
                    Records the redemption and deducts it from available points. Applying it as a bill discount at checkout isn't wired up yet — that's a separate change to how POS pricing works.
                  </p>
                </div>
              )}

              {/* Real points ledger — existed in the database this whole
                  time but was never actually shown anywhere in the app. */}
              <div>
                <h3 className="text-xs font-semibold mb-2">Points History</h3>
                <div className="space-y-2">
                  {selected.loyalty_history?.length ? selected.loyalty_history.map(h => (
                    <div key={h.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/50 last:border-0">
                      <span>{LEDGER_ICON[h.type] || '•'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-text-secondary truncate capitalize">{h.description || h.type}</p>
                        <p className="text-text-muted text-[10px]">{formatDate(h.created_at)}</p>
                      </div>
                      <span className={`font-bold ${h.points >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                        {h.points >= 0 ? '+' : ''}{h.points}
                      </span>
                    </div>
                  )) : <p className="text-xs text-text-muted">No points activity yet</p>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Notes' && (
            <div className="p-4 space-y-3">
              <h3 className="text-xs font-semibold">Notes</h3>
              <textarea
                className="input" rows={6} value={notesDraft} onChange={e => setNotesDraft(e.target.value)}
                placeholder="Special preferences, allergies, notable history..."
              />
              <button onClick={saveNotes} disabled={savingNotes || notesDraft === (selected.notes || '')} className="btn-primary w-full text-sm disabled:opacity-50">
                {savingNotes ? 'Saving…' : 'Save Notes'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editingId ? 'Edit Customer' : 'Add Customer'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-text-muted mb-1">Full Name *</label>
              <input className="input" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Enter full name" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Phone</label>
              <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="07XX XXX XXX" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">City</label>
              <input className="input" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Nairobi" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-text-muted mb-1">Address</label>
              <input className="input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Street, building, etc." />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-text-muted mb-1">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Special preferences, allergies, etc." />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <button onClick={() => setForm(p => ({ ...p, is_vip: !p.is_vip }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${form.is_vip ? 'bg-brand' : 'bg-surface-50'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.is_vip ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-xs text-text-secondary">VIP Customer</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={saveCustomer} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}