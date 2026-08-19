import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../AuthProvider';
import { API_PATHS } from '../../lib/api-paths';
import type { PlanName } from '../../lib/usage/config';

interface AccessContextValue {
  plan: PlanName | null;
  planExpiresAt: string | null;
  isFaculty: boolean;
  hasSeenFacultyWelcome: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const AccessContext = createContext<AccessContextValue | null>(null);

// GET /api/payments/access runs syncUserEntitlement server-side — an
// advisory-lock transaction that re-derives User.plan from every CAPTURED
// Payment row. It is correct but not free, and it must never be polled.
// This provider fetches it exactly once per authenticated session (mount)
// and otherwise only on an explicit refresh() call, mirroring
// UsageProvider's fetch-on-demand shape (including its
// USAGE_CHANGED_EVENT-style external refresh point — payment code calls
// refresh() directly after a verified purchase instead of a global event,
// since access changes originate from a single checkout flow, not many
// independent mutation sites like usage does).
export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, authenticatedUserId } = useAuth();
  const [plan, setPlan] = useState<PlanName | null>(null);
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);
  const [isFaculty, setIsFaculty] = useState(false);
  const [hasSeenFacultyWelcome, setHasSeenFacultyWelcome] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_PATHS.payments}/access`, {
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error?.message || 'Unable to load access.');
      }
      setPlan(payload.data.plan as PlanName);
      setPlanExpiresAt(payload.data.planExpiresAt ?? null);
      setIsFaculty(Boolean(payload.data.isFaculty));
      setHasSeenFacultyWelcome(Boolean(payload.data.hasSeenFacultyWelcome));
      setError(null);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load access.');
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      setPlan(null);
      setPlanExpiresAt(null);
      setIsFaculty(false);
      setHasSeenFacultyWelcome(false);
      setError(null);
      return;
    }
    // Fetch once per authenticated session — never polled.
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticatedUserId, isSignedIn]);

  const value = useMemo(
    () => ({ plan, planExpiresAt, isFaculty, hasSeenFacultyWelcome, loading, error, refresh }),
    [plan, planExpiresAt, isFaculty, hasSeenFacultyWelcome, loading, error, refresh],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessContextValue {
  const context = useContext(AccessContext);
  if (!context) throw new Error('useAccess must be used within AccessProvider');
  return context;
}
