import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, Star, Wallet, Settings2 } from 'lucide-react';
import api from '@/lib/api';
import { formatDate, formatCurrency, getInitials } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { PageHeader, StatusBadge, Pagination, Modal, LoadingPage } from '@/components/ui';
import toast from 'react-hot-toast';

interface LoyaltyMember {
  id: string; customer_code: string; full_name: string; phone?: string; email?: string;
  total_points: number; available_points: number; redeemed_points?: number; loyalty_tier?: string;
  last_visit?: string; status: string; points_earned_30d?: number;
}

interface LoyaltyTier {
  id: string; name: string; min_points: number; discount_percentage: number; benefits: string[];
}

const TIER_ICONS: Record<string, string> = { Gold: '👑', Silver: '🥈', Bronze: '🥉' };
const TIER_BADGE: Record<string, string> = {
  Gold: 'bg-brand/10 text-brand border border-brand/20',
  Silver: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
  Bronze: 'bg-amber-700/10 text-amber-600 border border-amber-700/20',
};

export default function LoyaltyPointsPage() {
  const { user } = useAuthStore();
  const canManage = user?.role === 'administrator' || user?.role === 'manager';

  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [stats, setStats] = useState({ total_members: 0, total_earned: 0, total_redeemed: 0, active_members_30d: 0, points_liability_kes: 0, point_value_kes: 1 });
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  const [actionMember, setActionMember] = useState<LoyaltyMember | null>(null);
  const [actionType, setActionType] = useState<'redeem' | 'adjust' | null>(null);
  const [actionPoints, setActionPoints] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  const [showPointValueModal, setShowPointValueModal] = useState(false);
  const [pointValueInput, setPointValueInput] = useState('1');
  const [savingPointValue, setSavingPointValue] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/loyalty/stats');
      setStats(data.data);
      setPointValueInput(String(data.data.point_value_kes));
    } catch { /* non-critical for the main table */ }
  }, []);

  const fetchTiers = useCallback(async () => {
    try {
      const { data } = await api.get('/loyalty/tiers');
      setTiers(data.data);
    } catch { /* non-critical */ }
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/customers', {
        params: { search: search || undefined, tier: tierFilter || undefined, status: statusFilter || undefined, page, limit: 10 }
      });
      setMembers(data.data);
      setPagination({ total: data.pagination.total, pages: data.pagination.pages });
    } catch { toast.error('Failed to load loyalty data'); }
    finally { setLoading(false); }
  }, [search, tierFilter, statusFilter, page]);

  useEffect(() => { fetchStats(); fetchTiers(); }, [fetchStats, fetchTiers]);
  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  useEffect(() => { const t = setTimeout(fetchMembers, 400); return () => clearTimeout(t); }, [search]);

  const refreshAll = () => { fetchStats(); fetchTiers(); fetchMembers(); };

  const openAction = (member: LoyaltyMember, type: 'redeem' | 'adjust') => {
    setActionMember(member); setActionType(type); setActionPoints(''); setActionReason('');
  };

  const submitAction = async () => {
    if (!actionMember || !actionType) return;
    const points = parseInt(actionPoints);
    if (!Number.isFinite(points) || points === 0) { toast.error('Enter a valid number of points'); return; }
    if (actionType === 'redeem' && points <= 0) { toast.error('Enter a positive number of points to redeem'); return; }
    if (actionType === 'adjust' && !actionReason.trim()) { toast.error('A reason is required for manual adjustments'); return; }

    setProcessingAction(true);
    try {
      if (actionType === 'redeem') {
        await api.post(`/customers/${actionMember.id}/redeem-points`, { points, description: actionReason || undefined });
        toast.success(`${points} points redeemed (${formatCurrency(points * stats.point_value_kes)})`);
      } else {
        await api.post(`/customers/${actionMember.id}/adjust-points`, { points, description: actionReason });
        toast.success(`Adjusted by ${points > 0 ? '+' : ''}${points} points`);
      }
      setActionMember(null); setActionType(null);
      refreshAll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Action failed';
      toast.error(msg);
    } finally { setProcessingAction(false); }
  };

  const savePointValue = async () => {
    const value = parseFloat(pointValueInput);
    if (!Number.isFinite(value) || value <= 0) { toast.error('Enter a valid positive amount'); return; }
    setSavingPointValue(true);
    try {
      await api.put('/loyalty/point-value', { point_value_kes: value });
      toast.success('Point value updated');
      setShowPointValueModal(false);
      fetchStats();
    } catch { toast.error('Failed to update point value'); }
    finally { setSavingPointValue(false); }
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <PageHeader title="Loyalty Points" subtitle="Manage customer loyalty points — points convert directly to a KES value, redeemable like cash">
          <button onClick={refreshAll} className="btn-secondary flex items-center gap-1.5 text-sm"><RefreshCw size={13} /> Refresh</button>
        </PageHeader>

        {/* Stats — every number here is real now. This used to include a
            hardcoded "125,840 pts earned this month" and "Points Liability"
            computed as total customers × 1934 — a formula with no actual
            relationship to anything. */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total Members', value: stats.total_members, icon: '⭐', sub: 'Active loyalty members' },
            { label: 'Total Points Earned', value: `${stats.total_earned.toLocaleString()} pts`, icon: '💰', sub: 'All-time' },
            { label: 'Total Points Redeemed', value: `${stats.total_redeemed.toLocaleString()} pts`, icon: '🎁', sub: 'All-time' },
            { label: 'Active Members', value: stats.active_members_30d, icon: '👥', sub: 'Ordered in last 30 days' },
            { label: 'Points Liability', value: formatCurrency(stats.points_liability_kes), icon: '💳', sub: `Outstanding value @ KES ${stats.point_value_kes}/pt` },
          ].map(s => (
            <div key={s.label} className="card p-3 flex items-start gap-2">
              <span className="text-xl">{s.icon}</span>
              <div>
                <p className="text-lg font-bold text-text-primary">{s.value}</p>
                <p className="text-xs text-text-muted">{s.label}</p>
                <p className="text-[10px] text-text-muted">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters — tier and status now genuinely filter server-side across
            ALL members, not just whatever happened to be on the current
            page of 10. */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9"
              placeholder="Search by customer name, phone or email..." />
          </div>
          <select className="select text-xs py-1.5 w-32" value={tierFilter} onChange={e => { setTierFilter(e.target.value); setPage(1); }}>
            <option value="">All Tiers</option>
            {tiers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
          <select className="select text-xs py-1.5 w-28" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Table */}
        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="overflow-auto flex-1">
            {loading ? <LoadingPage /> : (
              <table className="w-full">
                <thead className="bg-surface-50 sticky top-0">
                  <tr>
                    {['Customer','Tier','Total Points','Available','Value (KES)','Earned (30d)','Last Visit','Status','Actions'].map(h => (
                      <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => (
                    <tr key={member.id} className="table-row">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center text-sm font-bold shrink-0">
                            {getInitials(member.full_name)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{member.full_name}</p>
                            <p className="text-[11px] text-text-muted">{member.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={`badge text-xs ${TIER_BADGE[member.loyalty_tier || ''] || 'badge-muted'}`}>
                          {TIER_ICONS[member.loyalty_tier || ''] || '⭐'} {member.loyalty_tier || 'Bronze'}
                        </span>
                      </td>
                      <td className="table-cell font-bold">{(member.total_points || 0).toLocaleString()}</td>
                      <td className="table-cell font-medium">{(member.available_points || 0).toLocaleString()}</td>
                      <td className="table-cell font-medium text-brand">{formatCurrency((member.available_points || 0) * stats.point_value_kes)}</td>
                      <td className="table-cell">
                        <span className="text-status-success font-medium">+{member.points_earned_30d || 0}</span>
                      </td>
                      <td className="table-cell text-text-muted">{member.last_visit ? formatDate(member.last_visit) : '—'}</td>
                      <td className="table-cell"><StatusBadge status={member.status} /></td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          <button onClick={() => openAction(member, 'redeem')} disabled={!member.available_points}
                            className="btn-ghost text-[11px] px-2 py-1 disabled:opacity-30 disabled:cursor-not-allowed">Redeem</button>
                          {canManage && (
                            <button onClick={() => openAction(member, 'adjust')} className="btn-ghost text-[11px] px-2 py-1">Adjust</button>
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

      {/* Right sidebar */}
      <div className="w-full md:w-[260px] md:shrink-0 border-t md:border-t-0 md:border-l border-border bg-surface-card flex flex-col overflow-y-auto p-4 space-y-5 max-h-[60vh] md:max-h-none">
        {/* Loyalty Tiers — pulled from the real loyalty_tiers table now.
            (The discount % benefits listed are informational only — order
            pricing doesn't apply any automatic discount, tier or otherwise.) */}
        <div>
          <h2 className="section-title text-sm mb-3">Loyalty Tiers</h2>
          <div className="space-y-3">
            {tiers.map(tier => (
              <div key={tier.id} className={`rounded-xl p-3 border ${TIER_BADGE[tier.name] || 'border-border'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span>{TIER_ICONS[tier.name]}</span>
                  <span className="font-semibold text-sm">{tier.name}</span>
                </div>
                <p className="text-xs text-text-muted mb-2">{tier.min_points.toLocaleString()}+ pts</p>
                {tier.benefits?.length > 0 && (
                  <div className="space-y-0.5">
                    {tier.benefits.map(b => <p key={b} className="text-[11px] text-text-secondary">• {b}</p>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Points value — this is what "convert to money" actually means:
            a real, configurable KES-per-point rate, shown everywhere points
            appear as a value rather than a fixed catalog of named rewards. */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="section-title text-sm">Point Value</h2>
            {canManage && (
              <button onClick={() => { setPointValueInput(String(stats.point_value_kes)); setShowPointValueModal(true); }} className="btn-ghost p-1">
                <Settings2 size={13} />
              </button>
            )}
          </div>
          <p className="text-lg font-bold text-brand">KES {stats.point_value_kes} <span className="text-xs text-text-muted font-normal">/ point</span></p>
          <p className="text-[11px] text-text-muted mt-1">e.g. 100 points = {formatCurrency(100 * stats.point_value_kes)} when redeemed.</p>
        </div>

        {canManage && (
          <div>
            <h2 className="section-title text-sm mb-3">Quick Actions</h2>
            <button onClick={() => toast('Search for the customer in the table and use Redeem or Adjust on their row.', { icon: 'ℹ️' })}
              className="btn-secondary w-full flex flex-col items-center gap-1 py-3 text-xs">
              <Star size={16} className="text-brand" />
              Redeem or Adjust Points
            </button>
          </div>
        )}
      </div>

      {/* Redeem / Adjust Modal */}
      <Modal open={!!actionMember} onClose={() => { setActionMember(null); setActionType(null); }}
        title={actionType === 'redeem' ? `Redeem Points — ${actionMember?.full_name}` : `Adjust Points — ${actionMember?.full_name}`}>
        <div className="space-y-4">
          {actionType === 'redeem' && (
            <p className="text-xs text-text-muted">
              Available: <strong className="text-text-primary">{actionMember?.available_points || 0} points</strong> (worth {formatCurrency((actionMember?.available_points || 0) * stats.point_value_kes)})
            </p>
          )}
          <div>
            <label className="block text-xs text-text-muted mb-1">
              {actionType === 'redeem' ? 'Points to redeem' : 'Points to add or remove (use a negative number to remove)'}
            </label>
            <input type="number" className="input" value={actionPoints} onChange={e => setActionPoints(e.target.value)}
              placeholder={actionType === 'redeem' ? 'e.g. 100' : 'e.g. 50 or -20'} />
            {actionType === 'redeem' && actionPoints && Number(actionPoints) > 0 && (
              <p className="text-[11px] text-brand mt-1">= {formatCurrency(Number(actionPoints) * stats.point_value_kes)}</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">{actionType === 'adjust' ? 'Reason *' : 'Note (optional)'}</label>
            <input className="input" value={actionReason} onChange={e => setActionReason(e.target.value)}
              placeholder={actionType === 'adjust' ? 'e.g. Goodwill gesture for delayed order' : 'e.g. Redeemed at counter'} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setActionMember(null); setActionType(null); }} className="btn-secondary flex-1">Cancel</button>
            <button onClick={submitAction} disabled={processingAction} className="btn-primary flex-1 disabled:opacity-50">
              {processingAction ? 'Processing…' : actionType === 'redeem' ? 'Redeem' : 'Apply Adjustment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Point Value Settings Modal */}
      <Modal open={showPointValueModal} onClose={() => setShowPointValueModal(false)} title="Point Value">
        <div className="space-y-4">
          <p className="text-xs text-text-muted">The KES value of a single loyalty point when redeemed — applies everywhere points are shown as a value.</p>
          <div>
            <label className="block text-xs text-text-muted mb-1">KES per point</label>
            <div className="relative">
              <Wallet size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="number" step="0.01" min="0.01" className="input pl-9" value={pointValueInput} onChange={e => setPointValueInput(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowPointValueModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={savePointValue} disabled={savingPointValue} className="btn-primary flex-1 disabled:opacity-50">
              {savingPointValue ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}