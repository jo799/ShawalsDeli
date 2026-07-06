import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Phone, Mail, MapPin, Star } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';
import { formatCurrency, formatDate, formatTime, getInitials } from '@/lib/utils';
import { PageHeader, StatusBadge, Pagination, Modal, LoadingPage } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface Customer {
  id: string; customer_code: string; full_name: string; phone?: string; email?: string;
  address?: string; city?: string; tags?: string[]; is_vip: boolean;
  credit_limit: number; credit_balance: number; status: string;
  total_orders?: number; total_spent?: number; last_visit?: string;
  total_points?: number; available_points?: number; loyalty_tier?: string;
  notes?: string; sms_notifications?: boolean; email_notifications?: boolean;
  whatsapp_notifications?: boolean; marketing_offers?: boolean;
  recent_orders?: Array<{ id: string; order_number: string; total: number; status: string; created_at: string }>;
  created_at?: string;
}

const TIER_COLORS: Record<string, string> = {
  Gold: 'text-brand bg-brand/10',
  Silver: 'text-gray-400 bg-gray-400/10',
  Bronze: 'text-amber-600 bg-amber-600/10',
};

export default function CustomersPage() {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('customers.manage');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', city: 'Nairobi', address: '', is_vip: false, credit_limit: '0', notes: '' });

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
  useEffect(() => { const t = setTimeout(fetchCustomers, 400); return () => clearTimeout(t); }, [search]);

  const viewCustomer = async (c: Customer) => {
    try {
      const { data } = await api.get(`/customers/${c.id}`);
      setSelected(data.data);
      setActiveTab('Overview');
    } catch { setSelected(c); }
  };

  const createCustomer = async () => {
    try {
      await api.post('/customers', { ...form, credit_limit: parseFloat(form.credit_limit) || 0 });
      toast.success('Customer added');
      setShowAdd(false);
      fetchCustomers();
    } catch { toast.error('Failed to add customer'); }
  };

  const avgSpend = selected && selected.total_orders ? (selected.total_spent || 0) / selected.total_orders : 0;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main list */}
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <PageHeader title="Customers" subtitle="View and manage customer information">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9 w-64"
              placeholder="Search customers..." />
          </div>
          {canManage && (
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Add Customer
            </button>
          )}
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
                        <button onClick={e => { e.stopPropagation(); viewCustomer(c); }} className="btn-ghost p-1"><Edit2 size={13} /></button>
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
        <div className="w-[380px] shrink-0 border-l border-border bg-surface-card flex flex-col overflow-y-auto">
          {/* Back + actions */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <button onClick={() => setSelected(null)} className="btn-ghost text-xs flex items-center gap-1">
              ← Back to Customers
            </button>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs py-1.5">✏ Edit Customer</button>
              <button className="btn-secondary text-xs py-1.5">More Actions ▾</button>
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
                  <span className="badge badge-success">Active</span>
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
          <div className="flex border-b border-border px-4">
            {['Overview','Orders','Transactions','Loyalty','Credits','Notes & History'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'Overview' && (
            <div className="p-4 space-y-4">
              {/* Stats cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Visits', value: selected.total_orders || 0, icon: '🛒', sub: 'This year', color: 'bg-status-info/10' },
                  { label: 'Total Spent', value: formatCurrency(selected.total_spent || 0), icon: '💵', sub: 'This year', color: 'bg-status-success/10' },
                  { label: 'Average Spend', value: formatCurrency(avgSpend), icon: '🛍', sub: 'Per visit', color: 'bg-brand/10' },
                  { label: 'Last 3 Months', value: formatCurrency((selected.total_spent || 0) * 0.34), icon: '📈', sub: '↑18.6%', color: 'bg-status-purple/10' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
                    <p className="text-lg font-bold text-text-primary">{s.value}</p>
                    <p className="text-xs text-text-muted">{s.label}</p>
                    <p className="text-[11px] text-text-muted">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Spend chart */}
              <div>
                <h3 className="text-xs font-semibold mb-2">Visit & Spending Trend</h3>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={[
                    { m: 'Jan', v: 2800 }, { m: 'Feb', v: 3100 }, { m: 'Mar', v: 2600 },
                    { m: 'Apr', v: 4200 }, { m: 'May', v: 3800 }, { m: 'Jun', v: 2900 },
                    { m: 'Jul', v: 3400 }, { m: 'Aug', v: 2700 }, { m: 'Sep', v: 3200 },
                    { m: 'Oct', v: 2500 }, { m: 'Nov', v: 3600 }, { m: 'Dec', v: 3100 },
                  ]}>
                    <XAxis dataKey="m" tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Area type="monotone" dataKey="v" stroke="#F59E0B" strokeWidth={1.5} fill="rgba(245,158,11,0.1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Recent orders */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-xs font-semibold">Recent Orders</h3>
                  <button className="text-[11px] text-brand">View All</button>
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

              {/* Notes */}
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

          {activeTab === 'Loyalty' && (
            <div className="p-4 space-y-4">
              <div className="card p-4 text-center">
                <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Star size={20} className="text-brand" />
                </div>
                <p className="text-2xl font-bold text-brand">{selected.total_points || 0} pts</p>
                <p className="text-xs text-text-muted">Total Points</p>
                {selected.loyalty_tier && (
                  <span className={`mt-2 inline-flex items-center gap-1 badge ${TIER_COLORS[selected.loyalty_tier] || 'badge-muted'}`}>
                    👑 {selected.loyalty_tier} Tier
                  </span>
                )}
                <div className="mt-3">
                  <div className="h-2 bg-surface-50 rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${Math.min(100, ((selected.total_points || 0) / 2000) * 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-text-muted mt-1">{2000 - (selected.total_points || 0)} pts to Platinum Tier</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="card p-3">
                  <p className="text-lg font-bold">{selected.available_points || 0}</p>
                  <p className="text-xs text-text-muted">Available Points</p>
                </div>
                <div className="card p-3">
                  <p className="text-lg font-bold">{(selected.total_points || 0) - (selected.available_points || 0)}</p>
                  <p className="text-xs text-text-muted">Redeemed Points</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Credits' && (
            <div className="p-4 space-y-4">
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Credit Account</h3>
                  <button className="text-xs text-brand">Details</button>
                </div>
                <p className="text-2xl font-bold text-status-error">{formatCurrency(selected.credit_balance)}</p>
                <p className="text-xs text-status-error">Outstanding Balance</p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-text-muted">Credit Limit</span><span className="font-medium">{formatCurrency(selected.credit_limit)}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Available Credit</span><span className="font-medium text-status-success">{formatCurrency(selected.credit_limit - selected.credit_balance)}</span></div>
                </div>
                <button className="btn-secondary w-full mt-3 text-xs py-1.5">View Credit Account</button>
              </div>
            </div>
          )}

          {/* Sidebar cards always visible */}
          {!['Overview','Orders','Transactions','Loyalty','Credits','Notes & History'].includes(activeTab) || activeTab === 'Overview' ? null : (
            <div className="p-4 text-center text-text-muted text-sm">Select a tab above</div>
          )}
        </div>
      )}

      {/* Add Customer Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Customer">
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
            <div>
              <label className="block text-xs text-text-muted mb-1">Credit Limit (KES)</label>
              <input type="number" className="input" value={form.credit_limit} onChange={e => setForm(p => ({ ...p, credit_limit: e.target.value }))} />
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
            <button onClick={createCustomer} className="btn-primary flex-1">Add Customer</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
