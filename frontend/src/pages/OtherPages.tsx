// ─── Expenses Page ────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { Plus, Download, X, Edit2, Trash2, Upload, FileText, CreditCard, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { confirmDelete } from '@/lib/confirmPreference';
import { formatCurrency, formatDate, toLocalDateString } from '@/lib/utils';
import { PageHeader, Pagination, SearchInput, LoadingPage, Modal, FinancialSummaryExportButton } from '@/components/ui';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface Expense {
  id: string; title: string; description?: string; category_id?: string; category_name?: string; category_color?: string;
  vendor?: string; amount: number; payment_method?: string; expense_date: string;
  reference_no?: string; receipt_url?: string; created_by_name?: string;
}
interface Category { id: string; name: string; color: string; }
interface Stats {
  this_month_total: number; this_month_count: number; this_month_change_pct: number | null;
  average_per_day: number; over_budget_categories: Array<{ name: string; spent: number; budget_limit: number }>;
}

const COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#F97316','#14B8A6','#6B7280'];

const PAYMENT_METHOD_BADGE: Record<string, string> = {
  bank_transfer: 'bg-status-info/10 text-status-info',
  mpesa: 'bg-status-success/10 text-status-success',
  cash: 'bg-surface-50 text-text-secondary',
  card: 'bg-status-purple/10 text-status-purple',
};
const PAYMENT_METHODS = ['cash', 'mpesa', 'bank_transfer', 'card'];

const EMPTY_FORM = { title: '', category_id: '', vendor: '', amount: '', payment_method: 'bank_transfer', expense_date: toLocalDateString(), notes: '', reference_no: '' };

