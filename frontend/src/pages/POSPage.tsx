import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Scan, ShoppingCart, X, Plus, Minus,
  Trash2, ChevronDown, Phone, CheckCircle, AlertCircle, Loader,
  Pause, Save, Banknote, Smartphone, CreditCard, Shuffle, User, Star, Pencil, Landmark
} from 'lucide-react';
import api from '@/lib/api';
import { enqueueSale } from '@/lib/offlineSync/queue';
import { saveCartDraft, loadCartDraft, clearCartDraft } from '@/lib/posCartPersistence';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { confirmDelete } from '@/lib/confirmPreference';
import { formatCurrency, resolveMenuImage, menuImagePlaceholder } from '@/lib/utils';
import toast from 'react-hot-toast';
import Receipt from '@/components/Receipt';

interface MenuItem  { id: string; name: string; price: number; category_name: string; image_url?: string; tags?: string[]; track_stock?: boolean; stock_quantity?: number; reorder_level?: number; status?: string; }
interface CartItem  extends MenuItem { quantity: number; }
interface Category  { id: string; name: string; item_count: number; }
interface RestaurantTable { id: string; table_number: string; status: string; capacity?: number; area?: string; }
interface HeldOrder {
  id: string; label?: string; type: string; table_id?: string; table_number?: string;
  customer_name?: string; items: CartItem[]; item_count: number; subtotal: number;
  created_at: string; created_by_name?: string;
}

type MpesaStatus = 'idle' | 'sending' | 'waiting' | 'completed' | 'failed' | 'cancelled';
type CardStatus = 'idle' | 'creating_order' | 'waiting_for_customer' | 'processing' | 'completed' | 'failed' | 'not_configured';

const ORDER_TYPES     = ['Dine In', 'Takeaway', 'Delivery'];

