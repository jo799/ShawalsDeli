// ─── Expenses Page ────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { Plus, Download, Filter, X } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency, formatDate, toLocalDateString } from '@/lib/utils';
import { PageHeader, Pagination, SearchInput, LoadingPage, Modal } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

interface Expense {
  id: string; title: string; description?: string; category_name?: string; category_color?: string;
  vendor?: string; amount: number; payment_method?: string; expense_date: string;
  reference_no?: string; created_by_name?: string;
}
interface Category { id: string; name: string; color: string; }

const COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#F97316','#14B8A6','#6B7280'];

const PAYMENT_METHOD_BADGE: Record<string, string> = {
  bank_transfer: 'bg-status-info/10 text-status-info',
  mpesa: 'bg-status-success/10 text-status-success',
  cash: 'bg-surface-50 text-text-secondary',
  card: 'bg-status-purple/10 text-status-purple',
};

export function ExpensesPage() {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('expenses.manage');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [byCategory, setByCategory] = useState<Array<{ name: string; total: number; color?: string }>>([]);
  const [summary, setSummary] = useState({ total: 0, count: 0 });
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', category_id: '', vendor: '', amount: '', payment_method: 'bank_transfer', expense_date: toLocalDateString(), notes: '', reference_no: '' });

  const fetch = async () => {
    try {
      setLoading(true);
      const [expRes, catRes] = await Promise.all([
        api.get('/expenses', { params: { search: search || undefined, page, limit: 10 } }),
        api.get('/expenses/categories')
      ]);
      setExpenses(expRes.data.data);
      setSummary(expRes.data.summary);
      setByCategory(expRes.data.by_category || []);
      setPagination({ total: expRes.data.pagination.total, pages: expRes.data.pagination.pages });
      setCategories(catRes.data.data);
    } catch { toast.error('Failed to load expenses'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [page]);
  useEffect(() => { const t = setTimeout(fetch, 400); return () => clearTimeout(t); }, [search]);

  const addExpense = async () => {
    try {
      await api.post('/expenses', { ...form, amount: parseFloat(form.amount) });
      toast.success('Expense added');
      setShowAdd(false);
      fetch();
    } catch { toast.error('Failed to add expense'); }
  };

  const pieData = byCategory.map((c, i) => ({ name: c.name, value: c.total, fill: c.color || COLORS[i % COLORS.length] }));
  const totalExpense = byCategory.reduce((s, c) => s + c.total, 0);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <PageHeader title="Expenses" subtitle="Track and manage business expenses">
          <button className="btn-secondary flex items-center gap-1.5 text-sm"><Download size={13} /> Export</button>
          {canManage && (
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={14} /> Add Expense</button>
          )}
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total Expenses', value: formatCurrency(summary.total), icon: '💳', color: 'text-brand' },
            { label: 'This Month', value: formatCurrency(summary.total), icon: '📈', sub: '↓8.5% vs Apr 2025', subColor: 'text-status-success' },
            { label: 'Total Transactions', value: summary.count, icon: '📋', sub: 'This month' },
            { label: 'Average per Day', value: formatCurrency(summary.total / 30), icon: '📅', sub: 'This month' },
            { label: 'Over Budget', value: '2 Categories', icon: '⚠', sub: 'This month', color: 'text-status-error' },
          ].map(s => (
            <div key={s.label} className="card p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{s.icon}</span>
              </div>
              <p className={`text-base font-bold ${s.color || 'text-text-primary'}`}>{s.value}</p>
              <p className="text-xs text-text-muted">{s.label}</p>
              {s.sub && <p className={`text-xs mt-0.5 ${(s as { subColor?: string }).subColor || 'text-text-muted'}`}>{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by expense name, category or vendor..." className="flex-1 max-w-sm" />
          <select className="select text-xs py-1.5 w-32"><option>All Categories</option>{categories.map(c => <option key={c.id}>{c.name}</option>)}</select>
          <select className="select text-xs py-1.5 w-40"><option>All Payment Methods</option>{['Cash','M-Pesa','Bank Transfer','Card'].map(m => <option key={m}>{m}</option>)}</select>
          <button className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><Filter size={12} /> Filters</button>
        </div>

        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="overflow-auto flex-1">
            {loading ? <LoadingPage /> : (
              <table className="w-full">
                <thead className="bg-surface-50 sticky top-0">
                  <tr>{['Expense','Category','Vendor','Date','Payment Method','Amount','Receipt','Actions'].map(h => (
                    <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id} className={`table-row cursor-pointer ${selectedExpense?.id === exp.id ? 'bg-brand/5' : ''}`} onClick={() => setSelectedExpense(exp)}>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-surface-50 flex items-center justify-center text-sm">💳</div>
                          <div>
                            <p className="font-medium text-sm">{exp.title}</p>
                            <p className="text-xs text-text-muted">{exp.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="badge bg-surface-50 text-text-secondary" style={{ borderLeft: `3px solid ${exp.category_color || '#6B7280'}` }}>
                          {exp.category_name || '—'}
                        </span>
                      </td>
                      <td className="table-cell text-text-secondary">{exp.vendor || '—'}</td>
                      <td className="table-cell text-text-muted">{formatDate(exp.expense_date)}</td>
                      <td className="table-cell">
                        <span className={`badge text-xs ${PAYMENT_METHOD_BADGE[exp.payment_method || ''] || 'badge-muted'}`}>
                          {exp.payment_method?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="table-cell font-medium">{formatCurrency(exp.amount)}</td>
                      <td className="table-cell"><button className="btn-ghost p-1">📄</button></td>
                      <td className="table-cell"><button className="btn-ghost p-1">⋮</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Pagination page={page} pages={pagination.pages} total={pagination.total} limit={10} onChange={setPage} />
        </div>
      </div>

      {/* Right panel */}
      <div className="w-[260px] shrink-0 border-l border-border bg-surface-card flex flex-col overflow-y-auto">
        {selectedExpense ? (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title text-sm">Expense Details</h2>
              <button onClick={() => setSelectedExpense(null)}><X size={14} className="text-text-muted" /></button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-status-info/10 rounded-lg flex items-center justify-center">💳</div>
              <div>
                <p className="font-semibold text-sm">{selectedExpense.title}</p>
                <span className="badge badge-info text-xs">Expense</span>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ['Date', formatDate(selectedExpense.expense_date)],
                ['Amount', formatCurrency(selectedExpense.amount)],
                ['Category', selectedExpense.category_name || '—'],
                ['Payment Method', selectedExpense.payment_method?.replace('_',' ') || '—'],
                ['Reference No.', selectedExpense.reference_no || '—'],
                ['Notes', selectedExpense.description || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-text-muted">{label}</span>
                  <span className="font-medium text-right max-w-[140px]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4">
            <h2 className="section-title text-sm mb-4">Expenses by Category</h2>
            {pieData.length > 0 && (
              <div className="relative">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <p className="text-xs text-text-muted">Total</p>
                  <p className="text-sm font-bold">{formatCurrency(totalExpense)}</p>
                </div>
              </div>
            )}
            <div className="space-y-2 mt-3">
              {byCategory.slice(0, 5).map((cat, i) => (
                <div key={cat.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: cat.color || COLORS[i % COLORS.length] }} />
                    <span className="text-text-secondary">{cat.name}</span>
                  </div>
                  <span className="font-medium">{totalExpense > 0 ? Math.round(cat.total / totalExpense * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add expense modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Expense">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="block text-xs text-text-muted mb-1">Title *</label><input className="input" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="Expense title" /></div>
            <div><label className="block text-xs text-text-muted mb-1">Category</label>
              <select className="select" value={form.category_id} onChange={e => setForm(p => ({...p, category_id: e.target.value}))}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-text-muted mb-1">Vendor</label><input className="input" value={form.vendor} onChange={e => setForm(p => ({...p, vendor: e.target.value}))} placeholder="Vendor name" /></div>
            <div><label className="block text-xs text-text-muted mb-1">Amount (KES) *</label><input type="number" className="input" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} placeholder="0" /></div>
            <div><label className="block text-xs text-text-muted mb-1">Payment Method</label>
              <select className="select" value={form.payment_method} onChange={e => setForm(p => ({...p, payment_method: e.target.value}))}>
                {['cash','mpesa','bank_transfer','card'].map(m => <option key={m} value={m}>{m.replace('_',' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-text-muted mb-1">Date</label><input type="date" className="input" value={form.expense_date} onChange={e => setForm(p => ({...p, expense_date: e.target.value}))} /></div>
            <div><label className="block text-xs text-text-muted mb-1">Reference No.</label><input className="input" value={form.reference_no} onChange={e => setForm(p => ({...p, reference_no: e.target.value}))} placeholder="TXN-XXXXXX" /></div>
            <div className="col-span-2"><label className="block text-xs text-text-muted mb-1">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={addExpense} className="btn-primary flex-1">Add Expense</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Placeholder pages ─────────────────────────────────────────────────────────
export function InventoryPage() { return <div className="p-6"><div className="text-text-muted">Inventory page - connects to /api/inventory</div></div>; }
export function CustomersPage() { return <div className="p-6"><div className="text-text-muted">Customers page - connects to /api/customers</div></div>; }
export function LoyaltyPage() { return <div className="p-6"><div className="text-text-muted">Loyalty Points page - connects to /api/customers</div></div>; }
export function PurchasesPage() { return <div className="p-6"><div className="text-text-muted">Purchases page - connects to /api/purchases</div></div>; }
export function StaffPage() { return <div className="p-6"><div className="text-text-muted">Staff page - connects to /api/staff</div></div>; }
export function SchedulingPage() { return <div className="p-6"><div className="text-text-muted">Scheduling page - connects to /api/staff/schedules</div></div>; }
export function CreditsPage() { return <div className="p-6"><div className="text-text-muted">Credit Accounts page</div></div>; }
export function SettingsPage() { return <div className="p-6"><div className="text-text-muted">Settings page - connects to /api/settings</div></div>; }
export function DashboardPage() { return <div className="p-6"><h1 className="text-2xl font-bold text-brand mb-2">Shawal's Deli</h1><p className="text-text-muted">Welcome to the Dashboard. Navigate using the sidebar.</p></div>; }