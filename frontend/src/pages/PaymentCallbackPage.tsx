import { CheckCircle } from 'lucide-react';

// Pesapal redirects here (inside the iframe, not a full-page navigation)
// once the customer finishes on their hosted checkout page. This page
// itself does nothing to actually confirm the payment — the POS page's own
// polling (and the IPN webhook, independently) are what determine the real
// outcome. This is just what the customer sees inside that small iframe
// while the cashier's screen catches up a moment later.
export default function PaymentCallbackPage() {
  return (
    <div className="min-h-screen bg-surface-300 flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-sm">
        <CheckCircle size={56} className="text-status-success mx-auto" />
        <h1 className="text-xl font-bold text-text-primary">Payment Received</h1>
        <p className="text-sm text-text-muted">
          You can close this window now — the till will confirm your payment in a moment.
        </p>
      </div>
    </div>
  );
}