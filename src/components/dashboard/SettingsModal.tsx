import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CreditCard, LogOut, Settings, Shield, Sparkles, TriangleAlert, UserRound, X } from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { useAccess } from '../payments/AccessProvider';
import { daysRemaining, expiryBand } from '../../lib/payments/access-presentation';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut?: () => Promise<void>;
}

type Section = 'account' | 'learning' | 'plan' | 'privacy';

const sections = [
  { id: 'account' as const, label: 'Account', icon: UserRound },
  { id: 'learning' as const, label: 'Learning preferences', icon: Sparkles },
  { id: 'plan' as const, label: 'Plan & usage', icon: Check },
  { id: 'privacy' as const, label: 'Data & privacy', icon: Shield },
];

function titleCasePlan(plan: string): string {
  return `${plan.slice(0, 1)}${plan.slice(1).toLowerCase()}`;
}

export function SettingsModal({ isOpen, onClose, onSignOut }: SettingsModalProps) {
  const { user, signOut } = useAuth();
  const access = useAccess();
  const [section, setSection] = useState<Section>('account');
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const initials = user?.fullName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="settings-title" className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-800 bg-[#101621] shadow-2xl shadow-black/70 sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-400"><Settings className="h-4 w-4" /></span><div><h2 id="settings-title" className="text-base font-semibold text-white">Settings</h2><p className="text-xs text-slate-400">Manage your Lumora experience</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close settings" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
        </header>

        <div className="grid min-h-0 flex-1 sm:grid-cols-[220px_1fr]">
          <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto border-b border-slate-800/80 p-3 sm:flex-col sm:border-b-0 sm:border-r sm:p-4">
            {sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setSection(id)} aria-current={section === id ? 'page' : undefined} className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition sm:w-full ${section === id ? 'bg-sky-500/10 text-sky-300' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}><Icon className="h-4 w-4 shrink-0" />{label}</button>)}
          </nav>

          <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
            {section === 'account' && <section aria-labelledby="account-heading" className="space-y-6"><div><h3 id="account-heading" className="text-lg font-semibold text-white">Account</h3><p className="mt-1 text-sm text-slate-400">Your profile and account access.</p></div><div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">{user?.imageUrl ? <img src={user.imageUrl} alt="" className="h-14 w-14 rounded-full border border-slate-700 object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-700 text-lg font-bold text-white">{initials}</span>}<div className="min-w-0"><p className="truncate font-semibold text-white">{user?.fullName || 'Lumora learner'}</p><p className="truncate text-sm text-slate-400">{user?.email || 'No email available'}</p><p className="mt-1 text-[11px] text-slate-500">Profile details are managed through your sign-in account.</p></div></div><button type="button" onClick={() => (onSignOut || signOut)()} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-rose-800 hover:bg-rose-950/30 hover:text-rose-300"><LogOut className="h-4 w-4" />Sign out</button></section>}

            {section === 'learning' && <section aria-labelledby="learning-heading" className="space-y-5"><div><h3 id="learning-heading" className="text-lg font-semibold text-white">Learning preferences</h3><p className="mt-1 text-sm text-slate-400">Personal learning controls will appear here as Lumora supports them.</p></div><div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-6 text-center"><Sparkles className="mx-auto h-5 w-5 text-sky-400" /><p className="mt-3 text-sm font-medium text-slate-200">No preferences to configure yet</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">Your current learning experience works without additional setup.</p></div></section>}

            {section === 'plan' && (() => {
              const plan = access.plan;
              const isPaid = plan === 'CORE' || plan === 'MAX';
              const band = expiryBand(plan ?? null, access.planExpiresAt);
              const remaining = daysRemaining(access.planExpiresAt);
              return (
                <section aria-labelledby="plan-heading" className="space-y-5">
                  <div><h3 id="plan-heading" className="text-lg font-semibold text-white">Plan & usage</h3><p className="mt-1 text-sm text-slate-400">A clear view of your current Lumora access.</p></div>
                  <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-cyan-500/5 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{plan ? titleCasePlan(plan) : 'Loading…'}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {isPaid && access.planExpiresAt
                            ? `Access until ${new Date(access.planExpiresAt).toLocaleDateString()} · ${remaining} day${remaining === 1 ? '' : 's'} left`
                            : 'Free plan, no purchase on record'}
                        </p>
                      </div>
                      {isPaid ? (
                        <span className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${band === 'urgent' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-sky-500/30 bg-sky-500/10 text-sky-300'}`}>
                          {band === 'urgent' ? <TriangleAlert className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                          {band === 'urgent' ? 'Ending soon' : 'Active'}
                        </span>
                      ) : (
                        <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-400">Free</span>
                      )}
                    </div>
                  </div>
                  <Link
                    to="/billing"
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-sky-700/60 hover:bg-sky-950/20 hover:text-sky-200"
                  >
                    <CreditCard className="h-4 w-4" />
                    Manage billing
                  </Link>
                </section>
              );
            })()}

            {section === 'privacy' && <section aria-labelledby="privacy-heading" className="space-y-5"><div><h3 id="privacy-heading" className="text-lg font-semibold text-white">Data & privacy</h3><p className="mt-1 text-sm text-slate-400">Understand how account controls are handled.</p></div><div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"><div className="flex gap-3"><Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><div><p className="text-sm font-medium text-white">Your account data</p><p className="mt-1 text-xs leading-5 text-slate-400">Account deletion and data export are not currently available inside Lumora. Contact the application owner for account data requests.</p></div></div></div></section>}
          </div>
        </div>
      </div>
    </div>
  );
}
