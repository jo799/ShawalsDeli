// POSPage's cart lived only in component state — the moment the page
// unmounted (navigating to Orders and back, or a browser refresh), it was
// gone with no way to recover it. This persists just the pre-payment
// "building the order" state (cart contents, order type, table, attached
// customer) to localStorage, so a cashier who gets pulled away or
// accidentally refreshes mid-order doesn't lose everything they'd rung up.
//
// Deliberately does NOT persist activeOrder (an order that already exists
// server-side with a payment in progress) — that's a much riskier thing to
// silently resurrect from a stale local snapshot (someone else may have
// already finished paying it from another terminal). If that happens, the
// safer path is finishing the payment from the Orders page instead.
const STORAGE_KEY = 'shawalsdeli-pos-cart-draft';

interface CartItemLike {
  id: string; name: string; price: number; category_name: string;
  image_url?: string; tags?: string[]; track_stock?: boolean; stock_quantity?: number; reorder_level?: number;
  quantity: number;
}

export interface PersistedCartState {
  cart: CartItemLike[];
  orderType: string;
  selectedTableId: string | null;
  selectedCustomer: { id: string; full_name: string; phone?: string; available_points?: number } | null;
}

export function saveCartDraft(state: PersistedCartState): void {
  try {
    // An empty cart with nothing else set isn't worth persisting — clear
    // any leftover draft instead so a brand new session doesn't restore a
    // pointless empty entry.
    if (state.cart.length === 0 && !state.selectedTableId && !state.selectedCustomer && state.orderType === 'Dine In') {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can fail (private browsing, quota) — losing draft persistence
    // isn't worth surfacing an error over; the cashier can still check out normally.
  }
}

export function loadCartDraft(): PersistedCartState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedCartState;
  } catch {
    return null;
  }
}

export function clearCartDraft(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}