import { useState, useEffect } from 'react';
import {
  ShoppingCart, ClipboardList, Users, TrendingUp,
  Package, AlertTriangle, ArrowUpRight, ArrowDownRight,
  DollarSign, ChefHat, Star, Ban, Download, Loader2, ChevronDown
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import api from '@/lib/api';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { formatCurrency, formatTime, toLocalDateString } from '@/lib/utils';
import { StatusBadge } from '@/components/ui';
import toast from 'react-hot-toast';

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
  unavailable_menu_items: number;
  pending_orders: number;
  avg_order_value: number;
  gross_profit: number;
  total_expenses: number;
  net_profit: number;
  total_sales_change_pct: number | null;
  total_orders_change_pct: number | null;
  avg_order_value_change_pct: number | null;
  new_customers_change_pct: number | null;
  // The 10 owner KPIs — what the health of the whole business looks like
  // at a glance. cash_position/inventory_value/purchases_this_month/
  // expenses_this_month/food_cost_pct/waste_cost_this_month/
  // top_profitable_item all come from the dedicated /reports/owner-dashboard
  // endpoint; the rest above are already computed for other parts of this
  // page and simply reused here rather than fetched twice.
  cash_position: number;
  inventory_value: number;
  purchases_this_month: number;
  expenses: number;
  expenses_period_label: string;
  food_cost_pct: number;
  waste_cost_this_month: number;
  top_profitable_item: { name: string; profit: number; sales: number } | null;
}

interface RecentOrder {
  id: string; order_number: string; type: string; status: string;
  customer_name?: string; customer_full_name?: string; total: number; created_at: string;
  table_number?: string;
}

