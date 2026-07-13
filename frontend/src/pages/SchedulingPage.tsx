import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Printer, Plus, Copy, X } from 'lucide-react';
import { addDays, startOfWeek, format, isSameDay, addWeeks, subWeeks, subDays, addMonths, subMonths } from 'date-fns';
import api from '@/lib/api';
import { getInitials } from '@/lib/utils';
import { PageHeader } from '@/components/ui';
import toast from 'react-hot-toast';

interface StaffMember {
  id: string; full_name: string; role: string; avatar_url?: string;
}
interface Schedule {
  user_id: string; shift_date: string; shift_type: string;
  start_time?: string; end_time?: string; role_label?: string;
}

const SHIFT_COLORS: Record<string, string> = {
  morning: 'bg-status-success/20 text-status-success border border-status-success/30',
  day: 'bg-brand/20 text-brand border border-brand/30',
  evening: 'bg-status-purple/20 text-status-purple border border-status-purple/30',
  night: 'bg-status-info/20 text-status-info border border-status-info/30',
  off: 'bg-surface-50 text-text-muted border border-border',
};

const SHIFT_LABELS: Record<string, string> = {
  morning: 'Morning (6AM-2PM)',
  day: 'Day (8AM-4PM)',
  evening: 'Evening (11AM-7PM)',
  night: 'Night (3PM-11PM)',
};

const SHIFT_HOURS: Record<string, number> = { morning: 8, day: 8, evening: 8, night: 8, off: 0 };

// Postgres DATE columns come back through node-pg as full ISO timestamp
// strings ("2026-07-06T00:00:00.000Z"), not the plain "2026-07-06" a
// frontend date picker or date-fns format() produces — comparing them
// directly with === silently never matches. This is exactly the bug behind
// every schedule cell showing "Unscheduled" regardless of how many shifts
// were actually saved: the write always succeeded, the read-back comparison
// never did. The first 10 characters of either shape are always the plain
// calendar date, with no timezone conversion involved (Postgres DATE has no
// time-of-day or zone to begin with).
const normalizeDate = (d: string): string => d.slice(0, 10);

const ROLE_LABEL: Record<string, string> = {
  administrator: 'Administrator', manager: 'Manager', head_chef: 'Head Chef',
  cashier: 'Cashier', waiter: 'Waiter', kitchen_staff: 'Kitchen Staff', cleaner: 'Cleaner',
};

