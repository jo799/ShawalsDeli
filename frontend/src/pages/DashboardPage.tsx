import { useState, useEffect } from 'react';
import {
  ShoppingCart, ClipboardList, Users, TrendingUp,
  Package, AlertTriangle, ArrowUpRight, ArrowDownRight,
  DollarSign, ChefHat, Star
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import api from '@/lib/api';
import { formatCurrency, formatTime, toLocalDateString } from '@/lib/utils';
import { StatusBadge } from '@/components/ui';

const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444'];

const CustomTooltip = ({ active, payload, label }: {active?:boolean; payload?: Array<{value:number;name:string;color:string}>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-card border border-border rounded-lg p-2 text-xs shadow-modal">
      {label && <p className="text-text-muted mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.name.toLowerCase().includes('sales') || p.name.toLowerCase().includes('revenue') ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

interface DashStats {
  today_sales: number;
  today_orders: number;
  active_customers: number;
  low_stock_items: number;
  pending_orders: number;
  avg_order_value: number;
}

interface RecentOrder {
  id: string; order_number: string; type: string; status: string;
  customer_name?: string; customer_full_name?: string; total: number; created_at: string;
  table_number?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashStats>({ today_sales: 0, today_orders: 0, active_customers: 0, low_stock_items: 0, pending_orders: 0, avg_order_value: 0 });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [salesData, setSalesData] = useState<Array<{hour: string; Sales: number; Orders: number}>>([]);
  const [categoryData, setCategoryData] = useState<Array<{name: string; value: number}>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = toLocalDateString();
        const [reportRes, ordersRes, inventoryRes, customersRes] = await Promise.all([
          api.get('/reports/daily', { params: { date: today } }).catch(() => ({ data: { data: null } })),
          api.get('/orders', { params: { limit: 6 } }).catch(() => ({ data: { data: [] } })),
          api.get('/inventory').catch(() => ({ data: { stats: { low_stock: 0 } } })),
          api.get('/customers', { params: { limit: 1, status: 'active' } }).catch(() => ({ data: { pagination: { total: 0 } } })),
        ]);

        const rep = reportRes.data.data;
        if (rep) {
          setStats({
            today_sales: rep.summary?.total_sales || 0,
            today_orders: rep.summary?.total_orders || 0,
            active_customers: customersRes.data.pagination?.total || 0,
            low_stock_items: inventoryRes.data.stats?.low_stock || 0,
            pending_orders: ordersRes.data.data?.filter((o: RecentOrder) => ['new','preparing'].includes(o.status)).length || 0,
            avg_order_value: rep.summary?.avg_order_value || 0,
          });
          const hourly = rep.hourly?.map((h: {hour:number;sales:number;orders:number}) => ({
            hour: `${String(h.hour).padStart(2,'0')}:00`,
            Sales: h.sales,
            Orders: h.orders,
          })) || [];
          setSalesData(hourly);
          const cats = rep.by_category?.map((c: {category:string;sales:number}) => ({ name: c.category, value: c.sales })) || [];
          setCategoryData(cats);
        }

        setRecentOrders(ordersRes.data.data?.slice(0,6) || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const kpis = [
    { label: "Today's Sales", value: formatCurrency(stats.today_sales), icon: DollarSign, iconBg: 'bg-brand/10', iconColor: 'text-brand', trend: +18, trendLabel: 'vs yesterday', positive: true },
    { label: "Today's Orders", value: stats.today_orders, icon: ClipboardList, iconBg: 'bg-status-info/10', iconColor: 'text-status-info', trend: +12, trendLabel: 'vs yesterday', positive: true },
    { label: 'Active Customers', value: stats.active_customers, icon: Users, iconBg: 'bg-status-success/10', iconColor: 'text-status-success', trend: +5, trendLabel: 'this month', positive: true },
    { label: 'Avg Order Value', value: formatCurrency(stats.avg_order_value), icon: TrendingUp, iconBg: 'bg-status-purple/10', iconColor: 'text-status-purple', trend: +8, trendLabel: 'vs yesterday', positive: true },
    { label: 'Pending Orders', value: stats.pending_orders, icon: ChefHat, iconBg: 'bg-status-warning/10', iconColor: 'text-status-warning', trend: 0, trendLabel: 'right now', positive: true },
    { label: 'Low Stock Items', value: stats.low_stock_items, icon: AlertTriangle, iconBg: 'bg-status-error/10', iconColor: 'text-status-error', trend: stats.low_stock_items, trendLabel: 'need restocking', positive: false },
  ];

  const quickActions = [
    { label: 'New Order', icon: ShoppingCart, color: 'bg-brand text-black', to: '/pos' },
    { label: 'View Orders', icon: ClipboardList, color: 'bg-surface-50 text-text-primary', to: '/orders' },
    { label: 'Add Customer', icon: Users, color: 'bg-surface-50 text-text-primary', to: '/customers' },
    { label: 'Inventory', icon: Package, color: 'bg-surface-50 text-text-primary', to: '/inventory' },
    { label: 'Reports', icon: TrendingUp, color: 'bg-surface-50 text-text-primary', to: '/reports' },
    { label: 'Loyalty', icon: Star, color: 'bg-surface-50 text-text-primary', to: '/loyalty' },
  ];

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-status-success bg-status-success/10 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
            System Online
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {kpis.map(kpi => (
          <div key={kpi.label} className="card p-4">
            <div className={`w-10 h-10 rounded-xl ${kpi.iconBg} flex items-center justify-center mb-3`}>
              <kpi.icon size={18} className={kpi.iconColor} />
            </div>
            <p className="text-2xl font-bold text-text-primary">{loading ? '—' : kpi.value}</p>
            <p className="text-xs text-text-muted mt-0.5">{kpi.label}</p>
            {kpi.trend !== 0 && (
              <p className={`text-xs mt-1 flex items-center gap-0.5 ${kpi.positive ? 'text-status-success' : 'text-status-error'}`}>
                {kpi.positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {kpi.trend > 0 ? `+${kpi.trend}%` : kpi.trend} {kpi.trendLabel}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Sales Trend */}
        <div className="card p-4 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-text-primary">Sales Trend Today</h2>
            <select className="select text-xs py-1 w-24">
              <option>Today</option>
              <option>This Week</option>
            </select>
          </div>
          {salesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Sales" stroke="#F59E0B" strokeWidth={2} fill="url(#salesGrad)" name="Sales" />
                <Area type="monotone" dataKey="Orders" stroke="#10B981" strokeWidth={2} fill="none" name="Orders" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-text-muted text-sm">No sales data yet today</p>
            </div>
          )}
        </div>

        {/* Sales by Category */}
        <div className="card p-4">
          <h2 className="font-semibold text-text-primary mb-3">Sales by Category</h2>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v:number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {categoryData.slice(0, 4).map((cat, i) => {
                  const total = categoryData.reduce((s, c) => s + c.value, 0);
                  return (
                    <div key={cat.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-text-secondary">{cat.name}</span>
                      </div>
                      <span className="text-text-muted">{total ? Math.round(cat.value / total * 100) : 0}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-text-muted text-sm">No data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Recent Orders */}
        <div className="card col-span-2">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="font-semibold text-text-primary">Recent Orders</h2>
            <a href="/orders" className="text-xs text-brand hover:text-brand-400">View All →</a>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-surface-50">
                <tr>
                  {['Order','Type','Customer','Status','Amount','Time'].map(h => (
                    <th key={h} className="table-header px-4 py-2.5 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-text-muted text-sm">Loading...</td></tr>
                ) : recentOrders.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-text-muted text-sm">No orders today</td></tr>
                ) : recentOrders.map(order => (
                  <tr key={order.id} className="table-row">
                    <td className="table-cell text-brand font-medium">#{order.order_number}</td>
                    <td className="table-cell text-xs capitalize">{order.type?.replace('_',' ')}</td>
                    <td className="table-cell">{order.customer_full_name || order.customer_name || 'Walk-in'}</td>
                    <td className="table-cell"><StatusBadge status={order.status} /></td>
                    <td className="table-cell font-medium">{formatCurrency(order.total)}</td>
                    <td className="table-cell text-text-muted">{formatTime(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions + Stats */}
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="font-semibold text-text-primary mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map(action => (
                <a key={action.label} href={action.to}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg text-xs font-medium transition-all hover:scale-105 ${action.color}`}>
                  <action.icon size={18} />
                  {action.label}
                </a>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h2 className="font-semibold text-text-primary mb-3">Business Summary</h2>
            <div className="space-y-2.5">
              {[
                { label: 'Total Sales', value: formatCurrency(stats.today_sales), color: 'text-brand' },
                { label: 'Net Revenue', value: formatCurrency(stats.today_sales * 0.84), color: 'text-status-success' },
                { label: 'Gross Profit (41%)', value: formatCurrency(stats.today_sales * 0.41), color: 'text-status-success' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-xs text-text-muted">{row.label}</span>
                  <span className={`text-xs font-bold ${row.color}`}>{loading ? '—' : row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}