import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sendEmail, passwordResetEmail } from '../services/emailService';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' });
      return;
    }

    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];
    if (user.status === 'inactive') {
      res.status(401).json({ success: false, message: 'Account is inactive' });
      return;
    }
    // Account approval gate — checked separately from the work-schedule
    // `status` above. A self-service signup sits here until an admin acts
    // on it; only 'approved' accounts can actually log in.
    if (user.approval_status === 'pending') {
      res.status(403).json({ success: false, message: 'Your account is awaiting admin approval. You\'ll be able to log in once approved.' });
      return;
    }
    if (user.approval_status === 'rejected') {
      res.status(403).json({ success: false, message: 'Your account request was declined. Contact your administrator for details.' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // This should never happen in a properly configured environment —
      // server.ts validates this at startup. But defensively guard here too.
      res.status(503).json({ success: false, message: 'Server is not properly configured' });
      return;
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    } as jwt.SignOptions);

    const { password_hash, ...userWithoutPassword } = user;
    void password_hash;

    res.json({ success: true, data: { token, user: userWithoutPassword } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Public self-service signup. Always creates the account as
// approval_status='pending' and forces role to the lowest-privilege value
// regardless of what the request body asks for — letting a public form
// grant its own role (e.g. "administrator") would be a straightforward
// privilege-escalation hole. An admin assigns the real role when approving.
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { full_name, email, phone, password } = req.body;

    if (!full_name || !String(full_name).trim()) {
      res.status(400).json({ success: false, message: 'Full name is required' });
      return;
    }
    const trimmedEmail = String(email || '').toLowerCase().trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      res.status(400).json({ success: false, message: 'A valid email address is required' });
      return;
    }
    if (!password || String(password).length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      return;
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [trimmedEmail]);
    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'An account with that email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(`
      INSERT INTO users (full_name, email, phone, password_hash, role, approval_status)
      VALUES ($1,$2,$3,$4,'waiter','pending')
      RETURNING id, full_name, email, approval_status
    `, [String(full_name).trim(), trimmedEmail, phone || null, passwordHash]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Account created. It's awaiting admin approval — you'll be able to log in once approved.",
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Requesting a reset NEVER reveals whether the email exists — the response
// is identical either way. Without this, the endpoint becomes a way to probe
// which email addresses have accounts (a real, common vulnerability class).
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const genericMessage = "If an account exists for that email, we've sent a password reset link.";
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }

    const result = await query('SELECT id, full_name, email, approval_status FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      res.json({ success: true, message: genericMessage });
      return;
    }
    const user = result.rows[0];
    // A pending/rejected account has no password worth resetting yet — still
    // return the generic message so this can't be used to distinguish
    // "no account" from "account exists but isn't approved".
    if (user.approval_status !== 'approved') {
      res.json({ success: true, message: genericMessage });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes

    await query(
      // The explicit ::timestamptz cast matters here: without it, node-postgres
      // serializes a JS Date parameter destined for a naive TIMESTAMP column
      // using raw UTC, ignoring the session's Africa/Nairobi pin entirely
      // (verified directly against Postgres). That silently stored expiry
      // times ~3 hours earlier than intended, making valid reset links
      // appear expired well before they should. The cast forces Postgres to
      // do the timezone conversion itself, consistent with the pinned
      // session, the same way CURRENT_TIMESTAMP already is everywhere else.
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3::timestamptz)',
      [user.id, tokenHash, expiresAt]
    );

    const resetLink = `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/reset-password?token=${rawToken}`;
    const { subject, htmlContent } = passwordResetEmail(resetLink);

    try {
      await sendEmail({ to: user.email, toName: user.full_name, subject, htmlContent });
    } catch (emailErr) {
      // The token now exists whether or not the email actually went out —
      // surfacing the real failure here (rather than the generic message)
      // is deliberate: this is the one case where the caller genuinely needs
      // to know sending failed (e.g. Brevo not configured), since silently
      // saying "email sent" when it wasn't would leave someone stuck with no
      // way to reset their password at all.
      console.error('Failed to send password reset email:', emailErr);
      res.status(503).json({ success: false, message: emailErr instanceof Error ? emailErr.message : 'Failed to send reset email' });
      return;
    }

    res.json({ success: true, message: genericMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ success: false, message: 'token and newPassword are required' });
      return;
    }
    if (String(newPassword).length < 8) {
      res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const result = await query(
      `SELECT * FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );
    if (result.rows.length === 0) {
      res.status(400).json({ success: false, message: 'This reset link is invalid or has expired. Request a new one.' });
      return;
    }
    const reset = result.rows[0];

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [passwordHash, reset.user_id]);
    await query('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [reset.id]);
    // Invalidate any other outstanding reset requests for this user — a
    // second, older emailed link should stop working the moment one of them
    // is actually used.
    await query('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL', [reset.user_id]);

    res.json({ success: true, message: 'Password reset — you can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      'SELECT id, full_name, email, phone, role, status, schedule_type, avatar_url, joined_date, last_login, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'currentPassword and newPassword are required' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
      return;
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ success: false, message: 'New password must be different from current password' });
      return;
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    const user = result.rows[0];

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, req.user!.id]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};