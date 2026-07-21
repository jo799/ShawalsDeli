import { useState } from 'react';
import { cn, getStatusColor, toLocalDateString } from '@/lib/utils';
import { LucideIcon, FileSpreadsheet, ChevronDown } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Badge ───────────────────────────────────────────────────────
interface BadgeProps { status: string; label?: string; className?: string; }
export function StatusBadge({ status, label, className }: BadgeProps) {
  const color = getStatusColor(status);
  const cls: Record<string, string> = {
    success: 'bg-status-success/10 text-status-success',
    warning: 'bg-status-warning/10 text-status-warning',
    error:   'bg-status-error/10 text-status-error',
    info:    'bg-status-info/10 text-status-info',
    purple:  'bg-status-purple/10 text-status-purple',
    muted:   'bg-surface-50 text-text-secondary',
  };
  return (
    <span className={cn('badge capitalize', cls[color], className)}>
      {label || status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────
interface StatCardProps {
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  label: string;
  value: string | number;
  sub?: string;
  trend?: number;
}
export function StatCard({ icon: Icon, iconColor = 'text-brand', iconBg = 'bg-brand/10', label, value, sub, trend }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
        <Icon size={18} className={iconColor} />
      </div>
      <div>
        <p className="text-xs text-text-muted mb-0.5">{label}</p>
        <p className="text-lg font-bold text-text-primary leading-tight">{value}</p>
        {sub && (
          <p className="text-xs text-text-muted mt-0.5">
            {trend !== undefined && (
              <span className={trend >= 0 ? 'text-status-success' : 'text-status-error'}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%{' '}
              </span>
            )}
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Page Header ─────────────────────────────────────────────────
interface PageHeaderProps { title: string; subtitle?: string; children?: React.ReactNode; }
export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="text-xl font-bold text-text-primary">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center flex-wrap gap-2">{children}</div>}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────
interface EmptyStateProps { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode; }
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-16 h-16 bg-surface-50 rounded-2xl flex items-center justify-center mb-4">
          <Icon size={32} className="text-text-muted" />
        </div>
      )}
      <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>
      {description && <p className="text-sm text-text-muted mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className={cn('border-2 border-border border-t-brand rounded-full animate-spin', sizes[size])} />
  );
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center h-full py-32">
      <Spinner size="lg" />
    </div>
  );
}

// ─── Search Input ─────────────────────────────────────────────────
import { Search } from 'lucide-react';
interface SearchInputProps { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; }
export function SearchInput({ value, onChange, placeholder = 'Search...', className }: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-8"
      />
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────
import { X } from 'lucide-react';
interface ModalProps { open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; }
export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={cn('modal', sizes[size])}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="section-title">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────
interface PaginationProps { page: number; pages: number; total: number; limit: number; onChange: (p: number) => void; }
export function Pagination({ page, pages, total, limit, onChange }: PaginationProps) {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-xs text-text-muted">Showing {start} to {end} of {total}</p>
      <div className="flex items-center gap-1">
        <button disabled={page === 1} onClick={() => onChange(page - 1)} className="btn-ghost text-xs px-2 py-1 disabled:opacity-30">‹</button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          const p = i + 1;
          return (
            <button key={p} onClick={() => onChange(p)}
              className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors', p === page ? 'bg-brand text-black' : 'btn-ghost')}>
              {p}
            </button>
          );
        })}
        {pages > 5 && <span className="text-text-muted text-xs">...</span>}
        {pages > 5 && (
          <button onClick={() => onChange(pages)} className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors', page === pages ? 'bg-brand text-black' : 'btn-ghost')}>
            {pages}
          </button>
        )}
        <button disabled={page === pages} onClick={() => onChange(page + 1)} className="btn-ghost text-xs px-2 py-1 disabled:opacity-30">›</button>
      </div>
    </div>
  );
}

// ─── Financial Summary Export ───────────────────────────────────────
// Shared by the Purchases and Expenses pages — a real .xlsx covering how
// expenses and purchases actually connect to profitability for a chosen
// period (Today/Week/Month/Year), rather than each page only ever
// exporting its own itemized list with no view of the bigger financial
// picture. One component so both pages can never drift apart on what this
// button actually does.
export function FinancialSummaryExportButton() {
  const [showMenu, setShowMenu] = useState(false);
  const [exportingPeriod, setExportingPeriod] = useState<string | null>(null);

  const download = async (period: 'today' | 'week' | 'month' | 'year') => {
    setExportingPeriod(period);
    setShowMenu(false);
    try {
      const periodParam = period === 'today' ? 'day' : period;
      const res = await api.get('/reports/financial-summary-export', { params: { period: periodParam }, responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-summary-${period}-${toLocalDateString()}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success('Financial summary downloaded');
    } catch {
      toast.error('Could not generate the financial summary');
    } finally {
      setExportingPeriod(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(v => !v)}
        disabled={exportingPeriod !== null}
        className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50"
      >
        <FileSpreadsheet size={13} /> {exportingPeriod ? 'Generating…' : 'Financial Summary'} <ChevronDown size={13} />
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 w-44 bg-surface-card border border-border rounded-lg shadow-lg z-20 py-1">
            {([['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['year', 'This Year']] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => download(value)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-surface-50 text-text-secondary hover:text-text-primary transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}