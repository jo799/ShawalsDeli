import { cn, getStatusColor } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

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
      {children && <div className="flex items-center gap-2">{children}</div>}
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
