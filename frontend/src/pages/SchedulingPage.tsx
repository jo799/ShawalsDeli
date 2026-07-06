import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Download, Printer, Plus } from 'lucide-react';
import { addDays, startOfWeek, format, isSameDay, addWeeks, subWeeks } from 'date-fns';
import api from '@/lib/api';
import { getInitials, normalizeScheduleDate, toLocalDateString } from '@/lib/utils';
import { PageHeader } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
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
  off: 'Off',
};

const SHIFT_HOURS: Record<string, number> = {
  morning: 8, day: 8, evening: 8, night: 8, off: 0,
};

const ROLE_LABEL: Record<string, string> = {
  administrator: 'Administrator', manager: 'Manager', head_chef: 'Head Chef',
  cashier: 'Cashier', waiter: 'Waiter', kitchen_staff: 'Kitchen Staff', cleaner: 'Cleaner',
};

export default function SchedulingPage() {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('scheduling.manage');
  const printRef = useRef<HTMLDivElement>(null);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [showAddShift, setShowAddShift] = useState(false);
  const [editingCell, setEditingCell] = useState<{ userId: string; dayIdx: number } | null>(null);
  const [createForm, setCreateForm] = useState({
    user_id: '', shift_date: toLocalDateString(), shift_type: 'day',
  });
  const [savingCreate, setSavingCreate] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');

      const [staffRes, schedRes] = await Promise.all([
        api.get('/staff', { params: { limit: 50, status: 'active' } }),
        api.get('/staff/schedules', { params: { start_date: startDate, end_date: endDate } }),
      ]);
      setStaff(staffRes.data.data);
      setSchedules(
        (schedRes.data.data as Schedule[]).map(s => ({
          ...s,
          shift_date: normalizeScheduleDate(s.shift_date),
        }))
      );
    } catch {
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (staff.length && !createForm.user_id) {
      setCreateForm(f => ({ ...f, user_id: staff[0].id }));
    }
  }, [staff, createForm.user_id]);

  const filteredStaff = useMemo(
    () => (roleFilter ? staff.filter(s => s.role === roleFilter) : staff),
    [staff, roleFilter]
  );

  const getShiftForDay = useCallback((userId: string, dayIdx: number): string => {
    const dateStr = format(weekDays[dayIdx], 'yyyy-MM-dd');
    const found = schedules.find(
      s => s.user_id === userId && normalizeScheduleDate(s.shift_date) === dateStr
    );
    return found?.shift_type || 'off';
  }, [schedules, weekDays]);

  const getShiftLabel = (userId: string, dayIdx: number): string => {
    const shift = getShiftForDay(userId, dayIdx);
    if (shift === 'off') return 'Off';
    return SHIFT_LABELS[shift]?.split(' (')[0] || shift;
  };

  const getShiftTime = (shift: string): string => {
    const times: Record<string, string> = {
      morning: '6:00 AM – 2:00 PM', day: '8:00 AM – 4:00 PM',
      evening: '11:00 AM – 7:00 PM', night: '3:00 PM – 11:00 PM',
    };
    return times[shift] || '';
  };

  const weekStats = useMemo(() => {
    let totalShifts = 0;
    let totalHours = 0;
    let workingSlots = 0;
    const shiftCounts: Record<string, number> = { morning: 0, day: 0, evening: 0, night: 0 };

    filteredStaff.forEach(member => {
      weekDays.forEach((_, dayIdx) => {
        const shift = getShiftForDay(member.id, dayIdx);
        if (shift !== 'off') {
          totalShifts += 1;
          totalHours += SHIFT_HOURS[shift] || 0;
          workingSlots += 1;
          if (shiftCounts[shift] !== undefined) shiftCounts[shift] += 1;
        }
      });
    });

    const totalSlots = filteredStaff.length * 7;
    const coverage = totalSlots ? Math.round((workingSlots / totalSlots) * 100) : 0;

    return { totalShifts, totalHours, coverage, shiftCounts };
  }, [filteredStaff, weekDays, getShiftForDay]);

  const updateShift = async (userId: string, dayIdx: number, shiftType: string) => {
    const shiftDate = format(weekDays[dayIdx], 'yyyy-MM-dd');
    try {
      const member = staff.find(s => s.id === userId);
      await api.post('/staff/schedules', {
        user_id: userId,
        shift_date: shiftDate,
        shift_type: shiftType,
        role_label: ROLE_LABEL[member?.role || ''] || 'Staff',
      });
      toast.success('Shift updated');
      setEditingCell(null);
      fetchData();
    } catch {
      toast.error('Failed to update shift');
    }
  };

  const submitCreateSchedule = async () => {
    if (!createForm.user_id || !createForm.shift_date) {
      toast.error('Select a staff member and date');
      return;
    }
    setSavingCreate(true);
    try {
      const member = staff.find(s => s.id === createForm.user_id);
      await api.post('/staff/schedules', {
        ...createForm,
        role_label: ROLE_LABEL[member?.role || ''] || 'Staff',
      });
      toast.success('Schedule created');
      setShowAddShift(false);
      setCreateForm({ user_id: staff[0]?.id || '', shift_date: toLocalDateString(), shift_type: 'day' });
      fetchData();
    } catch {
      toast.error('Failed to create schedule');
    } finally {
      setSavingCreate(false);
    }
  };

  const exportSchedule = () => {
    const header = ['Staff Member', 'Role', ...weekDays.map(d => format(d, 'EEE MMM d'))];
    const rows = filteredStaff.map(member => [
      member.full_name,
      ROLE_LABEL[member.role] || member.role,
      ...weekDays.map((_, i) => {
        const shift = getShiftForDay(member.id, i);
        return shift === 'off' ? 'Off' : (SHIFT_LABELS[shift] || shift);
      }),
    ]);

    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule-${format(weekStart, 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Schedule exported');
  };

  const printSchedule = () => {
    window.print();
  };

  const shiftSummary = [
    { label: 'Morning (6AM-2PM)', count: weekStats.shiftCounts.morning, color: 'bg-status-success' },
    { label: 'Day (8AM-4PM)', count: weekStats.shiftCounts.day, color: 'bg-brand' },
    { label: 'Evening (11AM-7PM)', count: weekStats.shiftCounts.evening, color: 'bg-status-purple' },
    { label: 'Night (3PM-11PM)', count: weekStats.shiftCounts.night, color: 'bg-status-info' },
  ];

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          aside, nav { display: none !important; }
          main { overflow: visible !important; height: auto !important; }
          body { background: white !important; color: black !important; }
          .schedule-print-area { border: none !important; box-shadow: none !important; }
          .schedule-print-area table { font-size: 9px; }
          .schedule-print-area th, .schedule-print-area td { border: 1px solid #ccc !important; padding: 4px !important; }
        }
      `}</style>
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          <div className="no-print">
            <PageHeader title="Scheduling" subtitle="Create and manage staff schedules and shifts">
              <button onClick={exportSchedule} className="btn-secondary flex items-center gap-1.5 text-sm">
                <Download size={13} /> Export
              </button>
              <button onClick={printSchedule} className="btn-secondary flex items-center gap-1.5 text-sm">
                <Printer size={13} /> Print
              </button>
              {canManage && (
                <button onClick={() => setShowAddShift(true)} className="btn-primary flex items-center gap-2 text-sm">
                  <Plus size={14} /> Create Schedule
                </button>
              )}
            </PageHeader>
          </div>

          <div className="hidden print:block mb-4">
            <h1 className="text-xl font-bold">Shawal&apos;s Deli — Staff Schedule</h1>
            <p className="text-sm text-gray-600">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </p>
          </div>

          <div className="grid grid-cols-5 gap-3 mb-5 no-print">
            {[
              { label: 'Total Scheduled Hours', value: `${weekStats.totalHours}h`, icon: '🕐', sub: 'This week', color: 'text-status-info' },
              { label: 'Total Shifts', value: weekStats.totalShifts, icon: '📅', sub: 'This week', color: 'text-text-primary' },
              { label: 'Coverage', value: `${weekStats.coverage}%`, icon: '✅', sub: 'Staff days filled', color: 'text-status-success' },
              { label: 'Staff Scheduled', value: filteredStaff.length, icon: '👤', sub: 'Active this week', color: 'text-status-warning' },
              { label: 'Days Off', value: (filteredStaff.length * 7) - weekStats.totalShifts, icon: '⏱️', sub: 'This week', color: 'text-text-muted' },
            ].map(s => (
              <div key={s.label} className="card p-3 flex items-start gap-2">
                <span className="text-xl">{s.icon}</span>
                <div>
                  <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-text-muted">{s.label}</p>
                  <p className="text-[10px] text-text-muted">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-4 no-print">
            <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="btn-ghost p-1.5"><ChevronLeft size={16} /></button>
            <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="btn-ghost p-1.5"><ChevronRight size={16} /></button>
            <span className="font-semibold text-sm">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="btn-secondary text-xs py-1">Today</button>
            <select className="select text-xs py-1.5 w-28" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="">All Roles</option>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div ref={printRef} className="card flex-1 overflow-auto schedule-print-area">
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
                  <tr><td colSpan={8} className="py-12 text-center text-text-muted text-sm">No staff to display</td></tr>
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
                      const shift = getShiftForDay(member.id, dayIdx);
                      const isEditing = editingCell?.userId === member.id && editingCell?.dayIdx === dayIdx;
                      return (
                        <td key={dayIdx} className="px-1.5 py-2 text-center relative">
                          {isEditing ? (
                            <select
                              autoFocus
                              className="select text-xs py-1 w-full no-print"
                              defaultValue={shift}
                              onBlur={() => setEditingCell(null)}
                              onChange={e => updateShift(member.id, dayIdx, e.target.value)}
                            >
                              {Object.entries(SHIFT_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              type="button"
                              onClick={() => canManage && setEditingCell({ userId: member.id, dayIdx })}
                              className={`w-full rounded-lg px-1.5 py-1.5 text-[10px] font-medium text-center transition-all ${canManage ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'} ${SHIFT_COLORS[shift] || SHIFT_COLORS.off}`}
                            >
                              {shift !== 'off' ? (
                                <>
                                  <div>{getShiftTime(shift)}</div>
                                  <div className="opacity-80">{getShiftLabel(member.id, dayIdx)}</div>
                                </>
                              ) : (
                                <span className="text-text-muted">Off</span>
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
            <p className="text-[10px] text-text-muted px-4 py-2 border-t border-border no-print">
              Click any shift cell to edit (admin/manager). Shifts include break time in the listed hours.
            </p>
          </div>
        </div>

        <div className="w-[220px] shrink-0 border-l border-border bg-surface-card flex flex-col overflow-y-auto p-4 space-y-5 no-print">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="section-title text-sm">{format(new Date(), 'MMMM yyyy')}</h2>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                <div key={d} className="text-[10px] text-text-muted py-0.5">{d}</div>
              ))}
              {Array.from({ length: (new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() + 6) % 7 }, (_, i) => (
                <div key={`off-${i}`} />
              ))}
              {Array.from({ length: 31 }, (_, i) => {
                const d = new Date(new Date().getFullYear(), new Date().getMonth(), i + 1);
                if (d.getMonth() !== new Date().getMonth()) return null;
                const inWeek = d >= weekStart && d <= addDays(weekStart, 6);
                const isToday = isSameDay(d, new Date());
                return (
                  <button
                    key={d.getDate()}
                    type="button"
                    onClick={() => setWeekStart(startOfWeek(d, { weekStartsOn: 1 }))}
                    className={`text-[11px] py-0.5 rounded transition-colors ${isToday ? 'bg-brand text-black font-bold' : inWeek ? 'bg-brand/20 text-brand font-medium' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="section-title text-sm mb-3">Shift Summary</h2>
            <div className="space-y-2">
              {shiftSummary.map(s => (
                <div key={s.label} className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.color}`} />
                  <span className="text-text-secondary flex-1 text-[11px]">{s.label}</span>
                  <span className="font-bold">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {showAddShift && (
          <div className="modal-backdrop no-print" onClick={() => setShowAddShift(false)}>
            <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-border flex items-center justify-between">
                <h2 className="section-title">Create Schedule</h2>
                <button type="button" onClick={() => setShowAddShift(false)} className="btn-ghost p-1">✕</button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Staff Member</label>
                  <select
                    className="select"
                    value={createForm.user_id}
                    onChange={e => setCreateForm(p => ({ ...p, user_id: e.target.value }))}
                  >
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Date</label>
                  <input
                    type="date"
                    className="input"
                    value={createForm.shift_date}
                    onChange={e => setCreateForm(p => ({ ...p, shift_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Shift</label>
                  <select
                    className="select"
                    value={createForm.shift_type}
                    onChange={e => setCreateForm(p => ({ ...p, shift_type: e.target.value }))}
                  >
                    {Object.entries(SHIFT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowAddShift(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="button" onClick={submitCreateSchedule} disabled={savingCreate} className="btn-primary flex-1 disabled:opacity-50">
                    {savingCreate ? 'Saving…' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
