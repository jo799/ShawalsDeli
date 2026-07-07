import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to reset password';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-300 flex items-center justify-center p-8">
      <div className="w-full max-w-sm bg-surface-card rounded-2xl border border-border p-8">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="Shawal's Deli" className="w-40 max-w-full mx-auto" />
        </div>

        {!token ? (
          <div className="text-center py-4 space-y-3">
            <AlertTriangle size={48} className="text-status-error mx-auto" />
            <h2 className="text-lg font-bold text-text-primary">Invalid link</h2>
            <p className="text-sm text-text-muted">This reset link is missing its token. Request a new one from the login page.</p>
            <Link to="/forgot-password" className="btn-primary w-full py-2.5 inline-block mt-2">Request New Link</Link>
          </div>
        ) : done ? (
          <div className="text-center py-4 space-y-3">
            <CheckCircle2 size={48} className="text-status-success mx-auto" />
            <h2 className="text-lg font-bold text-text-primary">Password reset</h2>
            <p className="text-sm text-text-muted">Taking you to the login page…</p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-text-primary mb-1 text-center">Set a new password</h2>
            <p className="text-text-muted text-sm mb-6 text-center">Choose a new password for your account</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">New Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input type={showPw ? 'text' : 'password'} className="input pl-9 pr-10" placeholder="At least 8 characters"
                    value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input type={showPw ? 'text' : 'password'} className="input pl-9" placeholder="Re-enter your new password"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                {loading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : null}
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}