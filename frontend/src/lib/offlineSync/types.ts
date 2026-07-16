// A queued sale bundles order creation + its single, full payment as one
// logical unit — deliberately NOT a general "queue any API call" system.
// Offline support here covers one well-defined, safe scenario: a complete,
// single-tender cash, card, or till sale rung up while disconnected. It
// does not cover M-Pesa STK push (needs a live call to Safaricom — there's
// no way to queue that), split bills, or loyalty point redemption (needs a
// live, current points balance to avoid overspending points that may have
// moved in the meantime) — those stay blocked while offline rather than
// pretending to support them.
export interface QueuedSale {
  id: string; // client-generated, doubles as the idempotency key sent to the server
  createdAt: string;
  status: 'pending' | 'syncing' | 'failed';
  lastError?: string;
  orderPayload: {
    type: 'dine_in' | 'takeaway' | 'delivery';
    table_id?: string;
    customer_id?: string;
    customer_name: string;
    guests: number;
    items: Array<{ menu_item_id: string; item_name: string; quantity: number; unit_price: number }>;
    special_instructions?: string;
    payment_method: 'cash' | 'card' | 'till';
  };
  paymentPayload: {
    payment_method: 'cash' | 'card' | 'till';
    amount: number;
    award_loyalty: boolean;
  };
  // Filled in once the order half of the sync succeeds, so a retry after a
  // partial failure (order created, payment failed) doesn't recreate the
  // order — it resumes from the payment step against the order that's
  // already there.
  serverOrderId?: string;
  serverOrderNumber?: string;
}