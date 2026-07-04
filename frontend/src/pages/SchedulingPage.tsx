import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Download, Printer, Plus, Calendar, Filter } from 'lucide-react';
import { addDays, startOfWeek, format, isSameDay, addWeeks, subWeeks } from 'date-fns';
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

const ROLE_LABEL: Record<string, string> = {
  administrator: 'Administrator', manager: 'Manager', head_chef: 'Head Chef',
  cashier: 'Cashier', waiter: 'Waiter', kitchen_staff: 'Kitchen Staff', cleaner: 'Cleaner',
};

// Default weekly schedule for demo
const DEFAULT_SCHEDULE: Record<string, string[]> = {
  administrator: ['day','day','off','day','day','day','off'],
  manager: ['day','day','day','day','day','day','off'],
  head_chef: ['morning','morning','morning','off','morning','morning','off'],
  cashier: ['day','day','day','day','off','day','off'],
  waiter: ['evening','evening','evening','evening','evening','off','off'],
  kitchen_staff: ['morning','morning','morning','morning','morning','off','off'],
  cleaner: ['day','day','off','day','day','day','off'],
};

export default function SchedulingPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [currentDate] = useState(new Date());
  const [showAddShift, setShowAddShift] = useState(false);
  const [editingCell, setEditingCell] = useState<{ userId: string; dayIdx: number } | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const leaveRequests = [
    { name: 'Alice Wanjiku', dates: 'May 28 - May 30, 2025', duration: '3 days', status: 'approved', color: 'text-status-success' },
    { name: 'Brian Otieno', dates: 'June 10 - June 11, 2025', duration: '1 day', status: 'pending', color: 'text-status-warning' },
    { name: 'Sarah Ndungu', dates: 'June 22, 2025', duration: '1 day', status: 'declined', color: 'text-status-error' },
  ];

  const shiftSummary = [
    { label: 'Morning (6AM-2PM)', count: 24, color: 'bg-status-success' },
    { label: 'Day (8AM-4PM)', count: 26, color: 'bg-brand' },
    { label: 'Evening (11AM-7PM)', count: 20, color: 'bg-status-purple' },
    { label: 'Night (3PM-11PM)', count: 8, color: 'bg-status-info' },
  ];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');

      const [staffRes, schedRes] = await Promise.all([
        api.get('/staff', { params: { limit: 20 } }),
        api.get('/staff/schedules', { params: { start_date: startDate, end_date: endDate } }).catch(() => ({ data: { data: [] } }))
      ]);
      setStaff(staffRes.data.data);
      setSchedules(schedRes.data.data);
    } catch { toast.error('Failed to load schedule'); }
    finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getShiftForDay = (userId: string, dayIdx: number): string => {
    const day = weekDays[dayIdx];
    const dateStr = format(day, 'yyyy-MM-dd');
    const found = schedules.find(s => s.user_id === userId && s.shift_date === dateStr);
    if (found) return found.shift_type;
    const member = staff.find(s => s.id === userId);
    if (member) {
      const defaults = DEFAULT_SCHEDULE[member.role] || DEFAULT_SCHEDULE.waiter;
      return defaults[dayIdx] || 'off';
    }
    return 'off';
  };

  const getShiftLabel = (userId: string, dayIdx: number): string => {
    const shift = getShiftForDay(userId, dayIdx);
    if (shift === 'off') return 'Off';
    const member = staff.find(s => s.id === userId);
    return ROLE_LABEL[member?.role || ''] || shift.charAt(0).toUpperCase() + shift.slice(1);
  };

  const getShiftTime = (shift: string): string => {
    const times: Record<string, string> = {
      morning: '6:00 AM – 2:00 PM', day: '8:00 AM – 4:00 PM',
      evening: '11:00 AM – 7:00 PM', night: '3:00 PM – 11:00 PM',
    };
    return times[shift] || '';
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
    } catch { toast.error('Failed to update shift'); }
  };

  // Mini calendar helpers
  const miniMonth = Array.from({ length: 31 }, (_, i) => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
    return d.getMonth() === currentDate.getMonth() ? d : null;
  }).filter(Boolean) as Date[];

  const openShifts = [1, 2, 3, 5].includes(weekDays.findIndex(d => isSameDay(d, new Date()))) ? [0, 1, 3, 5] : [0, 1, 3];

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <PageHeader title="Scheduling" subtitle="Create and manage staff schedules and shifts">
          <button className="btn-secondary flex items-center gap-1.5 text-sm"><Download size={13} /> Export</button>
          <button className="btn-secondary flex items-center gap-1.5 text-sm"><Printer size={13} /> Print</button>
          <button onClick={() => setShowAddShift(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Create Schedule
          </button>
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total Scheduled Hours', value: '412h 30m', icon: '🕐', sub: 'This week', color: 'text-status-info' },
            { label: 'Total Shifts', value: '78', icon: '📅', sub: 'This week', color: 'text-text-primary' },
            { label: 'Coverage', value: '96%', icon: '✅', sub: 'Average coverage', color: 'text-status-success' },
            { label: 'Open Shifts', value: '3', icon: '👤', sub: 'Need to be filled', color: 'text-status-warning' },
            { label: 'Overtime Hours', value: '12h 30m', icon: '⏱️', sub: 'This week', color: 'text-status-error' },
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

        {/* Week navigation */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="btn-ghost p-1.5"><ChevronLeft size={16} /></button>
          <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="btn-ghost p-1.5"><ChevronRight size={16} /></button>
          <span className="font-semibold text-sm">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="btn-secondary text-xs py-1">Today</button>
          <button className="btn-secondary text-xs py-1 flex items-center gap-1"><Calendar size={12} /></button>
          <select className="select text-xs py-1.5 w-36"><option>All Locations</option></select>
          <select className="select text-xs py-1.5 w-28"><option>All Roles</option>{Object.entries(ROLE_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select className="select text-xs py-1.5 w-24"><option>Week</option><option>Day</option></select>
          <button className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><Filter size={12} /> Filters</button>
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
              ) : staff.map(member => (
                <tr key={member.id} className="border-b border-border/50 hover:bg-surface-50/50 transition-colors">
                  {/* Staff info */}
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
                  {/* Shift cells */}
                  {weekDays.map((_, dayIdx) => {
                    const shift = getShiftForDay(member.id, dayIdx);
                    const isEditing = editingCell?.userId === member.id && editingCell?.dayIdx === dayIdx;
                    return (
                      <td key={dayIdx} className="px-1.5 py-2 text-center relative">
                        {isEditing ? (
                          <select
                            autoFocus
                            className="select text-xs py-1 w-full"
                            defaultValue={shift}
                            onBlur={() => setEditingCell(null)}
                            onChange={e => updateShift(member.id, dayIdx, e.target.value)}
                          >
                            <option value="morning">Morning 6AM-2PM</option>
                            <option value="day">Day 8AM-4PM</option>
                            <option value="evening">Evening 11AM-7PM</option>
                            <option value="night">Night 3PM-11PM</option>
                            <option value="off">Off</option>
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingCell({ userId: member.id, dayIdx })}
                            className={`w-full rounded-lg px-1.5 py-1.5 text-[10px] font-medium text-center transition-all hover:opacity-80 ${SHIFT_COLORS[shift] || SHIFT_COLORS.off}`}
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

              {/* Open shifts row */}
              <tr className="border-t-2 border-border">
                <td className="px-4 py-3">
                  <button className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-400">
                    <Plus size={12} /> Add Staff
                  </button>
                </td>
                {weekDays.map((_, dayIdx) => (
                  <td key={dayIdx} className="px-1.5 py-2">
                    {openShifts.includes(dayIdx) && (
                      <button className="w-full rounded-lg border-2 border-dashed border-brand/30 px-1.5 py-1.5 text-[10px] text-brand/60 hover:border-brand hover:text-brand transition-colors">
                        Open Shift<br />Click to assign
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="text-[10px] text-text-muted px-4 py-2 border-t border-border">
            ℹ Shifts start and end times are inclusive of break time.
          </p>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-[220px] shrink-0 border-l border-border bg-surface-card flex flex-col overflow-y-auto p-4 space-y-5">
        {/* Mini calendar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="section-title text-sm">{format(currentDate, 'MMMM yyyy')}</h2>
            <div className="flex gap-1">
              <button className="btn-ghost p-0.5"><ChevronLeft size={12} /></button>
              <button className="btn-ghost p-0.5"><ChevronRight size={12} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
              <div key={d} className="text-[10px] text-text-muted py-0.5">{d}</div>
            ))}
            {/* Offset for first day */}
            {Array.from({ length: (new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() + 6) % 7 }, (_, i) => (
              <div key={`off-${i}`} />
            ))}
            {miniMonth.map(d => {
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

        {/* Shift Summary */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title text-sm">Shift Summary</h2>
            <button className="text-xs text-brand">View Report</button>
          </div>
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

        {/* Pending Leave */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title text-sm">Pending Leave Requests</h2>
            <button className="text-xs text-brand">View All</button>
          </div>
          <div className="space-y-3">
            {leaveRequests.map(lr => (
              <div key={lr.name} className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-bold shrink-0">
                  {getInitials(lr.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{lr.name}</p>
                  <p className="text-[10px] text-text-muted">{lr.dates}</p>
                  <p className={`text-[10px] font-medium ${lr.color}`}>{lr.status.charAt(0).toUpperCase() + lr.status.slice(1)} · {lr.duration}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="section-title text-sm mb-3">Quick Actions</h2>
          <div className="space-y-2">
            <button className="btn-secondary w-full text-xs py-2 flex items-center justify-center gap-1.5">
              📋 Copy Last Week Schedule
            </button>
            <button className="btn-secondary w-full text-xs py-2 flex items-center justify-center gap-1.5">
              🤖 Auto Schedule (Recommend)
            </button>
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
              <div><label className="block text-xs text-text-muted mb-1">Staff Member</label>
                <select className="select">{staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
              </div>
              <div><label className="block text-xs text-text-muted mb-1">Date</label><input type="date" className="input" /></div>
              <div><label className="block text-xs text-text-muted mb-1">Shift</label>
                <select className="select">
                  {Object.entries(SHIFT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAddShift(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => { toast.success('Schedule created!'); setShowAddShift(false); }} className="btn-primary flex-1">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
