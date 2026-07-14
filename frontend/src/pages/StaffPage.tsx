import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, RefreshCw, MoreVertical, UserPlus, Shield, Users, UserCheck, UserMinus, Wallet, Check, X, Edit2, KeyRound, UserX, UserCheck2 } from 'lucide-react';
import api from '@/lib/api';
import { confirmDelete } from '@/lib/confirmPreference';
// Relative import rather than the @shared/* alias — this file lives at a
// fixed location (frontend/src/pages/StaffPage.tsx), three levels below
// the project root where shared/permissions.ts lives, so this resolves
// correctly in every tool with zero path-alias configuration required.
// See authStore.ts for the same reasoning.
import { ROLES, ROLE_PERMISSIONS, ROLE_LABELS, MATRIX_MODULES, type Role } from '../../../shared/permissions';
import { formatDate, getInitials, toLocalDateString } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { PageHeader, StatusBadge, Pagination, Modal, LoadingPage } from '@/components/ui';
import toast from 'react-hot-toast';

interface StaffMember {
  id: string; full_name: string; email: string; phone?: string;
  role: string; status: string; schedule_type: string;
  avatar_url?: string; joined_date?: string; last_login?: string;
}
interface PendingUser {
  id: string; full_name: string; email: string; phone?: string; created_at: string;
}

const ROLE_BADGE: Record<string, string> = {
  administrator: 'bg-status-error/10 text-status-error border border-status-error/20',
  manager: 'bg-status-purple/10 text-status-purple border border-status-purple/20',
  head_chef: 'bg-brand/10 text-brand border border-brand/20',
  cashier: 'bg-status-info/10 text-status-info border border-status-info/20',
  waiter: 'bg-brand/10 text-brand border border-brand/20',
  kitchen_staff: 'bg-status-warning/10 text-status-warning border border-status-warning/20',
  cleaner: 'bg-status-success/10 text-status-success border border-status-success/20',
};

// Role → access table for the "Manage Roles" panel comes directly from the
// same canonical module (@shared/permissions) the Sidebar filters
// navigation with, and that backend route guards are meant to agree with —
// or hid, so the two could silently drift apart.

