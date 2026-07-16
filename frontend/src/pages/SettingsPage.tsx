import { useState, useEffect, useCallback } from 'react';
import { Save, Trash2, ChevronRight, Download, Upload, RefreshCw, Shield, Database, HardDrive, Activity, Info, ScrollText } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useAuthStore } from '@/store/authStore';
import { setConfirmBeforeDelete } from '@/lib/confirmPreference';
import { Modal } from '@/components/ui';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const TABS = ['General','Business','POS & Payments','Notifications','Users & Permissions','Backup & Restore','Audit Log','Integrations','System'];

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button onClick={() => onChange(!value)}
    className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${value ? 'bg-brand' : 'bg-surface-50 border border-border'}`}>
    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

const SettingRow = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
    <div>
      <p className="text-sm font-medium text-text-primary">{label}</p>
      {description && <p className="text-xs text-text-muted">{description}</p>}
    </div>
    {children}
  </div>
);

const PreferenceCard = ({ icon, label, description, onClick }: { icon: string; label: string; description: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-brand/40 hover:bg-brand/5 transition-all text-left group">
    <div className="w-9 h-9 bg-surface-50 rounded-lg flex items-center justify-center text-lg shrink-0">{icon}</div>
    <div>
      <p className="text-xs font-medium text-text-primary">{label}</p>
      <p className="text-[11px] text-text-muted">{description}</p>
    </div>
    <ChevronRight size={14} className="text-text-muted group-hover:text-brand ml-auto transition-colors" />
  </button>
);

interface SystemInfo {
  app_version: string; environment: string; database: string;
  node_uptime_seconds: number; server_time: string;
  last_backup: { filename: string; size_bytes: number; created_at: string } | null;
}
interface StorageUsage { database_gb: number; uploads_gb: number; backups_gb: number; total_gb: number; }
interface ActivityItem { type: string; text: string; at: string; }
interface Backup { filename: string; size_bytes: number; created_at: string; }

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

const ACTIVITY_ICON: Record<string, string> = { login: '🔐', staff_added: '👤', inventory: '📦', order: '🛒' };

export default function SettingsPage() {
  const { user } = useAuthStore();
  const canManage = user?.role === 'administrator' || user?.role === 'manager';
  const canBackup = user?.role === 'administrator';

  const [activeTab, setActiveTab] = useState('General');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local preferences that genuinely have nowhere to persist to server-side
  // yet vs. real business settings — kept separate so it's clear which is
  // which. See the note in the General tab about what's actually wired to
  // behavior elsewhere in the app today.
  const [prefs, setPrefs] = useState({
    auto_logout: '30 Minutes', confirm_before_delete: true, otp_login_enabled: true, sms_kitchen_alerts_enabled: false,
  });
  const [business, setBusiness] = useState({
    business_name: '', business_address: '', business_email: '', business_phone: '', tax_pin: '', website: '',
    business_logo_url: '',
  });
  const [receiptSettings, setReceiptSettings] = useState({ receipt_footer_message: 'Thank you for dining with us!\nKaribu tena', receipt_show_customer_name: true });
  const [invoiceSettings, setInvoiceSettings] = useState({ po_number_prefix: 'PO', invoice_footer_note: '' });
  const [tableSettings, setTableSettings] = useState({ default_reservation_duration_minutes: '90', default_table_capacity: '4' });
  const [kdsSettings, setKdsSettings] = useState({ kds_refresh_interval_seconds: '30', kds_sound_alert_enabled: true });
  const [posSettings, setPosSettings] = useState({
    pos_default_payment_method: 'Cash', pos_enable_mpesa: true, pos_enable_card: true, pos_enable_till: true, pos_enable_points_redemption: true,
  });
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showKdsModal, setShowKdsModal] = useState(false);
  const [savingPanel, setSavingPanel] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; user_name?: string; user_email?: string; action: string; entity_type?: string; entity_id?: string; details?: Record<string, unknown>; ip_address?: string; created_at: string }>>([]);
  const [auditActions, setAuditActions] = useState<string[]>([]);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [auditPagination, setAuditPagination] = useState({ total: 0, page: 1, limit: 50 });
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/settings');
      const s = data.data as Record<string, string>;
      setBusiness(p => ({
        ...p,
        business_name: s.business_name || "Shawal's Deli",
        business_address: s.business_address || '',
        business_email: s.business_email || '',
        business_phone: s.business_phone || '',
        tax_pin: s.tax_pin || '',
        website: s.website || '',
        business_logo_url: s.business_logo_url || '',
      }));
      if (s.auto_logout) setPrefs(p => ({ ...p, auto_logout: s.auto_logout }));
      if (s.confirm_before_delete !== undefined) setPrefs(p => ({ ...p, confirm_before_delete: s.confirm_before_delete === 'true' }));
      if (s.otp_login_enabled !== undefined) setPrefs(p => ({ ...p, otp_login_enabled: s.otp_login_enabled === 'true' }));
      if (s.sms_kitchen_alerts_enabled !== undefined) setPrefs(p => ({ ...p, sms_kitchen_alerts_enabled: s.sms_kitchen_alerts_enabled === 'true' }));
      setReceiptSettings(p => ({
        receipt_footer_message: s.receipt_footer_message ?? p.receipt_footer_message,
        receipt_show_customer_name: s.receipt_show_customer_name !== undefined ? s.receipt_show_customer_name === 'true' : p.receipt_show_customer_name,
      }));
      setInvoiceSettings(p => ({
        po_number_prefix: s.po_number_prefix ?? p.po_number_prefix,
        invoice_footer_note: s.invoice_footer_note ?? p.invoice_footer_note,
      }));
      setTableSettings(p => ({
        default_reservation_duration_minutes: s.default_reservation_duration_minutes ?? p.default_reservation_duration_minutes,
        default_table_capacity: s.default_table_capacity ?? p.default_table_capacity,
      }));
      setKdsSettings(p => ({
        kds_refresh_interval_seconds: s.kds_refresh_interval_seconds ?? p.kds_refresh_interval_seconds,
        kds_sound_alert_enabled: s.kds_sound_alert_enabled !== undefined ? s.kds_sound_alert_enabled === 'true' : p.kds_sound_alert_enabled,
      }));
      setPosSettings(p => ({
        pos_default_payment_method: s.pos_default_payment_method ?? p.pos_default_payment_method,
        pos_enable_mpesa: s.pos_enable_mpesa !== undefined ? s.pos_enable_mpesa === 'true' : p.pos_enable_mpesa,
        pos_enable_card: s.pos_enable_card !== undefined ? s.pos_enable_card === 'true' : p.pos_enable_card,
        pos_enable_till: s.pos_enable_till !== undefined ? s.pos_enable_till === 'true' : p.pos_enable_till,
        pos_enable_points_redemption: s.pos_enable_points_redemption !== undefined ? s.pos_enable_points_redemption === 'true' : p.pos_enable_points_redemption,
      }));
    } catch { toast.error('Failed to load settings'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!canManage) return;
    api.get('/settings/system-info').then(r => setSystemInfo(r.data.data)).catch(() => {});
    api.get('/settings/storage-usage').then(r => setStorage(r.data.data)).catch(() => {});
    api.get('/settings/recent-activity').then(r => setActivity(r.data.data)).catch(() => {});
  }, [canManage]);

  useEffect(() => {
    if (activeTab === 'Backup & Restore' && canBackup) {
      api.get('/settings/backups').then(r => setBackups(r.data.data)).catch(() => {});
    }
  }, [activeTab, canBackup]);

  useEffect(() => {
    if (activeTab === 'Audit Log' && canBackup) {
      api.get('/audit-logs/actions').then(r => setAuditActions(r.data.data)).catch(() => {});
      fetchAuditLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, canBackup]);

  const fetchAuditLogs = async (page = 1) => {
    setLoadingAudit(true);
    try {
      const { data } = await api.get('/audit-logs', {
        params: { page, limit: 50, action: auditActionFilter || undefined, start_date: auditStartDate || undefined, end_date: auditEndDate || undefined },
      });
      setAuditLogs(data.data);
      setAuditPagination({ total: data.pagination.total, page: data.pagination.page, limit: data.pagination.limit });
    } catch { toast.error('Failed to load audit log'); }
    finally { setLoadingAudit(false); }
  };

  const saveGeneral = async () => {
    setSaving(true);
    try {
      await api.put('/settings', {
        auto_logout: prefs.auto_logout,
        confirm_before_delete: String(prefs.confirm_before_delete),
        otp_login_enabled: String(prefs.otp_login_enabled),
        sms_kitchen_alerts_enabled: String(prefs.sms_kitchen_alerts_enabled),
        ...business,
      });
      setConfirmBeforeDelete(prefs.confirm_before_delete);
      toast.success('Settings saved');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save settings';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  // Shared by all four preference-panel modals below — each just passes its
  // own slice of settings (already string-coerced where needed) and which
  // modal to close on success.
  const savePanel = async (values: Record<string, string>, close: () => void, label: string) => {
    setSavingPanel(true);
    try {
      await api.put('/settings', values);
      toast.success(`${label} saved`);
      close();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || `Failed to save ${label.toLowerCase()}`;
      toast.error(msg);
    } finally { setSavingPanel(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file.'); e.target.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image is too large (max 5MB).'); e.target.value = ''; return; }
    setUploadingLogo(true);
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const { data } = await api.post('/settings/logo', formData);
      setBusiness(p => ({ ...p, business_logo_url: data.url }));
      toast.success('Logo updated');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to upload logo';
      toast.error(msg);
    } finally { setUploadingLogo(false); e.target.value = ''; }
  };

  const runBackup = async () => {
    setCreatingBackup(true);
    try {
      const { data } = await api.post('/settings/backup');
      toast.success('Backup created');
      setBackups(p => [data.data, ...p]);
      const info = await api.get('/settings/system-info');
      setSystemInfo(info.data.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Backup failed';
      toast.error(msg);
    } finally { setCreatingBackup(false); }
  };

  const downloadBackup = async (filename: string) => {
    try {
      const res = await api.get(`/settings/backups/${filename}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download backup'); }
  };

  const storageData = storage ? [
    { name: 'Database', value: storage.database_gb, fill: '#3B82F6' },
    { name: 'Uploads', value: storage.uploads_gb, fill: '#10B981' },
    { name: 'Backups', value: storage.backups_gb, fill: '#F59E0B' },
  ].filter(d => d.value > 0) : [];

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="w-8 h-8 border-2 border-border border-t-brand rounded-full animate-spin" /></div>;
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <div className="flex items-center justify-between flex-wrap gap-2 px-4 md:px-6 py-4 border-b border-border bg-surface-card">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Settings</h1>
            <p className="text-xs text-text-muted">Manage your system preferences and configurations</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { fetchAll(); toast.success('Data refreshed'); }} className="btn-secondary flex items-center gap-1.5 text-sm">
              <RefreshCw size={13} /> Refresh
            </button>
            {canManage && (activeTab === 'General' || activeTab === 'Business') && (
              <button onClick={saveGeneral} disabled={saving} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                <Save size={13} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-surface-card px-4 md:px-6 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeTab === 'General' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left */}
              <div className="space-y-6">
                <div className="card p-4">
                  <h2 className="section-title mb-2">Preferences</h2>
                  <p className="text-xs text-text-muted mb-2">
                    Auto Logout is now actually enforced — the app watches for real activity and signs you out after this much idle time, regardless of which page is open.
                  </p>
                  <SettingRow label="Auto Logout" description="Automatically log out after inactivity">
                    <select className="select text-xs py-1 w-32" value={prefs.auto_logout} onChange={e => setPrefs(p => ({ ...p, auto_logout: e.target.value }))}>
                      <option>15 Minutes</option><option>30 Minutes</option><option>1 Hour</option><option>Never</option>
                    </select>
                  </SettingRow>
                  <SettingRow label="Confirm Before Delete" description="Show confirmation dialog before deleting records">
                    <Toggle value={prefs.confirm_before_delete} onChange={v => setPrefs(p => ({ ...p, confirm_before_delete: v }))} />
                  </SettingRow>
                  <SettingRow label="Email Login Code (2FA)" description="Require a 6-digit code sent by email on every login, on top of the password">
                    <Toggle value={prefs.otp_login_enabled} onChange={v => setPrefs(p => ({ ...p, otp_login_enabled: v }))} />
                  </SettingRow>
                  {prefs.otp_login_enabled && (
                    <p className="text-[11px] text-text-muted -mt-1 mb-2">
                      Sent via the same email provider used for password resets — everyone logging in will need email access at that moment. Adds a step to every login, including shift-change logins on a shared POS terminal.
                    </p>
                  )}
                  <SettingRow label="SMS Kitchen Alerts" description="Text kitchen staff's phones for every new order, via Brevo">
                    <Toggle value={prefs.sms_kitchen_alerts_enabled} onChange={v => setPrefs(p => ({ ...p, sms_kitchen_alerts_enabled: v }))} />
                  </SettingRow>
                  {prefs.sms_kitchen_alerts_enabled && (
                    <p className="text-[11px] text-text-muted -mt-1 mb-2">
                      Each SMS is a real, per-message cost through your Brevo account — this is on top of the free push notifications Kitchen Display already supports. Only sent to active staff (kitchen staff, head chef, manager, administrator) with a phone number on file.
                    </p>
                  )}
                </div>

                {/* Business Profile */}
                <div>
                  <h2 className="section-title mb-4">Business Profile</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Business Name</label>
                      <input className="input" value={business.business_name} onChange={e => setBusiness(p => ({ ...p, business_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Business Email</label>
                      <input className="input" value={business.business_email} onChange={e => setBusiness(p => ({ ...p, business_email: e.target.value }))} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-text-muted mb-1">Business Address</label>
                      <textarea className="input" rows={2} value={business.business_address} onChange={e => setBusiness(p => ({ ...p, business_address: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Business Phone</label>
                      <input className="input" value={business.business_phone} onChange={e => setBusiness(p => ({ ...p, business_phone: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Tax / PIN</label>
                      <input className="input" value={business.tax_pin} onChange={e => setBusiness(p => ({ ...p, tax_pin: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Website</label>
                      <input className="input" value={business.website} onChange={e => setBusiness(p => ({ ...p, website: e.target.value }))} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="w-24 h-24 bg-surface-50 border border-border rounded-xl flex items-center justify-center p-2 overflow-hidden">
                      <img src={business.business_logo_url || '/logo.png'} alt="Business logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <label className={`btn-secondary text-xs py-1.5 inline-flex items-center gap-1.5 cursor-pointer ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}>
                        <Upload size={12} /> {uploadingLogo ? 'Uploading…' : 'Change Logo'}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogoUpload} />
                      </label>
                      <p className="text-[10px] text-text-muted mt-1">Upload logo in PNG, JPG or WEBP format.<br />Max 5MB.</p>
                    </div>
                  </div>
                </div>

                {/* Preference cards */}
                <div>
                  <h2 className="section-title mb-3">Preferences</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <PreferenceCard icon="🧾" label="Receipt Settings" description="Customize receipt footer and details shown" onClick={() => setShowReceiptModal(true)} />
                    <PreferenceCard icon="📄" label="Invoice Settings" description="Customize purchase order numbering and footer note" onClick={() => setShowInvoiceModal(true)} />
                    <PreferenceCard icon="🖥️" label="Kitchen Display Settings" description="Auto-refresh interval and new-order sound alert" onClick={() => setShowKdsModal(true)} />
                    <PreferenceCard icon="🪑" label="Table Settings" description="Default reservation duration and table capacity" onClick={() => setShowTableModal(true)} />
                  </div>
                </div>
              </div>

              {/* Right sidebar */}
              <div className="space-y-5">
                {canManage ? (
                  <>
                    {/* System Info — every value here is real/live */}
                    <div className="card p-4">
                      <h2 className="section-title text-sm mb-3 flex items-center gap-1.5"><Info size={13} /> System Information</h2>
                      {systemInfo ? (
                        <div className="space-y-2 text-xs">
                          {[
                            ['App Version', systemInfo.app_version],
                            ['Environment', systemInfo.environment],
                            ['Database', systemInfo.database],
                            ['Server Uptime', formatUptime(systemInfo.node_uptime_seconds)],
                            ['Server Time', new Date(systemInfo.server_time).toLocaleString('en-KE')],
                            ['Last Backup', systemInfo.last_backup ? `${formatDate(systemInfo.last_backup.created_at)} (${formatBytes(systemInfo.last_backup.size_bytes)})` : 'No backups yet'],
                          ].map(([label, value]) => (
                            <div key={label} className="flex justify-between gap-3">
                              <span className="text-text-muted shrink-0">{label}</span>
                              <span className="font-medium text-right truncate">{value}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-text-muted">Loading…</p>}
                    </div>

                    {/* Storage — real sizes from the database and uploads folder */}
                    <div className="card p-4">
                      <h2 className="section-title text-sm mb-3 flex items-center gap-1.5"><HardDrive size={13} /> Storage Usage</h2>
                      {storage ? (
                        storageData.length > 0 ? (
                          <div className="flex items-center gap-4">
                            <div className="relative w-24 h-24 shrink-0">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={storageData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={45}>
                                    {storageData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-sm font-bold text-text-primary">{storage.total_gb}</span>
                                <span className="text-[9px] text-text-muted">GB total</span>
                              </div>
                            </div>
                            <div className="space-y-1.5 flex-1">
                              {storageData.map(d => (
                                <div key={d.name} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                                    <span className="text-text-secondary">{d.name}</span>
                                  </div>
                                  <span className="font-medium">{d.value} GB</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : <p className="text-xs text-text-muted">Total usage: {storage.total_gb} GB (too small to break down meaningfully yet)</p>
                      ) : <p className="text-xs text-text-muted">Loading…</p>}
                    </div>

                    {/* Recent Activity — real events, not mock names */}
                    <div className="card p-4">
                      <h2 className="section-title text-sm mb-3 flex items-center gap-1.5"><Activity size={13} /> Recent Activity</h2>
                      <div className="space-y-3">
                        {activity.length === 0 ? (
                          <p className="text-xs text-text-muted">No recent activity</p>
                        ) : activity.map((act, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="w-7 h-7 bg-surface-50 rounded-lg flex items-center justify-center text-sm shrink-0">{ACTIVITY_ICON[act.type] || '⚙'}</div>
                            <div>
                              <p className="text-xs text-text-primary">{act.text}</p>
                              <p className="text-[10px] text-text-muted">{new Date(act.at).toLocaleString('en-KE')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="card p-4 text-center">
                    <Shield size={24} className="text-text-muted mx-auto mb-2" />
                    <p className="text-xs text-text-muted">System information, storage, and activity are visible to administrators and managers only.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Business' && (
            <div className="max-w-2xl space-y-6">
              <h2 className="section-title">Business Settings</h2>
              <p className="text-xs text-text-muted -mt-3">Same fields as General → Business Profile — shown here too since some people look for them under this tab.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Business Name', key: 'business_name', type: 'text' },
                  { label: 'Business Email', key: 'business_email', type: 'email' },
                  { label: 'Business Phone', key: 'business_phone', type: 'tel' },
                  { label: 'Tax / PIN Number', key: 'tax_pin', type: 'text' },
                  { label: 'Website', key: 'website', type: 'url' },
                  { label: 'Business Address', key: 'business_address', type: 'text' },
                ].map(f => (
                  <div key={f.key} className={f.key === 'business_address' ? 'col-span-2' : ''}>
                    <label className="block text-xs text-text-muted mb-1">{f.label}</label>
                    <input type={f.type} className="input" value={business[f.key as keyof typeof business] || ''}
                      onChange={e => setBusiness(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <button onClick={saveGeneral} disabled={saving} className="btn-primary px-6 disabled:opacity-50">{saving ? 'Saving…' : 'Save Business Settings'}</button>
            </div>
          )}

          {activeTab === 'POS & Payments' && (
            <div className="max-w-2xl space-y-6">
              <h2 className="section-title">POS & Payment Settings</h2>

              <div className="card p-4 space-y-3">
                <h3 className="font-semibold text-sm">Payment Methods at Checkout</h3>
                <p className="text-xs text-text-muted">
                  Controls which tender buttons actually appear at POS checkout — Cash is always available and can't be turned off.
                </p>
                <SettingRow label="Default Payment Method" description="Which method is pre-selected when checkout opens">
                  <select className="select text-xs py-1 w-32" value={posSettings.pos_default_payment_method}
                    onChange={e => setPosSettings(p => ({ ...p, pos_default_payment_method: e.target.value }))}>
                    <option value="Cash">Cash</option>
                    {posSettings.pos_enable_mpesa && <option value="M-Pesa">M-Pesa</option>}
                    {posSettings.pos_enable_card && <option value="Card">Card</option>}
                    {posSettings.pos_enable_till && <option value="Till">Till</option>}
                  </select>
                </SettingRow>
                <SettingRow label="Accept M-Pesa" description="Show the M-Pesa button at checkout">
                  <Toggle value={posSettings.pos_enable_mpesa} onChange={v => setPosSettings(p => ({ ...p, pos_enable_mpesa: v, pos_default_payment_method: !v && p.pos_default_payment_method === 'M-Pesa' ? 'Cash' : p.pos_default_payment_method }))} />
                </SettingRow>
                <SettingRow label="Accept Card" description="Show the Card button at checkout">
                  <Toggle value={posSettings.pos_enable_card} onChange={v => setPosSettings(p => ({ ...p, pos_enable_card: v, pos_default_payment_method: !v && p.pos_default_payment_method === 'Card' ? 'Cash' : p.pos_default_payment_method }))} />
                </SettingRow>
                <SettingRow label="Accept Till" description="Show the Till button at checkout — for M-Pesa Buy Goods payments the customer sends directly to your till number, confirmed manually rather than via STK push">
                  <Toggle value={posSettings.pos_enable_till} onChange={v => setPosSettings(p => ({ ...p, pos_enable_till: v, pos_default_payment_method: !v && p.pos_default_payment_method === 'Till' ? 'Cash' : p.pos_default_payment_method }))} />
                </SettingRow>
                <SettingRow label="Allow Loyalty Point Redemption" description="Let cashiers redeem a customer's points toward a bill at POS">
                  <Toggle value={posSettings.pos_enable_points_redemption} onChange={v => setPosSettings(p => ({ ...p, pos_enable_points_redemption: v }))} />
                </SettingRow>
                <button onClick={() => savePanel({
                  pos_default_payment_method: posSettings.pos_default_payment_method,
                  pos_enable_mpesa: String(posSettings.pos_enable_mpesa),
                  pos_enable_card: String(posSettings.pos_enable_card),
                  pos_enable_till: String(posSettings.pos_enable_till),
                  pos_enable_points_redemption: String(posSettings.pos_enable_points_redemption),
                }, () => {}, 'POS payment settings')} disabled={savingPanel} className="btn-primary text-sm disabled:opacity-50">
                  {savingPanel ? 'Saving…' : 'Save Payment Settings'}
                </button>
              </div>

              <div className="card p-4 space-y-2">
                <h3 className="font-semibold text-sm">Loyalty Point Value</h3>
                <p className="text-xs text-text-muted">
                  The KES value of one point when redeemed lives on the Loyalty Points page (it's used there for the same redemption math shown to cashiers), rather than duplicated here where the two copies could drift out of sync.
                </p>
                <a href="/loyalty" className="btn-secondary text-xs inline-flex items-center gap-1.5 w-fit">Go to Loyalty Points →</a>
              </div>

              <div className="card p-4 space-y-2">
                <h3 className="font-semibold text-sm">Pricing</h3>
                <p className="text-xs text-text-muted">
                  Orders are charged at menu prices as-is — no service charge or VAT is added.
                  This isn't a configurable setting yet; it's fixed in how orders are priced.
                </p>
              </div>
              <div className="card p-4 space-y-2">
                <h3 className="font-semibold text-sm">M-Pesa Configuration</h3>
                <p className="text-xs text-text-muted">
                  M-Pesa credentials (Consumer Key, Consumer Secret, Shortcode, Passkey, Callback URL) are configured
                  through the server's environment variables, not this screen — that keeps payment provider secrets
                  out of the database and out of anything a web form could accidentally expose. Ask whoever manages
                  the server's deployment to set <code className="text-[11px] bg-surface-50 px-1 rounded">MPESA_CONSUMER_KEY</code>,{' '}
                  <code className="text-[11px] bg-surface-50 px-1 rounded">MPESA_CONSUMER_SECRET</code>, and related
                  variables in the backend's <code className="text-[11px] bg-surface-50 px-1 rounded">.env</code> file.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'Users & Permissions' && (
            <div className="max-w-4xl space-y-4">
              <h2 className="section-title">Users & Permissions</h2>
              <p className="text-xs text-text-muted">
                Roles are fixed in how the system is built today, not editable from this screen — this table shows
                what each role can actually access right now, it isn't a configurable permissions matrix.
              </p>
              <div className="card overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-50">
                    <tr>{['Role','Dashboard','POS','Orders','Inventory','Reports','Staff','Settings'].map(h => (
                      <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {[
                      { role: 'Administrator', access: [true, true, true, true, true, true, true] },
                      { role: 'Manager', access: [true, true, true, true, true, true, true] },
                      { role: 'Head Chef', access: [true, false, true, true, false, false, false] },
                      { role: 'Cashier', access: [true, true, true, false, false, false, false] },
                      { role: 'Waiter', access: [true, true, true, false, false, false, false] },
                      { role: 'Kitchen Staff', access: [true, false, true, false, false, false, false] },
                      { role: 'Cleaner', access: [true, false, false, false, false, false, false] },
                    ].map(r => (
                      <tr key={r.role} className="table-row">
                        <td className="table-cell font-medium">{r.role}</td>
                        {r.access.map((can, i) => (
                          <td key={i} className="table-cell">
                            <span className={can ? 'text-status-success' : 'text-text-muted'}>{can ? '✓' : '—'}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Backup & Restore' && (
            <div className="max-w-2xl space-y-5">
              <h2 className="section-title">Backup & Restore</h2>
              {!canBackup ? (
                <div className="card p-5 text-center">
                  <Shield size={24} className="text-text-muted mx-auto mb-2" />
                  <p className="text-xs text-text-muted">Backups contain a complete copy of every order, payment, and customer record — restricted to administrators.</p>
                </div>
              ) : (
                <>
                  <div className="card p-5 space-y-4">
                    <h3 className="font-semibold text-sm flex items-center gap-1.5"><Database size={14} /> Database Backup</h3>
                    <p className="text-xs text-text-muted">
                      {systemInfo?.last_backup
                        ? `Last backup: ${formatDate(systemInfo.last_backup.created_at)} (${formatBytes(systemInfo.last_backup.size_bytes)})`
                        : 'No backups have been created yet.'}
                    </p>
                    <div className="flex gap-3">
                      <button onClick={runBackup} disabled={creatingBackup} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                        <Database size={14} /> {creatingBackup ? 'Creating…' : 'Create Backup Now'}
                      </button>
                      {systemInfo?.last_backup && (
                        <button onClick={() => downloadBackup(systemInfo.last_backup!.filename)} className="btn-secondary flex items-center gap-2">
                          <Download size={14} /> Download Last Backup
                        </button>
                      )}
                    </div>
                  </div>

                  {backups.length > 0 && (
                    <div className="card p-5 space-y-3">
                      <h3 className="font-semibold text-sm">All Backups</h3>
                      <div className="space-y-2">
                        {backups.map(b => (
                          <div key={b.filename} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                            <div>
                              <p className="font-medium">{formatDate(b.created_at)}</p>
                              <p className="text-text-muted">{formatBytes(b.size_bytes)}</p>
                            </div>
                            <button onClick={() => downloadBackup(b.filename)} className="btn-ghost p-1.5" title="Download"><Download size={13} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="card p-5 space-y-3 border-status-error/30">
                    <h3 className="font-semibold text-sm text-status-error">Danger Zone</h3>
                    <p className="text-xs text-text-muted">
                      A real "wipe everything" action isn't built yet — deliberately. Something this destructive needs
                      a much safer confirmation flow (e.g. typing the business name to confirm) than a single click
                      before it should exist at all.
                    </p>
                    <button onClick={() => toast('Not built yet, by design — see the note above.', { icon: 'ℹ️' })}
                      className="btn-secondary text-status-error border-status-error/30 hover:bg-status-error/10 flex items-center gap-2">
                      <Trash2 size={13} /> Clear All Data
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'Audit Log' && (
            <div className="space-y-5">
              <h2 className="section-title flex items-center gap-2"><ScrollText size={18} /> Audit Log</h2>
              {!canBackup ? (
                <div className="card p-5 text-center">
                  <Shield size={24} className="text-text-muted mx-auto mb-2" />
                  <p className="text-xs text-text-muted">A record of who did what across the whole system — restricted to administrators.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-text-muted max-w-2xl">
                    Every login attempt (successful or not), staff role/status change, refund or void, and deletion
                    across the system is recorded here — this is what makes "who did this" an answerable question
                    instead of a guess.
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <select className="select text-xs py-1.5 w-48" value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)}>
                      <option value="">All Actions</option>
                      {auditActions.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
                    </select>
                    <input type="date" className="input text-xs py-1.5 w-36" value={auditStartDate} onChange={e => setAuditStartDate(e.target.value)} placeholder="From" />
                    <input type="date" className="input text-xs py-1.5 w-36" value={auditEndDate} onChange={e => setAuditEndDate(e.target.value)} placeholder="To" />
                    <button onClick={() => fetchAuditLogs(1)} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5"><RefreshCw size={12} /> Apply</button>
                  </div>

                  <div className="card overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead className="bg-surface-50">
                        <tr>
                          {['When', 'Who', 'Action', 'Details', 'IP'].map(h => (
                            <th key={h} className="table-header px-4 py-2 text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loadingAudit ? (
                          <tr><td colSpan={5} className="py-8 text-center text-text-muted text-sm">Loading…</td></tr>
                        ) : auditLogs.length === 0 ? (
                          <tr><td colSpan={5} className="py-8 text-center text-text-muted text-sm">No matching audit events</td></tr>
                        ) : auditLogs.map(log => (
                          <tr key={log.id} className="table-row">
                            <td className="table-cell text-xs text-text-muted whitespace-nowrap">{formatDate(log.created_at)} {new Date(log.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="table-cell text-xs">{log.user_name || <span className="text-text-muted">Unknown</span>}</td>
                            <td className="table-cell text-xs">
                              <span className={`badge text-[11px] ${log.action.includes('failed') || log.action.includes('deleted') || log.action.includes('refund') || log.action.includes('void') ? 'badge-error' : log.action.includes('success') || log.action.includes('created') ? 'badge-success' : 'badge-muted'}`}>
                                {log.action.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="table-cell text-[11px] text-text-muted max-w-xs truncate">
                              {log.entity_type && <span>{log.entity_type}{log.entity_id ? ` · ${String(log.entity_id).slice(0, 8)}` : ''} </span>}
                              {log.details ? JSON.stringify(log.details) : ''}
                            </td>
                            <td className="table-cell text-[11px] text-text-muted">{log.ip_address || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {auditPagination.total > auditPagination.limit && (
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span>{auditPagination.total} total events</span>
                      <div className="flex gap-2">
                        <button disabled={auditPagination.page <= 1} onClick={() => fetchAuditLogs(auditPagination.page - 1)} className="btn-secondary text-xs py-1 px-2 disabled:opacity-40">Previous</button>
                        <button disabled={auditPagination.page * auditPagination.limit >= auditPagination.total} onClick={() => fetchAuditLogs(auditPagination.page + 1)} className="btn-secondary text-xs py-1 px-2 disabled:opacity-40">Next</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {['Notifications','Integrations','System'].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-surface-50 rounded-2xl flex items-center justify-center text-3xl mb-4">⚙️</div>
              <h3 className="text-base font-semibold mb-1">{activeTab} Settings</h3>
              <p className="text-text-muted text-sm max-w-xs">Configuration options for {activeTab.toLowerCase()} will be displayed here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Settings */}
      <Modal open={showReceiptModal} onClose={() => setShowReceiptModal(false)} title="Receipt Settings">
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            The header (business name, address, phone) already comes from Business Profile above — this only covers what's specific to the printed receipt.
          </p>
          <div>
            <label className="block text-xs text-text-muted mb-1">Footer Message</label>
            <textarea className="input" rows={2} value={receiptSettings.receipt_footer_message}
              onChange={e => setReceiptSettings(p => ({ ...p, receipt_footer_message: e.target.value }))}
              placeholder="Thank you for dining with us!" />
          </div>
          <SettingRow label="Show Customer Name" description="Print the customer's name on the receipt when one is on file">
            <Toggle value={receiptSettings.receipt_show_customer_name} onChange={v => setReceiptSettings(p => ({ ...p, receipt_show_customer_name: v }))} />
          </SettingRow>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowReceiptModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => savePanel({
                receipt_footer_message: receiptSettings.receipt_footer_message,
                receipt_show_customer_name: String(receiptSettings.receipt_show_customer_name),
              }, () => setShowReceiptModal(false), 'Receipt settings')}
              disabled={savingPanel} className="btn-primary flex-1 disabled:opacity-50"
            >{savingPanel ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      {/* Invoice Settings */}
      <Modal open={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="Invoice Settings">
        <div className="space-y-4">
          <p className="text-xs text-text-muted">Applies to purchase order documents (View Invoice / Print on the Purchases page).</p>
          <div>
            <label className="block text-xs text-text-muted mb-1">PO Number Prefix</label>
            <input className="input" value={invoiceSettings.po_number_prefix}
              onChange={e => setInvoiceSettings(p => ({ ...p, po_number_prefix: e.target.value.toUpperCase().slice(0, 10) }))}
              placeholder="PO" />
            <p className="text-[11px] text-text-muted mt-1">New purchase orders will be numbered like {invoiceSettings.po_number_prefix || 'PO'}-1234567.</p>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Footer Note</label>
            <textarea className="input" rows={2} value={invoiceSettings.invoice_footer_note}
              onChange={e => setInvoiceSettings(p => ({ ...p, invoice_footer_note: e.target.value }))}
              placeholder="e.g. Payment terms, thank-you note..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowInvoiceModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => savePanel({
                po_number_prefix: invoiceSettings.po_number_prefix || 'PO',
                invoice_footer_note: invoiceSettings.invoice_footer_note,
              }, () => setShowInvoiceModal(false), 'Invoice settings')}
              disabled={savingPanel} className="btn-primary flex-1 disabled:opacity-50"
            >{savingPanel ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      {/* Table Settings */}
      <Modal open={showTableModal} onClose={() => setShowTableModal(false)} title="Table Settings">
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            Adding, editing, or removing individual tables happens on the Tables page — these are just the defaults used there.
          </p>
          <div>
            <label className="block text-xs text-text-muted mb-1">Default Reservation Duration (minutes)</label>
            <input type="number" min={15} step={15} className="input" value={tableSettings.default_reservation_duration_minutes}
              onChange={e => setTableSettings(p => ({ ...p, default_reservation_duration_minutes: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Default Table Capacity</label>
            <input type="number" min={1} className="input" value={tableSettings.default_table_capacity}
              onChange={e => setTableSettings(p => ({ ...p, default_table_capacity: e.target.value }))} />
            <p className="text-[11px] text-text-muted mt-1">Pre-fills the capacity field when adding a new table.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowTableModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => savePanel({
                default_reservation_duration_minutes: String(Math.max(15, parseInt(tableSettings.default_reservation_duration_minutes) || 90)),
                default_table_capacity: String(Math.max(1, parseInt(tableSettings.default_table_capacity) || 4)),
              }, () => setShowTableModal(false), 'Table settings')}
              disabled={savingPanel} className="btn-primary flex-1 disabled:opacity-50"
            >{savingPanel ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      {/* Kitchen Display Settings */}
      <Modal open={showKdsModal} onClose={() => setShowKdsModal(false)} title="Kitchen Display Settings">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">Auto-Refresh Interval (seconds)</label>
            <select className="select" value={kdsSettings.kds_refresh_interval_seconds}
              onChange={e => setKdsSettings(p => ({ ...p, kds_refresh_interval_seconds: e.target.value }))}>
              <option value="10">10 seconds</option>
              <option value="15">15 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">60 seconds</option>
            </select>
          </div>
          <SettingRow label="Sound Alert on New Order" description="Play a short tone when a new order appears on the kitchen display">
            <Toggle value={kdsSettings.kds_sound_alert_enabled} onChange={v => setKdsSettings(p => ({ ...p, kds_sound_alert_enabled: v }))} />
          </SettingRow>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowKdsModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => savePanel({
                kds_refresh_interval_seconds: kdsSettings.kds_refresh_interval_seconds,
                kds_sound_alert_enabled: String(kdsSettings.kds_sound_alert_enabled),
              }, () => setShowKdsModal(false), 'Kitchen display settings')}
              disabled={savingPanel} className="btn-primary flex-1 disabled:opacity-50"
            >{savingPanel ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}