export default function SchedulingPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [miniCalMonth, setMiniCalMonth] = useState(new Date());
  const [roleFilter, setRoleFilter] = useState('');
  const [showAddShift, setShowAddShift] = useState(false);
  const [editingCell, setEditingCell] = useState<{ userId: string; dayIdx: number } | null>(null);
  const [copying, setCopying] = useState(false);
  const [addForm, setAddForm] = useState({ user_id: '', shift_date: '', shift_type: 'day' });
  const [savingAdd, setSavingAdd] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');
      const [staffRes, schedRes] = await Promise.all([
        api.get('/staff', { params: { limit: 50 } }),
        api.get('/staff/schedules', { params: { start_date: startDate, end_date: endDate } }).catch(() => ({ data: { data: [] } }))
      ]);
      setStaff(staffRes.data.data);
      setSchedules(schedRes.data.data);
    } catch { toast.error('Failed to load schedule'); }
    finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Nothing scheduled for a cell used to silently show a made-up default
  // shift (e.g. every waiter always "on evening shift" even if no one had
  // ever actually scheduled them) — indistinguishable from a real
  // assignment. Returns null now instead, and the grid shows an honest
  // "Unscheduled" state for it.
  const getShiftForDay = (userId: string, dayIdx: number): Schedule | null => {
    const dateStr = format(weekDays[dayIdx], 'yyyy-MM-dd');
    return schedules.find(s => s.user_id === userId && normalizeDate(s.shift_date) === dateStr) || null;
  };

  const getShiftTime = (s: Schedule): string => {
    if (s.start_time && s.end_time) return `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`;
    const times: Record<string, string> = {
      morning: '6:00 AM – 2:00 PM', day: '8:00 AM – 4:00 PM',
      evening: '11:00 AM – 7:00 PM', night: '3:00 PM – 11:00 PM',
    };
    return times[s.shift_type] || '';
  };

  const updateShift = async (userId: string, dayIdx: number, shiftType: string) => {
    const shiftDate = format(weekDays[dayIdx], 'yyyy-MM-dd');
    try {
      const member = staff.find(s => s.id === userId);
      await api.post('/staff/schedules', {
        user_id: userId, shift_date: shiftDate, shift_type: shiftType,
        role_label: ROLE_LABEL[member?.role || ''] || 'Staff'
      });
      toast.success('Shift updated');
      setEditingCell(null);
      fetchData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update shift';
      toast.error(msg);
    }
  };

  const clearShift = async (userId: string, dayIdx: number) => {
    const shiftDate = format(weekDays[dayIdx], 'yyyy-MM-dd');
    try {
      await api.delete(`/staff/schedules/${userId}/${shiftDate}`);
      toast.success('Schedule entry removed');
      setEditingCell(null);
      fetchData();
    } catch {
      toast.error('Failed to remove schedule entry');
    }
  };

  // Real, not decorative — fetches last week's actual entries and re-posts
  // each one for the corresponding day this week. Skips any day that
  // already has an entry this week rather than overwriting it silently.
  const copyLastWeek = async () => {
    setCopying(true);
    try {
      const lastWeekStart = subDays(weekStart, 7);
      const { data } = await api.get('/staff/schedules', {
        params: { start_date: format(lastWeekStart, 'yyyy-MM-dd'), end_date: format(addDays(lastWeekStart, 6), 'yyyy-MM-dd') }
      });
      const lastWeekSchedules: Schedule[] = data.data;
      if (lastWeekSchedules.length === 0) { toast('No schedule found for last week to copy.', { icon: 'ℹ️' }); return; }

      let copied = 0, skipped = 0;
      for (const s of lastWeekSchedules) {
        const dayOffset = Math.round((new Date(s.shift_date).getTime() - lastWeekStart.getTime()) / 86400000);
        const newDate = format(addDays(weekStart, dayOffset), 'yyyy-MM-dd');
        const alreadyExists = schedules.some(existing => existing.user_id === s.user_id && normalizeDate(existing.shift_date) === newDate);
        if (alreadyExists) { skipped++; continue; }
        await api.post('/staff/schedules', { user_id: s.user_id, shift_date: newDate, shift_type: s.shift_type, role_label: s.role_label });
        copied++;
      }
      toast.success(`Copied ${copied} shift${copied === 1 ? '' : 's'} from last week${skipped ? ` (${skipped} skipped — already scheduled)` : ''}`);
      fetchData();
    } catch {
      toast.error('Failed to copy last week\'s schedule');
    } finally { setCopying(false); }
  };

  const submitAddShift = async () => {
    if (!addForm.user_id || !addForm.shift_date) { toast.error('Choose a staff member and date'); return; }
    setSavingAdd(true);
    try {
      const member = staff.find(s => s.id === addForm.user_id);
      await api.post('/staff/schedules', {
        user_id: addForm.user_id, shift_date: addForm.shift_date, shift_type: addForm.shift_type,
        role_label: ROLE_LABEL[member?.role || ''] || 'Staff'
      });
      toast.success('Schedule created');
      setShowAddShift(false);
      setAddForm({ user_id: '', shift_date: '', shift_type: 'day' });
      fetchData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create schedule';
      toast.error(msg);
    } finally { setSavingAdd(false); }
  };

  const filteredStaff = roleFilter ? staff.filter(s => s.role === roleFilter) : staff;

  // Every number below is computed from the real schedules just fetched —
  // this used to be five hardcoded values ("412h 30m", "96%" coverage,
  // "3" open shifts, "12h 30m" overtime) that never changed regardless of
  // what was actually scheduled. "Open Shifts" and "Overtime" are gone
  // rather than faked differently — neither has a real basis to compute
  // from (there's no staffing-requirement model to be "open" against, and
  // no contracted-hours baseline to be "over"), so a number here would be
  // just as fabricated as before.
  const realShifts = schedules.filter(s => s.shift_type !== 'off');
  const totalShifts = realShifts.length;
  const totalHours = realShifts.reduce((sum, s) => {
    if (s.start_time && s.end_time) {
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      return sum + Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
    }
    return sum + (SHIFT_HOURS[s.shift_type] || 0);
  }, 0);
  const staffScheduledCount = new Set(realShifts.map(s => s.user_id)).size;
  const shiftTypeCounts = ['morning', 'day', 'evening', 'night'].map(type => ({
    type, label: SHIFT_LABELS[type], count: realShifts.filter(s => s.shift_type === type).length,
  }));

  const miniMonthDays = Array.from({ length: new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth() + 1, 0).getDate() }, (_, i) =>
    new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth(), i + 1)
  );

  const exportCsv = () => {
    const rows = [['Staff Member', 'Role', 'Date', 'Shift', 'Start', 'End']];
    filteredStaff.forEach(member => {
      weekDays.forEach((_, dayIdx) => {
        const s = getShiftForDay(member.id, dayIdx);
        if (s) rows.push([member.full_name, ROLE_LABEL[member.role] || member.role, normalizeDate(s.shift_date), s.shift_type, s.start_time || '', s.end_time || '']);
      });
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `schedule-${format(weekStart, 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:overflow-hidden p-6">
        <PageHeader title="Scheduling" subtitle="Create and manage staff schedules and shifts">
          <button onClick={exportCsv} className="btn-secondary flex items-center gap-1.5 text-sm">Export CSV</button>
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5 text-sm"><Printer size={13} /> Print</button>
          <button onClick={() => { setAddForm({ user_id: '', shift_date: format(weekStart, 'yyyy-MM-dd'), shift_type: 'day' }); setShowAddShift(true); }} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Create Schedule
          </button>
        </PageHeader>

        {/* Stats — every number here is real */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Total Shifts', value: String(totalShifts), sub: 'This week', color: 'text-text-primary' },
            { label: 'Total Scheduled Hours', value: `${Math.round(totalHours)}h`, sub: 'This week', color: 'text-status-info' },
            { label: 'Staff Scheduled', value: `${staffScheduledCount} / ${staff.length}`, sub: 'Have at least one shift', color: 'text-status-success' },
          ].map(s => (
            <div key={s.label} className="card p-3">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-text-muted">{s.label}</p>
              <p className="text-[10px] text-text-muted">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="btn-ghost p-1.5"><ChevronLeft size={16} /></button>
          <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="btn-ghost p-1.5"><ChevronRight size={16} /></button>
          <span className="font-semibold text-sm">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="btn-secondary text-xs py-1">Today</button>
          <select className="select text-xs py-1.5 w-32" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={copyLastWeek} disabled={copying} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 disabled:opacity-50">
            <Copy size={12} /> {copying ? 'Copying…' : 'Copy Last Week'}
          </button>
        </div>

        {/* Schedule Grid */}
        <div className="card flex-1 overflow-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-surface-50 sticky top-0 z-10">
              <tr>
                <th className="table-header px-4 py-3 text-left w-40">Staff Member</th>
                {weekDays.map((day, i) => (
                  <th key={i} className={`table-header px-2 py-3 text-center ${isSameDay(day, new Date()) ? 'text-brand' : ''}`}>
                    <div>{format(day, 'EEE')}</div>
                    <div className={`text-sm font-bold mt-0.5 ${isSameDay(day, new Date()) ? 'text-brand' : 'text-text-primary'}`}>{format(day, 'MMM d')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center"><div className="flex justify-center"><div className="w-8 h-8 border-2 border-border border-t-brand rounded-full animate-spin" /></div></td></tr>
              ) : filteredStaff.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-text-muted text-sm">No staff match this filter</td></tr>
              ) : filteredStaff.map(member => (
                <tr key={member.id} className="border-b border-border/50 hover:bg-surface-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-bold shrink-0">
                        {getInitials(member.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{member.full_name}</p>
                        <p className="text-[10px] text-text-muted capitalize">{ROLE_LABEL[member.role] || member.role}</p>
                      </div>
                    </div>
                  </td>
                  {weekDays.map((_, dayIdx) => {
                    const entry = getShiftForDay(member.id, dayIdx);
                    const isEditing = editingCell?.userId === member.id && editingCell?.dayIdx === dayIdx;
                    return (
                      <td key={dayIdx} className="px-1.5 py-2 text-center relative">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <select
                              autoFocus
                              className="select text-xs py-1 w-full"
                              defaultValue={entry?.shift_type || ''}
                              onBlur={() => setEditingCell(null)}
                              onChange={e => updateShift(member.id, dayIdx, e.target.value)}
                            >
                              <option value="" disabled>Set shift…</option>
                              <option value="morning">Morning 6AM-2PM</option>
                              <option value="day">Day 8AM-4PM</option>
                              <option value="evening">Evening 11AM-7PM</option>
                              <option value="night">Night 3PM-11PM</option>
                              <option value="off">Off</option>
                            </select>
                            {entry && (
                              <button onMouseDown={e => e.preventDefault()} onClick={() => clearShift(member.id, dayIdx)} className="btn-ghost p-1 text-status-error shrink-0" title="Remove this schedule entry entirely">
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingCell({ userId: member.id, dayIdx })}
                            className={`w-full rounded-lg px-1.5 py-1.5 text-[10px] font-medium text-center transition-all hover:opacity-80 ${entry ? (SHIFT_COLORS[entry.shift_type] || SHIFT_COLORS.off) : 'border border-dashed border-border text-text-muted'}`}
                          >
                            {!entry ? (
                              <span>Unscheduled</span>
                            ) : entry.shift_type !== 'off' ? (
                              <>
                                <div>{getShiftTime(entry)}</div>
                                <div className="opacity-80">{entry.role_label || ROLE_LABEL[member.role]}</div>
                              </>
                            ) : (
                              <span>Off</span>
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-full md:w-[220px] md:shrink-0 border-t md:border-t-0 md:border-l border-border bg-surface-card flex flex-col overflow-y-auto p-4 space-y-5 max-h-[60vh] md:max-h-none">
        {/* Mini calendar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="section-title text-sm">{format(miniCalMonth, 'MMMM yyyy')}</h2>
            <div className="flex gap-1">
              <button onClick={() => setMiniCalMonth(m => subMonths(m, 1))} className="btn-ghost p-0.5"><ChevronLeft size={12} /></button>
              <button onClick={() => setMiniCalMonth(m => addMonths(m, 1))} className="btn-ghost p-0.5"><ChevronRight size={12} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
              <div key={d} className="text-[10px] text-text-muted py-0.5">{d}</div>
            ))}
            {Array.from({ length: (new Date(miniCalMonth.getFullYear(), miniCalMonth.getMonth(), 1).getDay() + 6) % 7 }, (_, i) => (
              <div key={`off-${i}`} />
            ))}
            {miniMonthDays.map(d => {
              const inWeek = d >= weekStart && d <= addDays(weekStart, 6);
              const isToday = isSameDay(d, new Date());
              return (
                <button key={d.getDate()}
                  onClick={() => setWeekStart(startOfWeek(d, { weekStartsOn: 1 }))}
                  className={`text-[11px] py-0.5 rounded transition-colors ${isToday ? 'bg-brand text-black font-bold' : inWeek ? 'bg-brand/20 text-brand font-medium' : 'text-text-secondary hover:text-text-primary'}`}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Shift Summary — real counts from this week's actual schedules */}
        <div>
          <h2 className="section-title text-sm mb-3">Shift Summary</h2>
          <div className="space-y-2">
            {shiftTypeCounts.map(s => (
              <div key={s.type} className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full shrink-0 ${SHIFT_COLORS[s.type].split(' ')[0]}`} />
                <span className="text-text-secondary flex-1 text-[11px]">{s.label}</span>
                <span className="font-bold">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAddShift && (
        <div className="modal-backdrop" onClick={() => setShowAddShift(false)}>
          <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="section-title">Create Schedule</h2>
              <button onClick={() => setShowAddShift(false)} className="btn-ghost p-1">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Staff Member</label>
                <select className="select" value={addForm.user_id} onChange={e => setAddForm(p => ({ ...p, user_id: e.target.value }))}>
                  <option value="" disabled>Select a staff member…</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Date</label>
                <input type="date" className="input" value={addForm.shift_date} onChange={e => setAddForm(p => ({ ...p, shift_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Shift</label>
                <select className="select" value={addForm.shift_type} onChange={e => setAddForm(p => ({ ...p, shift_type: e.target.value }))}>
                  {Object.entries(SHIFT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  <option value="off">Off</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAddShift(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={submitAddShift} disabled={savingAdd} className="btn-primary flex-1 disabled:opacity-50">
                  {savingAdd ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}