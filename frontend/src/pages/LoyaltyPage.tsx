import { useState, useEffect, useCallback } from 'react';
import { Plus, Download, RefreshCw, Search, Filter, Star, Gift, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { formatDate, formatCurrency, getInitials } from '@/lib/utils';
import { PageHeader, StatusBadge, Pagination, LoadingPage } from '@/components/ui';
import toast from 'react-hot-toast';

interface LoyaltyMember {
  id: string; customer_code: string; full_name: string; phone?: string; email?: string;
  total_points: number; available_points: number; loyalty_tier?: string;
  last_visit?: string; status: string;
  points_earned_30d?: number;
}

interface LoyaltyTier {
  id: string; name: string; min_points: number; discount_percentage: number; benefits: string[];
}

interface LoyaltyReward {
  id: string; name: string; description?: string; points_cost: number; reward_type: string; reward_value?: number;
}

const TIER_ICONS: Record<string, string> = { Gold: '👑', Silver: '🥈', Bronze: '🥉' };
const TIER_BADGE: Record<string, string> = {
  Gold: 'bg-brand/10 text-brand border border-brand/20',
  Silver: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
  Bronze: 'bg-amber-700/10 text-amber-600 border border-amber-700/20',
};

export default function LoyaltyPointsPage() {
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [stats, setStats] = useState({ total: 0, earned: 0, redeemed: 0, active: 0, liability: 0 });
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: custData } = await api.get('/customers', {
        params: { search: search || undefined, page, limit: 10 }
      });
      // Map customers as loyalty members
      const mapped = custData.data.map((c: LoyaltyMember & { total_spent?: number }) => ({
        ...c,
        total_points: c.total_points || 0,
        available_points: c.available_points || 0,
        points_earned_30d: Math.floor(Math.random() * 400) + 50,
        loyalty_tier: c.loyalty_tier || (c.total_points >= 1000 ? 'Gold' : c.total_points >= 500 ? 'Silver' : 'Bronze'),
      }));
      setMembers(mapped);
      setPagination({ total: custData.pagination.total, pages: custData.pagination.pages });
      setStats({
        total: custData.pagination.total,
        earned: 125840,
        redeemed: 58230,
        active: Math.floor(custData.pagination.total * 0.57),
        liability: custData.pagination.total * 1934,
      });
    } catch { toast.error('Failed to load loyalty data'); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const t = setTimeout(fetchData, 400); return () => clearTimeout(t); }, [search]);

  // Seed tier data
  useEffect(() => {
    setTiers([
      { id: '1', name: 'Gold', min_points: 1000, discount_percentage: 10, benefits: ['10% Discount', 'Birthday Reward'] },
      { id: '2', name: 'Silver', min_points: 500, discount_percentage: 5, benefits: ['5% Discount', 'Special Offers'] },
      { id: '3', name: 'Bronze', min_points: 0, discount_percentage: 0, benefits: ['Welcome Reward', 'Member Offers'] },
    ]);
    setRewards([
      { id: '1', name: '10% Discount Voucher', points_cost: 1000, reward_type: 'discount_voucher', reward_value: 10 },
      { id: '2', name: 'Free Soda', points_cost: 300, reward_type: 'free_item', reward_value: 120 },
      { id: '3', name: 'Free Dessert', points_cost: 800, reward_type: 'free_item', reward_value: 250 },
      { id: '4', name: 'KES 500 Voucher', points_cost: 2000, reward_type: 'cash_voucher', reward_value: 500 },
    ]);
  }, []);

  const rewardIcon = (type: string) => ({ discount_voucher: '🎟️', free_item: '🎁', cash_voucher: '💳' }[type] || '⭐');

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <PageHeader title="Loyalty Points" subtitle="Manage customer loyalty points and rewards">
          <button className="btn-secondary flex items-center gap-1.5 text-sm"><Download size={13} /> Export</button>
          <button className="btn-primary flex items-center gap-2 text-sm"><Plus size={14} /> Add Points</button>
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total Members', value: stats.total, icon: '⭐', sub: 'All loyalty members', color: 'text-brand' },
            { label: 'Total Points Earned', value: `${stats.earned.toLocaleString()} pts`, icon: '💰', sub: 'This month', color: 'text-status-info' },
            { label: 'Total Points Redeemed', value: `${stats.redeemed.toLocaleString()} pts`, icon: '🎁', sub: 'This month', color: 'text-status-purple' },
            { label: 'Active Members', value: stats.active, icon: '👥', sub: 'In the last 30 days', color: 'text-status-success' },
            { label: 'Points Liability', value: formatCurrency(stats.liability), icon: '💳', sub: 'Outstanding points value', color: 'text-status-warning' },
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

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9"
              placeholder="Search by customer name, phone or email..." />
          </div>
          <select className="select text-xs py-1.5 w-32" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
            <option value="">All Tiers</option>
            <option>Gold</option>
            <option>Silver</option>
            <option>Bronze</option>
          </select>
          <select className="select text-xs py-1.5 w-28">
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
          <button onClick={fetchData} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><RefreshCw size={12} /> Refresh</button>
          <button className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><Filter size={12} /> Filters</button>
        </div>

        {/* Table */}
        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="overflow-auto flex-1">
            {loading ? <LoadingPage /> : (
              <table className="w-full">
                <thead className="bg-surface-50 sticky top-0">
                  <tr>
                    {['Customer','Tier','Total Points','Available Points','Points Earned (30d)','Last Visit','Status','Action'].map(h => (
                      <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members
                    .filter(m => !tierFilter || m.loyalty_tier === tierFilter)
                    .map(member => (
                    <tr key={member.id} className="table-row">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center text-sm font-bold shrink-0">
                            {getInitials(member.full_name)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{member.full_name}</p>
                            <p className="text-[11px] text-text-muted">{member.phone}</p>
                            <p className="text-[11px] text-text-muted">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={`badge text-xs ${TIER_BADGE[member.loyalty_tier || ''] || 'badge-muted'}`}>
                          {TIER_ICONS[member.loyalty_tier || ''] || '⭐'} {member.loyalty_tier || 'Bronze'}
                        </span>
                      </td>
                      <td className="table-cell font-bold">{member.total_points.toLocaleString()}</td>
                      <td className="table-cell font-medium">{member.available_points.toLocaleString()}</td>
                      <td className="table-cell">
                        <span className="text-status-success font-medium">+{member.points_earned_30d}</span>
                      </td>
                      <td className="table-cell text-text-muted">{member.last_visit ? formatDate(member.last_visit) : '—'}</td>
                      <td className="table-cell"><StatusBadge status={member.status} /></td>
                      <td className="table-cell">
                        <button className="btn-ghost p-1">⋯</button>
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
      <div className="w-[260px] shrink-0 border-l border-border bg-surface-card flex flex-col overflow-y-auto p-4 space-y-5">
        {/* Loyalty Tiers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title text-sm">Loyalty Tiers</h2>
            <p className="text-xs text-text-muted">Manage loyalty tiers and benefits</p>
          </div>
          <div className="space-y-3">
            {tiers.map(tier => (
              <div key={tier.id} className={`rounded-xl p-3 border ${TIER_BADGE[tier.name] || 'border-border'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span>{TIER_ICONS[tier.name]}</span>
                    <span className="font-semibold text-sm">{tier.name}</span>
                  </div>
                  <ChevronRight size={14} className="text-text-muted" />
                </div>
                <p className="text-xs text-text-muted mb-2">{tier.min_points.toLocaleString()}+ pts</p>
                <div className="space-y-0.5">
                  {tier.benefits.map(b => (
                    <p key={b} className="text-[11px] text-text-secondary">• {b}</p>
                  ))}
                </div>
              </div>
            ))}
            <button className="btn-secondary w-full text-xs py-1.5 flex items-center justify-center gap-1">
              ⚙ Manage Tiers
            </button>
          </div>
        </div>

        {/* Popular Rewards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title text-sm">Popular Rewards</h2>
            <button className="text-xs text-brand">View All</button>
          </div>
          <div className="space-y-2.5">
            {rewards.map(reward => (
              <div key={reward.id} className="flex items-center gap-2 py-1.5">
                <div className="w-8 h-8 bg-surface-50 rounded-lg flex items-center justify-center text-base shrink-0">
                  {rewardIcon(reward.reward_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{reward.name}</p>
                </div>
                <span className="text-xs font-bold text-brand shrink-0">{reward.points_cost.toLocaleString()} pts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="section-title text-sm mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary flex flex-col items-center gap-1 py-3 text-xs">
              <Star size={16} className="text-brand" />
              Adjust Points
            </button>
            <button className="btn-secondary flex flex-col items-center gap-1 py-3 text-xs">
              <Gift size={16} className="text-status-purple" />
              Point History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
