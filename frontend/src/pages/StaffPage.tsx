import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Search, Filter, RefreshCw, MoreVertical, UserPlus, Shield } from 'lucide-react';
import api from '@/lib/api';
import { formatDate, getInitials, toLocalDateString } from '@/lib/utils';
import { PageHeader, StatusBadge, Pagination, Modal, LoadingPage } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { ROLES, ROLE_LABELS } from '@shared/permissions';
import toast from 'react-hot-toast';

interface StaffMember {
  id: string; full_name: string; email: string; phone?: string;
  role: string; status: string; schedule_type: string;
  avatar_url?: string; joined_date?: string; last_login?: string;
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

const EMPTY_FORM = {
  full_name: '', email: '', phone: '', role: 'waiter',
  schedule_type: 'full_time', joined_date: toLocalDateString(), password: 'password123',
};

export default function StaffPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('staff.manage');

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
  const [showEdit, setShowEdit] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState({
    full_name: '', phone: '', role: 'waiter', status: 'active', schedule_type: 'full_time',
  });

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/staff', {
        params: {
          role: roleFilter || undefined,
          status: statusFilter || undefined,
          search: search || undefined,
          page, limit: 10,
        },
      });
      setStaff(data.data);
      setStats(data.stats);
      setPagination({ total: data.pagination.total, pages: data.pagination.pages });

      const counts: Record<string, number> = {};
      data.data.forEach((s: StaffMember) => { counts[s.role] = (counts[s.role] || 0) + 1; });
      setRoleDistrib(Object.entries(counts).map(([role, count]) => ({ role, count })));
    } catch {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, page]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);
  useEffect(() => { const t = setTimeout(fetchStaff, 400); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const createStaff = async () => {
    if (!form.full_name || !form.email) { toast.error('Name and email are required'); return; }
    try {
      await api.post('/staff', form);
      toast.success('Staff member added');
      setShowAdd(false);
      setForm({ ...EMPTY_FORM, joined_date: toLocalDateString() });
      fetchStaff();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add staff';
      toast.error(msg);
    }
  };

  const openEdit = (member: StaffMember) => {
    setEditingMember(member);
    setEditForm({
      full_name: member.full_name,
      phone: member.phone || '',
      role: member.role,
      status: member.status,
      schedule_type: member.schedule_type,
    });
    setShowEdit(true);
    setOpenMenuId(null);
  };

  const updateStaff = async () => {
    if (!editingMember) return;
    if (!editForm.full_name.trim()) { toast.error('Name is required'); return; }
    try {
      await api.put(`/staff/${editingMember.id}`, editForm);
      toast.success('Staff member updated');
      setShowEdit(false);
      setEditingMember(null);
      fetchStaff();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update staff';
      toast.error(msg);
    }
  };

  const toggleStatus = async (member: StaffMember) => {
    const newStatus = member.status === 'inactive' ? 'active' : 'inactive';
    const label = newStatus === 'inactive' ? 'deactivate' : 'activate';
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} ${member.full_name}?`)) return;
    try {
      await api.put(`/staff/${member.id}`, {
        full_name: member.full_name,
        phone: member.phone,
        role: member.role,
        status: newStatus,
        schedule_type: member.schedule_type,
      });
      toast.success(`Staff member ${newStatus === 'inactive' ? 'deactivated' : 'activated'}`);
      setOpenMenuId(null);
      fetchStaff();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update status';
      toast.error(msg);
    }
  };

  const totalForDistrib = roleDistrib.reduce((s, r) => s + r.count, 0);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <PageHeader title="Staff" subtitle="Manage your team members, roles and permissions">
          <button className="btn-secondary flex items-center gap-1.5 text-sm"><Download size={13} /> Export</button>
          {canManage && (
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Add Staff
            </button>
          )}
        </PageHeader>

        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Staff', value: stats.total, icon: '👥', sub: 'All team members', color: 'text-text-primary' },
            { label: 'Active Staff', value: stats.active, icon: '✅', sub: 'Currently working', color: 'text-status-success' },
            { label: 'On Leave', value: stats.on_leave, icon: '🏖️', sub: 'Not working today', color: 'text-status-warning' },
            { label: 'Roles', value: ROLES.length, icon: '🛡️', sub: 'System roles', color: 'text-status-purple' },
          ].map(s => (
            <div key={s.label} className="card p-3 flex items-start gap-2">
              <span className="text-xl">{s.icon}</span>
              <div className="min-w-0">
                <p className={`text-lg font-bold ${s.color} truncate`}>{s.value}</p>
                <p className="text-xs text-text-muted">{s.label}</p>
                <p className="text-[10px] text-text-muted">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

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
          <button className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><Filter size={12} /> Filters</button>
        </div>

        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="overflow-auto flex-1">
            {loading ? <LoadingPage /> : (
              <table className="w-full">
                <thead className="bg-surface-50 sticky top-0">
                  <tr>
                    {['Staff Member', 'Role', 'Contact', 'Status', 'Schedule', 'Joined Date', ...(canManage ? ['Actions'] : [])].map(h => (
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
                              : getInitials(member.full_name)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{member.full_name}</p>
                            <p className="text-[11px] text-text-muted">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={`badge text-xs ${ROLE_BADGE[member.role] || 'badge-muted'}`}>
                          {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role}
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
                      {canManage && (
                        <td className="table-cell relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                            className="btn-ghost p-1"
                          >
                            <MoreVertical size={13} />
                          </button>
                          {openMenuId === member.id && (
                            <div ref={menuRef} className="absolute right-4 top-8 z-20 bg-surface-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                              <button onClick={() => openEdit(member)} className="w-full text-left px-3 py-2 text-xs hover:bg-surface-50">Edit</button>
                              <button
                                onClick={() => toggleStatus(member)}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-50 ${member.status === 'inactive' ? 'text-status-success' : 'text-status-error'}`}
                              >
                                {member.status === 'inactive' ? 'Activate' : 'Deactivate'}
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Pagination page={page} pages={pagination.pages} total={pagination.total} limit={10} onChange={setPage} />
        </div>
      </div>

      <div className="w-[260px] shrink-0 border-l border-border bg-surface-card flex flex-col overflow-y-auto p-4 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title text-sm">Staff Overview</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1E1E1E" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10B981" strokeWidth="3"
                  strokeDasharray={`${stats.total ? (stats.active / stats.total) * 100 : 88} 100`} />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F59E0B" strokeWidth="3"
                  strokeDasharray={`${stats.total ? (stats.on_leave / stats.total) * 100 : 11} 100`}
                  strokeDashoffset={`-${stats.total ? (stats.active / stats.total) * 100 : 88}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-text-primary">{stats.total}</span>
                <span className="text-[9px] text-text-muted">Total</span>
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-status-success" /><span className="text-text-secondary">Active</span><span className="font-bold ml-auto">{stats.active}</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-status-warning" /><span className="text-text-secondary">On Leave</span><span className="font-bold ml-auto">{stats.on_leave}</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-status-error" /><span className="text-text-secondary">Inactive</span><span className="font-bold ml-auto">{stats.inactive || 0}</span></div>
            </div>
          </div>
        </div>

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

        {canManage && (
          <div>
            <h2 className="section-title text-sm mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowAdd(true)} className="btn-secondary flex flex-col items-center gap-1 py-3 text-xs">
                <UserPlus size={16} className="text-brand" />
                Add Staff
              </button>
              <button onClick={() => navigate('/settings')} className="btn-secondary flex flex-col items-center gap-1 py-3 text-xs">
                <Shield size={16} className="text-status-purple" />
                View Roles
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Staff Member" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
              <select className="select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
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
            <div>
              <label className="block text-xs text-text-muted mb-1">Initial Password</label>
              <input type="password" className="input" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={createStaff} className="btn-primary flex-1">Add Staff Member</button>
          </div>
        </div>
      </Modal>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Staff Member" size="md">
        <div className="space-y-4">
          {editingMember && (
            <p className="text-xs text-text-muted">Email: {editingMember.email}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-text-muted mb-1">Full Name *</label>
              <input className="input" value={editForm.full_name} onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Phone</label>
              <input className="input" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Role</label>
              <select className="select" value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Status</label>
              <select className="select" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Schedule Type</label>
              <select className="select" value={editForm.schedule_type} onChange={e => setEditForm(p => ({ ...p, schedule_type: e.target.value }))}>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowEdit(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={updateStaff} className="btn-primary flex-1">Save Changes</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
