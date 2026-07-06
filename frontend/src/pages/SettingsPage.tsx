import { useState } from 'react';
import { Save, Trash2, ChevronRight, Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ROLES, ROLE_LABELS, MATRIX_MODULES, roleHasModuleAccess } from '@shared/permissions';
import toast from 'react-hot-toast';

const TABS = ['General','Business','POS & Payments','Notifications','Users & Permissions','Backup & Restore','Integrations','System'];

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button onClick={() => onChange(!value)}
    className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${value ? 'bg-brand' : 'bg-surface-50 border border-border'}`}>
    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

const SettingRow = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 bg-surface-50 rounded-lg flex items-center justify-center text-sm">⚙</div>
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && <p className="text-xs text-text-muted">{description}</p>}
      </div>
    </div>
    {children}
  </div>
);

const PreferenceCard = ({ icon, label, description }: { icon: string; label: string; description: string }) => (
  <button className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-brand/40 hover:bg-brand/5 transition-all text-left group">
    <div className="w-9 h-9 bg-surface-50 rounded-lg flex items-center justify-center text-lg shrink-0">{icon}</div>
    <div>
      <p className="text-xs font-medium text-text-primary">{label}</p>
      <p className="text-[11px] text-text-muted">{description}</p>
    </div>
    <ChevronRight size={14} className="text-text-muted group-hover:text-brand ml-auto transition-colors" />
  </button>
);

const storageData = [
  { name: 'Database', value: 1.2, fill: '#3B82F6' },
  { name: 'Uploads', value: 0.85, fill: '#10B981' },
  { name: 'Backups', value: 0.62, fill: '#F59E0B' },
  { name: 'Logs', value: 0.23, fill: '#8B5CF6' },
  { name: 'Others', value: 0.28, fill: '#6B7280' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('General');
  interface Settings {
    language: string;
    date_format: string;
    currency: string;
    timezone: string;
    dark_mode: boolean;
    auto_logout: string;
    confirm_before_delete: boolean;
    enable_sound_alerts: boolean;
    compact_view: boolean;
    business_name: string;
    business_address: string;
    business_email: string;
    business_phone: string;
    tax_pin: string;
    website: string;
  }

  const [settings, setSettings] = useState<Settings>({
    language: 'English',
    date_format: 'MMM DD, YYYY',
    currency: 'KES - Kenyan Shilling (KES)',
    timezone: '(GMT +03:00) East Africa Time (Nairobi)',
    dark_mode: true,
    auto_logout: '30 Minutes',
    confirm_before_delete: true,
    enable_sound_alerts: true,
    compact_view: false,
    // Business
    business_name: "Shawal's D.E.I",
    business_address: 'Moi Avenue, Nairobi, Kenya',
    business_email: 'info@shawalsdei.com',
    business_phone: '0712 345 678',
    tax_pin: 'P051234567Z',
    website: 'www.shawalsdei.com',
  });

  const set = (key: keyof Settings, value: string | boolean) => setSettings(p => ({ ...p, [key]: value }));

  // Only used for the dynamically-rendered Business tab text fields below,
  // all of which are genuinely string-typed in Settings. Narrower than
  // casting the whole settings object (which also has boolean fields like
  // dark_mode and would let a typo'd key silently coerce a boolean to ''}).
  type StringSettingKey = 'business_name' | 'business_email' | 'business_phone' | 'tax_pin' | 'website' | 'business_address';

  const recentActivity = [
    { text: 'Mary Njeri updated staff profile', time: 'May 25, 2025 09:45 AM', icon: '👤' },
    { text: 'System backup completed', time: 'May 24, 2025 11:30 PM', icon: '💾' },
    { text: 'Brian Otieno added new expense', time: 'May 24, 2025 10:15 PM', icon: '👤' },
    { text: 'Settings updated by Joseph Kimunya', time: 'May 24, 2025 08:22 PM', icon: '⚙' },
    { text: 'User Mary Njeri logged in', time: 'May 24, 2025 08:00 AM', icon: '🔐' },
  ];

  const totalStorage = storageData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-card">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Settings</h1>
            <p className="text-xs text-text-muted">Manage your system preferences and configurations</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-1.5 text-sm"><Trash2 size={13} /> Clear Cache</button>
            <button onClick={() => toast.success('Settings saved!')} className="btn-primary flex items-center gap-2 text-sm">
              <Save size={13} /> Save Changes
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-surface-card px-6 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'General' && (
            <div className="grid grid-cols-2 gap-6">
              {/* Left */}
              <div className="space-y-6">
                {/* General Settings */}
                <div>
                  <h2 className="section-title mb-4">General Settings</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-text-muted mb-1">System Language</label>
                      <select className="select" value={settings.language} onChange={e => set('language', e.target.value)}>
                        <option>English</option><option>Swahili</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Date Format</label>
                      <select className="select" value={settings.date_format} onChange={e => set('date_format', e.target.value)}>
                        <option>May 25, 2025 (MMM DD, YYYY)</option>
                        <option>25/05/2025 (DD/MM/YYYY)</option>
                        <option>2025-05-25 (YYYY-MM-DD)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Currency</label>
                      <select className="select" value={settings.currency} onChange={e => set('currency', e.target.value)}>
                        <option>KES - Kenyan Shilling (KES)</option>
                        <option>USD - US Dollar</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Time Zone</label>
                      <select className="select" value={settings.timezone} onChange={e => set('timezone', e.target.value)}>
                        <option>(GMT +03:00) East Africa Time (Nairobi)</option>
                        <option>(GMT +00:00) UTC</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Toggle settings */}
                <div className="card p-4">
                  <SettingRow label="Enable Dark Mode" description="Switch between dark and light theme">
                    <Toggle value={settings.dark_mode} onChange={v => set('dark_mode', v)} />
                  </SettingRow>
                  <SettingRow label="Auto Logout" description="Automatically log out after inactivity">
                    <select className="select text-xs py-1 w-32" value={settings.auto_logout} onChange={e => set('auto_logout', e.target.value)}>
                      <option>15 Minutes</option>
                      <option>30 Minutes</option>
                      <option>1 Hour</option>
                      <option>Never</option>
                    </select>
                  </SettingRow>
                  <SettingRow label="Confirm Before Delete" description="Show confirmation dialog before deleting records">
                    <Toggle value={settings.confirm_before_delete} onChange={v => set('confirm_before_delete', v)} />
                  </SettingRow>
                  <SettingRow label="Enable Sound Alerts" description="Play sound for notifications and alerts">
                    <Toggle value={settings.enable_sound_alerts} onChange={v => set('enable_sound_alerts', v)} />
                  </SettingRow>
                  <SettingRow label="Compact View" description="Reduce spacing for more compact view">
                    <Toggle value={settings.compact_view} onChange={v => set('compact_view', v)} />
                  </SettingRow>
                </div>

                {/* Business Profile */}
                <div>
                  <h2 className="section-title mb-4">Business Profile</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Business Name</label>
                      <input className="input" value={settings.business_name} onChange={e => set('business_name', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Business Email</label>
                      <input className="input" value={settings.business_email} onChange={e => set('business_email', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-text-muted mb-1">Business Address</label>
                      <textarea className="input" rows={2} value={settings.business_address} onChange={e => set('business_address', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Business Phone</label>
                      <input className="input" value={settings.business_phone} onChange={e => set('business_phone', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Tax / PIN</label>
                      <input className="input" value={settings.tax_pin} onChange={e => set('tax_pin', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Website</label>
                      <input className="input" value={settings.website} onChange={e => set('website', e.target.value)} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="w-24 h-24 bg-brand rounded-xl flex items-center justify-center p-2">
                      {/* Logo preview */}
                      <svg viewBox="0 0 80 50" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        <g transform="translate(2,2)">
                          <path d="M12 30 L15 37 L19 36 L18 26 Z" fill="#000"/>
                          <rect x="6" y="24" width="22" height="2" rx="1" fill="#000"/>
                          <path d="M8 25 Q6 25 6 27" stroke="#000" strokeWidth="1" fill="none"/>
                          <path d="M28 25 Q30 25 30 27" stroke="#000" strokeWidth="1" fill="none"/>
                          <path d="M8 24 Q9 11 18 9 Q27 11 28 24 Z" fill="#000"/>
                          <circle cx="18" cy="9" r="1.5" fill="#000"/>
                          <path d="M13 8 Q12 5 13 2" stroke="#000" strokeWidth="1" fill="none" strokeLinecap="round"/>
                          <path d="M18 6 Q17 3 18 0" stroke="#000" strokeWidth="1" fill="none" strokeLinecap="round"/>
                        </g>
                        <text x="34" y="20" fontFamily="Georgia,serif" fontStyle="italic" fontSize="10" fontWeight="700" fill="#000">Shawal's</text>
                        <text x="37" y="31" fontFamily="Arial,sans-serif" fontSize="8" fontWeight="900" fill="#000" letterSpacing="1.5">DELI</text>
                        <text x="33" y="39" fontFamily="Arial,sans-serif" fontSize="5" fill="#333">Swahili Dishes</text>
                      </svg>
                    </div>
                    <div>
                      <button className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">📷 Change Logo</button>
                      <p className="text-[10px] text-text-muted mt-1">Upload logo in PNG or JPG format.<br />Recommended size: 512×512px.</p>
                    </div>
                  </div>
                </div>

                {/* Preference cards */}
                <div>
                  <h2 className="section-title mb-3">Preferences</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: '🧾', label: 'Receipt Settings', description: 'Customize receipt header, footer and layout' },
                      { icon: '💰', label: 'Tax Settings', description: 'Manage taxes, VAT and tax rates' },
                      { icon: '📄', label: 'Invoice Settings', description: 'Customize invoice template and numbering' },
                      { icon: '🏷️', label: 'Discount Settings', description: 'Configure discount types and approvals' },
                      { icon: '🖥️', label: 'Kitchen Display Settings', description: 'Configure KDS display and ticket printing' },
                      { icon: '🪑', label: 'Table Settings', description: 'Manage table layout and floor plan' },
                    ].map(p => <PreferenceCard key={p.label} {...p} />)}
                  </div>
                </div>
              </div>

              {/* Right sidebar */}
              <div className="space-y-5">
                {/* System Info */}
                <div className="card p-4">
                  <h2 className="section-title text-sm mb-3">System Information</h2>
                  <div className="space-y-2 text-xs">
                    {[
                      ['Version', 'v2.3.1'],
                      ['Environment', 'Production'],
                      ['Database', 'PostgreSQL 16'],
                      ['Last Backup', 'May 24, 2025 11:30 PM'],
                      ['Backup Size', '125.6 MB'],
                      ['Server Time', new Date().toLocaleTimeString('en-KE')],
                      ['Uptime', '15d 6h 42m'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-text-muted">{label}</span>
                        <span className="font-medium text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Storage */}
                <div className="card p-4">
                  <h2 className="section-title text-sm mb-3">Storage Usage</h2>
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
                        <span className="text-sm font-bold text-text-primary">38%</span>
                        <span className="text-[9px] text-text-muted">Used</span>
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
                      <div className="flex justify-between text-xs font-bold pt-1 border-t border-border">
                        <span>Total</span>
                        <span>{totalStorage.toFixed(1)} GB</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="section-title text-sm">Recent Activity</h2>
                    <button className="text-xs text-brand">View All</button>
                  </div>
                  <div className="space-y-3">
                    {recentActivity.map((act, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-7 h-7 bg-surface-50 rounded-lg flex items-center justify-center text-sm shrink-0">{act.icon}</div>
                        <div>
                          <p className="text-xs text-text-primary">{act.text}</p>
                          <p className="text-[10px] text-text-muted">{act.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Business' && (
            <div className="max-w-2xl space-y-6">
              <h2 className="section-title">Business Settings</h2>
              <div className="grid grid-cols-2 gap-4">
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
                    <input type={f.type} className="input" value={settings[f.key as StringSettingKey] || ''} onChange={e => set(f.key as StringSettingKey, e.target.value)} />
                  </div>
                ))}
              </div>
              <button onClick={() => toast.success('Business settings saved!')} className="btn-primary px-6">Save Business Settings</button>
            </div>
          )}

          {activeTab === 'POS & Payments' && (
            <div className="max-w-2xl space-y-6">
              <h2 className="section-title">POS & Payment Settings</h2>
              <div className="card p-4 space-y-2">
                <h3 className="font-semibold text-sm">Pricing</h3>
                <p className="text-xs text-text-muted">
                  Orders are charged at menu prices as-is — no service charge or VAT is added.
                  This isn't a configurable setting yet; it's fixed in how orders are priced.
                </p>
              </div>
              <div className="card p-4 space-y-4">
                <h3 className="font-semibold text-sm">M-Pesa Configuration</h3>
                <div className="grid grid-cols-2 gap-3">
                  {['Consumer Key','Consumer Secret','Shortcode','Passkey','Callback URL'].map(f => (
                    <div key={f} className={f === 'Callback URL' ? 'col-span-2' : ''}>
                      <label className="block text-xs text-text-muted mb-1">{f}</label>
                      <input type="password" className="input" placeholder={`Enter ${f.toLowerCase()}`} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Environment</label>
                    <select className="select"><option>Sandbox</option><option>Production</option></select>
                  </div>
                </div>
              </div>
              <button onClick={() => toast.success('POS settings saved!')} className="btn-primary px-6">Save POS Settings</button>
            </div>
          )}

          {activeTab === 'Users & Permissions' && (
            <div className="max-w-4xl space-y-4">
              <h2 className="section-title">Users & Permissions</h2>
              <p className="text-sm text-text-muted">
                Permissions are defined by system roles and cannot be changed here. Contact an administrator to assign roles via the Staff page.
              </p>
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-surface-50">
                    <tr>
                      <th className="table-header px-4 py-3 text-left">Role</th>
                      {MATRIX_MODULES.map(m => (
                        <th key={m.key} className="table-header px-3 py-3 text-center text-xs">{m.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROLES.map(role => (
                      <tr key={role} className="table-row">
                        <td className="table-cell font-medium text-sm">{ROLE_LABELS[role]}</td>
                        {MATRIX_MODULES.map(m => (
                          <td key={m.key} className="table-cell text-center">
                            <span className={`inline-block w-5 h-5 rounded text-xs leading-5 ${roleHasModuleAccess(role, m.key) ? 'bg-status-success/20 text-status-success' : 'bg-surface-50 text-text-muted'}`}>
                              {roleHasModuleAccess(role, m.key) ? '✓' : '—'}
                            </span>
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
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-sm">Database Backup</h3>
                <p className="text-xs text-text-muted">Last backup: May 24, 2025 at 11:30 PM (125.6 MB)</p>
                <div className="flex gap-3">
                  <button onClick={() => toast.success('Backup started!')} className="btn-primary flex items-center gap-2">💾 Create Backup Now</button>
                  <button className="btn-secondary flex items-center gap-2"><Download size={14} /> Download Last Backup</button>
                </div>
              </div>
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-sm">Auto Backup Schedule</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-text-muted mb-1">Frequency</label>
                    <select className="select"><option>Daily</option><option>Weekly</option><option>Monthly</option></select>
                  </div>
                  <div><label className="block text-xs text-text-muted mb-1">Time</label>
                    <input type="time" className="input" defaultValue="23:30" />
                  </div>
                </div>
                <button onClick={() => toast.success('Schedule saved!')} className="btn-primary px-6">Save Schedule</button>
              </div>
              <div className="card p-5 space-y-3 border-status-error/30">
                <h3 className="font-semibold text-sm text-status-error">Danger Zone</h3>
                <p className="text-xs text-text-muted">These actions cannot be undone. Please proceed with caution.</p>
                <button onClick={() => { if (confirm('Are you sure? This will clear ALL data!')) toast.error('Action cancelled for safety'); }}
                  className="btn-secondary text-status-error border-status-error/30 hover:bg-status-error/10 flex items-center gap-2">
                  <Trash2 size={13} /> Clear All Data
                </button>
              </div>
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
    </div>
  );
}