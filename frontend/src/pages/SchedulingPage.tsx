import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Printer, Plus, Copy, X, Clock, LogIn, LogOut, Stethoscope, Upload, Bell, BellOff, CalendarOff, Check } from 'lucide-react';
import { addDays, startOfWeek, format, isSameDay, addWeeks, subWeeks, subDays, addMonths, subMonths } from 'date-fns';
import api from '@/lib/api';
import { getInitials } from '@/lib/utils';
import { PageHeader } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { getPushSubscriptionStatus, subscribeToKitchenAlerts, unsubscribeFromKitchenAlerts } from '@/lib/pushNotifications';
import toast from 'react-hot-toast';

interface StaffMember {
  id: string; full_name: string; role: string; avatar_url?: string; recurring_day_off?: number | null;
}
interface Schedule {
  user_id: string; shift_date: string; shift_type: string;
  start_time?: string; end_time?: string; role_label?: string; is_recurring?: boolean;
}
interface Attendance {
  id: string; check_in_time?: string | null; check_out_time?: string | null;
}
interface SickOffRequest {
  id: string; user_id: string; requested_date: string; message: string; receipt_url?: string;
  status: 'pending' | 'approved' | 'declined'; requested_by_name?: string; requested_by_role?: string;
  reviewed_by_name?: string; decline_reason?: string; created_at: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  const { user } = useAuthStore();
  const canManage = user?.role === 'administrator' || user?.role === 'manager';
  const isAdmin = user?.role === 'administrator';
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

  // Clock In/Out — every staff member sees this, regardless of role.
  const [myAttendance, setMyAttendance] = useState<Attendance | null>(null);
  const [clockBusy, setClockBusy] = useState(false);

  // Recurring day off — admin/manager only.
  const [editingRecurringOffFor, setEditingRecurringOffFor] = useState<string | null>(null);
  const [savingRecurringOff, setSavingRecurringOff] = useState(false);

  // Sick-off requests — the modal any staff member uses to submit one, plus
  // their own request history, plus the admin-only review queue.
  const [showSickOffModal, setShowSickOffModal] = useState(false);
  const [sickOffDate, setSickOffDate] = useState('');
  const [sickOffMessage, setSickOffMessage] = useState('');
  const [sickOffReceipt, setSickOffReceipt] = useState<File | null>(null);
  const [submittingSickOff, setSubmittingSickOff] = useState(false);
  const [myRequests, setMyRequests] = useState<SickOffRequest[]>([]);
  const [showMyRequests, setShowMyRequests] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<SickOffRequest[]>([]);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [decliningRequestId, setDecliningRequestId] = useState<string | null>(null);
  const [declineReasonInput, setDeclineReasonInput] = useState('');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<'subscribed' | 'unsubscribed' | 'unsupported' | 'denied' | 'loading'>('loading');

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

  // Clock In/Out — every staff member's own status, fetched regardless of role.
  const fetchMyAttendance = useCallback(async () => {
    try {
      const { data } = await api.get('/staff/attendance/me');
      setMyAttendance(data.data);
    } catch { /* non-critical */ }
  }, []);
  useEffect(() => { fetchMyAttendance(); }, [fetchMyAttendance]);

  const handleCheckIn = async () => {
    setClockBusy(true);
    try {
      const { data } = await api.post('/staff/attendance/check-in');
      toast.success(data.message || 'Checked in');
      fetchMyAttendance();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not check in';
      toast.error(msg);
    } finally { setClockBusy(false); }
  };

  const handleCheckOut = async () => {
    setClockBusy(true);
    try {
      const { data } = await api.post('/staff/attendance/check-out');
      toast.success(data.message || 'Checked out');
      fetchMyAttendance();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not check out';
      toast.error(msg);
    } finally { setClockBusy(false); }
  };

