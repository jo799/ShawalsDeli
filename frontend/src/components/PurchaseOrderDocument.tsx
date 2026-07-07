import { useState, useEffect, useRef } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import api from '@/lib/api';

interface POItem {
  id: string; item_name: string; unit: string; quantity_ordered: number;
  quantity_received: number; unit_price: number; total: number;
}
interface PODoc {
  po_number: string; supplier_name?: string; supplier_phone?: string;
  order_date: string; expected_date?: string; received_date?: string;
  subtotal: number; discount: number; total_amount: number;
  payment_status: string; status: string; notes?: string;
  items?: POItem[];
}

// The actual document layout — shared between the on-screen "View Invoice"
// modal (rendered plainly, inline) and the print-only path below. Keeping
// one copy of this markup means the two can never quietly drift apart.
//
// `settings` is optional: the "View Invoice" modal doesn't pass it and this
// fetches its own copy (fine there — nothing is timing-sensitive in a modal
// the user is just looking at). The print path DOES pass it, already
// resolved, so there's exactly one settings fetch involved in printing, not
// two independent ones that could resolve at slightly different times.
export function PurchaseOrderContent({ po, settings: settingsProp }: { po: PODoc; settings?: Record<string, string> }) {
  const [ownSettings, setOwnSettings] = useState<Record<string, string>>({});
  useEffect(() => {
    if (settingsProp) return; // caller already provided resolved settings
    api.get('/settings').then(r => setOwnSettings(r.data.data)).catch(() => {});
  }, [settingsProp]);
  const settings = settingsProp ?? ownSettings;
  const businessName = settings.business_name || "Shawal's Deli";
  const businessPhone = settings.business_phone;
  const businessLogoUrl = settings.business_logo_url;
  const footerNote = settings.invoice_footer_note;

  return (
    <div style={{ background: '#fff', color: '#111', padding: 32, fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111', paddingBottom: 16, marginBottom: 20 }}>
        <div>
          {businessLogoUrl && <img src={businessLogoUrl} alt="" style={{ maxWidth: 140, maxHeight: 60, marginBottom: 6 }} />}
          <div style={{ fontWeight: 800, fontSize: 22 }}>{businessName.toUpperCase()}</div>
          {businessPhone && <div style={{ fontSize: 12, color: '#555' }}>Tel: {businessPhone}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>PURCHASE ORDER</div>
          <div style={{ fontSize: 13, color: '#555' }}>{po.po_number}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: 13 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>Supplier</div>
          <div>{po.supplier_name || '—'}</div>
          {po.supplier_phone && <div style={{ color: '#555' }}>{po.supplier_phone}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><span style={{ color: '#555' }}>Order Date: </span>{po.order_date ? formatDate(po.order_date) : '—'}</div>
          <div><span style={{ color: '#555' }}>Expected: </span>{po.expected_date ? formatDate(po.expected_date) : '—'}</div>
          <div><span style={{ color: '#555' }}>Received: </span>{po.received_date ? formatDate(po.received_date) : '—'}</div>
          <div style={{ marginTop: 4, fontWeight: 700, textTransform: 'capitalize' }}>{po.status.replace(/_/g, ' ')}</div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #111' }}>
            <th style={{ textAlign: 'left', padding: '6px 4px' }}>Item</th>
            <th style={{ textAlign: 'right', padding: '6px 4px' }}>Ordered</th>
            <th style={{ textAlign: 'right', padding: '6px 4px' }}>Received</th>
            <th style={{ textAlign: 'right', padding: '6px 4px' }}>Unit Price</th>
            <th style={{ textAlign: 'right', padding: '6px 4px' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {po.items?.map(item => (
            <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 4px' }}>{item.item_name}</td>
              <td style={{ textAlign: 'right', padding: '6px 4px' }}>{item.quantity_ordered} {item.unit}</td>
              <td style={{ textAlign: 'right', padding: '6px 4px', color: item.quantity_received >= item.quantity_ordered ? '#16a34a' : '#555' }}>
                {item.quantity_received} {item.unit}
              </td>
              <td style={{ textAlign: 'right', padding: '6px 4px' }}>{formatCurrency(item.unit_price)}</td>
              <td style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 600 }}>{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginLeft: 'auto', width: 220, fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span>Subtotal</span><span>{formatCurrency(po.subtotal)}</span></div>
        {po.discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#dc2626' }}><span>Discount</span><span>-{formatCurrency(po.discount)}</span></div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '2px solid #111', marginTop: 4, fontWeight: 800, fontSize: 15 }}>
          <span>Total</span><span>{formatCurrency(po.total_amount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 12, color: '#555', textTransform: 'capitalize' }}>
          <span>Payment</span><span>{po.payment_status}</span>
        </div>
      </div>

      {po.notes && (
        <div style={{ marginTop: 20, fontSize: 12, color: '#555' }}>
          <div style={{ fontWeight: 700, color: '#111', marginBottom: 2 }}>Notes</div>
          {po.notes}
        </div>
      )}

      <div style={{ marginTop: 28, paddingTop: 12, borderTop: '1px solid #ddd', fontSize: 11, color: '#888', textAlign: 'center' }}>
        {footerNote || `Generated by ${businessName}`}
      </div>
    </div>
  );
}

// Print-only wrapper — same "hide everything else" trick used for receipts.
// Rendered whenever `po` is set (see PurchasesPage). Does its own settings
// fetch (small duplication of what PurchaseOrderContent does for the "View
// Invoice" modal) specifically so window.print() can be gated on it actually
// finishing — the previous version had the caller fire print() on a blind
// setTimeout with no idea whether the business name/logo fetch below had
// completed, which on anything slower than a fast local connection could
// print the fallback text with no logo even when one was configured.
export default function PurchaseOrderPrint({ po }: { po: PODoc | null }) {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const printedFor = useRef<PODoc | null>(null);

  useEffect(() => {
    if (!po) { setSettings(null); return; }
    setSettings(null);
    api.get('/settings').then(r => setSettings(r.data.data)).catch(() => setSettings({}));
  }, [po]);

  useEffect(() => {
    if (po && settings && printedFor.current !== po) {
      printedFor.current = po;
      const t = setTimeout(() => window.print(), 50);
      return () => clearTimeout(t);
    }
  }, [po, settings]);

  return (
    <>
      <style>{`
        .po-print { display: none; }
        @media print {
          body * { visibility: hidden; }
          .po-print, .po-print * { visibility: visible; }
          .po-print { display: block; position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>
      {po && settings && <div className="po-print"><PurchaseOrderContent po={po} settings={settings} /></div>}
    </>
  );
}