import { useState, useEffect, useRef } from 'react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Printable receipt — screen-hidden, print-only. Used by both the POS page
// (auto-prints the instant an order is fully settled) and the Orders page
// ("Print Receipt" / reprint on any past order). Kept as one shared component
// so the two call sites can never drift out of sync on what a receipt
// actually looks like.
//
// The @media print rule hides everything else on the page and shows only
// this block, sized for an 80mm thermal receipt roll — the standard,
// reliable way to print from a browser without a native printer driver:
// whatever printer is set as the OS default (including a configured
// receipt printer) picks it up via the normal print dialog.
//
// Caller contract: render this with `order` set to null/undefined normally,
// and set it to a full order (from GET /orders/:id — must include `items`
// and `payments` arrays) to trigger a print. The caller owns calling
// window.print() (typically from a useEffect keyed on the order prop) —
// this component only renders the markup.
// ─────────────────────────────────────────────────────────────────────────────

export default function Receipt({ order }: { order: Record<string, unknown> | null }) {
  // Business name/phone and the footer message used to be hardcoded here
  // ("SHAWAL'S DELI" / "Tel: 0700 000 000" / a fixed thank-you line) —
  // fetched once whenever a receipt is actually about to render, rather than
  // on every page load, since a receipt render is already a rare, deliberate
  // moment (checkout completing, or a manual reprint).
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsReady, setSettingsReady] = useState(false);
  const printedFor = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!order) { setSettingsReady(false); return; }
    setSettingsReady(false);
    api.get('/settings')
      .then(r => setSettings(r.data.data))
      .catch(() => { /* fall back to defaults below rather than block printing forever */ })
      .finally(() => setSettingsReady(true));
  }, [order]);

  // Printing used to be the CALLER's job (POSPage/OrdersPage each ran their
  // own `setTimeout(() => window.print(), 150)` the moment `order` was set)
  // — a blind guess at how long the settings fetch above would take. On
  // anything slower than a fast local connection, 150ms often wasn't
  // enough: window.print() fired before the business name/logo had loaded,
  // silently printing the fallback text with no logo even when one was
  // configured. Printing now happens here instead, gated on settingsReady,
  // so it can only fire once the real data (or a definitive failure) is in.
  useEffect(() => {
    if (order && settingsReady && printedFor.current !== order) {
      printedFor.current = order;
      const t = setTimeout(() => window.print(), 50);
      return () => clearTimeout(t);
    }
  }, [order, settingsReady]);

  const businessName = settings.business_name || "Shawal's Deli";
  const businessPhone = settings.business_phone;
  const businessLogoUrl = settings.business_logo_url;
  const footerMessage = settings.receipt_footer_message || 'Thank you for dining with us!\nKaribu tena';
  const showCustomerName = settings.receipt_show_customer_name !== 'false';

  return (
    <>
      <style>{`
        .pos-receipt { display: none; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body * { visibility: hidden; }
          .pos-receipt, .pos-receipt * { visibility: visible; }
          .pos-receipt {
            display: block; position: fixed; top: 0; left: 0;
            width: 80mm; padding: 4mm; font-family: 'Courier New', monospace;
            color: #000; background: #fff; font-size: 15px; line-height: 1.5;
          }
        }
      `}</style>
      {order && (
        <div className="pos-receipt">
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            {businessLogoUrl && (
              <img src={businessLogoUrl} alt="" style={{ maxWidth: '45mm', maxHeight: '20mm', margin: '0 auto 6px', display: 'block' }} />
            )}
            <div style={{ fontWeight: 700, fontSize: 19 }}>{businessName.toUpperCase()}</div>
            {businessPhone && <div>Tel: {businessPhone}</div>}
          </div>
          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '6px 0' }}>
            <div>Order: {String(order.order_number ?? '')}</div>
            <div>Date: {order.created_at ? new Date(String(order.created_at)).toLocaleString() : ''}</div>
            <div>Type: {String(order.type ?? '').replace('_', ' ')}{order.table_number ? ` · Table ${order.table_number}` : ''}</div>
            {showCustomerName && !!order.customer_name && <div>Customer: {String(order.customer_name)}</div>}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {(order.items as Array<Record<string, unknown>> | undefined)?.map((it, idx) => (
                <tr key={idx}>
                  <td style={{ verticalAlign: 'top' }}>
                    {String(it.item_name)} x{String(it.quantity)}
                  </td>
                  <td style={{ textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {formatCurrency(Number(it.total_price))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0', paddingTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{formatCurrency(Number(order.subtotal ?? 0))}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 17, marginTop: 4 }}><span>TOTAL</span><span>{formatCurrency(Number(order.total ?? 0))}</span></div>
          </div>
          {/* Every tender recorded against this order — for a mixed-method
              sale (e.g. part M-Pesa, part cash) this is the one place that
              shows both. */}
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0', paddingTop: 4 }}>
            <div style={{ fontWeight: 700 }}>PAYMENT</div>
            {(order.payments as Array<Record<string, unknown>> | undefined)
              ?.filter(p => p.status === 'completed')
              .map((p, idx) => {
                const split = p.split_details as { parts?: number; per_person?: number } | null;
                return (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        {p.payment_method === 'points'
                          ? `POINTS REDEEMED (${p.points_redeemed} pts)`
                          : `${String(p.payment_method).toUpperCase()}${p.reference ? ` (${String(p.reference).slice(-6)})` : ''}`}
                      </span>
                      <span>{formatCurrency(Number(p.amount))}</span>
                    </div>
                    {split?.parts && (
                      <div style={{ fontSize: 12, opacity: 0.75 }}>Split {split.parts} ways — {formatCurrency(split.per_person || 0)} each</div>
                    )}
                  </div>
                );
              })}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 2 }}>
              <span>Total paid</span><span>{formatCurrency(Number(order.amount_paid ?? 0))}</span>
            </div>
          </div>
          {Number(order.loyalty_points_earned ?? 0) > 0 && (
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0', paddingTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span>⭐ Loyalty Points Earned</span>
              <span style={{ fontWeight: 700 }}>+{Number(order.loyalty_points_earned)}</span>
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            {footerMessage.split('\n').map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      )}
    </>
  );
}