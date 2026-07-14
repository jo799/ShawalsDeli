import { useState, useEffect, type CSSProperties } from 'react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';

interface ReportSummary {
  total_sales: number;
  total_orders: number;
  avg_order_value: number;
  total_discounts: number;
  net_sales: number;
  cogs: number;
  gross_profit: number;
  gross_profit_margin: number;
}

interface ReportPrintData {
  summary: ReportSummary;
  comparison: {
    total_sales_change_pct: number | null;
    total_orders_change_pct: number | null;
    avg_order_value_change_pct: number | null;
    gross_profit_change_pct: number | null;
  };
  by_category: Array<{ category: string; sales: number; qty: number }>;
  by_payment: Array<{ payment_method: string; amount: number; count: number }>;
  top_items: Array<{ item_name: string; qty_sold: number; sales: number; profit_margin: number }>;
  trend: Array<{ label: string; sales: number; orders: number }>;
  trend_granularity: 'hourly' | 'daily';
}

interface ReportPrintContentProps {
  data: ReportPrintData;
  tab: 'Daily' | 'Weekly' | 'Monthly';
  startDate: string;
  endDate: string;
  periodLabel: string;
  settings: Record<string, string>;
}

const thStyle: CSSProperties = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #111', fontSize: 12 };
const tdStyle: CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: 12 };
const tdRight: CSSProperties = { ...tdStyle, textAlign: 'right' };