export default function DashboardPage() {
  const isOnline = useOnlineStatus();
  const [stats, setStats] = useState<DashStats>({ today_sales: 0, today_orders: 0, active_customers: 0, low_stock_items: 0, unavailable_menu_items: 0, pending_orders: 0, avg_order_value: 0, gross_profit: 0, total_expenses: 0, net_profit: 0, total_sales_change_pct: null, total_orders_change_pct: null, avg_order_value_change_pct: null, new_customers_change_pct: null, cash_position: 0, inventory_value: 0, purchases_this_month: 0, expenses: 0, expenses_period_label: 'this month', food_cost_pct: 0, waste_cost_this_month: 0, top_profitable_item: null });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [salesData, setSalesData] = useState<Array<{hour: string; Sales: number; Orders: number}>>([]);
  const [categoryData, setCategoryData] = useState<Array<{name: string; value: number}>>([]);
  const [loading, setLoading] = useState(true);
  // Lets the owner flip the Expenses figure in Business Health between
  // today/this week/this month, rather than it being locked to a month
  // the way it originally was.
  const [expensesPeriod, setExpensesPeriod] = useState<'today' | 'week' | 'month'>('month');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportingPeriod, setExportingPeriod] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const today = toLocalDateString();
        const [reportRes, ordersRes, inventoryRes, customersRes, unavailableRes, ownerRes] = await Promise.all([
          api.get('/reports/daily', { params: { date: today } }).catch(() => ({ data: { data: null } })),
          api.get('/orders', { params: { limit: 6 } }).catch(() => ({ data: { data: [] } })),
          api.get('/inventory').catch(() => ({ data: { stats: { low_stock: 0 } } })),
          api.get('/customers', { params: { limit: 1, status: 'active', include_growth: true } }).catch(() => ({ data: { pagination: { total: 0 } } })),
          api.get('/menu/items', { params: { limit: 1, status: 'unavailable,out_of_stock' } }).catch(() => ({ data: { pagination: { total: 0 } } })),
          api.get('/reports/owner-dashboard', { params: { expenses_period: expensesPeriod } }).catch(() => ({ data: { data: null } })),
        ]);

        const rep = reportRes.data.data;
        const owner = ownerRes.data.data;
        if (rep) {
          setStats({
            today_sales: rep.summary?.total_sales || 0,
            today_orders: rep.summary?.total_orders || 0,
            active_customers: customersRes.data.pagination?.total || 0,
            low_stock_items: inventoryRes.data.stats?.low_stock || 0,
            unavailable_menu_items: unavailableRes.data.pagination?.total || 0,
            pending_orders: ordersRes.data.data?.filter((o: RecentOrder) => ['new','preparing'].includes(o.status)).length || 0,
            avg_order_value: rep.summary?.avg_order_value || 0,
            gross_profit: rep.summary?.gross_profit || 0,
            total_expenses: rep.summary?.total_expenses || 0,
            net_profit: rep.summary?.net_profit || 0,
            total_sales_change_pct: rep.comparison?.total_sales_change_pct ?? null,
            total_orders_change_pct: rep.comparison?.total_orders_change_pct ?? null,
            avg_order_value_change_pct: rep.comparison?.avg_order_value_change_pct ?? null,
            new_customers_change_pct: customersRes.data.growth?.change_pct ?? null,
            cash_position: owner?.cash_position_today ?? 0,
            inventory_value: owner?.inventory_value ?? 0,
            purchases_this_month: owner?.purchases_this_month ?? 0,
            expenses: owner?.expenses ?? 0,
            expenses_period_label: owner?.expenses_period_label ?? 'this month',
            food_cost_pct: owner?.food_cost_pct ?? 0,
            waste_cost_this_month: owner?.waste_cost_this_month ?? 0,
            top_profitable_item: owner?.top_profitable_item ?? null,
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
  }, [expensesPeriod]);

  // Every figure explained in plain language right next to its value, since
  // a raw number in a spreadsheet six months from now won't remind anyone
  // what "Cash Position" actually means or how it differs from "Net
  // Profit". Sections mirror how the Business Health card itself groups
  // things, so the export reads the same way the dashboard looks.
  const exportDashboardCsv = async (period: 'day' | 'week' | 'month' | 'year') => {
    setExportingPeriod(period);
    setShowExportMenu(false);
    try {
      const { data } = await api.get('/reports/dashboard-export', { params: { period } });
      const d = data.data;

      const rows: string[][] = [
        ['Metric', 'Value', 'How it is calculated'],
        [`${d.period_label} Report`, `${d.start_date} to ${d.end_date}`, ''],
        ['', '', ''],
        ['REVENUE & PROFIT', '', ''],
        ['Revenue (Total Sales)', formatCurrency(d.revenue), 'Total value of every completed order in this period'],
        ['Total Discounts Given', formatCurrency(d.total_discounts), 'Sum of all discounts applied to orders in this period'],
        ['Net Sales', formatCurrency(d.net_sales), 'Revenue minus total discounts'],
        ['Cost of Goods Sold (COGS)', formatCurrency(d.cogs), "Ingredient cost of everything sold, based on each menu item's recipe"],
        ['Gross Profit', formatCurrency(d.gross_profit), 'Net Sales minus Cost of Goods Sold'],
        ['Gross Profit Margin', `${d.gross_profit_margin}%`, 'Gross Profit as a percentage of Net Sales'],
        ['Total Expenses', formatCurrency(d.total_expenses), 'All operating expenses logged in this period (rent, utilities, supplies, etc.) - not including purchase orders'],
        ['Net Profit', formatCurrency(d.net_profit), 'Gross Profit minus Total Expenses - the real bottom line after all costs'],
        ['Net Profit Margin', `${d.net_profit_margin}%`, 'Net Profit as a percentage of Net Sales'],
        ['', '', ''],
        ['CASH & INVENTORY', '', ''],
        ['Cash Position', formatCurrency(d.cash_position), 'Cash-method payments received in this period, minus expenses and any purchase order paid in full during the same period'],
        ['Inventory Value', formatCurrency(d.inventory_value), 'Current stock quantity x cost per unit, for all active items - a live snapshot as of now, not scoped to this period'],
        ['', '', ''],
        ['PURCHASES & WASTE', '', ''],
        ['Total Purchases', formatCurrency(d.purchases_total), 'Total value of all non-cancelled purchase orders placed in this period'],
        ['Waste Cost', formatCurrency(d.waste_cost), 'Cost of everything logged as waste or spoilage in this period, valued at current cost per unit'],
        ['Food Cost %', `${d.food_cost_pct}%`, 'Cost of Goods Sold as a percentage of Net Sales - the standard restaurant efficiency measure (lower is generally better)'],
        ['', '', ''],
        ['SALES DETAIL', '', ''],
        ['Total Orders', String(d.total_orders), 'Number of completed orders in this period'],
        ['Average Order Value', formatCurrency(d.avg_order_value), 'Revenue divided by number of orders'],
        ['Top Profitable Item', d.top_profitable_item ? d.top_profitable_item.name : 'No sales in this period', d.top_profitable_item ? `Contributed ${formatCurrency(d.top_profitable_item.profit)} in actual profit this period - sorted by profit, not revenue` : ''],
        ['', '', ''],
        ['LIVE SNAPSHOT (as of right now, not scoped to this period)', '', ''],
        ['Active Customers', String(d.active_customers), 'Customers currently marked active'],
        ['Low Stock Items', String(d.low_stock_items), 'Inventory items currently at or below their reorder level'],
        ['Unavailable Menu Items', String(d.unavailable_menu_items), 'Menu items currently marked unavailable or out of stock'],
        ['Pending Orders', String(d.pending_orders), 'Orders currently in New or Preparing status'],
      ];

      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `dashboard-${period}-${toLocalDateString()}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${d.period_label} report downloaded`);
    } catch {
      toast.error('Failed to export dashboard report');
    } finally {
      setExportingPeriod(null);
    }
  };

  const kpis: Array<{
    label: string; value: string | number; icon: typeof DollarSign; iconBg: string; iconColor: string;
    pct?: number | null; pctLabel?: string; note?: string; notePositive?: boolean;
  }> = [
    { label: "Today's Sales", value: formatCurrency(stats.today_sales), icon: DollarSign, iconBg: 'bg-brand/10', iconColor: 'text-brand', pct: stats.total_sales_change_pct, pctLabel: 'vs yesterday' },
    { label: "Today's Orders", value: stats.today_orders, icon: ClipboardList, iconBg: 'bg-status-info/10', iconColor: 'text-status-info', pct: stats.total_orders_change_pct, pctLabel: 'vs yesterday' },
    { label: 'Active Customers', value: stats.active_customers, icon: Users, iconBg: 'bg-status-success/10', iconColor: 'text-status-success', pct: stats.new_customers_change_pct, pctLabel: 'new customers vs last month' },
    { label: 'Avg Order Value', value: formatCurrency(stats.avg_order_value), icon: TrendingUp, iconBg: 'bg-status-purple/10', iconColor: 'text-status-purple', pct: stats.avg_order_value_change_pct, pctLabel: 'vs yesterday' },
    { label: 'Pending Orders', value: stats.pending_orders, icon: ChefHat, iconBg: 'bg-status-warning/10', iconColor: 'text-status-warning' },
    { label: 'Low Stock Items', value: stats.low_stock_items, icon: AlertTriangle, iconBg: 'bg-status-error/10', iconColor: 'text-status-error', note: stats.low_stock_items > 0 ? `${stats.low_stock_items} need restocking` : undefined, notePositive: false },
    { label: 'Unavailable Items', value: stats.unavailable_menu_items, icon: Ban, iconBg: 'bg-status-error/10', iconColor: 'text-status-error', note: stats.unavailable_menu_items > 0 ? `${stats.unavailable_menu_items} marked off menu` : undefined, notePositive: false },
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
    <div className="p-4 md:p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(v => !v)}
              disabled={!!exportingPeriod}
              className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50"
            >
              {exportingPeriod ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export CSV
              <ChevronDown size={14} />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-surface-card border border-border rounded-xl shadow-modal z-20 overflow-hidden">
                  {([['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['year', 'Annually']] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => exportDashboardCsv(value)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-50 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${isOnline ? 'text-status-success bg-status-success/10' : 'text-status-error bg-status-error/10'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-status-success animate-pulse' : 'bg-status-error'}`} />
            {isOnline ? 'System Online' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Business Health — the 10 numbers an owner needs to read the whole
          business in about 30 seconds. Deliberately placed first and most
          prominent, above the day-to-day operational KPIs below — this
          answers "is the business healthy" before "what's happening right
          now". Revenue/profit/food-cost figures are today; purchases,
          waste, and top item are this month (see getOwnerDashboard for
          why); inventory value is a live snapshot. Expenses is the one
          exception — the owner can flip it between today/this week/this
          month rather than it being locked to one fixed window. */}
      <div className="card p-4 md:p-5 mb-6 border-brand/20">
        <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-brand" /> Business Health
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Revenue Today', value: formatCurrency(stats.today_sales), color: 'text-text-primary' },
            { label: 'Gross Profit', value: formatCurrency(stats.gross_profit), color: 'text-status-success' },
            { label: 'Net Profit', value: formatCurrency(stats.net_profit), color: stats.net_profit >= 0 ? 'text-status-success' : 'text-status-error' },
            { label: 'Cash Position', value: formatCurrency(stats.cash_position), color: stats.cash_position >= 0 ? 'text-status-success' : 'text-status-error', sub: 'today' },
            { label: 'Inventory Value', value: formatCurrency(stats.inventory_value), color: 'text-status-purple', sub: 'on hand now' },
            { label: 'Purchases', value: formatCurrency(stats.purchases_this_month), color: 'text-text-primary', sub: 'this month' },
          ].map(kpi => (
            <div key={kpi.label} className="min-w-0">
              <p className="text-xs text-text-muted">{kpi.label}</p>
              <p className={`text-lg font-bold truncate ${kpi.color}`}>{loading ? '—' : kpi.value}</p>
              {kpi.sub && <p className="text-[10px] text-text-muted mt-0.5">{kpi.sub}</p>}
            </div>
          ))}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs text-text-muted">Expenses</p>
              <div className="flex gap-0.5">
                {([['today', 'D'], ['week', 'W'], ['month', 'M']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setExpensesPeriod(value)}
                    className={`text-[9px] font-bold w-4 h-4 rounded transition-colors ${expensesPeriod === value ? 'bg-brand text-black' : 'bg-surface-50 text-text-muted hover:text-text-primary'}`}
                    title={{ today: 'Today', week: 'This Week', month: 'This Month' }[value]}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-lg font-bold truncate text-status-error">{loading ? '—' : formatCurrency(stats.expenses)}</p>
            <p className="text-[10px] text-text-muted mt-0.5">{stats.expenses_period_label}</p>
          </div>

          {[
            { label: 'Food Cost %', value: `${stats.food_cost_pct}%`, color: stats.food_cost_pct > 35 ? 'text-status-error' : 'text-status-success', sub: 'of net sales today' },
            { label: 'Waste Cost', value: formatCurrency(stats.waste_cost_this_month), color: stats.waste_cost_this_month > 0 ? 'text-status-error' : 'text-text-primary', sub: 'this month' },
            {
              label: 'Top Profitable Item',
              value: stats.top_profitable_item ? stats.top_profitable_item.name : '—',
              color: 'text-status-success',
              sub: stats.top_profitable_item ? `${formatCurrency(stats.top_profitable_item.profit)} profit this month` : 'No sales yet this month',
            },
          ].map(kpi => (
            <div key={kpi.label} className="min-w-0">
              <p className="text-xs text-text-muted">{kpi.label}</p>
              <p className={`text-lg font-bold truncate ${kpi.color}`}>{loading ? '—' : kpi.value}</p>
              {kpi.sub && <p className="text-[10px] text-text-muted mt-0.5">{kpi.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        {kpis.map(kpi => (
          <div key={kpi.label} className="card p-4">
            <div className={`w-10 h-10 rounded-xl ${kpi.iconBg} flex items-center justify-center mb-3`}>
              <kpi.icon size={18} className={kpi.iconColor} />
            </div>
            <p className="text-2xl font-bold text-text-primary">{loading ? '—' : kpi.value}</p>
            <p className="text-xs text-text-muted mt-0.5">{kpi.label}</p>
            {!loading && kpi.pct !== undefined && (
              kpi.pct === null ? (
                <p className="text-xs mt-1 text-text-muted">— {kpi.pctLabel}</p>
              ) : (
                <p className={`text-xs mt-1 flex items-center gap-0.5 ${kpi.pct >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                  {kpi.pct >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {kpi.pct > 0 ? `+${kpi.pct}%` : `${kpi.pct}%`} {kpi.pctLabel}
                </p>
              )
            )}
            {!loading && kpi.note && (
              <p className={`text-xs mt-1 flex items-center gap-0.5 ${kpi.notePositive === false ? 'text-status-error' : 'text-status-success'}`}>
                {kpi.notePositive === false ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                {kpi.note}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Sales Trend */}
        <div className="card p-4 lg:col-span-2">
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
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'rgb(var(--color-text-muted))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'rgb(var(--color-text-muted))' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Orders */}
        <div className="card lg:col-span-2">
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

        {/* Quick Actions */}
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
        </div>
      </div>
    </div>
  );
}