import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Monitor, ChefHat, Package, LineChart, ShieldCheck, User, Phone, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, user: currentUser, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  // 'otp' only ever happens when Settings > General has "Email Login Code"
  // turned on — otherwise handleSubmit completes the login in one step,
  // same as before this existed. 'setup' is a fourth state that overrides
  // everything else the moment the app detects zero users in the database —
  // see the useEffect below.
  const [step, setStep] = useState<'checking' | 'credentials' | 'otp' | 'setup'>('checking');
  const [otp, setOtp] = useState('');
  const [resending, setResending] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupPhone, setSetupPhone] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');

  // A fresh install has no users at all, and self-registration (see
  // SignupPage) always creates a 'pending' account that needs an existing
  // administrator to approve it — an impossible bootstrap on day one. This
  // check runs once, on load, and if the table is genuinely empty, replaces
  // the whole login screen with a one-time "create your administrator
  // account" form instead. Re-checked server-side on submit too — this
  // client-side check only decides which screen to show, it's never trusted
  // as the actual security boundary.
  useEffect(() => {
    api.get('/auth/system-status')
      .then(({ data }) => setStep(data.data.needs_setup ? 'setup' : 'credentials'))
      .catch(() => setStep('credentials')); // fail open to the normal login screen, not stuck on a spinner forever
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== setupConfirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/setup', { full_name: setupName, email, phone: setupPhone || undefined, password });
      login(data.data.user, data.data.token);
      navigate('/');
      toast.success(`Welcome, ${data.data.user.full_name.split(' ')[0]}! Your administrator account is ready.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Setup failed';
      toast.error(msg);
      // Someone else may have completed setup in the moment between this
      // page loading and this submit — re-check rather than leaving the
      // setup form up as a dead end.
      if (msg.includes('already been completed')) {
        api.get('/auth/system-status').then(({ data }) => setStep(data.data.needs_setup ? 'setup' : 'credentials')).catch(() => setStep('credentials'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.otp_required) {
        setStep('otp');
        toast.success('Check your email for a login code');
        return;
      }
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp });
      login(data.data.user, data.data.token);
      navigate('/');
      toast.success(`Welcome back, ${data.data.user.full_name.split(' ')[0]}!`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Verification failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setResending(true);
    try {
      await api.post('/auth/login', { email, password });
      toast.success('New code sent — check your email');
      setOtp('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to resend code';
      toast.error(msg);
    } finally {
      setResending(false);
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

          <h2 className="text-2xl font-bold text-text-primary mb-1">
            {step === 'otp' ? 'Check Your Email' : step === 'setup' ? 'Welcome to Shawal\'s Deli' : step === 'checking' ? ' ' : 'Welcome Back'}
          </h2>
          <p className="text-text-muted text-sm mb-8">
            {step === 'otp' ? `Enter the 6-digit code we sent to ${email}`
              : step === 'setup' ? "Let's create your administrator account to get started"
              : step === 'checking' ? ' '
              : "Sign in to your Shawal's Deli account"}
          </p>

          {step === 'checking' && (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-border border-t-brand rounded-full animate-spin" />
            </div>
          )}

          {step === 'setup' && (
            <>
              <div className="bg-brand/10 border border-brand/20 rounded-lg px-3 py-2.5 text-xs text-text-secondary mb-5 flex items-start gap-2">
                <Sparkles size={14} className="text-brand shrink-0 mt-0.5" />
                <span>No accounts exist yet — you're setting up this system for the first time. This account will have full administrator access.</span>
              </div>
              <form onSubmit={handleSetup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Full Name</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input type="text" value={setupName} onChange={e => setSetupName(e.target.value)}
                      className="input pl-9" placeholder="Your full name" autoComplete="name" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      className="input pl-9" placeholder="you@example.com" autoComplete="username" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Phone <span className="text-text-muted font-normal">(optional)</span></label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input type="tel" value={setupPhone} onChange={e => setSetupPhone(e.target.value)}
                      className="input pl-9" placeholder="0712 345 678" autoComplete="tel" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      className="input pl-9 pr-10" placeholder="At least 8 characters" autoComplete="new-password" required />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Confirm Password</label>
                  <input type={showPw ? 'text' : 'password'} value={setupConfirmPassword} onChange={e => setSetupConfirmPassword(e.target.value)}
                    className="input" placeholder="Type it again" autoComplete="new-password" required />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2">
                  {loading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : null}
                  {loading ? 'Creating account...' : 'Create Administrator Account →'}
                </button>
              </form>
            </>
          )}

          {step === 'credentials' && isAuthenticated && currentUser && (
            <div className="bg-brand/10 border border-brand/20 rounded-lg px-3 py-2 text-xs text-text-secondary mb-5">
              Currently signed in as <span className="font-medium text-text-primary">{currentUser.full_name}</span>.
              Signing in below will switch accounts — {currentUser.full_name.split(' ')[0]}'s session stays open if you change your mind.
              <button type="button" onClick={() => navigate('/')} className="block text-brand hover:text-brand-400 font-medium mt-1">← Go back without switching</button>
            </div>
          )}

          {(step === 'credentials' || step === 'otp') && (step === 'credentials' ? (
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
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">6-Digit Code</label>
                <div className="relative">
                  <ShieldCheck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="input pl-9 text-center tracking-[0.5em] font-bold text-lg"
                    placeholder="000000"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[11px] text-text-muted mt-1.5">Code expires in 5 minutes.</p>
              </div>

              <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2 disabled:opacity-50">
                {loading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : null}
                {loading ? 'Verifying...' : 'Verify & Sign In →'}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button type="button" onClick={() => { setStep('credentials'); setOtp(''); }} className="text-text-muted hover:text-text-primary">← Back to login</button>
                <button type="button" onClick={resendCode} disabled={resending} className="text-brand hover:text-brand-400 disabled:opacity-50">
                  {resending ? 'Sending…' : 'Resend Code'}
                </button>
              </div>
            </form>
          ))}

          {step === 'credentials' && (
            <>
              <p className="text-center text-xs text-text-muted mt-6">
                Don't have an account? <Link to="/signup" className="text-brand hover:text-brand-400">Sign up</Link>
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