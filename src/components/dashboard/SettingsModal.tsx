import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  CreditCard,
  Download,
  Globe,
  Loader2,
  LogOut,
  MessageSquare,
  Quote,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { useAccess } from '../payments/AccessProvider';
import { useUsage } from '../usage/UsageProvider';
import { useLearningPreferences } from '../../context/LearningPreferencesContext';
import { daysRemaining, expiryBand } from '../../lib/payments/access-presentation';
import { toTitleCase } from '../../lib/text-format';
import type { MeteredUsageAction } from '../../lib/usage/config';

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

const USAGE_ROWS: ReadonlyArray<{ type: MeteredUsageAction; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { type: 'CHAT', label: 'Chat reservations', icon: MessageSquare },
  { type: 'INGESTION', label: 'Ingestion limit', icon: Upload },
  { type: 'AI_ACTION', label: 'AI Actions limit', icon: Sparkles },
];

function titleCasePlan(plan: string): string {
  return `${plan.slice(0, 1)}${plan.slice(1).toLowerCase()}`;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101621] ${checked ? 'bg-gradient-to-r from-cyan-500 to-blue-600' : 'bg-slate-700'}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-[23px]' : 'translate-x-[3px]'}`}
      />
    </button>
  );
}

function PreferenceRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-300">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

