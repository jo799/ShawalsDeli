import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Download, Printer } from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import api from '@/lib/api';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { formatCurrency, toLocalDateString, resolveMenuImage } from '@/lib/utils';
import { LoadingPage } from '@/components/ui';
import toast from 'react-hot-toast';

const COLORS = ['#F59E0B','#10B981','#3B82F6','#8B5CF6','#EF4444'];

interface ReportData {
  summary: { total_sales: number; total_orders: number; avg_order_value: number; total_discounts: number; net_sales: number; cogs: number; gross_profit: number; gross_profit_margin: number };
  comparison: { total_sales_change_pct: number | null; total_orders_change_pct: number | null; avg_order_value_change_pct: number | null; gross_profit_change_pct: number | null };
  by_category: Array<{ category: string; sales: number; qty: number }>;
  by_payment: Array<{ payment_method: string; amount: number; count: number }>;
  top_items: Array<{ item_name: string; qty_sold: number; sales: number; profit_margin: number; image_url?: string }>;
  trend: Array<{ label: string; sales: number; orders: number }>;
  trend_granularity: 'hourly' | 'daily';
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-card border border-border rounded-lg p-2 text-xs shadow-modal">
      {label && <p className="text-text-muted mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('sale') ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// "—" rather than a fake 0% or ∞% when there's no prior-period baseline to
// compare against (e.g. the very first day this business ever had any
// sales) — showing a number there would just be a different kind of made up.
const TrendBadge = ({ pct }: { pct: number | null }) => {
  if (pct === null) return <span className="text-xs mt-0.5 text-text-muted">— vs previous period</span>;
  const positive = pct >= 0;
  return <span className={`text-xs mt-0.5 ${positive ? 'text-status-success' : 'text-status-error'}`}>{positive ? '+' : ''}{pct}% vs previous period</span>;
};

export default function ReportsPage() {
  const isOnline = useOnlineStatus();
  const [tab, setTab] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [date, setDate] = useState(toLocalDateString());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // The tab used to be entirely cosmetic — clicking Weekly or Monthly just
  // silently re-fetched the exact same single-day report a second time.
  // This is what actually makes them mean something: a real date range
  // computed from the selected tab and anchor date.
  const getRange = useCallback((): [string, string] => {
    const anchor = new Date(date);
    if (tab === 'Weekly') {
      return [format(startOfWeek(anchor, { weekStartsOn: 1 }), 'yyyy-MM-dd'), format(endOfWeek(anchor, { weekStartsOn: 1 }), 'yyyy-MM-dd')];
    }
    if (tab === 'Monthly') {
      return [format(startOfMonth(anchor), 'yyyy-MM-dd'), format(endOfMonth(anchor), 'yyyy-MM-dd')];
    }
    return [date, date];
  }, [tab, date]);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const [start_date, end_date] = getRange();
      const { data: res } = await api.get('/reports/summary', { params: { start_date, end_date } });
      setData(res.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  }, [getRange]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const periodLabel = tab === 'Daily' ? 'Today' : tab === 'Weekly' ? 'This Week' : 'This Month';
  const trendData = data?.trend.map(t => ({ label: t.label, Sales: t.sales, Orders: t.orders })) || [];
  const categoryData = data?.by_category || [];
  const paymentData = data?.by_payment?.map(p => ({
    name: p.payment_method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: p.amount,
    count: p.count,
  })) || [];

  const peakPoint = data?.trend.reduce((max, h) => h.sales > (max?.sales || 0) ? h : max, data.trend[0]);

  const exportCsv = () => {
    if (!data) return;
    const [start_date, end_date] = getRange();
    const rows: string[][] = [
      ['Report period', `${start_date} to ${end_date}`],
      [],
      ['Summary'],
      ['Total Sales', String(data.summary.total_sales)],
      ['Total Orders', String(data.summary.total_orders)],
      ['Average Order Value', String(data.summary.avg_order_value)],
      ['Discounts', String(data.summary.total_discounts)],
      ['Net Sales', String(data.summary.net_sales)],
      ['COGS', String(data.summary.cogs)],
      ['Gross Profit', String(data.summary.gross_profit)],
      ['Gross Profit Margin %', String(data.summary.gross_profit_margin)],
      [],
      ['Sales by Category'], ['Category', 'Sales', 'Qty'],
      ...categoryData.map(c => [c.category, String(c.sales), String(c.qty)]),
      [],
      ['Payment Methods'], ['Method', 'Amount', 'Count'],
      ...paymentData.map(p => [p.name, String(p.value), String(p.count)]),
      [],
      ['Top Selling Items'], ['Item', 'Qty Sold', 'Sales', 'Profit Margin %'],
      ...(data.top_items.map(i => [i.item_name, String(i.qty_sold), String(i.sales), String(i.profit_margin)])),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `report-${tab.toLowerCase()}-${start_date}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-status-success' : 'bg-status-error'}`} />
          <h1 className="text-xl font-bold text-text-primary">Reports</h1>
          <span className={`text-xs ${isOnline ? 'text-status-success' : 'text-status-error'}`}>{isOnline ? '● Online' : '● Offline'}</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input text-xs py-1.5 w-42" />
          <button onClick={fetchReport} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><RefreshCw size={12} /> Refresh</button>
          <button onClick={exportCsv} disabled={!data} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 disabled:opacity-50"><Download size={12} /> Export</button>
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><Printer size={12} /> Print</button>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 mb-6 bg-surface-card p-1 rounded-lg border border-border w-fit">
        {(['Daily','Weekly','Monthly'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${tab === t ? 'bg-brand text-black' : 'text-text-secondary hover:text-text-primary'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <LoadingPage /> : data ? (
        <>
          {/* KPI cards — trend percentages are now computed against the
              equivalent previous period (yesterday / last week / last
              month), not the fixed "+18%" style figures every card used to
              show regardless of what actually happened. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Sales', value: formatCurrency(data.summary.total_sales), icon: '💰', pct: data.comparison.total_sales_change_pct },
              { label: 'Orders', value: data.summary.total_orders, icon: '📋', pct: data.comparison.total_orders_change_pct },
              { label: 'Avg Order Value', value: formatCurrency(data.summary.avg_order_value), icon: '🍽', pct: data.comparison.avg_order_value_change_pct },
              { label: 'Gross Profit', value: formatCurrency(data.summary.gross_profit), icon: '📈', pct: data.comparison.gross_profit_change_pct },
            ].map(card => (
              <div key={card.label} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center text-lg">{card.icon}</div>
                </div>
                <p className="text-xs text-text-muted mb-0.5">{card.label}</p>
                <p className="text-xl font-bold text-text-primary">{card.value}</p>
                <TrendBadge pct={card.pct} />
              </div>
            ))}
          </div>

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="card p-4 lg:col-span-2">
              <h3 className="section-title text-sm mb-3">Sales Trend ({periodLabel})</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgb(var(--color-text-muted))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgb(var(--color-text-muted))' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Sales" stroke="#F59E0B" strokeWidth={2} fill="url(#salesGrad)" name="Sales" />
                  <Area type="monotone" dataKey="Orders" stroke="#10B981" strokeWidth={2} fill="none" name="Orders" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 mt-3 pt-3 border-t border-border text-center">
                {[
                  { label: 'Total Sales', value: formatCurrency(data.summary.total_sales) },
                  { label: 'Total Orders', value: data.summary.total_orders },
                  { label: 'Items Sold', value: data.top_items.reduce((s, i) => s + (i.qty_sold || 0), 0) },
                ].map(s => (
                  <div key={s.label}>
                    <p className="text-xs text-text-muted">{s.label}</p>
                    <p className="font-bold text-sm">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <h3 className="section-title text-sm mb-3">Sales by Category ({periodLabel})</h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={categoryData} dataKey="sales" nameKey="category" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {categoryData.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-2">No sales in this period</p>
                ) : categoryData.slice(0, 5).map((cat, i) => (
                  <div key={cat.category} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-text-secondary">{cat.category}</span>
                    </div>
                    <span className="text-text-muted font-medium">
                      {data.summary.total_sales > 0 ? Math.round(cat.sales / data.summary.total_sales * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="card p-4">
              <h3 className="section-title text-sm mb-3">Payment Methods ({periodLabel})</h3>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={55}>
                    {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {paymentData.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-text-secondary">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{formatCurrency(p.value)}</span>
                      <span className="text-text-muted ml-1">
                        {data.summary.net_sales > 0 ? Math.round(p.value / data.summary.net_sales * 100) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <h3 className="section-title text-sm mb-3">{data.trend_granularity === 'hourly' ? 'Hourly' : 'Daily'} Sales ({periodLabel})</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={trendData.slice(-10)} barSize={10}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgb(var(--color-text-muted))' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Sales" fill="#F59E0B" radius={[3, 3, 0, 0]} name="Sales" />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 mt-2 pt-2 border-t border-border text-xs text-center">
                <div>
                  <p className="text-text-muted">Peak {data.trend_granularity === 'hourly' ? 'Hour' : 'Day'}</p>
                  <p className="font-bold">{peakPoint ? peakPoint.label : '—'}</p>
                </div>
                <div>
                  <p className="text-text-muted">Peak Sales</p>
                  <p className="font-bold text-brand">{peakPoint ? formatCurrency(peakPoint.sales) : '—'}</p>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="section-title text-sm mb-3">Summary ({periodLabel})</h3>
              <div className="space-y-2">
                {[
                  { label: 'Total Sales', value: formatCurrency(data.summary.total_sales), color: 'text-text-primary' },
                  { label: 'Discounts', value: `-${formatCurrency(data.summary.total_discounts)}`, color: 'text-status-error' },
                  { label: 'Net Sales', value: formatCurrency(data.summary.net_sales), color: 'text-status-success' },
                  { label: 'COGS', value: `-${formatCurrency(data.summary.cogs)}`, color: 'text-status-error' },
                  { label: 'Gross Profit', value: formatCurrency(data.summary.gross_profit), color: 'text-status-success' },
                  { label: 'Gross Profit Margin', value: `${data.summary.gross_profit_margin}%`, color: 'text-text-primary' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-text-muted">{row.label}</span>
                    <span className={`font-medium ${row.color}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top selling items — item images now come from the actual
              uploaded menu photo (with the same branded fallback used
              everywhere else in the app), not an external stock-photo
              lookup keyed off the item's name, which was both an
              unnecessary network dependency and often just wrong. */}
          <div className="card p-4">
            <h3 className="section-title text-sm mb-3">Top Selling Items ({periodLabel})</h3>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-border">
                  {['Item','Qty Sold','Sales','Profit Margin'].map(h => (
                    <th key={h} className="table-header pb-2 text-left pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.top_items.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-text-muted text-sm">No items sold in this period</td></tr>
                ) : data.top_items.slice(0, 5).map((item, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-3">
                        <img src={resolveMenuImage(item.image_url, item.item_name)} alt={item.item_name} className="w-8 h-8 rounded object-cover bg-surface-50" />
                        <span className="text-sm font-medium">{item.item_name}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-sm text-text-secondary">{item.qty_sold}</td>
                    <td className="py-2 pr-4 text-sm font-medium text-brand">{formatCurrency(item.sales)}</td>
                    <td className="py-2">
                      <span className={`text-sm font-bold ${item.profit_margin >= 50 ? 'text-status-success' : 'text-status-warning'}`}>
                        {item.profit_margin}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          <p className="text-xs text-text-muted text-center mt-4">
            ℹ {tab === 'Daily' ? 'Daily reports are calculated from 00:00 to 23:59 for the selected date.' : tab === 'Weekly' ? 'Weekly reports cover Monday through Sunday of the week containing the selected date.' : 'Monthly reports cover the full calendar month containing the selected date.'}
          </p>
        </>
      ) : null}
    </div>
  );
}