  // Recurring day off — admin/manager only.
  const saveRecurringDayOff = async (userId: string, dayOfWeek: number | null) => {
    setSavingRecurringOff(true);
    try {
      await api.put(`/staff/${userId}/recurring-day-off`, { recurring_day_off: dayOfWeek });
      toast.success(dayOfWeek === null ? 'Recurring day off cleared' : `Recurring day off set to ${DAY_NAMES[dayOfWeek]}`);
      setEditingRecurringOffFor(null);
      fetchData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not update recurring day off';
      toast.error(msg);
    } finally { setSavingRecurringOff(false); }
  };

  // Sick-off requests — own history (everyone) and the review queue
  // (admin only, matches the backend restriction).
  const fetchMyRequests = useCallback(async () => {
    try {
      const { data } = await api.get('/sick-off-requests/mine');
      setMyRequests(data.data);
    } catch { /* non-critical */ }
  }, []);
  useEffect(() => { fetchMyRequests(); }, [fetchMyRequests]);

  const fetchReviewQueue = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await api.get('/sick-off-requests', { params: { status: 'pending' } });
      setReviewQueue(data.data);
    } catch { /* non-critical */ }
  }, [isAdmin]);
  useEffect(() => {
    fetchReviewQueue();
    const interval = setInterval(fetchReviewQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchReviewQueue]);

  useEffect(() => { if (isAdmin) getPushSubscriptionStatus().then(setPushStatus); }, [isAdmin]);

  const handleTogglePush = async () => {
    if (pushStatus === 'subscribed') {
      await unsubscribeFromKitchenAlerts();
      setPushStatus('unsubscribed');
      toast.success('Sick-off request alerts turned off on this device');
      return;
    }
    if (pushStatus === 'denied') {
      toast.error('Notifications are blocked for this site. Check your browser/phone settings, then reload and try again.', { duration: 7000 });
      return;
    }
    setPushStatus('loading');
    const result = await subscribeToKitchenAlerts();
    if (result.success) {
      setPushStatus('subscribed');
      toast.success('This device will now get a notification for every sick-off request');
    } else {
      setPushStatus(await getPushSubscriptionStatus());
      toast.error(result.message || 'Could not enable phone alerts', { duration: 7000 });
    }
  };

  const submitSickOffRequest = async () => {
    if (!sickOffDate) { toast.error('Choose the date you need off'); return; }
    if (!sickOffMessage.trim()) { toast.error('Add a short message explaining the request'); return; }
    setSubmittingSickOff(true);
    try {
      const form = new FormData();
      form.append('requested_date', sickOffDate);
      form.append('message', sickOffMessage.trim());
      if (sickOffReceipt) form.append('receipt', sickOffReceipt);
      const { data } = await api.post('/sick-off-requests', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(data.message || 'Request submitted');
      setShowSickOffModal(false);
      setSickOffDate(''); setSickOffMessage(''); setSickOffReceipt(null);
      fetchMyRequests();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not submit the request';
      toast.error(msg);
    } finally { setSubmittingSickOff(false); }
  };

  const approveSickOff = async (r: SickOffRequest) => {
    if (!confirm(`Approve ${r.requested_by_name}'s sick-off request for ${format(new Date(r.requested_date), 'MMM d, yyyy')}? This will mark that day off in their schedule.`)) return;
    setProcessingRequestId(r.id);
    try {
      const { data } = await api.post(`/sick-off-requests/${r.id}/approve`);
      toast.success(data.message || 'Request approved');
      fetchReviewQueue();
      fetchData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not approve';
      toast.error(msg);
    } finally { setProcessingRequestId(null); }
  };

  const declineSickOff = async (r: SickOffRequest) => {
    setProcessingRequestId(r.id);
    try {
      const { data } = await api.post(`/sick-off-requests/${r.id}/decline`, { decline_reason: declineReasonInput.trim() || undefined });
      toast.success(data.message || 'Request declined');
      setDecliningRequestId(null);
      setDeclineReasonInput('');
      fetchReviewQueue();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not decline';
      toast.error(msg);
    } finally { setProcessingRequestId(null); }
  };

  // Nothing scheduled for a cell used to silently show a made-up default
  // shift (e.g. every waiter always "on evening shift" even if no one had
  // ever actually scheduled them) — indistinguishable from a real
  // assignment. Returns null now instead, and the grid shows an honest
  // "Unscheduled" state for it — UNLESS the staff member has a recurring
  // day off set for this exact day of the week, in which case that's what
  // actually applies by default. A real, explicit staff_schedules row for
  // this date (someone covering that day, or an approved sick-off day
  // already written as a genuine row) always takes precedence over this
  // synthetic fallback — see the explicit-entry check first, below.
  const getShiftForDay = (member: StaffMember, dayIdx: number): Schedule | null => {
    const day = weekDays[dayIdx];
    const dateStr = format(day, 'yyyy-MM-dd');
    const explicit = schedules.find(s => s.user_id === member.id && normalizeDate(s.shift_date) === dateStr);
    if (explicit) return explicit;
    if (member.recurring_day_off !== null && member.recurring_day_off !== undefined && day.getDay() === member.recurring_day_off) {
      return { user_id: member.id, shift_date: dateStr, shift_type: 'off', role_label: 'Recurring Day Off', is_recurring: true };
    }
    return null;
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
        const s = getShiftForDay(member, dayIdx);
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
          {isAdmin && pushStatus !== 'unsupported' && (
            <button
              onClick={handleTogglePush}
              disabled={pushStatus === 'loading'}
              title={pushStatus === 'denied' ? 'Notifications blocked — enable them in your browser/phone settings' : 'Get a phone notification the moment a sick-off request comes in'}
              className={`btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50 ${pushStatus === 'subscribed' ? 'border-status-success/40 text-status-success' : pushStatus === 'denied' ? 'border-status-warning/40 text-status-warning' : ''}`}
            >
              {pushStatus === 'subscribed' ? <Bell size={14} /> : <BellOff size={14} />}
              <span className="hidden lg:inline">{pushStatus === 'loading' ? 'Loading…' : pushStatus === 'subscribed' ? 'Alerts ON' : 'Enable alerts'}</span>
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowReviewPanel(true)} className="btn-secondary flex items-center gap-1.5 text-sm relative">
              <Stethoscope size={14} /> <span className="hidden sm:inline">Sick-Off Requests</span>
              {reviewQueue.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-status-warning rounded-full text-[10px] font-bold flex items-center justify-center text-black">
                  {reviewQueue.length}
                </span>
              )}
            </button>
          )}
          <button onClick={() => setShowMyRequests(true)} className="btn-secondary flex items-center gap-1.5 text-sm">My Requests</button>
          <button onClick={() => setShowSickOffModal(true)} className="btn-secondary flex items-center gap-1.5 text-sm"><Stethoscope size={14} /> <span className="hidden sm:inline">Request Sick Off</span></button>
          <button onClick={exportCsv} className="btn-secondary flex items-center gap-1.5 text-sm">Export CSV</button>
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-1.5 text-sm"><Printer size={13} /> Print</button>
          {canManage && (
            <button onClick={() => { setAddForm({ user_id: '', shift_date: format(weekStart, 'yyyy-MM-dd'), shift_type: 'day' }); setShowAddShift(true); }} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Create Schedule
            </button>
          )}
        </PageHeader>

        {/* Clock In/Out — every staff member sees this, since scheduling.view
            is granted to every role. Own status only; this isn't a
            management tool, it's the thing each person uses on themselves
            every day. */}
        <div className="card p-3 mb-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock size={16} className="text-brand" />
            {myAttendance?.check_in_time && myAttendance?.check_out_time ? (
              <span className="text-text-secondary">
                Checked in <span className="font-semibold text-text-primary">{format(new Date(myAttendance.check_in_time), 'h:mm a')}</span> · out <span className="font-semibold text-text-primary">{format(new Date(myAttendance.check_out_time), 'h:mm a')}</span> today
              </span>
            ) : myAttendance?.check_in_time ? (
              <span className="text-text-secondary">Checked in at <span className="font-semibold text-status-success">{format(new Date(myAttendance.check_in_time), 'h:mm a')}</span> — not checked out yet</span>
            ) : (
              <span className="text-text-muted">You haven't checked in today</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCheckIn}
              disabled={clockBusy || !!myAttendance?.check_in_time}
              className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 disabled:opacity-40"
            >
              <LogIn size={13} /> Check In
            </button>
            <button
              onClick={handleCheckOut}
              disabled={clockBusy || !myAttendance?.check_in_time || !!myAttendance?.check_out_time}
              className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 disabled:opacity-40"
            >
              <LogOut size={13} /> Check Out
            </button>
          </div>
        </div>

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
                        {editingRecurringOffFor === member.id ? (
                          <select
                            autoFocus
                            disabled={savingRecurringOff}
                            defaultValue={member.recurring_day_off ?? ''}
                            onChange={e => saveRecurringDayOff(member.id, e.target.value === '' ? null : Number(e.target.value))}
                            onBlur={() => setEditingRecurringOffFor(null)}
                            className="select text-[10px] py-0.5 mt-0.5 w-full disabled:opacity-50"
                          >
                            <option value="">No recurring day off</option>
                            {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                          </select>
                        ) : (
                          <button
                            onClick={() => canManage && setEditingRecurringOffFor(member.id)}
                            disabled={!canManage}
                            className={`flex items-center gap-1 text-[10px] mt-0.5 ${canManage ? 'text-brand hover:text-brand-400 cursor-pointer' : 'text-text-muted cursor-default'}`}
                            title={canManage ? 'Click to set a recurring weekly day off' : undefined}
                          >
                            <CalendarOff size={10} />
                            {member.recurring_day_off !== null && member.recurring_day_off !== undefined ? `Off every ${DAY_NAMES[member.recurring_day_off]}` : 'No recurring day off'}
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                  {weekDays.map((_, dayIdx) => {
                    const entry = getShiftForDay(member, dayIdx);
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
                            {entry && !entry.is_recurring && (
                              <button onMouseDown={e => e.preventDefault()} onClick={() => clearShift(member.id, dayIdx)} className="btn-ghost p-1 text-status-error shrink-0" title="Remove this schedule entry entirely">
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingCell({ userId: member.id, dayIdx })}
                            className={`w-full rounded-lg px-1.5 py-1.5 text-[10px] font-medium text-center transition-all hover:opacity-80 ${entry ? (SHIFT_COLORS[entry.shift_type] || SHIFT_COLORS.off) : 'border border-dashed border-border text-text-muted'} ${entry?.is_recurring ? 'border-dashed opacity-80' : ''}`}
                          >
                            {!entry ? (
                              <span>Unscheduled</span>
                            ) : entry.shift_type !== 'off' ? (
                              <>
                                <div>{getShiftTime(entry)}</div>
                                <div className="opacity-80">{entry.role_label || ROLE_LABEL[member.role]}</div>
                              </>
                            ) : (
                              <span>{entry.role_label || 'Off'}</span>
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

      {/* Request Sick Off — any staff member */}
      {showSickOffModal && (
        <div className="modal-backdrop" onClick={() => setShowSickOffModal(false)}>
          <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="section-title flex items-center gap-2"><Stethoscope size={16} /> Request Sick Off</h2>
              <button onClick={() => setShowSickOffModal(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Date you need off</label>
                <input type="date" className="input" value={sickOffDate} onChange={e => setSickOffDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Message *</label>
                <textarea
                  rows={3}
                  className="input w-full resize-none"
                  placeholder="Briefly explain what's going on…"
                  value={sickOffMessage}
                  onChange={e => setSickOffMessage(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Hospital receipt / note (optional for now, can add later)</label>
                <label className="btn-secondary w-full flex items-center justify-center gap-2 text-sm cursor-pointer">
                  <Upload size={14} /> {sickOffReceipt ? sickOffReceipt.name : 'Choose a file…'}
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                    onChange={e => setSickOffReceipt(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowSickOffModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={submitSickOffRequest} disabled={submittingSickOff} className="btn-primary flex-1 disabled:opacity-50">
                  {submittingSickOff ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My Requests — own history, so a staff member can track whether
          theirs has been reviewed yet without needing admin access. */}
      {showMyRequests && (
        <div className="modal-backdrop" onClick={() => setShowMyRequests(false)}>
          <div className="modal max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="section-title">My Sick-Off Requests</h2>
              <button onClick={() => setShowMyRequests(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {myRequests.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">You haven't requested a sick-off day yet.</p>
              ) : myRequests.map(r => (
                <div key={r.id} className="border border-border rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{format(new Date(r.requested_date), 'EEEE, MMM d, yyyy')}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      r.status === 'approved' ? 'bg-status-success/10 text-status-success' :
                      r.status === 'declined' ? 'bg-status-error/10 text-status-error' :
                      'bg-status-warning/10 text-status-warning'
                    }`}>{r.status.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-text-secondary">"{r.message}"</p>
                  {r.receipt_url && <a href={r.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">View uploaded receipt</a>}
                  {r.status === 'declined' && r.decline_reason && (
                    <p className="text-xs text-status-error">Reason: {r.decline_reason}</p>
                  )}
                  {r.reviewed_by_name && <p className="text-[10px] text-text-muted">Reviewed by {r.reviewed_by_name}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Admin review queue */}
      {showReviewPanel && (
        <div className="modal-backdrop" onClick={() => setShowReviewPanel(false)}>
          <div className="modal max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="section-title">Pending Sick-Off Requests</h2>
              <button onClick={() => setShowReviewPanel(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {reviewQueue.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">No requests waiting on you.</p>
              ) : reviewQueue.map(r => (
                <div key={r.id} className="border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{r.requested_by_name}</span>
                    <span className="text-xs text-text-muted">{format(new Date(r.requested_date), 'EEE, MMM d')}</span>
                  </div>
                  <p className="text-xs text-text-secondary">"{r.message}"</p>
                  {r.receipt_url && <a href={r.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline flex items-center gap-1"><Upload size={11} /> View receipt</a>}
                  <p className="text-[10px] text-text-muted">Submitted {format(new Date(r.created_at), 'MMM d, h:mm a')}</p>

                  {decliningRequestId === r.id ? (
                    <div className="space-y-2 pt-1">
                      <input
                        type="text" autoFocus
                        value={declineReasonInput}
                        onChange={e => setDeclineReasonInput(e.target.value)}
                        placeholder="Why decline? (optional, shown to them)"
                        className="input text-xs"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => { setDecliningRequestId(null); setDeclineReasonInput(''); }} className="btn-secondary flex-1 text-xs py-1.5">Cancel</button>
                        <button
                          onClick={() => declineSickOff(r)}
                          disabled={processingRequestId === r.id}
                          className="btn-primary flex-1 text-xs py-1.5 text-status-error disabled:opacity-50"
                        >
                          {processingRequestId === r.id ? 'Declining…' : 'Confirm Decline'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setDecliningRequestId(r.id)}
                        disabled={processingRequestId === r.id}
                        className="btn-secondary flex-1 text-xs py-1.5 disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => approveSickOff(r)}
                        disabled={processingRequestId === r.id}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-status-success/10 text-status-success border border-status-success/30 hover:bg-status-success/20 transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-1"
                      >
                        <Check size={12} /> {processingRequestId === r.id ? 'Approving…' : 'Approve'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}