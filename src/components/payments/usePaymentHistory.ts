import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { API_PATHS } from '../../lib/api-paths';

// Mirrors the server's PaymentRecord shape (src/lib/payments/payment-store.ts)
// exactly — this hook does not reshape or rename fields, so a Billing UI can
// render straight off the API response.
export interface PaymentHistoryRecord {
  id: string;
  userId: string;
  plan: 'CORE' | 'MAX';
  providerOrderId: string;
  providerPaymentId: string | null;
  amount: number;
  discountAmount: number;
  currency: string;
  status: 'CREATED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
  method: string | null;
  failureCode: string | null;
  failureReason: string | null;
  accessFrom: string | null;
  accessUntil: string | null;
  couponId: string | null;
  signatureVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UsePaymentHistoryResult {
  history: PaymentHistoryRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// GET /api/payments — read-only history for the authenticated caller. Not
// used to build /billing yet (Phase 3C); Phase 3A only establishes the
// fetch/loading/error contract so later stages can consume it directly.
export function usePaymentHistory(): UsePaymentHistoryResult {
  const { isLoaded, isSignedIn } = useAuth();
  const [history, setHistory] = useState<PaymentHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    setLoading(true);
    try {
      // The payments router itself defines this endpoint at "/payments"
      // (see src/routes/payments.ts), so the full path is
      // /api/payments/payments — distinct from /api/payments/access.
      const response = await fetch(`${API_PATHS.payments}/payments`, { headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error?.message || 'Unable to load payment history.');
      }
      setHistory((payload.data.payments as PaymentHistoryRecord[]) ?? []);
      setError(null);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load payment history.');
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      setHistory([]);
      setError(null);
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  return { history, loading, error, refresh };
}
