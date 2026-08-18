import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, X } from 'lucide-react';
import { useAccess } from './AccessProvider';
import { daysRemaining, expiryBand } from '../../lib/payments/access-presentation';

// Mounted exactly once, in DashboardLayout — never per-page. Renders
// nothing for band 'none' (the common case: FREE, or a paid plan with
// plenty of time left). 'expired' is intentionally never dismissible:
// it's telling the user their actual current limits changed, not nagging
// them to upgrade.
export function ExpiryBanner() {
  const access = useAccess();
  const band = expiryBand(access.plan, access.planExpiresAt);
  const remaining = daysRemaining(access.planExpiresAt);

  // Dismissal is scoped to the specific expiry timestamp: renewing (which
  // changes planExpiresAt) naturally un-dismisses the banner for the new
  // cycle instead of hiding it forever.
  const dismissKey = access.planExpiresAt ? `lumora-expiry-dismissed-${access.planExpiresAt}` : null;
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(dismissKey ? sessionStorage.getItem(dismissKey) === '1' : false);
  }, [dismissKey]);

  if (band === 'none') return null;
  // 'expired' is never dismissible — every other band can be hidden for
  // this session.
  if (band !== 'expired' && dismissed) return null;

  const isExpired = band === 'expired';
  const isUrgent = band === 'urgent';
  const plan = access.plan;

  const tone = isExpired
    ? 'border-rose-800/50 bg-rose-950/30 text-rose-100'
    : isUrgent
      ? 'border-amber-500/40 bg-amber-500/[0.08] text-amber-100'
      : 'border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-100';

  const message = isExpired
    ? `Your ${plan === 'FREE' ? 'paid' : plan} access ended — you're now on FREE limits.`
    : isUrgent
      ? `Your ${plan} access ends in ${remaining} day${remaining === 1 ? '' : 's'}.`
      : `Your ${plan} access ends in ${remaining} days.`;

  const handleDismiss = () => {
    if (dismissKey) sessionStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-fade-in flex items-center gap-3 border-b px-4 py-2.5 text-xs sm:px-6 lg:px-8 ${tone}`}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <p className="min-w-0 flex-1 truncate">{message}</p>
      <Link
        to="/billing"
        className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
          isUrgent || isExpired
            ? 'bg-white/10 hover:bg-white/15'
            : 'text-cyan-200 underline decoration-cyan-400/40 underline-offset-2 hover:text-cyan-100'
        }`}
      >
        {isExpired ? 'Renew now' : 'Renew'}
      </Link>
      {!isExpired && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss expiry notice"
          className="shrink-0 rounded-lg p-1 opacity-60 transition hover:bg-white/10 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
