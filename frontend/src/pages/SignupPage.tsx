import { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Phone, Lock, Eye, EyeOff, CheckCircle2, Monitor, ChefHat, Package, LineChart } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function SignupPage() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await api.post('/auth/register', {
        full_name: form.full_name, email: form.email, phone: form.phone || undefined, password: form.password,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create account';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-300 flex">
      {/* Left panel — same branding treatment as LoginPage, so the two flows
          feel like one product rather than a designed page and an
          afterthought bolted on next to it. */}
      <div className="flex-1 relative hidden lg:flex items-center justify-center bg-gradient-to-br from-surface-400 via-surface-300 to-surface-600 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.09]" style={{
          backgroundImage: "url('/logo-icon.png')",
          backgroundSize: '140px 166px',
          backgroundRepeat: 'repeat',
        }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface-300/40 to-surface-300/90" />
        <div className="relative flex flex-col items-center justify-center p-12">
          <div className="mb-10 text-center">
            <img src="/logo.png" alt="Shawal's Deli" className="w-72 max-w-full mx-auto drop-shadow-[0_0_30px_rgba(245,163,0,0.15)]" />
          </div>
          <p className="text-text-secondary text-center text-lg max-w-xs leading-relaxed">
            Manage your restaurant smarter, serve better and grow your business.
          </p>
          <div className="mt-10 space-y-3 w-full max-w-xs">
            {[
              { Icon: Monitor, label: 'Intuitive POS System', sub: 'Fast & easy billing' },
              { Icon: ChefHat, label: 'Real-time Kitchen Display', sub: 'Streamline kitchen operations' },
              { Icon: Package, label: 'Inventory Management', sub: 'Track stock in real-time' },
              { Icon: LineChart, label: 'Reports & Analytics', sub: 'Make data-driven decisions' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center text-brand shrink-0"><f.Icon size={17} /></div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{f.label}</p>
                  <p className="text-xs text-text-muted">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - Signup form */}
      <div className="w-full lg:w-[480px] flex items-center justify-center p-8 bg-surface-card overflow-y-auto">
        <div className="w-full max-w-sm py-8">
          <div className="lg:hidden mb-8 text-center">
            <img src="/logo.png" alt="Shawal's Deli" className="w-48 max-w-full mx-auto" />
          </div>

          {submitted ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle2 size={48} className="text-status-success mx-auto" />
              <h2 className="text-lg font-bold text-text-primary">Request submitted</h2>
              <p className="text-sm text-text-muted">
                Your account is awaiting admin approval. You'll be able to log in once an administrator approves it.
              </p>
              <Link to="/login" className="btn-primary w-full py-2.5 inline-block mt-2">Back to Login</Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-text-primary mb-1">Create Your Account</h2>
              <p className="text-text-muted text-sm mb-6">Join Shawal's Deli and get started today</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Full Name</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input className="input pl-9" placeholder="Your full name" value={form.full_name}
                      onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input type="email" className="input pl-9" placeholder="you@example.com" value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))} autoComplete="username" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Phone (optional)</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input className="input pl-9" placeholder="07XX XXX XXX" value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input type={showPw ? 'text' : 'password'} className="input pl-9 pr-10" placeholder="At least 8 characters"
                      value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} autoComplete="new-password" required />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input type={showPw ? 'text' : 'password'} className="input pl-9" placeholder="Re-enter your password"
                      value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} autoComplete="new-password" required />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2">
                  {loading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : null}
                  {loading ? 'Submitting...' : 'Request Access'}
                </button>
              </form>

              <p className="text-center text-xs text-text-muted mt-6">
                Already have an account? <Link to="/login" className="text-brand hover:text-brand-400">Sign in</Link>
              </p>
              <p className="text-center text-[11px] text-text-muted mt-1.5">
                New accounts need admin approval before you can log in.
              </p>
            </>
          )}

          <p className="text-center text-xs text-text-muted mt-8">© {new Date().getFullYear()} Shawal's Deli. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}