function formatPct(pct: number | null): string {
  if (pct === null) return '—';
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

function formatPaymentLabel(method: string): string {
  return method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function ReportPrintContent({
  data, tab, startDate, endDate, periodLabel, settings,
}: ReportPrintContentProps) {
  const businessName = settings.business_name || "Shawal's Deli";
  const businessPhone = settings.business_phone;
  const businessLogoUrl = settings.business_logo_url;
  const periodRange = startDate === endDate ? startDate : `${startDate} to ${endDate}`;

  return (
    <div style={{ background: '#fff', color: '#111', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111', paddingBottom: 16, marginBottom: 20 }}>
        <div>
          {businessLogoUrl && (
            <img src={businessLogoUrl} alt="" style={{ maxWidth: 120, maxHeight: 50, marginBottom: 6, display: 'block' }} />
          )}
          <div style={{ fontWeight: 800, fontSize: 20 }}>{businessName.toUpperCase()}</div>
          {businessPhone && <div style={{ fontSize: 12, color: '#555' }}>Tel: {businessPhone}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>SALES REPORT</div>
          <div style={{ fontSize: 13, color: '#555', textTransform: 'capitalize' }}>{tab} · {periodLabel}</div>
          <div style={{ fontSize: 12, color: '#555' }}>{periodRange}</div>
        </div>
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Summary</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr>
            <th style={thStyle}>Metric</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Value</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>vs Previous</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: 'Total Sales', value: formatCurrency(data.summary.total_sales), pct: data.comparison.total_sales_change_pct },
            { label: 'Orders', value: String(data.summary.total_orders), pct: data.comparison.total_orders_change_pct },
            { label: 'Avg Order Value', value: formatCurrency(data.summary.avg_order_value), pct: data.comparison.avg_order_value_change_pct },
            { label: 'Discounts', value: formatCurrency(data.summary.total_discounts), pct: null },
            { label: 'Net Sales', value: formatCurrency(data.summary.net_sales), pct: null },
            { label: 'COGS', value: formatCurrency(data.summary.cogs), pct: null },
            { label: 'Gross Profit', value: formatCurrency(data.summary.gross_profit), pct: data.comparison.gross_profit_change_pct },
            { label: 'Gross Profit Margin', value: `${data.summary.gross_profit_margin}%`, pct: null },
          ].map(row => (
            <tr key={row.label}>
              <td style={tdStyle}>{row.label}</td>
              <td style={tdRight}>{row.value}</td>
              <td style={tdRight}>{formatPct(row.pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Sales by Category</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr>
            <th style={thStyle}>Category</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Sales</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>% of Total</th>
          </tr>
        </thead>
        <tbody>
          {data.by_category.length === 0 ? (
            <tr><td colSpan={4} style={tdStyle}>No sales in this period</td></tr>
          ) : data.by_category.map(cat => (
            <tr key={cat.category}>
              <td style={tdStyle}>{cat.category}</td>
              <td style={tdRight}>{formatCurrency(cat.sales)}</td>
              <td style={tdRight}>{cat.qty}</td>
              <td style={tdRight}>
                {data.summary.total_sales > 0 ? Math.round(cat.sales / data.summary.total_sales * 100) : 0}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Payment Methods</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr>
            <th style={thStyle}>Method</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Count</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>% of Net</th>
          </tr>
        </thead>
        <tbody>
          {data.by_payment.length === 0 ? (
            <tr><td colSpan={4} style={tdStyle}>No payments in this period</td></tr>
          ) : data.by_payment.map(p => (
            <tr key={p.payment_method}>
              <td style={tdStyle}>{formatPaymentLabel(p.payment_method)}</td>
              <td style={tdRight}>{formatCurrency(p.amount)}</td>
              <td style={tdRight}>{p.count}</td>
              <td style={tdRight}>
                {data.summary.net_sales > 0 ? Math.round(p.amount / data.summary.net_sales * 100) : 0}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
        {data.trend_granularity === 'hourly' ? 'Hourly' : 'Daily'} Sales Trend
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr>
            <th style={thStyle}>{data.trend_granularity === 'hourly' ? 'Hour' : 'Day'}</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Sales</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Orders</th>
          </tr>
        </thead>
        <tbody>
          {data.trend.length === 0 ? (
            <tr><td colSpan={3} style={tdStyle}>No trend data</td></tr>
          ) : data.trend.map(row => (
            <tr key={row.label}>
              <td style={tdStyle}>{row.label}</td>
              <td style={tdRight}>{formatCurrency(row.sales)}</td>
              <td style={tdRight}>{row.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Top Selling Items</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr>
            <th style={thStyle}>Item</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Qty Sold</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Sales</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Profit Margin</th>
          </tr>
        </thead>
        <tbody>
          {data.top_items.length === 0 ? (
            <tr><td colSpan={4} style={tdStyle}>No items sold in this period</td></tr>
          ) : data.top_items.slice(0, 10).map((item, i) => (
            <tr key={`${item.item_name}-${i}`}>
              <td style={tdStyle}>{item.item_name}</td>
              <td style={tdRight}>{item.qty_sold}</td>
              <td style={tdRight}>{formatCurrency(item.sales)}</td>
              <td style={tdRight}>{item.profit_margin}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 24, paddingTop: 12, borderTop: '1px solid #ddd', fontSize: 11, color: '#888', textAlign: 'center' }}>
        Generated {new Date().toLocaleString()} · {businessName}
      </div>
    </div>
  );
}

interface ReportPrintProps {
  data: ReportPrintData | null;
  tab: 'Daily' | 'Weekly' | 'Monthly';
  startDate: string;
  endDate: string;
  periodLabel: string;
  onReadyChange?: (ready: boolean) => void;
}

// Screen-hidden, print-only report — same pattern as Receipt and PurchaseOrderPrint.
export default function ReportPrint({ data, tab, startDate, endDate, periodLabel, onReadyChange }: ReportPrintProps) {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (!data) {
      setSettings(null);
      onReadyChange?.(false);
      return;
    }
    setSettings(null);
    onReadyChange?.(false);
    api.get('/settings')
      .then(r => setSettings(r.data.data))
      .catch(() => setSettings({}))
      .finally(() => onReadyChange?.(true));
  }, [data, onReadyChange]);

  if (!data || !settings) return null;

  return (
    <>
      <style>{`
        .reports-print { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden; }
          .reports-print, .reports-print * { visibility: visible; }
          .reports-print {
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            background: #fff;
          }
        }
      `}</style>
      <div className="reports-print">
        <ReportPrintContent
          data={data}
          tab={tab}
          startDate={startDate}
          endDate={endDate}
          periodLabel={periodLabel}
          settings={settings}
        />
      </div>
    </>
  );
}