function randomPassword(): string {
  // Real random default instead of a fixed, guessable string that would
  // otherwise sit right there in the form for anyone to see and reuse.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const EMPTY_FORM = { full_name: '', email: '', phone: '', role: 'waiter', schedule_type: 'full_time', joined_date: toLocalDateString(), password: randomPassword() };

export default function StaffPage() {
  const { user: currentUser } = useAuthStore();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, on_leave: 0, inactive: 0 });
  const [roleDistrib, setRoleDistrib] = useState<Array<{ role: string; count: number }>>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [resetPwMember, setResetPwMember] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPw, setResettingPw] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchPending = useCallback(async () => {
    try {
      const { data } = await api.get('/staff', { params: { approval_status: 'pending', limit: 50 } });
      setPendingUsers(data.data);
    } catch { /* non-critical for the main staff list */ }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/staff', {
        params: { role: roleFilter || undefined, status: statusFilter || undefined, search: search || undefined, page, limit: 10 }
      });
      setStaff(data.data);
      setStats(data.stats);
      setPagination({ total: data.pagination.total, pages: data.pagination.pages });
      const counts: Record<string, number> = {};
      data.data.forEach((s: StaffMember) => { counts[s.role] = (counts[s.role] || 0) + 1; });
      setRoleDistrib(Object.entries(counts).map(([role, count]) => ({ role, count })));
    } catch { toast.error('Failed to load staff'); }
    finally { setLoading(false); }
  }, [search, roleFilter, statusFilter, page]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);
  useEffect(() => { fetchPending(); }, [fetchPending]);
  useEffect(() => { const t = setTimeout(fetchStaff, 400); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    const closeMenu = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null); };
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  const openAdd = () => { setEditingId(null); setForm({ ...EMPTY_FORM, password: randomPassword(), joined_date: toLocalDateString() }); setShowAdd(true); };

  const openEdit = (m: StaffMember) => {
    setEditingId(m.id);
    setForm({ full_name: m.full_name, email: m.email, phone: m.phone || '', role: m.role, schedule_type: m.schedule_type || 'full_time', joined_date: m.joined_date || toLocalDateString(), password: '' });
    setShowAdd(true);
    setOpenMenuId(null);
  };

  const saveStaff = async () => {
    if (!form.full_name.trim() || !form.email.trim()) { toast.error('Name and email are required'); return; }
    if (!editingId && form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/staff/${editingId}`, form);
        toast.success('Staff member updated');
      } else {
        await api.post('/staff', form);
        toast.success('Staff member added');
      }
      setShowAdd(false);
      fetchStaff();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save staff member';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const toggleActive = async (m: StaffMember) => {
    setOpenMenuId(null);
    const nextStatus = m.status === 'inactive' ? 'active' : 'inactive';
    if (nextStatus === 'inactive' && !confirmDelete(`Deactivate ${m.full_name}? They won't be able to log in until reactivated.`)) return;
    try {
      await api.put(`/staff/${m.id}`, { full_name: m.full_name, email: m.email, phone: m.phone, role: m.role, schedule_type: m.schedule_type, status: nextStatus });
      toast.success(nextStatus === 'inactive' ? `${m.full_name} deactivated` : `${m.full_name} reactivated`);
      fetchStaff();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update status';
      toast.error(msg);
    }
  };

  const submitResetPassword = async () => {
    if (!resetPwMember) return;
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setResettingPw(true);
    try {
      await api.put(`/staff/${resetPwMember.id}/reset-password`, { password: newPassword });
      toast.success(`Password reset for ${resetPwMember.full_name}`);
      setResetPwMember(null); setNewPassword('');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to reset password';
      toast.error(msg);
    } finally { setResettingPw(false); }
  };

  // Approving assigns the default 'waiter' role for now — an admin can
  // change it afterward from the main staff table like any other edit.
  // Rejecting just leaves the account permanently unable to log in; it
  // isn't deleted, so there's a record of the request having existed.
  const decideApproval = async (user: PendingUser, decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !confirmDelete(`Decline ${user.full_name}'s request? They will not be able to log in.`)) return;
    setDecidingId(user.id);
    try {
      const res = await api.put(`/staff/${user.id}/approval`, { approval_status: decision });
      toast.success(res.data.message || (decision === 'approved' ? 'Approved' : 'Declined'));
      fetchPending();
      if (decision === 'approved') fetchStaff();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update this request';
      toast.error(msg);
    } finally {
      setDecidingId(null);
    }
  };

  const totalForDistrib = roleDistrib.reduce((s, r) => s + r.count, 0);

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:overflow-hidden p-6">
        <PageHeader title="Staff" subtitle="Manage your team members, roles and permissions">
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Add Staff
          </button>
        </PageHeader>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total Staff', value: stats.total, Icon: Users, sub: 'Active team members', color: 'text-text-primary' },
            { label: 'Active Staff', value: stats.active, Icon: UserCheck, sub: 'Currently working', color: 'text-status-success' },
            { label: 'On Leave', value: stats.on_leave, Icon: UserMinus, sub: 'Not working today', color: 'text-status-warning' },
            { label: 'Roles', value: ROLES.length, Icon: Shield, sub: 'System roles', color: 'text-status-purple' },
            { label: 'Payroll', value: '—', Icon: Wallet, sub: 'Not tracked yet', color: 'text-text-muted' },
          ].map(s => (
            <div key={s.label} className="card p-3 flex items-start gap-2">
              <div className={`w-8 h-8 rounded-lg bg-surface-50 flex items-center justify-center shrink-0 ${s.color}`}><s.Icon size={16} /></div>
              <div className="min-w-0">
                <p className={`text-lg font-bold ${s.color} truncate`}>{s.value}</p>
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
              placeholder="Search by name, email or phone..." />
          </div>
          <select className="select text-xs py-1.5 w-36" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <select className="select text-xs py-1.5 w-32" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive</option>
          </select>
          <button onClick={fetchStaff} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><RefreshCw size={12} /> Refresh</button>
        </div>

        {/* Table */}
        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="overflow-auto flex-1">
            {loading ? <LoadingPage /> : (
              <table className="w-full">
                <thead className="bg-surface-50 sticky top-0">
                  <tr>
                    {['Staff Member','Role','Contact','Status','Schedule','Joined Date','Actions'].map(h => (
                      <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.map(member => (
                    <tr key={member.id} className="table-row">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center text-sm font-bold shrink-0">
                            {member.avatar_url
                              ? <img src={member.avatar_url} alt={member.full_name} className="w-full h-full rounded-full object-cover" />
                              : getInitials(member.full_name)
                            }
                          </div>
                          <div>
                            <p className="font-medium text-sm">{member.full_name}</p>
                            <p className="text-[11px] text-text-muted">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={`badge text-xs ${ROLE_BADGE[member.role] || 'badge-muted'}`}>
                          {ROLE_LABELS[member.role as Role] || member.role}
                        </span>
                      </td>
                      <td className="table-cell text-text-secondary text-xs">{member.phone || '—'}</td>
                      <td className="table-cell"><StatusBadge status={member.status} /></td>
                      <td className="table-cell text-xs capitalize text-text-secondary">
                        {member.schedule_type?.replace('_', ' ')}
                      </td>
                      <td className="table-cell text-text-muted text-xs">
                        {member.joined_date ? formatDate(member.joined_date) : '—'}
                      </td>
                      <td className="table-cell relative">
                        <button onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === member.id ? null : member.id); }} className="btn-ghost p-1">
                          <MoreVertical size={13} />
                        </button>
                        {openMenuId === member.id && (
                          <div ref={menuRef} className="absolute right-4 top-10 z-20 bg-surface-card border border-border rounded-xl shadow-modal py-1 w-44">
                            <button onClick={() => openEdit(member)} className="w-full text-left px-3 py-2 text-xs hover:bg-surface-50 flex items-center gap-2">
                              <Edit2 size={12} /> Edit
                            </button>
                            <button onClick={() => { setResetPwMember(member); setNewPassword(''); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-surface-50 flex items-center gap-2">
                              <KeyRound size={12} /> Reset Password
                            </button>
                            <button onClick={() => toggleActive(member)} className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-50 flex items-center gap-2 ${member.status === 'inactive' ? 'text-status-success' : 'text-status-error'}`}>
                              {member.status === 'inactive' ? <><UserCheck2 size={12} /> Reactivate</> : <><UserX size={12} /> Deactivate</>}
                            </button>
                          </div>
                        )}
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

      {/* Right sidebar */}
      <div className="w-full md:w-[260px] md:shrink-0 border-t md:border-t-0 md:border-l border-border bg-surface-card flex flex-col overflow-y-auto p-4 space-y-5 max-h-[60vh] md:max-h-none">
        {/* Staff Overview donut */}
        <div>
          <h2 className="section-title text-sm mb-3">Staff Overview</h2>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgb(var(--color-surface-100))" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10B981" strokeWidth="3"
                  strokeDasharray={`${stats.total ? (stats.active / stats.total) * 100 : 0} 100`} />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F59E0B" strokeWidth="3"
                  strokeDasharray={`${stats.total ? (stats.on_leave / stats.total) * 100 : 0} 100`}
                  strokeDashoffset={`-${stats.total ? (stats.active / stats.total) * 100 : 0}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-text-primary">{stats.total}</span>
                <span className="text-[9px] text-text-muted">Total</span>
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-status-success" /><span className="text-text-secondary">Active</span><span className="font-bold ml-auto">{stats.active} ({stats.total ? Math.round(stats.active / stats.total * 100) : 0}%)</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-status-warning" /><span className="text-text-secondary">On Leave</span><span className="font-bold ml-auto">{stats.on_leave} ({stats.total ? Math.round(stats.on_leave / stats.total * 100) : 0}%)</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-status-error" /><span className="text-text-secondary">Inactive</span><span className="font-bold ml-auto">{stats.inactive || 0}</span></div>
            </div>
          </div>
        </div>

        {/* Role Distribution */}
        <div>
          <h2 className="section-title text-sm mb-3">Role Distribution</h2>
          <div className="space-y-2">
            {ROLES.map(role => {
              const count = roleDistrib.find(r => r.role === role)?.count || 0;
              const pct = totalForDistrib ? Math.round(count / totalForDistrib * 100) : 0;
              return (
                <div key={role} className="flex items-center gap-2 text-xs">
                  <span className="text-text-secondary w-24 truncate">{ROLE_LABELS[role]}</span>
                  <div className="flex-1 h-1.5 bg-surface-50 rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-text-muted w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Approvals — self-service signups awaiting a decision */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title text-sm flex items-center gap-2">
              Pending Approvals
              {pendingUsers.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-status-warning/15 text-status-warning text-[10px] font-bold">{pendingUsers.length}</span>
              )}
            </h2>
          </div>
          {pendingUsers.length === 0 ? (
            <p className="text-xs text-text-muted">No signup requests waiting.</p>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map(u => (
                <div key={u.id} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-sm font-bold text-brand shrink-0">
                    {getInitials(u.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{u.full_name}</p>
                    <p className="text-[10px] text-text-muted truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => decideApproval(u, 'approved')}
                      disabled={decidingId === u.id}
                      className="w-6 h-6 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center hover:bg-status-success/20 disabled:opacity-40"
                      title="Approve"
                    ><Check size={13} /></button>
                    <button
                      onClick={() => decideApproval(u, 'rejected')}
                      disabled={decidingId === u.id}
                      className="w-6 h-6 rounded-lg bg-status-error/10 text-status-error flex items-center justify-center hover:bg-status-error/20 disabled:opacity-40"
                      title="Decline"
                    ><X size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="section-title text-sm mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={openAdd} className="btn-secondary flex flex-col items-center gap-1 py-3 text-xs">
              <UserPlus size={16} className="text-brand" />
              Add Staff
            </button>
            <button onClick={() => setShowRolesModal(true)} className="btn-secondary flex flex-col items-center gap-1 py-3 text-xs">
              <Shield size={16} className="text-status-purple" />
              Manage Roles
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Staff Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editingId ? 'Edit Staff Member' : 'Add Staff Member'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-text-muted mb-1">Full Name *</label>
              <input className="input" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Enter full name" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Email *</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@shawalsdei.com" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Phone</label>
              <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="07XX XXX XXX" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Role *</label>
              <select
                className="select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                disabled={editingId === currentUser?.id && currentUser?.role === 'administrator'}
                title={editingId === currentUser?.id ? "You can't change your own role" : undefined}
              >
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Schedule Type</label>
              <select className="select" value={form.schedule_type} onChange={e => setForm(p => ({ ...p, schedule_type: e.target.value }))}>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Joined Date</label>
              <input type="date" className="input" value={form.joined_date} onChange={e => setForm(p => ({ ...p, joined_date: e.target.value }))} />
            </div>
            {!editingId && (
              <div>
                <label className="block text-xs text-text-muted mb-1">Initial Password</label>
                <div className="flex gap-1.5">
                  <input className="input flex-1" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                  <button type="button" onClick={() => setForm(p => ({ ...p, password: randomPassword() }))} className="btn-secondary text-xs px-2" title="Generate a new random password">↻</button>
                </div>
                <p className="text-[10px] text-text-muted mt-1">Share this with them directly — it won't be shown again.</p>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={saveStaff} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Staff Member'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetPwMember} onClose={() => setResetPwMember(null)} title={`Reset Password — ${resetPwMember?.full_name}`}>
        <div className="space-y-4">
          <p className="text-xs text-text-muted">Sets a new password directly — different from the self-service "forgot password" email flow. Share the new password with them yourself.</p>
          <div>
            <label className="block text-xs text-text-muted mb-1">New Password</label>
            <div className="flex gap-1.5">
              <input className="input flex-1" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
              <button type="button" onClick={() => setNewPassword(randomPassword())} className="btn-secondary text-xs px-2" title="Generate a random password">↻</button>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setResetPwMember(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={submitResetPassword} disabled={resettingPw} className="btn-primary flex-1 disabled:opacity-50">
              {resettingPw ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Manage Roles — informational, not a configurable permissions
          matrix. Roles are fixed in code (each route's authorize() call),
          not database-driven, so an editable UI here would be fake. This
          shows what's actually true today. */}
      <Modal open={showRolesModal} onClose={() => setShowRolesModal(false)} title="Roles & Access" size="lg">
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            Roles are fixed in how the system is built today, not editable from this screen — this table shows what each role can actually access right now.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-50">
                <tr>
                  <th className="table-header px-3 py-2 text-left">Role</th>
                  {MATRIX_MODULES.map(m => <th key={m.key} className="table-header px-3 py-2 text-left">{m.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {ROLES.map(role => (
                  <tr key={role} className="table-row">
                    <td className="table-cell font-medium text-xs">{ROLE_LABELS[role] || role}</td>
                    {MATRIX_MODULES.map(m => (
                      <td key={m.key} className="table-cell text-xs">
                        <span className={ROLE_PERMISSIONS[role].includes(m.key) ? 'text-status-success' : 'text-text-muted'}>{ROLE_PERMISSIONS[role].includes(m.key) ? '✓' : '—'}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}