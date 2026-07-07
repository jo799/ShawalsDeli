import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Monitor, ChefHat, Package, LineChart } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.data.user, data.data.token);
      navigate('/');
      toast.success(`Welcome back, ${data.data.user.full_name.split(' ')[0]}!`);
    } catch (err: unknown) {
      // Surfaces the backend's specific messages as-is — including "awaiting
      // admin approval" / "request was declined" for accounts that exist but
      // can't log in yet, not just a generic failure.
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-300 flex">
      {/* Left panel */}
      <div className="flex-1 relative hidden lg:flex items-center justify-center bg-gradient-to-br from-surface-400 via-surface-300 to-surface-600 overflow-hidden">
        {/* Tiled brand-mark texture — brought back at a genuinely visible
            opacity (this used to be a near-invisible 4% CSS dot pattern).
            Uses the actual logo's icon crop as a local image asset rather
            than an external stock photo (no network dependency, nothing to
            license), tiled repeatedly like wallpaper across the panel. */}
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

      {/* Right panel - Login form */}
      <div className="w-full lg:w-[480px] flex items-center justify-center p-8 bg-surface-card">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 text-center">
            <img src="/logo.png" alt="Shawal's Deli" className="w-48 max-w-full mx-auto" />
          </div>

          <h2 className="text-2xl font-bold text-text-primary mb-1">Welcome Back</h2>
          <p className="text-text-muted text-sm mb-8">Sign in to your Shawal's Deli account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input pl-9"
                  placeholder="Enter your email"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pl-9 pr-10"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="text-right mt-1">
                <Link to="/forgot-password" className="text-xs text-brand hover:text-brand-400">Forgot password?</Link>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2">
              {loading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <p className="text-center text-xs text-text-muted mt-6">
            Don't have an account? <Link to="/signup" className="text-brand hover:text-brand-400">Sign up</Link>
          </p>
          <p className="text-center text-[11px] text-text-muted mt-1.5">
            New accounts need admin approval before you can log in.
          </p>

          <p className="text-center text-xs text-text-muted mt-8">© {new Date().getFullYear()} Shawal's Deli. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}