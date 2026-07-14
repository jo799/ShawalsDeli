import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, LayoutGrid, List, Armchair, Circle, ShoppingCart, ArrowLeftRight, Receipt, Merge, Printer, X, Eye } from 'lucide-react';
import api from '@/lib/api';
import { confirmDelete } from '@/lib/confirmPreference';
import { formatCurrency } from '@/lib/utils';
import { PageHeader, StatusBadge, Modal } from '@/components/ui';
import toast from 'react-hot-toast';

interface Table {
  id: string; table_number: string; area: string; capacity: number;
  status: string; order_number?: string; order_total?: number; order_amount_paid?: number;
  order_status?: string;
  customer_name?: string; customer_phone?: string;
  minutes_occupied?: number; order_started?: string;
  current_order_id?: string;
}

interface Reservation { id: string; table_id?: string; reservation_time: string; table_number: string; customer_name?: string; guests: number; status: string; notes?: string; }

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-status-success/20 border-status-success/40 text-status-success',
  occupied:  'bg-status-error/20 border-status-error/40 text-status-error',
  reserved:  'bg-status-warning/20 border-status-warning/40 text-status-warning',
  cleaning:  'bg-status-purple/20 border-status-purple/40 text-status-purple',
};

// datetime-local inputs read and write "YYYY-MM-DDTHH:mm" in the browser's
// LOCAL time, with no timezone info attached at all. toISOString() gives UTC
// — using it here (for a default value or a `min` bound) silently shifts the
// displayed time for anyone not in UTC+0. Build it from local getters instead.
function toLocalDatetimeInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function TableCard({ table, selected, onClick }: { table: Table; selected: boolean; onClick: () => void }) {
  const colorClass = STATUS_COLORS[table.status] || STATUS_COLORS.available;
  const mins = table.minutes_occupied ? Math.round(table.minutes_occupied) : null;

  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl border-2 p-3 transition-all text-center min-h-[90px] flex flex-col items-center justify-center gap-1
        ${colorClass}
        ${selected ? 'ring-2 ring-brand ring-offset-2 ring-offset-surface-300' : 'hover:scale-105'}
      `}
    >
      <span className="font-bold text-sm">{table.table_number}</span>
      <div className="flex items-center gap-1 text-xs opacity-80">
        <span>👥</span>
        <span>{table.capacity}</span>
      </div>
      {table.status === 'occupied' && mins !== null && (
        <span className="text-[10px] opacity-70">{mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins} min`}</span>
      )}
      {table.status === 'reserved' && (
        <span className="text-[10px] opacity-70">Reserved</span>
      )}
    </button>
  );
}