export function ExpensesPage() {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('expenses.manage');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [byCategory, setByCategory] = useState<Array<{ name: string; total: number; color?: string }>>([]);
  const [summary, setSummary] = useState({ total: 0, count: 0 });
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [uploadingReceiptFor, setUploadingReceiptFor] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const [expRes, catRes, statsRes] = await Promise.all([
        api.get('/expenses', { params: { search: search || undefined, category_id: categoryFilter || undefined, payment_method: paymentFilter || undefined, page, limit: 10 } }),
        api.get('/expenses/categories'),
        api.get('/expenses/stats'),
      ]);
      setExpenses(expRes.data.data);
      setSummary(expRes.data.summary);
      setByCategory(expRes.data.by_category || []);
      setPagination({ total: expRes.data.pagination.total, pages: expRes.data.pagination.pages });
      setCategories(catRes.data.data);
      setStats(statsRes.data.data);
    } catch { toast.error('Failed to load expenses'); }
    finally { setLoading(false); }
  }, [search, categoryFilter, paymentFilter, page]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useEffect(() => { const t = setTimeout(fetchExpenses, 400); return () => clearTimeout(t); }, [search]);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setShowAdd(true); };

  const openEdit = (exp: Expense) => {
    setEditingId(exp.id);
    setForm({
      title: exp.title, category_id: exp.category_id || '', vendor: exp.vendor || '', amount: String(exp.amount),
      payment_method: exp.payment_method || 'bank_transfer', expense_date: exp.expense_date.slice(0, 10),
      notes: exp.description || '', reference_no: exp.reference_no || '',
    });
    setShowAdd(true);
  };

  const saveExpense = async () => {
    if (!form.title.trim() || !form.amount) { toast.error('Title and amount are required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, amount: parseFloat(form.amount), category_id: form.category_id || null };
      if (editingId) {
        await api.put(`/expenses/${editingId}`, payload);
        toast.success('Expense updated');
      } else {
        await api.post('/expenses', payload);
        toast.success('Expense added');
      }
      setShowAdd(false);
      fetchExpenses();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save expense';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const deleteExpense = async (exp: Expense) => {
    if (!confirmDelete(`Delete "${exp.title}" (${formatCurrency(exp.amount)})? This cannot be undone.`)) return;
    try {
      await api.delete(`/expenses/${exp.id}`);
      toast.success('Expense deleted');
      if (selectedExpense?.id === exp.id) setSelectedExpense(null);
      fetchExpenses();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete expense';
      toast.error(msg);
    }
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) { toast.error('Enter a category name'); return; }
    try {
      const { data } = await api.post('/expenses/categories', { name: newCategoryName.trim(), color: COLORS[categories.length % COLORS.length] });
      setCategories(prev => [...prev, data.data]);
      setForm(p => ({ ...p, category_id: data.data.id }));
      setShowNewCategory(false);
      setNewCategoryName('');
      toast.success('Category added');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add category';
      toast.error(msg);
    }
  };

  const handleReceiptUpload = async (expenseId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error('File is too large (max 5MB).'); return; }
    setUploadingReceiptFor(expenseId);
    const fd = new FormData();
    fd.append('receipt', file);
    try {
      await api.post(`/expenses/${expenseId}/receipt`, fd);
      toast.success('Receipt uploaded');
      fetchExpenses();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to upload receipt';
      toast.error(msg);
    } finally { setUploadingReceiptFor(null); }
  };

  const exportCsv = () => {
    const rows = [['Title', 'Category', 'Vendor', 'Date', 'Payment Method', 'Amount', 'Reference']];
    expenses.forEach(e => rows.push([e.title, e.category_name || '', e.vendor || '', e.expense_date.slice(0, 10), e.payment_method || '', String(e.amount), e.reference_no || '']));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `expenses-${toLocalDateString()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const pieData = byCategory.map((c, i) => ({ name: c.name, value: c.total, fill: c.color || COLORS[i % COLORS.length] }));
  const totalExpense = byCategory.reduce((s, c) => s + c.total, 0);

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:overflow-hidden p-6">
        <PageHeader title="Expenses" subtitle="Track and manage business expenses">
          <FinancialSummaryExportButton />
          <button onClick={exportCsv} disabled={expenses.length === 0} className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50"><Download size={13} /> Export</button>
          {canManage && <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm"><Plus size={14} /> Add Expense</button>}
        </PageHeader>

        {/* Stats — every number here is real now. "This Month" used to show
            the exact same figure as "Total Expenses" with a hardcoded
            "↓8.5% vs Apr 2025" underneath regardless of anything actually
            spent; "Average per Day" divided that same unscoped total by a
            fixed 30; "Over Budget" was a fixed string. budget_limit already
            existed on expense_categories — nothing was ever reading it. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Expenses', value: formatCurrency(summary.total), Icon: CreditCard, sub: `${summary.count} transactions` },
            {
              label: 'This Month', value: formatCurrency(stats?.this_month_total || 0), Icon: TrendingUp,
              sub: stats?.this_month_change_pct === null ? '— vs last month' : `${(stats?.this_month_change_pct || 0) >= 0 ? '+' : ''}${stats?.this_month_change_pct}% vs last month`,
              subColor: stats?.this_month_change_pct !== null && (stats?.this_month_change_pct || 0) <= 0 ? 'text-status-success' : 'text-status-error',
            },
            { label: 'Average per Day', value: formatCurrency(stats?.average_per_day || 0), Icon: Calendar, sub: 'This month' },
            {
              label: 'Over Budget', value: `${stats?.over_budget_categories.length || 0} ${stats?.over_budget_categories.length === 1 ? 'Category' : 'Categories'}`, Icon: AlertTriangle,
              sub: stats?.over_budget_categories.length ? stats.over_budget_categories.map(c => c.name).join(', ') : 'None this month',
              color: stats?.over_budget_categories.length ? 'text-status-error' : undefined,
            },
          ].map(s => (
            <div key={s.label} className="card p-3">
              <div className="flex items-center gap-2 mb-2"><s.Icon size={18} className="text-brand" /></div>
              <p className={`text-base font-bold ${s.color || 'text-text-primary'}`}>{s.value}</p>
              <p className="text-xs text-text-muted">{s.label}</p>
              {s.sub && <p className={`text-xs mt-0.5 truncate ${(s as { subColor?: string }).subColor || 'text-text-muted'}`}>{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Filters — both now genuinely filter server-side */}
        <div className="flex items-center gap-3 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by expense name, category or vendor..." className="flex-1 max-w-sm" />
          <select className="select text-xs py-1.5 w-36" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select text-xs py-1.5 w-40" value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value); setPage(1); }}>
            <option value="">All Payment Methods</option>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
          </select>
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
                  {expenses.length === 0 ? (
                    <tr><td colSpan={8} className="py-10 text-center text-text-muted text-sm">No expenses recorded yet</td></tr>
                  ) : expenses.map(exp => (
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
                      <td className="table-cell" onClick={e => e.stopPropagation()}>
                        {exp.receipt_url ? (
                          <a href={exp.receipt_url} target="_blank" rel="noreferrer" className="btn-ghost p-1 inline-flex" title="View receipt"><FileText size={14} className="text-status-info" /></a>
                        ) : canManage ? (
                          <label className={`btn-ghost p-1 inline-flex cursor-pointer ${uploadingReceiptFor === exp.id ? 'opacity-50 pointer-events-none' : ''}`} title="Upload receipt">
                            <Upload size={14} />
                            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(exp.id, f); e.target.value = ''; }} />
                          </label>
                        ) : <span className="text-text-muted text-xs">—</span>}
                      </td>
                      <td className="table-cell" onClick={e => e.stopPropagation()}>
                        {canManage ? (
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(exp)} className="btn-ghost p-1"><Edit2 size={13} /></button>
                            <button onClick={() => deleteExpense(exp)} className="btn-ghost p-1 text-status-error"><Trash2 size={13} /></button>
                          </div>
                        ) : <span className="text-text-muted text-xs">—</span>}
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

      {/* Right panel */}
      <div className="w-full md:w-[260px] md:shrink-0 border-t md:border-t-0 md:border-l border-border bg-surface-card flex flex-col overflow-y-auto max-h-[60vh] md:max-h-none">
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
              {selectedExpense.receipt_url && (
                <a href={selectedExpense.receipt_url} target="_blank" rel="noreferrer" className="btn-secondary w-full text-xs py-2 flex items-center justify-center gap-1.5 mt-2">
                  <FileText size={13} /> View Receipt
                </a>
              )}
            </div>
            {canManage && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => openEdit(selectedExpense)} className="btn-secondary flex-1 text-xs py-2 flex items-center justify-center gap-1"><Edit2 size={12} /> Edit</button>
                <button onClick={() => deleteExpense(selectedExpense)} className="btn-secondary flex-1 text-xs py-2 flex items-center justify-center gap-1 text-status-error border-status-error/30"><Trash2 size={12} /> Delete</button>
              </div>
            )}
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
              {byCategory.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-2">No expenses to break down yet</p>
              ) : byCategory.slice(0, 5).map((cat, i) => (
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

      {/* Add / Edit expense modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editingId ? 'Edit Expense' : 'Add Expense'}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-1 sm:col-span-2"><label className="block text-xs text-text-muted mb-1">Title *</label><input className="input" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="Expense title" /></div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Category</label>
              {showNewCategory ? (
                <div className="flex gap-1.5">
                  <input className="input flex-1" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New category name" autoFocus />
                  <button type="button" onClick={createCategory} className="btn-primary text-xs px-2">Add</button>
                  <button type="button" onClick={() => setShowNewCategory(false)} className="btn-secondary text-xs px-2">✕</button>
                </div>
              ) : (
                <select className="select" value={form.category_id} onChange={e => {
                  if (e.target.value === '__new__') { setShowNewCategory(true); return; }
                  setForm(p => ({...p, category_id: e.target.value}));
                }}>
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__new__">+ New category…</option>
                </select>
              )}
            </div>
            <div><label className="block text-xs text-text-muted mb-1">Vendor</label><input className="input" value={form.vendor} onChange={e => setForm(p => ({...p, vendor: e.target.value}))} placeholder="Vendor name" /></div>
            <div><label className="block text-xs text-text-muted mb-1">Amount (KES) *</label><input type="number" className="input" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} placeholder="0" /></div>
            <div><label className="block text-xs text-text-muted mb-1">Payment Method</label>
              <select className="select" value={form.payment_method} onChange={e => setForm(p => ({...p, payment_method: e.target.value}))}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_',' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-text-muted mb-1">Date</label><input type="date" className="input" value={form.expense_date} onChange={e => setForm(p => ({...p, expense_date: e.target.value}))} /></div>
            <div><label className="block text-xs text-text-muted mb-1">Reference No.</label><input className="input" value={form.reference_no} onChange={e => setForm(p => ({...p, reference_no: e.target.value}))} placeholder="TXN-XXXXXX" /></div>
            <div className="col-span-1 sm:col-span-2"><label className="block text-xs text-text-muted mb-1">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={saveExpense} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Expense'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}