export default function POSPage() {
  const navigate = useNavigate();
  // Read once, synchronously, before any state initializes — this is what
  // lets cart/orderType/table/customer come back pre-filled on the very
  // first render after a refresh, rather than flashing empty and then
  // populating a moment later.
  const cartDraft = loadCartDraft();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items,      setItems]      = useState<MenuItem[]>([]);
  const [cart,       setCart]       = useState<CartItem[]>(() => cartDraft?.cart || []);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search,         setSearch]         = useState('');
  const [tables,          setTables]          = useState<RestaurantTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(() => cartDraft?.selectedTableId ?? null);
  const [orderType,      setOrderType]      = useState(() => cartDraft?.orderType || 'Dine In');
  const [loadingMenu,    setLoadingMenu]    = useState(false);
  const [paymentMethod,  setPaymentMethod]  = useState('Cash');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showTablePicker,   setShowTablePicker]   = useState(false);
  const [showTypePicker,    setShowTypePicker]     = useState(false);
  const [activeOrderCount,  setActiveOrderCount]   = useState<number | null>(null);
  const [heldOrders,        setHeldOrders]         = useState<HeldOrder[]>([]);
  const [showHeldPanel,     setShowHeldPanel]      = useState(false);
  // Mobile-only — below md: the cart used to always sit stacked under the
  // menu grid, permanently eating half the screen height even when empty.
  // This makes it a hidden-by-default slide-up drawer instead, opened via
  // the cart icon in the top bar, so the menu gets the full screen until
  // someone actually wants to see their cart. Desktop is untouched — it
  // still shows the cart as a permanent side panel regardless of this.
  const [mobileCartOpen,    setMobileCartOpen]      = useState(false);

  // ── Customer attachment + loyalty toggle ────────────────────────────────
  // Walk-in by default (selectedCustomer === null) — attaching a real
  // customer is what makes loyalty points possible at all (points need
  // somewhere to go), and awardLoyalty is the per-sale choice on top of
  // that: a cashier can attach a customer for order history/records without
  // necessarily wanting to earn points on this particular sale (e.g. a
  // staff discount).
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; full_name: string; phone?: string; available_points?: number } | null>(() => cartDraft?.selectedCustomer ?? null);
  // "Add special instructions" used to be a dead button with no onClick at
  // all — the backend already has a real special_instructions column on
  // orders (and on order_items, for per-item notes), so this was only ever
  // missing the frontend wiring, not a backend gap.
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [showInstructionsInput, setShowInstructionsInput] = useState(false);
  const [awardLoyalty, setAwardLoyalty] = useState(true);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  // Scan — a real USB barcode scanner behaves as a keyboard: it "types" the
  // code into whatever's focused, fast, then sends Enter. There's no camera
  // feed involved, so this is just an auto-focused input capturing that,
  // not an image-based scanner (no camera-scanning library is part of this
  // build). scanFeed keeps a short running log so a cashier scanning several
  // items in a row can see what just got added without the modal closing
  // after each one.
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanFeed, setScanFeed] = useState<Array<{ ok: boolean; text: string }>>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Array<{ id: string; full_name: string; phone?: string; available_points?: number }>>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [pointValueKes, setPointValueKes] = useState(1);
  // Which tender buttons actually show up at checkout, and which one is
  // pre-selected — configured from Settings > POS & Payments rather than
  // fixed in code. Cash is never excluded here even if somehow misconfigured,
  // since it's the one method that always has to work.
  const [posConfig, setPosConfig] = useState({ defaultMethod: 'Cash', enableMpesa: true, enableCard: true, enableTill: true, enablePointsRedemption: true });
  const isOnline = useOnlineStatus();
  const [pointsToRedeem, setPointsToRedeem] = useState('');

  // ── Multi-tender payment state ─────────────────────────────────────────
  // Once the FIRST payment is taken against a cart, the resulting order is
  // held here as `activeOrder` and the cart locks (no more adding/removing
  // items — the order is already priced server-side). Every subsequent
  // "Checkout" tap applies ANOTHER payment against this SAME order rather
  // than creating a new one, so a bill can be split across methods — e.g.
  // half by M-Pesa, half by cash — simply by charging a partial amount,
  // seeing the remaining balance, and picking a different method for the
  // rest. The order only finalizes (prints, clears) once the balance hits
  // zero, regardless of how many separate tenders it took to get there.
  const [activeOrder, setActiveOrder] = useState<{
    id: string; order_number: string; type: string; total: number; amount_paid: number; table_id: string | null;
  } | null>(null);
  const [tenderAmount, setTenderAmount] = useState('');
  const [receiptOrder, setReceiptOrder] = useState<Record<string, unknown> | null>(null);

  const selectedTable = tables.find(t => t.id === selectedTableId) || null;

  /* M-Pesa */
  const [showMpesaModal,    setShowMpesaModal]    = useState(false);
  const [mpesaPhone,        setMpesaPhone]        = useState('');
  const [mpesaStatus,       setMpesaStatus]       = useState<MpesaStatus>('idle');
  const [checkoutRequestId, setCheckoutRequestId] = useState('');
  const [currentOrderId,    setCurrentOrderId]    = useState('');

  /* Card payment (Pesapal — Visa/Mastercard via hosted checkout).
     Unlike a physical card reader, this is a redirect-based flow: create
     an order server-side, show Pesapal's own secure checkout page in an
     iframe, then poll for the customer having completed it — the same
     shape as the M-Pesa flow above, just with a checkout page instead of
     a phone prompt. */
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardStatus, setCardStatus] = useState<CardStatus>('idle');
  const [cardError, setCardError] = useState('');
  const [cardRedirectUrl, setCardRedirectUrl] = useState('');
  const orderTrackingIdRef = useRef<string>('');
  const cardPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Split bill */
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitParts,     setSplitParts]     = useState(2);
  // The split modal previously had no way to record HOW the money was
  // actually collected — every split payment was tagged with the generic
  // 'split' method regardless of whether it was cash or card, so there was
  // no way to reconcile split-bill takings against the till or bank
  // statement. M-Pesa isn't an option here since it needs the async
  // STK-push flow (a phone number per person), which doesn't fit this
  // single confirm-and-done action.
  const [splitPaymentMethod, setSplitPaymentMethod] = useState<'cash' | 'card' | 'till'>('cash');

  /* ── Load menu ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingMenu(true);
        const [catRes, itemRes] = await Promise.all([
          api.get('/menu/categories'),
          // available + unavailable + out_of_stock (everything except
          // archived) — items a manager or chef has temporarily marked off
          // (e.g. an uninventoried dish like pilau that's run out for the
          // day) still need to be visible here so staff know it exists and
          // can tell a customer "not today" — see the disabled-card
          // rendering below. Only genuinely archived/discontinued items are
          // excluded entirely.
          api.get('/menu/items?limit=100&status=available,unavailable,out_of_stock'),
        ]);
        setCategories(catRes.data.data);
        setItems(itemRes.data.data);
      } catch { toast.error('Failed to load menu'); }
      finally   { setLoadingMenu(false); }
    };
    load();
  }, []);

  /* ── Live order count for the header badge ───────────────────────────
     Replaces what used to be a hardcoded "3". Polls a lightweight stats
     endpoint (counts only, no order rows) every 15s so the badge reflects
     what's actually in the kitchen/queue right now. Also refreshed
     immediately after this terminal creates an order, so the cashier sees
     their own action reflected without waiting for the next poll tick. */
  const refreshOrderCount = async () => {
    try {
      const res = await api.get('/orders/stats/active');
      setActiveOrderCount(res.data.data.active);
    } catch { /* non-critical — leave the last known count showing */ }
  };

  /* ── Real tables ───────────────────────────────────────────────────────
     Previously the table picker was a hardcoded T01–T12 label array that
     was never actually linked to a real restaurant_tables row — selecting
     "T05" was cosmetic only, and dine-in orders never occupied a real
     table. Now sourced from the same GET /tables the Tables page uses, and
     table_id is sent with the order (see createOrder below), so this
     terminal and the Tables page finally agree on what's occupied. */
  const fetchTables = async () => {
    try {
      const res = await api.get('/tables');
      setTables(res.data.data);
    } catch { /* non-critical for polling refreshes — keep the last known list */ }
  };

  /* ── Held orders (Hold Order / Save Draft) ───────────────────────────── */
  const fetchHeldOrders = async () => {
    try {
      const res = await api.get('/held-orders');
      setHeldOrders(res.data.data);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    refreshOrderCount();
    fetchTables();
    fetchHeldOrders();
    const interval = setInterval(() => { refreshOrderCount(); fetchTables(); fetchHeldOrders(); }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  useEffect(() => { api.get('/loyalty/stats').then(r => setPointValueKes(r.data.data.point_value_kes)).catch(() => {}); }, []);

  // Persists the in-progress sale so a refresh or navigating away and back
  // doesn't silently wipe out whatever was already rung up — this used to
  // be pure component state with no recovery at all.
  useEffect(() => {
    saveCartDraft({ cart, orderType, selectedTableId, selectedCustomer });
  }, [cart, orderType, selectedTableId, selectedCustomer]);
  useEffect(() => {
    api.get('/settings').then(r => {
      const s = r.data.data;
      setPosConfig({
        defaultMethod: s.pos_default_payment_method || 'Cash',
        enableMpesa: s.pos_enable_mpesa !== 'false',
        enableCard: s.pos_enable_card !== 'false',
        enableTill: s.pos_enable_till !== 'false',
        enablePointsRedemption: s.pos_enable_points_redemption !== 'false',
      });
      if (s.pos_default_payment_method) setPaymentMethod(s.pos_default_payment_method);
    }).catch(() => {});
  }, []);

  // Debounced customer search — only runs while the picker is actually open,
  // same 400ms pattern used for search boxes elsewhere in the app.
  useEffect(() => {
    if (!showCustomerPicker) return;
    if (!customerSearch.trim()) { setCustomerResults([]); return; }
    const t = setTimeout(async () => {
      setSearchingCustomers(true);
      try {
        const { data } = await api.get('/customers', { params: { search: customerSearch, limit: 8 } });
        setCustomerResults(data.data);
      } catch { /* non-critical */ }
      finally { setSearchingCustomers(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [customerSearch, showCustomerPicker]);

  /* ── Cart helpers ──────────────────────────────────────────────────── */
  const filtered = items.filter(item => {
    const matchCat    = activeCategory === 'All' || item.category_name === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // Soft guard for countable stock: lets the cashier keep working (never a
  // hard dead-end), but stops silent over-selling past what's on the shelf
  // and explains why with a toast — this is the "alert" the countable-stock
  // feature is meant to give at the point of sale.
  const addToCart = (item: MenuItem) =>
    setCart(prev => {
      const found = prev.find(c => c.id === item.id);
      const nextQty = (found?.quantity || 0) + 1;
      if (item.track_stock && nextQty > (item.stock_quantity ?? 0)) {
        toast.error((item.stock_quantity ?? 0) > 0 ? `Only ${item.stock_quantity} ${item.name} left in stock` : `${item.name} is out of stock`);
        return prev;
      }
      if (found) return prev.map(c => c.id === item.id ? { ...c, quantity: nextQty } : c);
      return [...prev, { ...item, quantity: 1 }];
    });

  const handleScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setScanning(true);
    try {
      const { data } = await api.get(`/menu/items/barcode/${encodeURIComponent(trimmed)}`);
      addToCart(data.data);
      setScanFeed(prev => [{ ok: true, text: `Added: ${data.data.name}` }, ...prev].slice(0, 6));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || `No item found for "${trimmed}"`;
      setScanFeed(prev => [{ ok: false, text: msg }, ...prev].slice(0, 6));
    } finally {
      setScanning(false);
      setScanInput('');
    }
  };

  const closeScanModal = () => { setShowScanModal(false); setScanInput(''); setScanFeed([]); };

  const updateQty = (id: string, delta: number) =>
    setCart(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        const nextQty = c.quantity + delta;
        if (delta > 0 && c.track_stock && nextQty > (c.stock_quantity ?? 0)) {
          toast.error((c.stock_quantity ?? 0) > 0 ? `Only ${c.stock_quantity} ${c.name} left in stock` : `${c.name} is out of stock`);
          return c;
        }
        return { ...c, quantity: Math.max(0, nextQty) };
      }).filter(c => c.quantity > 0)
    );

  /* ── Totals ───────────────────────────────────────────────────────────
     Mirrors the backend exactly (ordersController.createOrder): 5% service
     charge + 16% tax on top of the item subtotal. These used to be silently
     absent from the POS preview while the backend charged them anyway —
     fixed so cashiers and customers see the real total before payment. */
  const subtotal      = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  // No service charge or VAT — the business charges menu prices as-is, and
  // the total the customer pays is just the sum of what's in the cart. The
  // backend computes this identically (see createOrder), so this is purely
  // a pre-checkout preview, never the figure actually charged.
  const total          = Math.round(subtotal * 100) / 100;
  const itemCount      = cart.reduce((s, c) => s + c.quantity, 0);
  // What THIS tender will actually charge — the balance due (or the whole
  // pre-order total if no order exists yet), capped by whatever the cashier
  // typed into "Amount to charge now". Used for the M-Pesa modal's display
  // so it never shows the full bill when only a partial amount is being
  // pushed to the customer's phone.
  const balanceDueDisplay = activeOrder ? Math.max(0, Math.round((activeOrder.total - activeOrder.amount_paid) * 100) / 100) : total;
  const chargeAmountDisplay = tenderAmount ? Math.min(Number(tenderAmount) || 0, balanceDueDisplay) : balanceDueDisplay;

  // "Points" only ever shows up as a tender option once there's an actual
  // customer attached with something to spend — for a walk-in sale it
  // wouldn't mean anything. M-Pesa and Card can each be turned off
  // entirely from Settings > POS & Payments (e.g. a business that hasn't
  // set up card payments yet); Cash always stays available regardless.
  //
  // While offline, M-Pesa, Split Bill, and Points all drop out regardless
  // of those settings — none of them can work without a live server. M-Pesa
  // needs an actual call to Safaricom (there's no way to queue that), and
  // Split Bill / Points both need a live, current balance to check against
  // rather than a possibly-stale local number.
  const availableMethods = useMemo(() => [
    'Cash',
    ...(posConfig.enableMpesa && isOnline ? ['M-Pesa'] : []),
    ...(posConfig.enableCard && isOnline ? ['Card'] : []),
    ...(posConfig.enableTill ? ['Till'] : []),
    ...(isOnline ? ['Split Bill'] : []),
    ...(posConfig.enablePointsRedemption && isOnline && (selectedCustomer?.available_points || 0) > 0 ? ['Points'] : []),
  ], [posConfig.enableMpesa, posConfig.enableCard, posConfig.enableTill, posConfig.enablePointsRedemption, isOnline, selectedCustomer?.available_points]);
  const maxPointsUsable = Math.min(
    selectedCustomer?.available_points || 0,
    pointValueKes > 0 ? Math.floor(balanceDueDisplay / pointValueKes) : 0
  );
  useEffect(() => {
    if (!availableMethods.includes(paymentMethod)) setPaymentMethod('Cash');
  }, [paymentMethod, availableMethods]);

  /* ── Create order ──────────────────────────────────────────────────── */
  // Dine-in orders need a real table — otherwise the kitchen has an order
  // with nowhere to deliver it, and the table picker's whole point (keeping
  // the Tables page in sync with what's actually happening at the POS) is
  // defeated. Takeaway/delivery never need one.
  const requireTableIfDineIn = (): boolean => {
    if (orderType === 'Dine In' && !selectedTableId) {
      toast.error('Select a table for this dine-in order');
      setShowTablePicker(true);
      return false;
    }
    return true;
  };

  const createOrder = async (paymentMethodHint: 'cash' | 'card' | 'till' | 'mpesa' | 'split') => {
    const res = await api.post('/orders', {
      type: orderType === 'Dine In' ? 'dine_in' : orderType === 'Takeaway' ? 'takeaway' : 'delivery',
      // A real table_id links this order to restaurant_tables (occupies it,
      // shows up on the Tables page) — omitted entirely for takeaway/delivery.
      table_id: orderType === 'Dine In' ? selectedTableId : undefined,
      customer_id: selectedCustomer?.id,
      customer_name: selectedCustomer?.full_name || 'Walk-in Customer',
      guests: 1,
      items: cart.map(c => ({ menu_item_id: c.id, item_name: c.name, quantity: c.quantity, unit_price: c.price })),
      special_instructions: specialInstructions || undefined,
      payment_method: paymentMethodHint,
    });
    refreshOrderCount(); // reflect this terminal's own order without waiting for the next poll tick
    if (orderType === 'Dine In') {
      // That table is now occupied by this order — free up the picker for
      // whoever the cashier serves next, and refresh so the picker reflects
      // the new occupied status if opened again immediately.
      setSelectedTableId(null);
      fetchTables();
    }
    return res.data.data;
  };

  /* ── Receipt printing ──────────────────────────────────────────────────
     Fetches the full order (items + every payment recorded against it —
     which, for a mixed-tender sale, is more than one row) and loads it into
     `receiptOrder`, which the print-only markup at the bottom of this file
     renders. The useEffect above fires window.print() once it's in state.
     Printing failures are swallowed on purpose — a receipt is a convenience
     on top of a completed, already-recorded sale; it must never be able to
     make the checkout itself look like it failed. */
  const printReceipt = async (orderId: string) => {
    try {
      const res = await api.get(`/orders/${orderId}`);
      setReceiptOrder(res.data.data);
    } catch { /* non-critical */ }
  };

  /* ── Multi-tender core ───────────────────────────────────────────────
     Returns the order this checkout is collecting payment against,
     creating one only if this is the FIRST tender for the current cart.
     Every subsequent call (a second, different-method payment on the same
     bill) returns the SAME order untouched — createOrder is only ever
     called once per sale. */
  const ensureActiveOrder = async (methodHint: 'cash' | 'card' | 'till' | 'mpesa' | 'split') => {
    if (activeOrder) return activeOrder;
    const order = await createOrder(methodHint);
    const ao = {
      id: order.id, order_number: order.order_number, type: order.type,
      total: Number(order.total), amount_paid: Number(order.amount_paid || 0),
      table_id: order.table_id || null,
    };
    setActiveOrder(ao);
    return ao;
  };

  /* Called after any payment (cash/card/split immediately, or M-Pesa once
     the poll/callback confirms it) with the resulting balance. Finalizes
     the sale — prints the receipt, clears the cart — once the balance
     reaches zero; otherwise keeps activeOrder open so the cashier can apply
     a different method for the rest, and pre-fills the amount field with
     exactly what's still owed. */
  const settleAfterPayment = (order: { id: string; order_number: string; type: string; total: number }, balanceRemaining: number) => {
    if (balanceRemaining <= 0.01) {
      toast.success(`Order #${order.order_number} sent to kitchen!`);
      printReceipt(order.id);
      setCart([]);
      setSpecialInstructions(''); setShowInstructionsInput(false);
      setMobileCartOpen(false);
      setActiveOrder(null);
      setTenderAmount('');
      setSelectedCustomer(null);
      setAwardLoyalty(true);
      setPointsToRedeem('');
      setSplitPaymentMethod('cash');
      clearCartDraft();
    } else {
      setActiveOrder(prev => prev ? { ...prev, amount_paid: prev.total - balanceRemaining } : prev);
      setTenderAmount(String(balanceRemaining));
      toast(`KES ${balanceRemaining.toFixed(2)} still due — choose a payment method for the rest.`, { icon: '💰' });
    }
  };

  /* ── Cash / Card checkout — now tender-amount aware ───────────────────
     Charges `tenderAmount` (defaults to the full balance due) via the
     chosen method against activeOrder, creating it first if this is the
     first tender for the cart. Settling decides whether that was enough to
     finish the sale or whether the balance is still open for another
     method. */
  const payCashOrCard = async (method: 'cash' | 'card' | 'till') => {
    if (!cart.length && !activeOrder) { toast.error('Cart is empty'); return; }
    if (!activeOrder && !requireTableIfDineIn()) return;
    if (processingPayment) return; // guard against double-submit
    setProcessingPayment(true);
    try {
      const order = await ensureActiveOrder(method);
      const balanceDue = Math.max(0, Math.round((order.total - order.amount_paid) * 100) / 100);
      const amount = tenderAmount ? Math.min(Number(tenderAmount), balanceDue) : balanceDue;
      if (!(amount > 0)) { toast.error('Enter an amount to charge'); return; }
      const res = await api.post(`/orders/${order.id}/payment`, { payment_method: method, amount, award_loyalty: awardLoyalty });
      if (res.data.points_awarded > 0) toast.success(`+${res.data.points_awarded} loyalty points earned`, { icon: '⭐' });
      settleAfterPayment(order, res.data.balance_remaining);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Checkout failed';
      toast.error(msg);
    } finally { setProcessingPayment(false); }
  };

  /* ── Offline checkout — a deliberately separate, simpler path ──────────
     Online checkout supports partial tenders, switching methods mid-sale,
     and building on an order that already exists. None of that is safe to
     replicate against a local queue with no live server to check balances
     against, so offline mode only ever does ONE thing: ring up the whole
     cart as a single, full Cash or Card payment, queue it, and finish the
     sale immediately from the cashier's point of view — the sync happening
     later is a background concern, not something the till should wait on. */
  const payCashOrCardOffline = async (method: 'cash' | 'card' | 'till') => {
    if (!cart.length) { toast.error('Cart is empty'); return; }
    if (activeOrder) {
      toast.error('This order already has a partial payment recorded online — reconnect to finish it rather than starting a new one offline.');
      return;
    }
    if (!requireTableIfDineIn()) return;
    if (processingPayment) return;
    setProcessingPayment(true);
    try {
      await enqueueSale(
        {
          type: orderType === 'Dine In' ? 'dine_in' : orderType === 'Takeaway' ? 'takeaway' : 'delivery',
          table_id: orderType === 'Dine In' ? selectedTableId || undefined : undefined,
          customer_id: selectedCustomer?.id,
          customer_name: selectedCustomer?.full_name || 'Walk-in Customer',
          guests: 1,
          items: cart.map(c => ({ menu_item_id: c.id, item_name: c.name, quantity: c.quantity, unit_price: c.price })),
          special_instructions: specialInstructions || undefined,
          payment_method: method,
        },
        { payment_method: method, amount: total, award_loyalty: awardLoyalty }
      );
      toast.success(`Sale queued (${formatCurrency(total)}) — will sync automatically once back online`, { icon: '📥', duration: 5000 });
      setCart([]);
      setSpecialInstructions(''); setShowInstructionsInput(false);
      setMobileCartOpen(false);
      setActiveOrder(null);
      setTenderAmount('');
      setSelectedCustomer(null);
      setAwardLoyalty(true);
      clearCartDraft();
    } catch {
      toast.error('Failed to queue this sale locally — please try again');
    } finally { setProcessingPayment(false); }
  };

  /* ── Redeem loyalty points as a tender ────────────────────────────────
     Same multi-tender shape as cash/card — the server derives the KES
     amount from the points count and the configured rate itself (never
     trusts a client-supplied amount here), and rejects rather than silently
     capping if it would exceed the balance due, exactly like an overpaid
     cash tender already does. This reduces what's actually owed without
     ever touching the order's underlying subtotal/total — it's a payment
     method, not a discount on the bill. */
  const payWithPoints = async () => {
    if (!selectedCustomer) { toast.error('Attach a customer to redeem their points'); return; }
    if (!cart.length && !activeOrder) { toast.error('Cart is empty'); return; }
    if (!activeOrder && !requireTableIfDineIn()) return;
    if (processingPayment) return;
    const points = pointsToRedeem ? Math.trunc(Number(pointsToRedeem)) : maxPointsUsable;
    if (!(points > 0)) { toast.error('Enter how many points to redeem'); return; }
    setProcessingPayment(true);
    try {
      const order = await ensureActiveOrder('cash'); // methodHint only matters for M-Pesa's own flow
      const res = await api.post(`/orders/${order.id}/payment`, { payment_method: 'points', points, award_loyalty: awardLoyalty });
      toast.success(`${points} points redeemed (${formatCurrency(points * pointValueKes)})`);
      setPointsToRedeem('');
      settleAfterPayment(order, res.data.balance_remaining);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Redemption failed';
      toast.error(msg);
    } finally { setProcessingPayment(false); }
  };

  /* ── M-Pesa STK Push ───────────────────────────────────────────────── */
  const openMpesaModal = () => {
    if (!cart.length && !activeOrder) { toast.error('Cart is empty'); return; }
    if (!activeOrder && !requireTableIfDineIn()) return;
    setMpesaPhone(''); setMpesaStatus('idle');
    setCheckoutRequestId(''); setCurrentOrderId(activeOrder?.id || '');
    setShowMpesaModal(true);
  };

  /* Once an M-Pesa payment is confirmed (via poll or manual reconcile), the
     status endpoints only tell us THIS payment succeeded — not whether the
     order's balance is now zero (relevant the moment a partial M-Pesa
     tender is only PART of a mixed payment). Re-fetch the order to find
     out, then hand off to the same settle logic cash/card uses, so a
     mixed-tender sale finalizes (receipt, clear cart) at exactly the same
     "balance reached zero" moment regardless of which method got it there. */
  const finishMpesaFlow = async (orderId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setMpesaStatus('completed');
    try {
      const res = await api.get(`/orders/${orderId}`);
      const o = res.data.data;
      const balance = Math.max(0, Math.round((Number(o.total) - Number(o.amount_paid)) * 100) / 100);
      if (o.loyalty_points_earned > 0) toast.success(`+${o.loyalty_points_earned} loyalty points earned`, { icon: '⭐' });
      setTimeout(() => {
        setShowMpesaModal(false);
        settleAfterPayment({ id: o.id, order_number: o.order_number, type: o.type, total: Number(o.total) }, balance);
      }, 1500);
    } catch {
      // Payment definitely succeeded (we're in this branch because Safaricom
      // confirmed it) — if we simply can't reach our own API to check the
      // exact remaining balance, don't leave the cashier stuck mid-modal.
      toast.success('M-Pesa payment confirmed!');
      setTimeout(() => {
        setShowMpesaModal(false); setCart([]); setActiveOrder(null); setTenderAmount('');
        setSpecialInstructions(''); setShowInstructionsInput(false);
        setMobileCartOpen(false);
        setSelectedCustomer(null); clearCartDraft();
      }, 1500);
    }
  };

  const sendStkPush = async () => {
    if (mpesaStatus === 'sending' || mpesaStatus === 'waiting') return; // guard double-submit
    if (mpesaPhone.replace(/\D/g, '').length < 9) {
      toast.error('Enter a valid M-Pesa number'); return;
    }
    setMpesaStatus('sending');
    try {
      const order = await ensureActiveOrder('mpesa');
      setCurrentOrderId(order.id);

      const balanceDue = Math.max(0, Math.round((order.total - order.amount_paid) * 100) / 100);
      const amount = tenderAmount ? Math.min(Number(tenderAmount), balanceDue) : balanceDue;
      if (!(amount > 0)) { toast.error('Enter an amount to charge'); setMpesaStatus('idle'); return; }

      const res = await api.post('/mpesa/stk-push', { order_id: order.id, phone: mpesaPhone, amount, award_loyalty: awardLoyalty });
      const { checkout_request_id } = res.data.data;
      setCheckoutRequestId(checkout_request_id);
      setMpesaStatus('waiting');

      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const sr = await api.get(`/mpesa/status/${checkout_request_id}`);
          const { status } = sr.data;
          if (status === 'completed') {
            finishMpesaFlow(order.id);
          } else if (status === 'cancelled') {
            clearInterval(pollRef.current!); setMpesaStatus('cancelled');
          } else if (status === 'expired') {
            clearInterval(pollRef.current!); setMpesaStatus('failed');
            toast.error('Payment request expired — the customer did not respond in time.');
          } else if (status === 'failed' || attempts >= 24) {
            clearInterval(pollRef.current!); setMpesaStatus('failed');
            if (attempts >= 24) toast.error('Still waiting after 70s — use "Check status" or try again.');
          }
        } catch { /* network hiccup — keep polling, don't fail the whole flow on one bad request */ }
      }, 3000);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to send STK Push';
      // Deliberately distinct wording from the customer-side outcomes below
      // (expired/cancelled/failed after the push actually reached their
      // phone) — this failure happens before the customer is involved at
      // all, so it shouldn't read like their payment failed.
      toast.error(`Couldn't send the payment request: ${msg}`);
      setMpesaStatus('failed');
    }
  };

  /* Manual reconciliation — lets a cashier force a re-check against
     Safaricom directly instead of waiting on the 3s poll or the callback.
     Useful when the callback is slow or the poll silently keeps missing. */
  const checkStatusNow = async () => {
    if (!checkoutRequestId) return;
    try {
      const res = await api.post(`/mpesa/reconcile/${checkoutRequestId}`);
      const { status } = res.data;
      if (status === 'completed') {
        finishMpesaFlow(currentOrderId);
      } else if (status === 'cancelled' || status === 'expired' || status === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current);
        setMpesaStatus('failed');
      } else {
        toast('Still waiting for the customer to enter their PIN…', { icon: '⏳' });
      }
    } catch {
      toast.error('Could not reach M-Pesa to check status. Try again in a moment.');
    }
  };

  const cancelMpesa = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setShowMpesaModal(false); setMpesaStatus('idle');
    if (currentOrderId) {
      // Actually cancel the pending payment + release the order, instead of
      // just telling the cashier to clean it up manually from Orders. The
      // order itself isn't deleted — its items are kept and it goes back to
      // a payable 'new' state in case the cashier wants to retry with cash.
      try {
        await api.post(`/orders/${currentOrderId}/cancel-payment`);
        toast('Payment request cancelled. Order is still open — pick a different payment method.', { icon: 'ℹ️' });
      } catch {
        toast.error('Could not cancel the pending payment automatically. Check the Orders page.');
      }
    }
  };

  /* ── Pesapal (card payment — Visa/Mastercard) ──────────────────────────
     A hosted-checkout flow, not a physical reader: create an order
     server-side, show Pesapal's own secure checkout page in an iframe,
     then poll for the customer having completed it — the same shape as
     the M-Pesa flow above, just with a checkout page instead of a phone
     prompt. The backend never trusts this polling's own report either —
     it re-checks with Pesapal directly before applying anything (see
     getPesapalPaymentStatus on the backend). */
  const openCardModal = () => {
    if (!cart.length && !activeOrder) { toast.error('Cart is empty'); return; }
    if (!activeOrder && !requireTableIfDineIn()) return;
    setCardError('');
    setCardStatus('idle');
    setCardRedirectUrl('');
    setShowCardModal(true);
    runCardPayment();
  };

  const pollCardPaymentStatus = (order: { id: string; order_number: string; type: string; total: number }, orderTrackingId: string) => {
    if (cardPollRef.current) clearInterval(cardPollRef.current);
    cardPollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/pesapal/status/${orderTrackingId}`);
        if (data.status === 'completed') {
          if (cardPollRef.current) clearInterval(cardPollRef.current);
          setCardStatus('completed');
          setTimeout(() => {
            setShowCardModal(false);
            settleAfterPayment(order, data.balance_remaining);
          }, 1200);
        } else if (data.status === 'failed') {
          if (cardPollRef.current) clearInterval(cardPollRef.current);
          setCardStatus('failed');
          setCardError(data.message || 'The card payment failed or was cancelled by the customer');
        }
        // 'pending' — keep polling, customer is still on the checkout page.
      } catch { /* transient network hiccup — next poll tick will retry */ }
    }, 3000);
  };

  const runCardPayment = async () => {
    setCardError('');
    try {
      const order = await ensureActiveOrder('card');
      const balanceDue = Math.max(0, Math.round((order.total - order.amount_paid) * 100) / 100);
      const amount = tenderAmount ? Math.min(Number(tenderAmount), balanceDue) : balanceDue;
      if (!(amount > 0)) { setCardStatus('failed'); setCardError('Enter an amount to charge'); return; }

      setCardStatus('creating_order');
      const [custFirstName, ...custLastNameParts] = (selectedCustomer?.full_name || '').split(' ');
      const orderRes = await api.post('/pesapal/create-order', {
        order_id: order.id, amount, award_loyalty: awardLoyalty,
        customer_phone: selectedCustomer?.phone,
        customer_first_name: custFirstName || undefined,
        customer_last_name: custLastNameParts.join(' ') || undefined,
      });
      const { redirect_url, order_tracking_id } = orderRes.data.data;
      orderTrackingIdRef.current = order_tracking_id;
      setCardRedirectUrl(redirect_url);
      setCardStatus('waiting_for_customer');
      pollCardPaymentStatus(order, order_tracking_id);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (e instanceof Error ? e.message : 'Card payment failed');
      setCardStatus(msg.includes('PESAPAL_') || msg.includes('not configured') ? 'not_configured' : 'failed');
      setCardError(msg);
    }
  };

  const cancelCardPayment = async () => {
    if (cardPollRef.current) clearInterval(cardPollRef.current);
    if (orderTrackingIdRef.current) {
      try { await api.post('/pesapal/cancel', { order_tracking_id: orderTrackingIdRef.current }); }
      catch { /* best-effort — the payment row will still show as failed/pending for manual review */ }
    }
    setShowCardModal(false);
    setCardStatus('idle');
    setCardRedirectUrl('');
    orderTrackingIdRef.current = '';
  };

  /* ── Held order actions: hold, save-as-draft, resume, discard ──────────
     A held order is a suspended cart, not a real order — nothing here
     touches inventory, the kitchen, or table occupancy. "Hold Order" parks
     anonymously; "Save Draft" is the same action with an optional name
     attached, for a cart the cashier wants to find again by description
     (e.g. "Birthday table, waiting on 2 more guests"). */
  const holdCurrentOrder = async (label?: string) => {
    if (!cart.length) { toast.error('Cart is empty — nothing to hold'); return; }
    try {
      await api.post('/held-orders', {
        label: label || undefined,
        type: orderType === 'Dine In' ? 'dine_in' : orderType === 'Takeaway' ? 'takeaway' : 'delivery',
        table_id: orderType === 'Dine In' ? selectedTableId : undefined,
        table_number: orderType === 'Dine In' ? selectedTable?.table_number : undefined,
        items: cart,
      });
      toast.success(label ? `Draft "${label}" saved` : 'Order held — resume it anytime from Held');
      setCart([]);
      setSpecialInstructions(''); setShowInstructionsInput(false);
      setMobileCartOpen(false);
      setSelectedTableId(null);
      fetchHeldOrders();
    } catch {
      toast.error('Failed to hold order');
    }
  };

  const saveDraft = () => {
    if (!cart.length) { toast.error('Cart is empty — nothing to save'); return; }
    const label = window.prompt('Name this draft (optional):', '');
    if (label === null) return; // cashier cancelled the prompt
    holdCurrentOrder(label.trim() || undefined);
  };

  const resumeHeld = async (h: HeldOrder) => {
    if (cart.length > 0 && !confirm('This will replace your current cart. Continue?')) return;
    setCart(h.items);
    setOrderType(h.type === 'dine_in' ? 'Dine In' : h.type === 'takeaway' ? 'Takeaway' : 'Delivery');
    setSelectedTableId(h.table_id || null);
    setShowHeldPanel(false);
    try {
      await api.delete(`/held-orders/${h.id}`);
      fetchHeldOrders();
      toast.success('Order resumed');
    } catch {
      // The cart is already loaded either way — this only affects whether
      // the held record lingers in the list, which is a minor cleanup
      // nuisance, not a failed resume from the cashier's point of view.
      toast('Order resumed, but the held record may still show in the list.', { icon: '⚠️' });
    }
  };

  const discardHeld = async (id: string) => {
    if (!confirmDelete('Discard this held order? This cannot be undone.')) return;
    try {
      await api.delete(`/held-orders/${id}`);
      fetchHeldOrders();
      toast.success('Held order discarded');
    } catch {
      toast.error('Failed to discard held order');
    }
  };

  /* ── Main checkout dispatcher ──────────────────────────────────────── */
  const handleCheckout = () => {
    if (!cart.length && !activeOrder) { toast.error('Cart is empty'); return; }
    if (!activeOrder && !requireTableIfDineIn()) return;
    if (paymentMethod === 'M-Pesa')    openMpesaModal();
    else if (paymentMethod === 'Card') openCardModal();
    else if (paymentMethod === 'Split Bill') setShowSplitModal(true);
    else if (paymentMethod === 'Points') payWithPoints();
    else if (!isOnline) payCashOrCardOffline(paymentMethod.toLowerCase() as 'cash' | 'card' | 'till');
    else payCashOrCard(paymentMethod.toLowerCase() as 'cash' | 'card' | 'till');
  };

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div
      className="flex flex-col md:flex-row h-screen overflow-hidden"
      onClick={() => { setShowTablePicker(false); setShowTypePicker(false); setShowHeldPanel(false); }}
    >

      {/* ══════════════ LEFT — Menu ══════════════ */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-4 gap-3">

        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-status-success animate-pulse' : 'bg-status-error'}`} />
            <h1 className="font-bold text-xl text-text-primary tracking-tight">POS</h1>
            <span className={`text-sm font-medium ${isOnline ? 'text-status-success' : 'text-status-error'}`}>
              {isOnline ? '● Online' : '● Offline'}
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Mobile-only cart toggle — desktop already shows the cart
                permanently as a side panel, so this button doesn't exist
                there at all (md:hidden) rather than being redundant. */}
            <button
              onClick={e => { e.stopPropagation(); setMobileCartOpen(true); }}
              className="md:hidden btn-secondary flex items-center gap-1.5 text-sm py-2 relative"
              title="View cart"
            >
              <ShoppingCart size={15} />
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-status-error rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </button>
            <button onClick={() => setShowScanModal(true)} className="btn-secondary flex items-center gap-1.5 text-sm py-2" title="Scan">
              <Scan size={15} /> <span className="hidden sm:inline">Scan</span>
            </button>
            <button onClick={() => navigate('/orders')} className="btn-secondary flex items-center gap-1.5 text-sm py-2 relative" title="Orders">
              <ShoppingCart size={15} /> <span className="hidden sm:inline">Orders</span>
              {/* Live count of today's orders still in flight (new/preparing/
                  ready) — replaces what used to be a hardcoded "3". Hidden
                  entirely at zero so an idle POS doesn't show a stray badge. */}
              {activeOrderCount !== null && activeOrderCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-status-error rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                  {activeOrderCount > 99 ? '99+' : activeOrderCount}
                </span>
              )}
            </button>

            {/* Held orders */}
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => { setShowHeldPanel(p => !p); setShowTablePicker(false); setShowTypePicker(false); }}
                className="btn-secondary flex items-center gap-1.5 text-sm py-2 relative"
                title="Held orders"
              >
                <Pause size={14} /> <span className="hidden sm:inline">Held</span>
                {heldOrders.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-status-warning rounded-full text-[10px] font-bold flex items-center justify-center text-black">
                    {heldOrders.length > 99 ? '99+' : heldOrders.length}
                  </span>
                )}
              </button>
              {showHeldPanel && (
                <div className="absolute top-full mt-1 right-0 bg-surface-card border border-border rounded-xl shadow-modal z-50 w-72 max-h-80 overflow-y-auto">
                  {heldOrders.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-6 px-4">No held orders. Use "Hold Order" or "Save Draft" below the cart to park a sale.</p>
                  ) : (
                    <div className="p-1.5 space-y-1">
                      {heldOrders.map(h => (
                        <div key={h.id} className="p-2 rounded-lg hover:bg-surface-50 flex items-center justify-between gap-2">
                          <button onClick={() => resumeHeld(h)} className="flex-1 text-left min-w-0">
                            <p className="text-xs font-semibold text-text-primary truncate">
                              {h.label || `${h.item_count} item${h.item_count === 1 ? '' : 's'}`}
                              {h.table_number && <span className="text-text-muted font-normal"> · Table {h.table_number}</span>}
                            </p>
                            <p className="text-[11px] text-text-muted">{h.item_count} item{h.item_count === 1 ? '' : 's'} · {formatCurrency(h.subtotal)}</p>
                          </button>
                          <button onClick={() => discardHeld(h.id)} className="btn-ghost p-1 hover:text-status-error shrink-0" title="Discard">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Table picker */}
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => { if (orderType === 'Dine In') { setShowTablePicker(p => !p); setShowTypePicker(false); setShowHeldPanel(false); } }}
                disabled={orderType !== 'Dine In'}
                className="btn-secondary flex items-center gap-1.5 text-sm py-2 font-bold text-brand disabled:opacity-40 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
              >
                {orderType === 'Dine In' ? (selectedTable ? selectedTable.table_number : 'Select Table') : orderType}
                {orderType === 'Dine In' && <ChevronDown size={13} />}
              </button>
              {showTablePicker && orderType === 'Dine In' && (
                <div className="absolute top-full mt-1 right-0 bg-surface-card border border-border rounded-xl shadow-modal z-50 p-2 grid grid-cols-4 gap-1 w-56 max-h-64 overflow-y-auto">
                  {tables.length === 0 && <p className="col-span-4 text-xs text-text-muted text-center py-3">No tables configured</p>}
                  {tables.map(t => {
                    const occupied = t.status === 'occupied' && t.id !== selectedTableId;
                    return (
                      <button key={t.id}
                        onClick={() => {
                          if (occupied && !confirm(`${t.table_number} shows as occupied by another order. Select it anyway?`)) return;
                          setSelectedTableId(t.id); setShowTablePicker(false);
                        }}
                        className={`px-2 py-2 rounded-lg text-sm font-semibold transition-colors relative ${
                          selectedTableId === t.id ? 'bg-brand text-black'
                          : occupied ? 'text-status-error/70 hover:bg-surface-50'
                          : 'hover:bg-surface-50 text-text-secondary'
                        }`}
                        title={occupied ? 'Occupied' : 'Available'}
                      >{t.table_number}</button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Order type picker */}
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => { setShowTypePicker(p => !p); setShowTablePicker(false); setShowHeldPanel(false); }}
                className="btn-secondary flex items-center gap-1.5 text-sm py-2 shrink-0 whitespace-nowrap"
              >
                <ShoppingCart size={13} /> {orderType} <ChevronDown size={13} />
              </button>
              {showTypePicker && (
                <div className="absolute top-full mt-1 right-0 bg-surface-card border border-border rounded-xl shadow-modal z-50 p-1.5 w-36">
                  {ORDER_TYPES.map(t => (
                    <button key={t}
                      onClick={() => { setOrderType(t); if (t !== 'Dine In') setSelectedTableId(null); setShowTypePicker(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${orderType === t ? 'bg-brand text-black' : 'hover:bg-surface-50 text-text-secondary'}`}
                    >{t}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-10 text-sm"
            placeholder="Search items by name or code...   Ctrl + K"
          />
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {['All', ...categories.map(c => c.name)].map(cat => (
            <button key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors shrink-0 ${activeCategory === cat ? 'bg-brand text-black' : 'bg-surface-50 text-text-secondary hover:text-text-primary border border-border'}`}
            >{cat}</button>
          ))}
          <div className="ml-auto flex gap-1 shrink-0">
            <button className="btn-ghost p-2">⊞</button>
            <button className="btn-ghost p-2">☰</button>
          </div>
        </div>

        {/* Menu grid */}
        {loadingMenu ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-border border-t-brand rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(item => {
                const manuallyUnavailable = !!item.status && item.status !== 'available';
                return (
                <button key={item.id} onClick={() => !manuallyUnavailable && addToCart(item)}
                  disabled={manuallyUnavailable}
                  className={`card p-0 overflow-hidden transition-all text-left group ${
                    manuallyUnavailable ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:border-brand/60 active:scale-95 cursor-pointer'
                  }`}>
                  <div className="aspect-video bg-surface-50 overflow-hidden relative">
                    <img
                      src={resolveMenuImage(item.image_url, item.name)}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).src = menuImagePlaceholder(item.name); }}
                    />
                    {/* A manager/chef's manual toggle (for dishes with no
                        per-unit inventory count, like pilau) takes priority
                        over the countable-stock badge below — "we're out
                        for the day" is a more direct signal than any
                        quantity count for an item that was never
                        inventory-tracked to begin with. */}
                    {manuallyUnavailable ? (
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-status-error text-white">
                        Out of stock
                      </span>
                    ) : item.track_stock && (
                      <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        (item.stock_quantity ?? 0) <= 0 ? 'bg-status-error text-white'
                        : (item.stock_quantity ?? 0) <= (item.reorder_level ?? 5) ? 'bg-status-warning text-black'
                        : 'bg-black/60 text-status-success'
                      }`}>
                        {(item.stock_quantity ?? 0) <= 0 ? 'Out of stock' : `${item.stock_quantity} left`}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="pos-item-name text-text-primary truncate">{item.name}</p>
                    <p className="pos-item-price text-brand mt-0.5">KES {item.price.toLocaleString()}</p>
                    {item.tags?.[0] && (
                      <span className="mt-1.5 inline-block pos-item-tag px-2 py-0.5 rounded bg-status-success/10 text-status-success font-medium">
                        {item.tags[0]}
                      </span>
                    )}
                  </div>
                </button>
                );
              })}
            </div>
            <p className="text-xs text-text-muted text-center pt-3 pb-1">
              Showing {filtered.length} of {items.length} items
            </p>
          </div>
        )}

        {/* Bottom actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 pt-3 border-t border-border">
          <button onClick={() => holdCurrentOrder()} className="btn-secondary flex-1 min-w-0 py-2.5 text-sm flex items-center justify-center gap-2" title="Hold Order">
            <Pause size={14} /> <span className="hidden lg:inline">Hold Order</span>
          </button>
          <button onClick={saveDraft} className="btn-secondary flex-1 min-w-0 py-2.5 text-sm flex items-center justify-center gap-2" title="Save Draft">
            <Save size={14} /> <span className="hidden lg:inline">Save Draft</span>
          </button>
          <button
            onClick={() => { setCart([]); setSpecialInstructions(''); setShowInstructionsInput(false); }}
            className="btn-secondary flex-1 min-w-0 py-2.5 text-sm flex items-center justify-center gap-2 text-status-error border-status-error/20 hover:bg-status-error/5"
            title="Clear Cart"
          >
            <Trash2 size={14} /> <span className="hidden lg:inline">Clear Cart</span>
          </button>
          <button onClick={() => setMobileCartOpen(true)} className="btn-secondary py-2.5 px-2.5 sm:px-4 text-sm flex items-center gap-1.5 sm:gap-2 shrink-0" title="View cart">
            <ShoppingCart size={14} /> <span className="hidden sm:inline">Items</span> ({itemCount})
          </button>
        </div>
      </div>

      {/* Backdrop — mobile only, closes the drawer on tap-outside. Doesn't
          exist in the DOM at all on desktop (rather than existing-but-hidden)
          so it can never intercept a click on the permanent side panel. */}
      {mobileCartOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setMobileCartOpen(false)} />
      )}

      {/* ══════════════ RIGHT — Cart ══════════════ */}
      <div
        className={`w-full md:w-[340px] md:shrink-0 border-t md:border-t-0 md:border-l border-border bg-surface-card flex flex-col
          max-h-[85vh] md:max-h-none
          fixed inset-x-0 bottom-0 z-50 rounded-t-2xl md:rounded-none transition-transform duration-300 ease-in-out
          md:static md:z-auto md:translate-y-0
          ${mobileCartOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Mobile-only drag handle + close, purely visual/functional cues
            that this is a dismissible sheet — neither exists on desktop
            where the panel is just permanently docked. */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <span className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Table header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingCart size={17} className="text-brand shrink-0" />
            <span className="font-bold text-base truncate">
              {orderType === 'Dine In' ? (selectedTable ? `Table ${selectedTable.table_number}` : 'Dine In — no table selected') : orderType}
            </span>
          </div>
          <button onClick={() => setMobileCartOpen(false)} className="md:hidden btn-ghost p-1 shrink-0">
            <X size={16} />
          </button>
          {orderType === 'Dine In' && (
            <button onClick={() => setShowTablePicker(true)} className="text-sm text-brand font-medium hover:text-brand-400 shrink-0">
              {selectedTable ? 'Change' : 'Select table'}
            </button>
          )}
        </div>

        {/* Customer + loyalty */}
        <div className="px-5 pt-4">
          <button
            onClick={() => { setShowCustomerPicker(true); setCustomerSearch(''); setCustomerResults([]); }}
            disabled={!!activeOrder}
            className="w-full flex items-center justify-between gap-2 bg-surface-50 hover:bg-surface-100 rounded-xl px-3 py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2 text-text-secondary min-w-0">
              <User size={14} className="shrink-0" />
              {selectedCustomer ? (
                <span className="text-text-primary font-medium truncate">{selectedCustomer.full_name}{selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''}</span>
              ) : 'Walk-in Customer'}
            </span>
            {selectedCustomer ? (
              <span onClick={e => { e.stopPropagation(); setSelectedCustomer(null); }} className="text-text-muted hover:text-status-error p-1 shrink-0"><X size={13} /></span>
            ) : (
              <span className="text-brand text-xs font-medium shrink-0">Attach customer</span>
            )}
          </button>
          {selectedCustomer && (
            <label className="flex items-center gap-2 mt-2 px-1 text-xs text-text-secondary cursor-pointer">
              <input type="checkbox" checked={awardLoyalty} onChange={e => setAwardLoyalty(e.target.checked)} disabled={!!activeOrder} />
              Award loyalty points on this sale
            </label>
          )}
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 text-center gap-2">
              <ShoppingCart size={36} className="text-text-muted" />
              <p className="text-base text-text-muted font-medium">Cart is empty</p>
              <p className="text-sm text-text-muted">Tap items on the left to add them</p>
            </div>
          ) : cart.map(item => (
            <div key={item.id} className="flex items-center gap-3">
              <img
                src={resolveMenuImage(item.image_url, item.name)}
                alt={item.name}
                className="w-11 h-11 rounded-xl object-cover bg-surface-50 shrink-0"
                onError={e => { (e.target as HTMLImageElement).src = menuImagePlaceholder(item.name); }}
              />
              <div className="flex-1 min-w-0">
                <p className="pos-cart-item-name text-text-primary truncate">{item.name}</p>
                <p className="pos-cart-item-price text-sm">KES {(item.price * item.quantity).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQty(item.id, -1)}
                  disabled={!!activeOrder}
                  className="w-7 h-7 rounded-lg bg-surface-50 hover:bg-surface-100 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Minus size={12} />
                </button>
                <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                <button
                  onClick={() => updateQty(item.id, 1)}
                  disabled={!!activeOrder}
                  className="w-7 h-7 rounded-lg bg-surface-50 hover:bg-surface-100 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => setCart(prev => prev.filter(c => c.id !== item.id))}
                  disabled={!!activeOrder}
                  className="w-7 h-7 rounded-lg hover:bg-status-error/10 flex items-center justify-center transition-colors ml-1 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <X size={12} className="text-status-error" />
                </button>
              </div>
            </div>
          ))}

          {activeOrder && (
            <p className="text-xs text-text-muted bg-surface-50 rounded-lg px-3 py-2 text-center">
              Order #{activeOrder.order_number} is already placed — items are locked. Cancel the order below to start over.
            </p>
          )}

          {cart.length > 0 && !activeOrder && (
            showInstructionsInput ? (
              <div className="border-t border-border/50 pt-3 space-y-1.5">
                <textarea
                  value={specialInstructions}
                  onChange={e => setSpecialInstructions(e.target.value)}
                  onBlur={() => setShowInstructionsInput(false)}
                  autoFocus
                  rows={2}
                  placeholder="e.g. no onions, extra spicy, allergy note…"
                  className="input w-full text-sm resize-none"
                />
              </div>
            ) : (
              <button
                onClick={() => setShowInstructionsInput(true)}
                className="w-full text-left text-sm text-text-muted hover:text-brand transition-colors py-1 border-t border-border/50 pt-3 flex items-center gap-1.5"
              >
                <Pencil size={13} />
                {specialInstructions ? <span className="truncate text-text-secondary">{specialInstructions}</span> : 'Add special instructions'}
              </button>
            )
          )}
        </div>

        {/* ── Totals — now showing the real breakdown the backend charges ── */}
        <div className="px-5 py-4 border-t border-border space-y-3">
          {activeOrder ? (
            <>
              {/* Once an order exists, the authoritative numbers come from
                  the server (activeOrder), not the pre-checkout cart math
                  below — this is what lets a mixed cash+M-Pesa payment show
                  an accurate running balance across multiple tenders. */}
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Order #{activeOrder.order_number}</span>
                <span className="text-text-primary font-medium">{formatCurrency(activeOrder.total)} total</span>
              </div>
              {activeOrder.amount_paid > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-status-success">✓ Already collected</span>
                  <span className="text-status-success font-medium">{formatCurrency(activeOrder.amount_paid)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="pos-total-label">Balance due</span>
                <span className="pos-total-value">{formatCurrency(Math.max(0, activeOrder.total - activeOrder.amount_paid))}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Subtotal</span>
                <span className="text-text-primary font-medium">{formatCurrency(subtotal)}</span>
              </div>

              {/* Total — prominent */}
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="pos-total-label">Total</span>
                <span className="pos-total-value">{formatCurrency(total)}</span>
              </div>
            </>
          )}

          {/* Amount to charge — defaults to the full balance due but is
              editable, which is what makes mixed payments possible: charge
              only part of the balance via this method, see what's still
              owed, then pick a different method (e.g. M-Pesa, then Cash)
              for the rest. */}
          {paymentMethod === 'Points' ? (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Points to redeem — {selectedCustomer?.available_points || 0} available, up to {maxPointsUsable} usable on this balance
              </label>
              <div className="flex gap-2">
                <input
                  type="number" min={0} max={maxPointsUsable} step={1}
                  value={pointsToRedeem}
                  onChange={e => setPointsToRedeem(e.target.value)}
                  placeholder={String(maxPointsUsable)}
                  className="input font-bold text-lg flex-1"
                />
                <button type="button" onClick={() => setPointsToRedeem(String(maxPointsUsable))} className="btn-secondary text-xs px-3">Max</button>
              </div>
              <p className="text-xs text-brand mt-1">
                = {formatCurrency((pointsToRedeem ? Number(pointsToRedeem) : maxPointsUsable) * pointValueKes)}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Amount to charge now</label>
              <input
                type="number" min={0} step={1}
                value={tenderAmount}
                onChange={e => setTenderAmount(e.target.value)}
                placeholder={String(activeOrder ? Math.max(0, activeOrder.total - activeOrder.amount_paid) : total)}
                className="input font-bold text-lg"
              />
            </div>
          )}

          {/* Payment method buttons */}
          <div className={`grid gap-2 mt-1 grid-cols-3 ${
            availableMethods.length <= 2 ? 'sm:grid-cols-2'
            : availableMethods.length === 3 ? 'sm:grid-cols-3'
            : availableMethods.length === 5 ? 'sm:grid-cols-5'
            : availableMethods.length === 6 ? 'sm:grid-cols-3'
            : 'sm:grid-cols-4'
          }`}>
            {availableMethods.map(m => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                disabled={activeOrder !== null && m === 'Split Bill'}
                title={activeOrder !== null && m === 'Split Bill' ? 'Split Bill divides a fresh order — cancel this order to use it' : undefined}
                className={`py-3 rounded-xl text-xs font-bold transition-colors flex flex-col items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed ${
                  paymentMethod === m
                    ? 'bg-brand text-black shadow-brand'
                    : 'bg-surface-50 text-text-secondary hover:text-text-primary border border-border hover:border-brand/30'
                }`}
              >
                {m === 'Cash' ? <Banknote size={17} /> : m === 'M-Pesa' ? <Smartphone size={17} /> : m === 'Card' ? <CreditCard size={17} /> : m === 'Till' ? <Landmark size={17} /> : m === 'Points' ? <Star size={17} /> : <Shuffle size={17} />}
                {m}
              </button>
            ))}
          </div>

          {/* Checkout */}
          <button
            onClick={handleCheckout}
            disabled={processingPayment || (!cart.length && !activeOrder)}
            className="pos-checkout-btn disabled:opacity-50 disabled:cursor-not-allowed mt-1"
          >
            {processingPayment
              ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              : <ShoppingCart size={17} />}
            {processingPayment ? 'Processing...' : activeOrder ? `Charge ${formatCurrency(tenderAmount ? Number(tenderAmount) : Math.max(0, activeOrder.total - activeOrder.amount_paid))}` : !isOnline ? 'Complete Sale (Offline)   F2' : 'Checkout   F2'}
          </button>

          {activeOrder && (
            <button
              onClick={async () => {
                if (!confirmDelete('Cancel this order entirely? Any payment already collected will need to be refunded manually from the Orders page.')) return;
                try {
                  await api.put(`/orders/${activeOrder.id}/status`, { status: 'cancelled' });
                  toast('Order cancelled', { icon: 'ℹ️' });
                } catch {
                  toast.error('Could not cancel automatically — cancel it from the Orders page.');
                }
                setActiveOrder(null); setCart([]); setTenderAmount('');
                setSpecialInstructions(''); setShowInstructionsInput(false);
                setMobileCartOpen(false);
                setSelectedCustomer(null); setSelectedTableId(null); clearCartDraft();
              }}
              className="w-full text-center text-xs text-status-error hover:underline pt-1"
            >
              Cancel this order
            </button>
          )}
        </div>
      </div>

      {/* ══════════════ Customer Picker Modal ══════════════ */}
      {showCustomerPicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCustomerPicker(false)}>
          <div className="bg-surface-card border border-border rounded-2xl shadow-modal w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-base text-text-primary">Attach Customer</h2>
              <button onClick={() => setShowCustomerPicker(false)} className="btn-ghost p-1 text-lg">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  autoFocus value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                  className="input pl-9" placeholder="Search by name or phone..."
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {searchingCustomers ? (
                  <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-border border-t-brand rounded-full animate-spin" /></div>
                ) : customerResults.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-6">
                    {customerSearch.trim() ? 'No matching customers' : 'Type a name or phone number to search'}
                  </p>
                ) : customerResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCustomer(c); setShowCustomerPicker(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-50 transition-colors flex items-center justify-between"
                  >
                    <span className="text-sm font-medium text-text-primary">{c.full_name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      {c.phone && <span className="text-xs text-text-muted">{c.phone}</span>}
                      {!!c.available_points && <span className="text-[11px] text-brand">{c.available_points} pts</span>}
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={() => { setSelectedCustomer(null); setShowCustomerPicker(false); }} className="btn-secondary w-full text-sm">
                Continue as Walk-in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ Scan Modal ══════════════ */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeScanModal}>
          <div className="bg-surface-card border border-border rounded-2xl shadow-modal w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scan size={16} className="text-brand" />
                <h2 className="font-bold text-base text-text-primary">Scan Item</h2>
              </div>
              <button onClick={closeScanModal} className="btn-ghost p-1 text-lg">×</button>
            </div>
            <div className="p-5 space-y-3">
              <input
                autoFocus
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleScan(scanInput); }}
                disabled={scanning}
                className="input text-center font-mono tracking-wider"
                placeholder="Scan or type a barcode…"
              />
              <p className="text-[11px] text-text-muted text-center">
                Point a USB barcode scanner here and scan — it types the code and presses Enter automatically. You can also type a code by hand and press Enter.
              </p>
              {scanFeed.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-border max-h-40 overflow-y-auto">
                  {scanFeed.map((entry, i) => (
                    <p key={i} className={`text-xs ${entry.ok ? 'text-status-success' : 'text-status-error'}`}>
                      {entry.ok ? '✓' : '✕'} {entry.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ M-Pesa STK Push Modal ══════════════ */}
      {showMpesaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-border rounded-2xl shadow-modal w-full max-w-sm">

            {/* Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-status-success/10 rounded-xl flex items-center justify-center text-status-success"><Smartphone size={18} /></div>
                <div>
                  <h2 className="font-bold text-base text-text-primary">M-Pesa Payment</h2>
                  <p className="text-xs text-text-muted">Lipa Na M-Pesa · STK Push</p>
                </div>
              </div>
              {!['waiting','sending'].includes(mpesaStatus) && (
                <button onClick={cancelMpesa} className="btn-ghost p-1.5"><X size={17} /></button>
              )}
            </div>

            <div className="p-5 space-y-5">
              {/* Amount — reflects the actual tender amount (which may be a
                  partial charge if the cashier is splitting the bill across
                  M-Pesa and another method), not necessarily the full bill. */}
              <div className="bg-status-success/10 border border-status-success/20 rounded-xl p-4 text-center">
                <p className="text-sm text-text-muted mb-1">Amount to Pay</p>
                <p className="text-4xl font-black text-brand">{formatCurrency(chargeAmountDisplay)}</p>
                <p className="text-xs text-text-muted mt-1">
                  {activeOrder && chargeAmountDisplay < balanceDueDisplay
                    ? `Partial payment — ${formatCurrency(balanceDueDisplay - chargeAmountDisplay)} will remain after this`
                    : `${itemCount} item${itemCount !== 1 ? 's' : ''} · ${orderType}`}
                </p>
              </div>

              {/* IDLE — enter phone */}
              {mpesaStatus === 'idle' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-text-secondary mb-2">
                      Customer's M-Pesa Phone Number
                    </label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="tel"
                        value={mpesaPhone}
                        onChange={e => setMpesaPhone(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendStkPush()}
                        className="input pl-10 text-base font-medium tracking-wider"
                        placeholder="07XX XXX XXX"
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1">
                      💡 A PIN prompt will be sent to this number
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={cancelMpesa} className="btn-secondary flex-1 py-3">Cancel</button>
                    <button onClick={sendStkPush} className="btn-primary flex-1 py-3 text-base font-bold flex items-center justify-center gap-2">
                      <Smartphone size={16} /> Send Push
                    </button>
                  </div>
                </>
              )}

              {/* SENDING */}
              {mpesaStatus === 'sending' && (
                <div className="text-center py-5 space-y-3">
                  <Loader size={40} className="text-brand animate-spin mx-auto" />
                  <p className="font-bold text-base text-text-primary">Sending push notification…</p>
                  <p className="text-sm text-text-muted">Connecting to Safaricom</p>
                </div>
              )}

              {/* WAITING */}
              {mpesaStatus === 'waiting' && (
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-brand/10 border-2 border-brand/20 rounded-full flex items-center justify-center mx-auto">
                    <Smartphone size={36} className="text-brand animate-bounce" />
                  </div>
                  <div>
                    <p className="font-bold text-lg text-text-primary">Check your phone!</p>
                    <p className="text-sm text-text-muted mt-1">Push notification sent to</p>
                    <p className="text-brand font-bold text-base mt-0.5">{mpesaPhone}</p>
                  </div>
                  <div className="bg-surface-50 border border-border rounded-xl p-4 text-sm text-text-secondary text-left space-y-2">
                    <p className="font-semibold text-text-primary">Customer steps:</p>
                    <p>1. Check phone for M-Pesa prompt</p>
                    <p>2. Enter M-Pesa PIN to confirm payment</p>
                    <p>3. Wait for confirmation — this screen updates automatically</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
                    <div className="w-4 h-4 border-2 border-border border-t-brand rounded-full animate-spin" />
                    Waiting for payment confirmation…
                  </div>
                  <div className="flex gap-3">
                    <button onClick={cancelMpesa} className="btn-secondary flex-1 py-2.5 text-sm text-status-error border-status-error/30 hover:bg-status-error/5">
                      Cancel Payment
                    </button>
                    <button onClick={checkStatusNow} className="btn-secondary flex-1 py-2.5 text-sm">
                      Check Status Now
                    </button>
                  </div>
                </div>
              )}

              {/* COMPLETED */}
              {mpesaStatus === 'completed' && (
                <div className="text-center py-5 space-y-3">
                  <CheckCircle size={56} className="text-status-success mx-auto" />
                  <p className="font-bold text-status-success text-xl">Payment Confirmed!</p>
                  <p className="text-sm text-text-muted">Checking order status…</p>
                </div>
              )}

              {/* FAILED / CANCELLED */}
              {(mpesaStatus === 'failed' || mpesaStatus === 'cancelled') && (
                <div className="text-center space-y-4">
                  <AlertCircle size={48} className="text-status-error mx-auto" />
                  <p className="font-bold text-status-error text-lg">
                    {mpesaStatus === 'cancelled' ? 'Payment Cancelled' : 'Payment Failed'}
                  </p>
                  <p className="text-sm text-text-muted">
                    {mpesaStatus === 'cancelled'
                      ? 'The customer cancelled the M-Pesa request.'
                      : 'The payment could not be completed. Please try again.'}
                  </p>
                  <div className="flex gap-3">
                    <button onClick={cancelMpesa} className="btn-secondary flex-1 py-3">Close</button>
                    <button onClick={() => setMpesaStatus('idle')} className="btn-primary flex-1 py-3">Try Again</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ Pesapal Card Payment Modal ══════════════ */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`bg-surface-card border border-border rounded-2xl shadow-modal w-full transition-all ${cardStatus === 'waiting_for_customer' ? 'max-w-lg' : 'max-w-sm'}`}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center text-brand"><CreditCard size={18} /></div>
                <div>
                  <h2 className="font-bold text-base text-text-primary">Card Payment</h2>
                  <p className="text-xs text-text-muted">Visa / Mastercard via Pesapal</p>
                </div>
              </div>
              <button onClick={cancelCardPayment} className="btn-ghost p-1.5"><X size={17} /></button>
            </div>

            <div className="p-5 space-y-5">
              {cardStatus !== 'waiting_for_customer' && (
                <div className="bg-brand/10 border border-brand/20 rounded-xl p-4 text-center">
                  <p className="text-sm text-text-muted mb-1">Amount to Charge</p>
                  <p className="text-4xl font-black text-brand">{formatCurrency(chargeAmountDisplay)}</p>
                </div>
              )}

              {(cardStatus === 'idle' || cardStatus === 'creating_order') && (
                <div className="text-center py-5 space-y-3">
                  <Loader size={40} className="text-brand animate-spin mx-auto" />
                  <p className="font-bold text-base text-text-primary">Preparing payment…</p>
                </div>
              )}

              {cardStatus === 'waiting_for_customer' && (
                <div className="space-y-3">
                  <p className="text-sm text-text-muted text-center">
                    Hand the device to the customer to complete payment with their card — <span className="font-bold text-text-primary">{formatCurrency(chargeAmountDisplay)}</span>
                  </p>
                  <div className="rounded-xl overflow-hidden border border-border bg-white" style={{ height: '480px' }}>
                    <iframe src={cardRedirectUrl} title="Pesapal Checkout" className="w-full h-full border-0" />
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
                    <div className="w-3.5 h-3.5 border-2 border-border border-t-brand rounded-full animate-spin" />
                    Waiting for the customer to finish…
                  </div>
                </div>
              )}

              {cardStatus === 'completed' && (
                <div className="text-center py-5 space-y-3">
                  <CheckCircle size={56} className="text-status-success mx-auto" />
                  <p className="font-bold text-status-success text-xl">Payment Approved!</p>
                </div>
              )}

              {cardStatus === 'not_configured' && (
                <div className="text-center space-y-4">
                  <AlertCircle size={48} className="text-status-warning mx-auto" />
                  <p className="font-bold text-status-warning text-lg">Card Payments Not Set Up</p>
                  <p className="text-sm text-text-muted">{cardError}</p>
                  <p className="text-xs text-text-muted">Ask an administrator to configure Pesapal in Settings before using card payments.</p>
                  <button onClick={cancelCardPayment} className="btn-secondary w-full py-3">Close</button>
                </div>
              )}

              {cardStatus === 'failed' && (
                <div className="text-center space-y-4">
                  <AlertCircle size={48} className="text-status-error mx-auto" />
                  <p className="font-bold text-status-error text-lg">Payment Failed</p>
                  <p className="text-sm text-text-muted">{cardError}</p>
                  <div className="flex gap-3">
                    <button onClick={cancelCardPayment} className="btn-secondary flex-1 py-3">Close</button>
                    <button onClick={runCardPayment} className="btn-primary flex-1 py-3">Try Again</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ══════════════ Split Bill Modal ══════════════ */}
      {showSplitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-border rounded-2xl shadow-modal w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg text-text-primary">Split Bill</h2>
              <button onClick={() => setShowSplitModal(false)} className="btn-ghost p-1.5"><X size={17} /></button>
            </div>

            <div className="text-center mb-6">
              <p className="text-4xl font-black text-brand">{formatCurrency(total)}</p>
              <p className="text-sm text-text-muted mt-1">Total bill to split</p>
            </div>

            <div className="mb-5">
              <p className="text-sm text-text-muted text-center mb-3">Split between</p>
              <div className="flex items-center gap-4 justify-center">
                <button
                  onClick={() => setSplitParts(p => Math.max(2, p - 1))}
                  className="w-11 h-11 rounded-full bg-surface-50 hover:bg-surface-100 border border-border flex items-center justify-center text-xl font-bold transition-colors"
                >−</button>
                <span className="text-5xl font-black text-brand w-12 text-center">{splitParts}</span>
                <button
                  onClick={() => setSplitParts(p => Math.min(10, p + 1))}
                  className="w-11 h-11 rounded-full bg-surface-50 hover:bg-surface-100 border border-border flex items-center justify-center text-xl font-bold transition-colors"
                >+</button>
              </div>
              <p className="text-sm text-text-muted text-center mt-2">people</p>
            </div>

            <div className="bg-brand/10 border border-brand/20 rounded-xl p-4 text-center mb-5">
              <p className="text-sm text-text-muted">Each person pays</p>
              <p className="text-3xl font-black text-brand mt-1">{formatCurrency(Math.ceil(total / splitParts))}</p>
              <p className="text-xs text-text-muted mt-1">Rounded up — restaurant absorbs the rounding difference</p>
            </div>

            <div className="mb-5">
              <p className="text-sm text-text-muted text-center mb-2">Collected as</p>
              <div className="grid grid-cols-3 gap-2">
                {(['cash', 'card', 'till'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setSplitPaymentMethod(m)}
                    className={`py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                      splitPaymentMethod === m ? 'bg-brand text-black' : 'bg-surface-50 text-text-secondary border border-border hover:text-text-primary'
                    }`}
                  >
                    {m === 'cash' ? <Banknote size={15} /> : m === 'card' ? <CreditCard size={15} /> : <Landmark size={15} />}
                    {m === 'cash' ? 'Cash' : m === 'card' ? 'Card' : 'Till'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowSplitModal(false)} className="btn-secondary flex-1 py-3">Cancel</button>
              <button
                onClick={async () => {
                  if (processingPayment) return; // guard double-submit
                  if (!requireTableIfDineIn()) return;
                  setShowSplitModal(false);
                  setProcessingPayment(true);
                  try {
                    const order = await ensureActiveOrder('split');
                    // Pay the order's actual total, not splitParts * ceil(total/splitParts) —
                    // that per-person ceiling can overcollect by a shilling or two,
                    // which would now be rejected by the backend's amount-match
                    // check. The per-person figure above is customer-facing
                    // display math only; what we charge is the real bill.
                    const res = await api.post(`/orders/${order.id}/payment`, {
                      payment_method: splitPaymentMethod,
                      amount: order.total,
                      split_details: { parts: splitParts, per_person: Math.ceil(order.total / splitParts) },
                      award_loyalty: awardLoyalty,
                    });
                    toast.success(`Split ${splitParts} ways (${splitPaymentMethod}) — ${formatCurrency(Math.ceil(order.total / splitParts))} each`);
                    if (res.data.points_awarded > 0) toast.success(`+${res.data.points_awarded} loyalty points earned`, { icon: '⭐' });
                    settleAfterPayment(order, res.data.balance_remaining);
                  } catch (e: unknown) {
                    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Checkout failed';
                    toast.error(msg);
                  } finally { setProcessingPayment(false); }
                }}
                disabled={processingPayment}
                className="btn-primary flex-1 py-3 text-base font-bold disabled:opacity-50"
              >
                {processingPayment ? 'Processing…' : 'Confirm Split'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable receipt — Receipt itself fires window.print() once its
          settings fetch (business name/logo) actually completes, not on a
          blind timeout from here. Shared with OrdersPage so both "just paid"
          (here) and "reprint a past order" (there) render an identical
          receipt. */}
      <Receipt order={receiptOrder} />
    </div>
  );
}