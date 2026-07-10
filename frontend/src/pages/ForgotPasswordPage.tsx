import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound, Lock, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// One self-contained flow, three steps in the same card — email, then the
// code that arrives by email, then a new password — rather than the old
// design where the code arrived in an email as a clickable LINK that
// dropped you on a separate /reset-password page. Nothing outside this
// page needs to know about tokens or steps; it all happens right here.
type Step = 'email' | 'code' | 'newPassword' | 'done';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      // Backend intentionally returns the same message whether or not the
      // email is registered — the UI can't and shouldn't reveal that
      // either, so this always advances to the code step regardless.
      setStep('code');
      toast.success('If that email has an account, a code is on its way.');
    } catch (err: unknown) {
      // A real failure here (as opposed to "no such account", which the
      // backend hides) means the email service itself is down/misconfigured
      // — that's worth surfacing honestly rather than pretending it worked.
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Something went wrong. Try again shortly.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-reset-otp', { email, otp: code });
      setResetToken(data.reset_token);
      setStep('newPassword');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Incorrect code. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token: resetToken, newPassword });
      setStep('done');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to reset password. Please start over.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setCode('');
      toast.success('New code sent.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not resend the code right now.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-300 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-sm bg-surface-card rounded-2xl border border-border p-5 sm:p-8">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="Shawal's Deli" className="w-40 max-w-full mx-auto" />
        </div>

        {step === 'email' && (
          <>
            <h2 className="text-xl font-bold text-text-primary mb-1 text-center">Forgot password?</h2>
            <p className="text-text-muted text-sm mb-6 text-center">Enter your email and we'll send you a code</p>

            <form onSubmit={requestCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input type="email" className="input pl-9" placeholder="Enter your email" value={email}
                    onChange={e => setEmail(e.target.value)} autoComplete="username" required />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                {loading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : null}
                {loading ? 'Sending...' : 'Send Code'}
              </button>
            </form>

            <p className="text-center text-xs text-text-muted mt-6">
              <Link to="/login" className="text-brand hover:text-brand-400 inline-flex items-center gap-1"><ArrowLeft size={12} /> Back to Login</Link>
            </p>
          </>
        )}

        {step === 'code' && (
          <>
            <KeyRound size={40} className="text-brand mx-auto mb-3" />
            <h2 className="text-xl font-bold text-text-primary mb-1 text-center">Enter the code</h2>
            <p className="text-text-muted text-sm mb-6 text-center">
              We sent a 6-digit code to <strong className="text-text-primary">{email}</strong>. It expires in 10 minutes.
            </p>

            <form onSubmit={verifyCode} className="space-y-4">
              <input
                autoFocus
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                className="input text-center text-2xl font-bold tracking-[0.4em]"
                placeholder="······"
              />
              <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : null}
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>

            <div className="flex items-center justify-between mt-4 text-xs">
              <button onClick={() => setStep('email')} className="text-text-muted hover:text-text-primary inline-flex items-center gap-1">
                <ArrowLeft size={12} /> Use a different email
              </button>
              <button onClick={resendCode} disabled={loading} className="text-brand hover:text-brand-400 disabled:opacity-50">Resend code</button>
            </div>
          </>
        )}

        {step === 'newPassword' && (
          <>
            <Lock size={40} className="text-brand mx-auto mb-3" />
            <h2 className="text-xl font-bold text-text-primary mb-1 text-center">Set a new password</h2>
            <p className="text-text-muted text-sm mb-6 text-center">Code verified — choose a new password for your account.</p>

            <form onSubmit={submitNewPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">New Password</label>
                <input type="password" className="input" placeholder="At least 8 characters" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Confirm Password</label>
                <input type="password" className="input" placeholder="Type it again" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                {loading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : null}
                {loading ? 'Saving...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <div className="text-center py-4 space-y-3">
            <CheckCircle size={48} className="text-status-success mx-auto" />
            <h2 className="text-lg font-bold text-text-primary">Password reset</h2>
            <p className="text-sm text-text-muted">You can now log in with your new password.</p>
            <button onClick={() => navigate('/login')} className="btn-primary w-full py-2.5 mt-2">
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}