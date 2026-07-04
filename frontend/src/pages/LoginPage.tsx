import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('joseph.kimunya@shawalsdei.com');
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
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-300 flex">
      {/* Left panel */}
      <div className="flex-1 relative hidden lg:block">
        <img
          src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80"
          alt="Kenyan Food"
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12">
          {/* Logo */}
          <div className="mb-10 text-center">
            <div className="w-20 h-20 bg-brand/20 border-2 border-brand rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-bold text-brand">S</span>
            </div>
            <h1 className="text-4xl font-bold text-brand">Shawal's</h1>
            <h2 className="text-3xl font-bold text-white">DELI</h2>
            <p className="text-text-secondary text-sm mt-1">Swahili Dishes</p>
          </div>
          <p className="text-text-secondary text-center text-lg max-w-xs leading-relaxed">
            Manage your restaurant smarter, serve better and grow your business.
          </p>
          <div className="mt-10 space-y-3 w-full max-w-xs">
            {[
              { icon: '🖥️', label: 'Intuitive POS System', sub: 'Fast & easy billing' },
              { icon: '👨‍🍳', label: 'Real-time Kitchen Display', sub: 'Streamline kitchen operations' },
              { icon: '📦', label: 'Inventory Management', sub: 'Track stock in real-time' },
              { icon: '📊', label: 'Reports & Analytics', sub: 'Make data-driven decisions' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3">
                <span className="text-xl">{f.icon}</span>
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
            <div className="w-16 h-16 bg-brand/10 border border-brand/30 rounded-xl flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-brand">S</span>
            </div>
            <h1 className="text-2xl font-bold text-brand">Shawal's DELI</h1>
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
                  required
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="text-right mt-1">
                <button type="button" className="text-xs text-brand hover:text-brand-400">Forgot password?</button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2">
              {loading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-muted">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button className="btn-secondary w-full mt-4 py-2.5 flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign in with Google
          </button>

          <p className="text-center text-xs text-text-muted mt-6">
            Don't have an account? <button className="text-brand hover:text-brand-400">Sign up</button>
          </p>

          <p className="text-center text-xs text-text-muted mt-8">© 2025 Shawal's Deli. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
