import { formatCurrency } from '@/lib/utils';

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
  return (
    <>
      <style>{`
        .pos-receipt { display: none; }
        @media print {
          body * { visibility: hidden; }
          .pos-receipt, .pos-receipt * { visibility: visible; }
          .pos-receipt {
            display: block; position: fixed; top: 0; left: 0;
            width: 80mm; padding: 4mm; font-family: 'Courier New', monospace;
            color: #000; background: #fff; font-size: 11px; line-height: 1.4;
          }
        }
      `}</style>
      {order && (
        <div className="pos-receipt">
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>SHAWAL'S DELI</div>
            <div>Swahili Dishes</div>
            <div>Tel: 0700 000 000</div>
          </div>
          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '6px 0' }}>
            <div>Order: {String(order.order_number ?? '')}</div>
            <div>Date: {order.created_at ? new Date(String(order.created_at)).toLocaleString() : ''}</div>
            <div>Type: {String(order.type ?? '').replace('_', ' ')}{order.table_number ? ` · Table ${order.table_number}` : ''}</div>
            {!!order.customer_name && <div>Customer: {String(order.customer_name)}</div>}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13, marginTop: 4 }}><span>TOTAL</span><span>{formatCurrency(Number(order.total ?? 0))}</span></div>
          </div>
          {/* Every tender recorded against this order — for a mixed-method
              sale (e.g. part M-Pesa, part cash) this is the one place that
              shows both. */}
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0', paddingTop: 4 }}>
            <div style={{ fontWeight: 700 }}>PAYMENT</div>
            {(order.payments as Array<Record<string, unknown>> | undefined)
              ?.filter(p => p.status === 'completed')
              .map((p, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{String(p.payment_method).toUpperCase()}{p.reference ? ` (${String(p.reference).slice(-6)})` : ''}</span>
                  <span>{formatCurrency(Number(p.amount))}</span>
                </div>
              ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 2 }}>
              <span>Total paid</span><span>{formatCurrency(Number(order.amount_paid ?? 0))}</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <div>Thank you for dining with us!</div>
            <div>Karibu tena</div>
          </div>
        </div>
      )}
    </>
  );
}