export default function TablesPage() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<Table[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selected, setSelected] = useState<Table | null>(null);
  const [stats, setStats] = useState({ total: 0, occupied: 0, available: 0, reserved: 0, cleaning: 0 });
  const [view, setView] = useState<'floor' | 'list'>('floor');
  const [loading, setLoading] = useState(true);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [reservationForm, setReservationForm] = useState({
    customer_name: '', customer_phone: '', table_id: '', guests: 2, reservation_time: '', notes: '',
  });
  const [savingReservation, setSavingReservation] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null); // null = adding a new table
  const [tableForm, setTableForm] = useState({ table_number: '', area: 'Main Hall', capacity: 2 });
  const [savingTable, setSavingTable] = useState(false);
  const [defaultCapacity, setDefaultCapacity] = useState(2);
  useEffect(() => {
    api.get('/settings').then(r => {
      const cap = parseInt(r.data.data.default_table_capacity);
      if (cap > 0) setDefaultCapacity(cap);
    }).catch(() => {});
  }, []);
  // "Today" (default, a host-stand view of tonight) vs "View All" (every
  // upcoming confirmed/seated reservation regardless of date).
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tablesRes, resRes] = await Promise.all([
        api.get('/tables'),
        api.get('/tables/reservations', showAllUpcoming
          ? { params: { upcoming: 'true' } }
          // "Today" in the browser's own local calendar — toISOString() gives
          // the UTC date, which can already be tomorrow (or still yesterday)
          // relative to local time near midnight, silently showing the wrong
          // day's reservations.
          : { params: { date: toLocalDatetimeInputValue(new Date()).slice(0, 10) } }
        )
      ]);
      setTables(tablesRes.data.data);
      setStats(tablesRes.data.stats);
      setReservations(resRes.data.data);
    } catch { toast.error('Failed to load tables'); }
    finally { setLoading(false); }
  }, [showAllUpcoming]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Manual override — the system otherwise only learns a table is free when
  // staff completes (or cancels) its order (see ordersController). This is
  // the escape hatch for everything that doesn't fit that: a customer who
  // left without staff formally closing the order, a walkout, a data
  // mismatch. It does NOT touch the order itself (no cancel, no refund) —
  // it only frees the table for reseating; the backend surfaces a warning
  // if the linked order is still open so this can't be used to silently
  // make an unpaid balance disappear from view.
  const closeTable = async (table: Table) => {
    if (!confirmDelete(`Clear Table ${table.table_number}? This marks it available for the next guest without changing its order.`)) return;
    try {
      const res = await api.put(`/tables/${table.id}/status`, { status: 'available' });
      if (res.data.warning) {
        toast(res.data.warning, { icon: '⚠️', duration: 6000 });
      } else {
        toast.success(`Table ${table.table_number} is now available`);
      }
      setSelected(null);
      fetchData();
    } catch {
      toast.error('Failed to clear the table');
    }
  };

  // ── Add / edit / remove tables from the floor plan ──────────────────────
  const openAddTable = () => {
    setEditingTable(null);
    setTableForm({ table_number: '', area: areas[0] || 'Main Hall', capacity: defaultCapacity });
    setShowTableModal(true);
  };

  const openEditTable = (table: Table) => {
    setEditingTable(table);
    setTableForm({ table_number: table.table_number, area: table.area, capacity: table.capacity });
    setShowTableModal(true);
  };

  const saveTable = async () => {
    if (!tableForm.table_number.trim()) { toast.error('Table number is required'); return; }
    if (!Number.isInteger(tableForm.capacity) || tableForm.capacity < 1) { toast.error('Capacity must be a whole number of at least 1'); return; }
    setSavingTable(true);
    try {
      if (editingTable) {
        await api.put(`/tables/${editingTable.id}`, tableForm);
        toast.success(`Table ${tableForm.table_number} updated`);
      } else {
        await api.post('/tables', tableForm);
        toast.success(`Table ${tableForm.table_number} added`);
      }
      setShowTableModal(false);
      fetchData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save table';
      toast.error(msg);
    } finally { setSavingTable(false); }
  };

  const deleteTable = async (table: Table) => {
    if (!confirmDelete(`Remove Table ${table.table_number} from the floor plan? This can't be undone from here.`)) return;
    try {
      await api.delete(`/tables/${table.id}`);
      toast.success(`Table ${table.table_number} removed`);
      setSelected(null);
      fetchData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to remove table';
      toast.error(msg);
    }
  };

  // ── Reservations ─────────────────────────────────────────────────────
  const openReservationModal = () => {
    // Default to an hour from now, rounded to the next 15 minutes — a
    // sensible starting point the host can adjust rather than an empty
    // field they have to fill in from scratch every time.
    const dt = new Date(Date.now() + 60 * 60 * 1000);
    dt.setMinutes(Math.ceil(dt.getMinutes() / 15) * 15, 0, 0);
    const local = toLocalDatetimeInputValue(dt);
    const firstAvailable = tables.find(t => t.status === 'available');
    setReservationForm({
      customer_name: '', customer_phone: '', table_id: firstAvailable?.id || '', guests: 2, reservation_time: local, notes: '',
    });
    setShowReservationModal(true);
  };

  const submitReservation = async () => {
    if (!reservationForm.customer_name.trim()) { toast.error('Customer name is required'); return; }
    if (!reservationForm.table_id) { toast.error('Select a table'); return; }
    if (!reservationForm.reservation_time) { toast.error('Select a date and time'); return; }
    if (new Date(reservationForm.reservation_time).getTime() < Date.now() - 5 * 60 * 1000) {
      toast.error('Reservation time must be in the future'); return;
    }
    setSavingReservation(true);
    try {
      // reservationForm.reservation_time is a naive "YYYY-MM-DDTHH:mm" from
      // the datetime-local input — no timezone attached. `new Date(...)`
      // parses that as the BROWSER's local time (per spec), so converting
      // it to a real Date and then to an ISO string here produces a precise,
      // unambiguous UTC instant. Sending the naive string through as-is and
      // letting the backend parse it was the actual bug behind "1PM doesn't
      // reserve but 1AM does" — different JS engines / Node versions are not
      // fully consistent about how they interpret a date-time string with no
      // timezone designator, so the same naive string could silently land on
      // a different moment (or even a different calendar day) depending on
      // which process parses it. An explicit UTC timestamp removes that
      // ambiguity entirely — both sides now agree on the exact same instant.
      const preciseTime = new Date(reservationForm.reservation_time).toISOString();
      await api.post('/tables/reservations', { ...reservationForm, reservation_time: preciseTime });
      toast.success(`Reservation added for ${reservationForm.customer_name}`);
      setShowReservationModal(false);
      fetchData(); // refreshes both the floor plan (table may now show reserved) and today's reservations list
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add reservation';
      toast.error(msg);
    } finally { setSavingReservation(false); }
  };

  // Reservation lifecycle actions. The backend handles the matching table
  // status side-effect (seated -> occupied, cancelled/no_show -> released
  // back to available) — this just calls it and refreshes.
  const setReservationStatus = async (r: Reservation, status: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    try {
      await api.put(`/tables/reservations/${r.id}/status`, { status });
      const labels: Record<string,string> = { seated: 'Seated', completed: 'Completed', cancelled: 'Cancelled', no_show: 'Marked no-show' };
      toast.success(`${labels[status] || status} — ${r.customer_name}`);
      fetchData();
    } catch {
      toast.error('Failed to update reservation');
    }
  };

  const areas = [...new Set(tables.map(t => t.area))];

  const formatMins = (mins?: number) => {
    if (!mins) return '—';
    const m = Math.round(mins);
    return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m} min`;
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:overflow-hidden p-6">
        <PageHeader title="Tables" subtitle="View and manage all restaurant tables">
          <button onClick={() => setView('floor')} className="btn-secondary flex items-center gap-2 text-sm">
            <LayoutGrid size={14} /> Table Layout
          </button>
          <button onClick={openAddTable} className="btn-secondary flex items-center gap-2 text-sm">
            <Plus size={14} /> Add Table
          </button>
          <button onClick={openReservationModal} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Add Reservation
          </button>
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total Tables', value: stats.total, Icon: Armchair, filled: false, color: 'text-text-primary' },
            { label: 'Occupied', value: stats.occupied, Icon: Circle, filled: true, color: 'text-status-error' },
            { label: 'Available', value: stats.available, Icon: Circle, filled: true, color: 'text-status-success' },
            { label: 'Reserved', value: stats.reserved, Icon: Circle, filled: true, color: 'text-status-warning' },
            { label: 'Cleaning', value: stats.cleaning, Icon: Circle, filled: true, color: 'text-status-purple' },
          ].map(s => (
            <div key={s.label} className="card p-3 text-center">
              <div className="flex justify-center mb-1"><s.Icon size={s.filled ? 14 : 20} className={s.color} fill={s.filled ? 'currentColor' : 'none'} /></div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-text-muted">{s.label}</p>
              {s.label !== 'Total Tables' && (
                <p className="text-[10px] text-text-muted">{stats.total ? Math.round((s.value/stats.total)*100) : 0}% of tables</p>
              )}
            </div>
          ))}
        </div>

        {/* View toggle + filters */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex bg-surface-card border border-border rounded-lg p-0.5">
            <button onClick={() => setView('floor')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${view === 'floor' ? 'bg-brand text-black' : 'text-text-secondary hover:text-text-primary'}`}>
              <LayoutGrid size={12} /> Floor Plan
            </button>
            <button onClick={() => setView('list')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${view === 'list' ? 'bg-brand text-black' : 'text-text-secondary hover:text-text-primary'}`}>
              <List size={12} /> List View
            </button>
          </div>
          <div className="flex items-center gap-4 ml-auto text-xs">
            {[['🟢','Available'],['🔴','Occupied'],['🟡','Reserved'],['🟣','Cleaning']].map(([icon,label]) => (
              <span key={label as string} className="flex items-center gap-1 text-text-muted">{icon} {label}</span>
            ))}
          </div>
          <button onClick={fetchData} className="btn-secondary flex items-center gap-1.5 text-xs">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* Floor Plan */}
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-border border-t-brand rounded-full animate-spin" /></div>
        ) : view === 'floor' ? (
          <div className="flex-1 overflow-y-auto space-y-6">
            {areas.map(area => (
              <div key={area}>
                <h3 className="text-sm font-semibold text-brand mb-3">{area}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {tables.filter(t => t.area === area).map(table => (
                    <TableCard key={table.id} table={table} selected={selected?.id === table.id} onClick={() => setSelected(table)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card flex-1 overflow-auto">
            <table className="w-full">
              <thead className="bg-surface-50 sticky top-0">
                <tr>
                  {['Table','Area','Capacity','Status','Customer','Duration','Order Total','Actions'].map(h => (
                    <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tables.map(t => (
                  <tr key={t.id} className="table-row cursor-pointer" onClick={() => setSelected(t)}>
                    <td className="table-cell font-medium text-brand">{t.table_number}</td>
                    <td className="table-cell">{t.area}</td>
                    <td className="table-cell">👥 {t.capacity}</td>
                    <td className="table-cell"><StatusBadge status={t.status} /></td>
                    <td className="table-cell">{t.customer_name || '—'}</td>
                    <td className="table-cell">{formatMins(t.minutes_occupied)}</td>
                    <td className="table-cell">{t.order_total ? formatCurrency(t.order_total) : '—'}</td>
                    <td className="table-cell">
                      <button className="text-xs text-brand hover:text-brand-400">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reservations */}
        {reservations.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-title">{showAllUpcoming ? 'All Upcoming Reservations' : 'Upcoming Reservations (Today)'}</h3>
              <button onClick={() => setShowAllUpcoming(v => !v)} className="text-xs text-brand hover:underline">
                {showAllUpcoming ? '← Today only' : 'View All →'}
              </button>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-surface-50">
                  <tr>{['Time','Table','Customer','Guests','Status','Notes','Actions'].map(h => (
                    <th key={h} className="table-header px-4 py-2 text-left">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {reservations.map(r => (
                    <tr key={r.id} className="table-row">
                      <td className="table-cell font-medium">
                        {showAllUpcoming && (
                          <span className="text-text-muted mr-1">{new Date(r.reservation_time).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}</span>
                        )}
                        {new Date(r.reservation_time).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </td>
                      <td className="table-cell"><span className="badge-warning">{r.table_number}</span></td>
                      <td className="table-cell">{r.customer_name}</td>
                      <td className="table-cell">👥 {r.guests}</td>
                      <td className="table-cell"><StatusBadge status={r.status} /></td>
                      <td className="table-cell text-text-muted text-xs">{r.notes || '—'}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          {r.status === 'confirmed' && (
                            <>
                              <button onClick={() => setReservationStatus(r, 'seated')} className="btn-ghost px-2 py-1 text-[11px] text-status-success">Seat</button>
                              <button onClick={() => setReservationStatus(r, 'no_show', `Mark ${r.customer_name} as a no-show?`)} className="btn-ghost px-2 py-1 text-[11px] text-status-warning">No-show</button>
                              <button onClick={() => setReservationStatus(r, 'cancelled', `Cancel this reservation for ${r.customer_name}?`)} className="btn-ghost px-2 py-1 text-[11px] text-status-error">Cancel</button>
                            </>
                          )}
                          {r.status === 'seated' && (
                            <button onClick={() => setReservationStatus(r, 'completed')} className="btn-ghost px-2 py-1 text-[11px] text-status-success">Complete</button>
                          )}
                          {['completed','cancelled','no_show'].includes(r.status) && (
                            <span className="text-text-muted text-[11px]">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Selected table detail */}
      {selected && (
        <div className="w-full md:w-[300px] md:shrink-0 border-t md:border-t-0 md:border-l border-border bg-surface-card flex flex-col max-h-[60vh] md:max-h-none">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="section-title">Selected Table</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => openEditTable(selected)} className="btn-ghost p-1 text-xs" title="Edit table">✏️</button>
              <button
                onClick={() => deleteTable(selected)}
                disabled={selected.status === 'occupied'}
                className="btn-ghost p-1 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                title={selected.status === 'occupied' ? 'Clear the table before removing it' : 'Remove table'}
              >🗑️</button>
              <button onClick={() => setSelected(null)} className="btn-ghost p-1 text-lg">×</button>
            </div>
          </div>
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center font-bold text-lg ${STATUS_COLORS[selected.status]}`}>
                {selected.table_number}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Table {selected.table_number}</span>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                  <span>👥 {selected.capacity} Guests</span>
                  {selected.minutes_occupied && <span>⏱ {formatMins(selected.minutes_occupied)}</span>}
                </div>
              </div>
            </div>

            {selected.customer_name && (
              <div>
                <p className="text-xs text-text-muted mb-1">Customer</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{selected.customer_name}</p>
                    {selected.customer_phone && <p className="text-xs text-text-muted">{selected.customer_phone}</p>}
                  </div>
                  <button className="btn-ghost p-1">📞</button>
                </div>
              </div>
            )}

            {selected.order_total && (
              <div>
                <p className="text-xs text-text-muted mb-2">Order Summary</p>
                <div className="space-y-1.5 text-sm">
                  {/* No service charge / VAT breakdown — the business charges
                      menu prices as-is, and Total is the only real figure
                      the order carries (the old 80%/14% split here was a
                      guess, not derived from anything the order actually
                      stored). */}
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span><span className="text-brand">{formatCurrency(selected.order_total)}</span>
                  </div>
                  {selected.order_amount_paid !== undefined && selected.order_amount_paid < selected.order_total - 0.01 && (
                    <div className="flex justify-between text-status-warning">
                      <span>Balance due</span>
                      <span>{formatCurrency(selected.order_total - selected.order_amount_paid)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-text-muted mb-2">Table Actions</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { Icon: ShoppingCart, label: 'Add Order', onClick: () => navigate('/pos') },
                  { Icon: ArrowLeftRight, label: 'Transfer', onClick: () => toast('Transferring a table isn\'t built yet — coming in a future update.', { icon: 'ℹ️' }) },
                  { Icon: Receipt, label: 'Split Bill', onClick: () => navigate('/pos') }, // Split Bill lives in the POS checkout flow
                  { Icon: Merge, label: 'Merge Table', onClick: () => toast('Merging tables isn\'t built yet — coming in a future update.', { icon: 'ℹ️' }) },
                  { Icon: Printer, label: 'Print Bill', onClick: () => toast('Print this from the Orders page once the order is selected.', { icon: 'ℹ️' }) },
                  { Icon: X, label: 'Close Table', danger: true, onClick: () => closeTable(selected) },
                ].map(action => (
                  <button key={action.label}
                    onClick={action.onClick}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-[10px] font-medium transition-colors
                      ${action.danger
                        ? 'border-status-error/30 text-status-error hover:bg-status-error/10'
                        : 'border-border text-text-secondary hover:border-brand/40 hover:text-brand hover:bg-brand/5'
                      }`}
                  >
                    <action.Icon size={16} />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {selected.current_order_id && (
              <button className="btn-secondary w-full text-sm flex items-center justify-center gap-2">
                <Eye size={14} /> View Order
              </button>
            )}
          </div>
        </div>
      )}

      <Modal open={showReservationModal} onClose={() => setShowReservationModal(false)} title="Add Reservation">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Customer Name</label>
              <input
                className="input" placeholder="Enter name"
                value={reservationForm.customer_name}
                onChange={e => setReservationForm(f => ({ ...f, customer_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Phone</label>
              <input
                className="input" placeholder="07XX XXX XXX"
                value={reservationForm.customer_phone}
                onChange={e => setReservationForm(f => ({ ...f, customer_phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Table</label>
              <select
                className="select"
                value={reservationForm.table_id}
                onChange={e => setReservationForm(f => ({ ...f, table_id: e.target.value }))}
              >
                <option value="">Select a table</option>
                {tables.filter(t => t.status === 'available').map(t => (
                  <option key={t.id} value={t.id}>{t.table_number} ({t.area})</option>
                ))}
              </select>
              {tables.filter(t => t.status === 'available').length === 0 && (
                <p className="text-[11px] text-status-warning mt-1">No tables are currently available to book.</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Guests</label>
              <input
                type="number" className="input" min={1} step={1}
                value={reservationForm.guests}
                onChange={e => setReservationForm(f => ({ ...f, guests: Math.max(1, Math.round(+e.target.value)) }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Date & Time</label>
            <input
              type="datetime-local" className="input"
              min={toLocalDatetimeInputValue(new Date())}
              value={reservationForm.reservation_time}
              onChange={e => setReservationForm(f => ({ ...f, reservation_time: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Notes</label>
            <textarea
              className="input" rows={2} placeholder="Special requests..."
              value={reservationForm.notes}
              onChange={e => setReservationForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowReservationModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={submitReservation} disabled={savingReservation} className="btn-primary flex-1 disabled:opacity-50">
              {savingReservation ? 'Saving…' : 'Add Reservation'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add / Edit Table */}
      <Modal open={showTableModal} onClose={() => setShowTableModal(false)} title={editingTable ? `Edit Table ${editingTable.table_number}` : 'Add Table'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">Table Number</label>
            <input
              className="input" placeholder="e.g. T13"
              value={tableForm.table_number}
              onChange={e => setTableForm(f => ({ ...f, table_number: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Area</label>
              <input
                className="input" placeholder="e.g. Main Hall, Patio"
                list="table-areas"
                value={tableForm.area}
                onChange={e => setTableForm(f => ({ ...f, area: e.target.value }))}
              />
              <datalist id="table-areas">
                {areas.map(a => <option key={a} value={a} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Capacity (guests)</label>
              <input
                type="number" min={1} step={1} className="input"
                value={tableForm.capacity}
                onChange={e => setTableForm(f => ({ ...f, capacity: Math.max(1, Math.round(+e.target.value)) }))}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowTableModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={saveTable} disabled={savingTable} className="btn-primary flex-1 disabled:opacity-50">
              {savingTable ? 'Saving…' : editingTable ? 'Save Changes' : 'Add Table'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}