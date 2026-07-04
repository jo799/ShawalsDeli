import { useState, useEffect } from 'react';
import { RefreshCw, Download, Printer } from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';
import { formatCurrency, toLocalDateString } from '@/lib/utils';
import { LoadingPage } from '@/components/ui';
import toast from 'react-hot-toast';

const COLORS = ['#F59E0B','#10B981','#3B82F6','#8B5CF6','#EF4444'];

interface DailyData {
  summary: { total_sales: number; total_orders: number; avg_order_value: number; total_discounts: number; net_sales: number; cogs: number; gross_profit: number; gross_profit_margin: number };
  by_category: Array<{ category: string; sales: number; qty: number }>;
  by_payment: Array<{ payment_method: string; amount: number; count: number }>;
  top_items: Array<{ item_name: string; qty_sold: number; sales: number; profit_margin: number }>;
  hourly: Array<{ hour: number; sales: number; orders: number }>;
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

export default function ReportsPage() {
  const [tab, setTab] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [date, setDate] = useState(toLocalDateString());
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const { data: res } = await api.get('/reports/daily', { params: { date } });
      setData(res.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReport(); }, [date, tab]);

  const hourlyData = data?.hourly.map(h => ({
    hour: `${String(h.hour).padStart(2, '0')}:00`,
    Sales: h.sales,
    Orders: h.orders,
  })) || [];

  const categoryData = data?.by_category || [];
  const paymentData = data?.by_payment?.map(p => ({
    name: p.payment_method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: p.amount,
    count: p.count,
  })) || [];

  const peakHour = data?.hourly.reduce((max, h) => h.sales > (max?.sales || 0) ? h : max, data.hourly[0]);

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-status-success" />
          <h1 className="text-xl font-bold text-text-primary">Reports</h1>
          <span className="text-xs text-status-success">● Online</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input text-xs py-1.5 w-42" />
          <button onClick={fetchReport} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><RefreshCw size={12} /> Refresh</button>
          <button className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><Download size={12} /> Export</button>
          <button className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><Printer size={12} /> Print</button>
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
          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Sales', value: formatCurrency(data.summary.total_sales), icon: '💰', trend: '+18% vs Yesterday', trendPos: true },
              { label: 'Orders', value: data.summary.total_orders, icon: '📋', trend: '+12% vs Yesterday', trendPos: true },
              { label: 'Avg Order Value', value: formatCurrency(data.summary.avg_order_value), icon: '🍽', trend: '+8% vs Yesterday', trendPos: true },
              { label: 'Gross Profit', value: formatCurrency(data.summary.gross_profit), icon: '📈', sub: `Margin ${data.summary.gross_profit_margin}%`, trendPos: true },
            ].map(card => (
              <div key={card.label} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center text-lg">{card.icon}</div>
                </div>
                <p className="text-xs text-text-muted mb-0.5">{card.label}</p>
                <p className="text-xl font-bold text-text-primary">{card.value}</p>
                <p className={`text-xs mt-0.5 ${card.trendPos ? 'text-status-success' : 'text-status-error'}`}>
                  {card.trend || card.sub}
                </p>
              </div>
            ))}
          </div>

          {/* Charts row 1 */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Sales Trend */}
            <div className="card p-4 col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="section-title text-sm">Sales Trend (Today)</h3>
                <select className="select text-xs py-1 w-24">
                  <option>Today</option>
                  <option>This Week</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
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

            {/* Sales by Category */}
            <div className="card p-4">
              <h3 className="section-title text-sm mb-3">Sales by Category (Today)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={categoryData} dataKey="sales" nameKey="category" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {categoryData.slice(0, 5).map((cat, i) => (
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
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Payment methods */}
            <div className="card p-4">
              <h3 className="section-title text-sm mb-3">Payment Methods (Today)</h3>
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

            {/* Hourly sales bar */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="section-title text-sm">Hourly Sales (Today)</h3>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={hourlyData.slice(-10)} barSize={10}>
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Sales" fill="#F59E0B" radius={[3, 3, 0, 0]} name="Sales" />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 mt-2 pt-2 border-t border-border text-xs text-center">
                <div>
                  <p className="text-text-muted">Peak Hour</p>
                  <p className="font-bold">{peakHour ? `${String(peakHour.hour).padStart(2,'0')}:00 - ${String(peakHour.hour+1).padStart(2,'0')}:00` : '—'}</p>
                </div>
                <div>
                  <p className="text-text-muted">Peak Sales</p>
                  <p className="font-bold text-brand">{peakHour ? formatCurrency(peakHour.sales) : '—'}</p>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="card p-4">
              <h3 className="section-title text-sm mb-3">Summary (Today)</h3>
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

          {/* Top selling items */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-title text-sm">Top Selling Items (Today)</h3>
              <button className="btn-secondary text-xs py-1">View All</button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Item','Qty Sold','Sales','Profit Margin'].map(h => (
                    <th key={h} className="table-header pb-2 text-left pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.top_items.slice(0, 5).map((item, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-3">
                        <img src={`https://source.unsplash.com/40x40/?${encodeURIComponent(item.item_name)},food`} alt={item.item_name} className="w-8 h-8 rounded object-cover bg-surface-50" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
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

          <p className="text-xs text-text-muted text-center mt-4">ℹ Daily reports are calculated from 00:00 to 23:59 for the selected date.</p>
        </>
      ) : null}
    </div>
  );
}