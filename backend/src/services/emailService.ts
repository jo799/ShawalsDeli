// Thin wrapper around Brevo's (formerly Sendinblue) transactional email
// REST API. Only password reset uses this today, but any future
// transactional email (approval notifications, receipts by email, etc.)
// should go through this same function rather than each caller reimplementing
// the HTTP call.
//
// Fails the same way mpesaController's Daraja calls do: check configuration
// at CALL time (not at server startup) and throw a clear, specific error
// naming exactly which env vars are missing, so a misconfigured deployment
// gets a readable 503 instead of a mysterious 500 or a silent no-op.

interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
}

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export const sendEmail = async ({ to, toName, subject, htmlContent }: SendEmailParams): Promise<void> => {
  const apiKey = process.env.BREVO_API_KEY || '';
  const senderEmail = process.env.BREVO_SENDER_EMAIL || '';
  const senderName = process.env.BREVO_SENDER_NAME || "Shawal's Deli";

  const missing: string[] = [];
  if (!apiKey) missing.push('BREVO_API_KEY');
  if (!senderEmail) missing.push('BREVO_SENDER_EMAIL');
  if (missing.length > 0) {
    throw new Error(`Email sending is not configured. Missing: ${missing.join(', ')}`);
  }

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('Brevo send failed:', res.status, body);
    throw new Error('Failed to send email — the email provider rejected the request');
  }
};

// Password reset email content lives here (not inline in the controller) so
// the actual copy/branding can be edited in one obvious place.
export const passwordResetEmail = (resetLink: string): { subject: string; htmlContent: string } => ({
  subject: "Reset your Shawal's Deli password",
  htmlContent: `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <h2 style="color: #F5A300;">Shawal's Deli</h2>
      <p>We received a request to reset your password.</p>
      <p>
        <a href="${resetLink}" style="display: inline-block; background: #F5A300; color: #111; font-weight: bold; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 12px 0;">
          Reset Password
        </a>
      </p>
      <p style="color: #555; font-size: 13px;">This link expires in 45 minutes. If you didn't request this, you can safely ignore this email — your password won't change.</p>
      <p style="color: #999; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser:<br>${resetLink}</p>
    </div>
  `,
});