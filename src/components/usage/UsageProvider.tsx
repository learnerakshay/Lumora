import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../AuthProvider';
import type { UsageSummary } from '../../lib/usage/types';
import { API_PATHS } from '../../lib/api-paths';

interface UsageContextValue {
  summary: UsageSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const UsageContext = createContext<UsageContextValue | null>(null);
export const USAGE_CHANGED_EVENT = 'lumora:usage-changed';

export function notifyUsageChanged(): void {
  window.dispatchEvent(new Event(USAGE_CHANGED_EVENT));
}

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, authenticatedUserId } = useAuth();
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    setLoading(true);
    try {
      const response = await fetch(API_PATHS.usage, {
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error?.message || 'Unable to load usage.');
      }
      setSummary(payload.data as UsageSummary);
      setError(null);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Unable to load usage.',
      );
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      setSummary(null);
      setError(null);
      return;
    }
    void refresh();
  }, [authenticatedUserId, isSignedIn, refresh]);

  useEffect(() => {
    const handleUsageChanged = () => void refresh();
    window.addEventListener(USAGE_CHANGED_EVENT, handleUsageChanged);
    return () => window.removeEventListener(USAGE_CHANGED_EVENT, handleUsageChanged);
  }, [refresh]);

  const value = useMemo(
    () => ({ summary, loading, error, refresh }),
    [summary, loading, error, refresh],
  );

  return <UsageContext.Provider value={value}>{children}</UsageContext.Provider>;
}

export function useUsage(): UsageContextValue {
  const context = useContext(UsageContext);
  if (!context) throw new Error('useUsage must be used within UsageProvider');
  return context;
}
