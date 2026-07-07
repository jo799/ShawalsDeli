import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, MailCheck } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      // Backend intentionally returns the same message whether or not the
      // email is registered — never reveal that here either.
      setSent(true);
      void data;
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

  return (
    <div className="min-h-screen bg-surface-300 flex items-center justify-center p-8">
      <div className="w-full max-w-sm bg-surface-card rounded-2xl border border-border p-8">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="Shawal's Deli" className="w-40 max-w-full mx-auto" />
        </div>

        {sent ? (
          <div className="text-center py-4 space-y-3">
            <MailCheck size={48} className="text-status-success mx-auto" />
            <h2 className="text-lg font-bold text-text-primary">Check your email</h2>
            <p className="text-sm text-text-muted">
              If an account exists for <strong className="text-text-primary">{email}</strong>, we've sent a link to reset your password. It expires in 45 minutes.
            </p>
            <Link to="/login" className="btn-secondary w-full py-2.5 inline-flex items-center justify-center gap-1.5 mt-2">
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-text-primary mb-1 text-center">Forgot password?</h2>
            <p className="text-text-muted text-sm mb-6 text-center">Enter your email and we'll send you a reset link</p>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <p className="text-center text-xs text-text-muted mt-6">
              <Link to="/login" className="text-brand hover:text-brand-400 inline-flex items-center gap-1"><ArrowLeft size={12} /> Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}