export function SettingsModal({ isOpen, onClose, onSignOut }: SettingsModalProps) {
  const { user, signOut } = useAuth();
  const access = useAccess();
  const { summary: usageSummary } = useUsage();
  const { strictGrounding, inlineCitations, webDiscovery, setStrictGrounding, setInlineCitations, setWebDiscovery } = useLearningPreferences();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('account');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'deleting'>('idle');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setDeleteStep('idle');
      setDeleteError(null);
      setExportError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;
  const initials = user?.fullName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';

  const handleExportData = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const res = await fetch('/api/workspaces/export-data');
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error?.message || 'Failed to export Workspace data');
      }
      const blob = new Blob([JSON.stringify(payload.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lumora-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err.message || 'Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAllData = async () => {
    setDeleteStep('deleting');
    setDeleteError(null);
    try {
      const res = await fetch('/api/workspaces/delete-all-data', { method: 'DELETE' });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error?.message || 'Failed to delete data');
      }
      onClose();
      navigate('/workspaces');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete data. Please try again.');
      setDeleteStep('confirm');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-md sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="settings-title" className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-800 bg-[#101621]/95 shadow-2xl shadow-black/70 backdrop-blur-xl sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-400"><Settings className="h-4 w-4" /></span><div><h2 id="settings-title" className="text-base font-semibold text-white">Settings</h2><p className="text-xs text-slate-400">Manage your Lumora experience</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close settings" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
        </header>

        <div className="grid min-h-0 flex-1 sm:grid-cols-[220px_1fr]">
          <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto border-b border-slate-800/80 p-3 sm:flex-col sm:border-b-0 sm:border-r sm:p-4">
            {sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setSection(id)} aria-current={section === id ? 'page' : undefined} className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition sm:w-full ${section === id ? 'bg-sky-500/10 text-sky-300' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}><Icon className="h-4 w-4 shrink-0" />{label}</button>)}
          </nav>

          <div className="min-h-0 overflow-y-auto scroll-smooth p-5 sm:p-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={section}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {section === 'account' && (
                  <section aria-labelledby="account-heading" className="space-y-6">
                    <div><h3 id="account-heading" className="text-lg font-semibold text-white">Account</h3><p className="mt-1 text-sm text-slate-400">Your profile and account access.</p></div>
                    <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-5">
                      {user?.imageUrl ? <img src={user.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-full border border-slate-700 object-cover" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-700 text-lg font-bold text-white">{initials}</span>}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{toTitleCase(user?.fullName || 'Lumora learner')}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm text-slate-400">{user?.email || 'No email available'}</p>
                          {user?.email && (
                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${user.authProvider === 'google' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'}`}>
                              <BadgeCheck className="h-3 w-3" />
                              {user.authProvider === 'google' ? 'Verified Google Account' : 'Verified Account'}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-500">Profile details are managed through your sign-in account.</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => (onSignOut || signOut)()} className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-all hover:border-red-500/60 hover:bg-red-500/10"><LogOut className="h-4 w-4" />Sign out</button>
                  </section>
                )}

                {section === 'learning' && (
                  <section aria-labelledby="learning-heading" className="space-y-5">
                    <div><h3 id="learning-heading" className="text-lg font-semibold text-white">Learning preferences</h3><p className="mt-1 text-sm text-slate-400">Control how Lumora answers and what it shows in chat.</p></div>
                    <div className="space-y-3">
                      <PreferenceRow
                        icon={ShieldCheck}
                        title="Strict Evidence Grounding"
                        description="Restrict AI answers strictly to active uploaded sources."
                        checked={strictGrounding}
                        onChange={setStrictGrounding}
                      />
                      <PreferenceRow
                        icon={Quote}
                        title="Inline Citations"
                        description="Show page numbers, timestamps, and source pills in chat messages."
                        checked={inlineCitations}
                        onChange={setInlineCitations}
                      />
                      <PreferenceRow
                        icon={Globe}
                        title="Tavily Web Discovery"
                        description="Allow extended web resource discovery when local sources lack coverage."
                        checked={webDiscovery}
                        onChange={setWebDiscovery}
                      />
                    </div>
                  </section>
                )}

                {section === 'plan' && (() => {
                  const plan = access.plan;
                  const isPaid = plan === 'CORE' || plan === 'MAX';
                  const band = expiryBand(plan ?? null, access.planExpiresAt);
                  const remaining = daysRemaining(access.planExpiresAt);
                  return (
                    <section aria-labelledby="plan-heading" className="space-y-5">
                      <div><h3 id="plan-heading" className="text-lg font-semibold text-white">Plan & usage</h3><p className="mt-1 text-sm text-slate-400">A clear view of your current Lumora access.</p></div>
                      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 p-5">
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
                            <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${band === 'urgent' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'}`}>
                              {band === 'urgent' ? <TriangleAlert className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                              {plan ? titleCasePlan(plan) : ''} · {band === 'urgent' ? 'Ending soon' : 'Active'}
                            </span>
                          ) : (
                            <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-400">Free</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {USAGE_ROWS.map(({ type, label, icon: Icon }) => {
                          const action = usageSummary?.perAction[type];
                          const percent = action ? Math.min(100, (action.used / action.limit) * 100) : 0;
                          return (
                            <div key={type} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-300"><Icon className="h-4 w-4" /></span>
                                  <p className="text-sm font-medium text-white">{label}</p>
                                </div>
                                <span className="shrink-0 font-mono text-sm font-semibold text-cyan-100">{action ? `${action.used} / ${action.limit}` : '—'}</span>
                              </div>
                              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800/90 shadow-inner">
                                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 transition-[width] duration-300" style={{ width: `${percent}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-slate-500">Usage reservations automatically reset on a rolling 12-hour window.</p>

                      <Link
                        to="/billing"
                        onClick={onClose}
                        className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                      >
                        <CreditCard className="h-4 w-4" />
                        Manage billing
                      </Link>
                    </section>
                  );
                })()}

                {section === 'privacy' && (
                  <section aria-labelledby="privacy-heading" className="space-y-5">
                    <div><h3 id="privacy-heading" className="text-lg font-semibold text-white">Data & privacy</h3><p className="mt-1 text-sm text-slate-400">Export or remove the data Lumora stores for your account.</p></div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <Download className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                          <div>
                            <p className="text-sm font-medium text-white">Export Workspace Data</p>
                            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">Download your ingested source index and chat history as JSON.</p>
                            {exportError && <p role="alert" className="mt-2 text-xs text-rose-400">{exportError}</p>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleExportData}
                          disabled={isExporting}
                          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-700/60 hover:bg-cyan-950/20 hover:text-cyan-200 disabled:opacity-60"
                        >
                          {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          {isExporting ? 'Exporting…' : 'Export JSON'}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-rose-900/40 bg-rose-950/10 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                          <div>
                            <p className="text-sm font-medium text-white">Account & Workspace Cleanup</p>
                            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">Permanently remove your workspace indexes and personal data.</p>
                            {deleteError && <p role="alert" className="mt-2 text-xs text-rose-400">{deleteError}</p>}
                          </div>
                        </div>
                        {deleteStep === 'idle' && (
                          <button
                            type="button"
                            onClick={() => setDeleteStep('confirm')}
                            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-red-500/30 px-3.5 py-2 text-xs font-semibold text-red-400 transition-all hover:border-red-500/60 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Data
                          </button>
                        )}
                      </div>
                      {deleteStep !== 'idle' && (
                        <div className="mt-4 space-y-3 rounded-xl border border-rose-800/60 bg-rose-950/30 p-3.5">
                          <p className="text-xs leading-5 text-rose-200">This permanently deletes every Workspace, source, and chat history on your account. This cannot be undone.</p>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setDeleteStep('idle')} disabled={deleteStep === 'deleting'} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50">Cancel</button>
                            <button
                              type="button"
                              onClick={handleDeleteAllData}
                              disabled={deleteStep === 'deleting'}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-rose-600/30 transition hover:bg-rose-500 disabled:bg-rose-950 disabled:text-rose-400"
                            >
                              {deleteStep === 'deleting' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              {deleteStep === 'deleting' ? 'Deleting…' : 'Yes, permanently delete everything'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
