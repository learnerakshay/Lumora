import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Brain,
  FolderSearch,
  ListChecks,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  Upload,
} from 'lucide-react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { UsageLimitNotice } from '../components/usage/UsageLimitNotice';
import { notifyUsageChanged, useUsage } from '../components/usage/UsageProvider';
import { usageLimitFromPayload } from '../lib/usage/client';
import type { UsageLimitDetails } from '../lib/usage/types';
import { API_PATHS } from '../lib/api-paths';
import { ResumeUploadPanel } from '../components/skills/ResumeUploadPanel';
import { SkillGapReport, SkillProfileSummary } from '../components/skills/SkillGapReport';
import {
  applyFileSelected,
  applyTextChanged,
  blankUploadAttempt,
  buildStartOverState,
  type UploadAttemptState,
} from '../components/skills/skill-intelligence-interactions';
import { tryBeginSubmission, releaseSubmission, type SubmissionGate } from '../components/workspace/workspace-interactions';
import type { SkillProfileRecord, RoleAnalysisRecord } from '../lib/skills/skill-profile-store';

interface ProfileState {
  profile: SkillProfileRecord;
  analysis: RoleAnalysisRecord | null;
}

type ViewState = 'loading' | 'empty' | 'ready' | 'error';

const HOW_IT_WORKS = [
  { label: 'Upload a resume', icon: Upload },
  { label: 'Match target roles', icon: Target },
  { label: 'See explainable gaps', icon: ListChecks },
] as const;

async function parseJsonResponse(response: Response): Promise<any> {
  return response.json().catch(() => null);
}

export function SkillIntelligencePage() {
  const [view, setView] = useState<ViewState>('loading');
  const [profileState, setProfileState] = useState<ProfileState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [upload, setUpload] = useState<UploadAttemptState>(blankUploadAttempt());
  const [submitting, setSubmitting] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);
  const [startingOver, setStartingOver] = useState(false);
  const submissionGate = useRef<SubmissionGate>({ current: false });

  const { summary: usageSummary } = useUsage();
  const skillIntelUsage = usageSummary?.perAction.SKILL_INTELLIGENCE;

  const loadProfile = useCallback(async () => {
    setView('loading');
    setLoadError(null);
    try {
      const response = await fetch(`${API_PATHS.skills}/profile`, { headers: { Accept: 'application/json' } });
      const payload = await parseJsonResponse(response);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || 'Unable to load your Skill Profile.');
      }
      if (payload.data?.profile?.status === 'READY' && payload.data.analysis) {
        setProfileState(payload.data);
        setView('ready');
      } else {
        setProfileState(null);
        setView('empty');
      }
    } catch (error: any) {
      setLoadError(error.message || 'Unable to load your Skill Profile.');
      setView('error');
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleFileSelect = (file: File | null) => setUpload((current) => applyFileSelected(current, file));
  const handleTextChange = (value: string) => setUpload((current) => applyTextChanged(current, value));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tryBeginSubmission(submissionGate.current)) return;
    if (!upload.selectedFile && !upload.resumeText.trim()) {
      setUpload((current) => ({ ...current, submitError: 'Upload a resume PDF or image, or paste your resume text.' }));
      releaseSubmission(submissionGate.current);
      return;
    }
    setSubmitting(true);
    setUpload((current) => ({ ...current, submitError: null, usageLimit: null }));
    try {
      const formData = new FormData();
      if (upload.selectedFile) {
        formData.set('file', upload.selectedFile);
      } else {
        formData.set('resumeText', upload.resumeText.trim());
      }
      const response = await fetch(`${API_PATHS.skills}/profile`, { method: 'POST', body: formData });
      const payload = await parseJsonResponse(response);
      if (!response.ok || !payload?.success) {
        const limitError = usageLimitFromPayload(payload);
        if (limitError) {
          setUpload((current) => ({ ...current, usageLimit: limitError.details }));
          return;
        }
        throw new Error(payload?.error?.message || 'Resume analysis failed.');
      }
      notifyUsageChanged();
      setProfileState(payload.data);
      setView('ready');
      setUpload(blankUploadAttempt());
    } catch (error: any) {
      setUpload((current) => ({ ...current, submitError: error.message || 'Resume analysis failed.' }));
    } finally {
      releaseSubmission(submissionGate.current);
      setSubmitting(false);
    }
  };

  // Re-run analysis only recomputes deterministic role-matching + gap
  // analysis from the already-stored extraction (see POST /analysis on the
  // backend) — it must never touch the upload attempt or leave the results
  // view, and any failure surfaces its own inline error, separate from the
  // full-page load-error state.
  const handleReanalyze = async () => {
    if (reanalyzing) return;
    setReanalyzing(true);
    setReanalyzeError(null);
    try {
      const response = await fetch(`${API_PATHS.skills}/analysis`, { method: 'POST' });
      const payload = await parseJsonResponse(response);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || 'Could not re-run the analysis.');
      }
      setProfileState(payload.data);
    } catch (error: any) {
      setReanalyzeError(error.message || 'Could not re-run the analysis.');
    } finally {
      setReanalyzing(false);
    }
  };

  // Start over deletes the stored profile (no usage charge — see DELETE
  // /profile) and then unconditionally resets every piece of local state:
  // the report, both error channels, and the entire upload attempt, so the
  // fresh screen never shows a stale file, a stale error, or old results.
  const handleStartOver = async () => {
    if (startingOver) return;
    setStartingOver(true);
    try {
      await fetch(`${API_PATHS.skills}/profile`, { method: 'DELETE' });
    } catch {
      // Best-effort: the local reset below still gives the user a fresh
      // attempt even if the delete request itself failed to reach the server.
    } finally {
      const reset = buildStartOverState();
      setView(reset.view);
      setProfileState(reset.profileState);
      setLoadError(reset.loadError);
      setReanalyzeError(reset.reanalyzeError);
      setUpload(reset.upload);
      setStartingOver(false);
    }
  };

  const skillCount = profileState?.profile.normalizedSkills?.length ?? 0;
  const shippedCount = profileState?.profile.normalizedSkills?.filter((skill) => skill.evidenceLevel === 'SHIPPED').length ?? 0;
  const strongestSkill = profileState?.profile.normalizedSkills
    ?.filter((skill) => skill.evidenceLevel === 'SHIPPED')
    .sort((a, b) => b.evidenceRefs.length - a.evidenceRefs.length)[0]?.label;

  const usageCaption = skillIntelUsage
    ? `${skillIntelUsage.remaining} of ${skillIntelUsage.limit} analyses left this window`
    : null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="border-b border-slate-800/70 pb-6">
          <div className="mb-2 flex items-center gap-2 text-cyan-300">
            <span className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] p-1.5"><Brain className="h-3.5 w-3.5" /></span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Skill Intelligence</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Role gap analysis</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Upload a resume and Lumora identifies your skills and evidence, matches you against target roles, and explains exactly what is missing for each one.
          </p>

          {view !== 'ready' && (
            <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
              {HOW_IT_WORKS.map((step, index) => (
                <React.Fragment key={step.label}>
                  <div className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/40 py-1 pl-1.5 pr-3">
                    <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300"><step.icon className="h-2.5 w-2.5" /></span>
                    <span className="text-[11px] font-medium text-slate-400">{step.label}</span>
                  </div>
                  {index < HOW_IT_WORKS.length - 1 && <span className="h-px w-4 bg-slate-800" aria-hidden="true" />}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <AnimatePresence>
          {upload.usageLimit && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-2xl border border-amber-400/20"
            >
              <UsageLimitNotice details={upload.usageLimit} onDismiss={() => setUpload((current) => ({ ...current, usageLimit: null }))} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {view === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-[#101722] text-sm text-slate-400"
            >
              <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
              Loading your Skill Profile…
            </motion.div>
          )}

          {view === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="rounded-2xl border border-rose-800/60 bg-rose-950/30 p-5 text-sm text-rose-200"
            >
              <p className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" /> {loadError}</p>
              <button type="button" onClick={() => void loadProfile()} className="mt-3 rounded-lg border border-rose-700 px-3 py-1.5 text-xs font-semibold transition hover:bg-rose-900/40">Try again</button>
            </motion.div>
          )}

          {view === 'empty' && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ResumeUploadPanel
                selectedFile={upload.selectedFile}
                resumeText={upload.resumeText}
                onFileSelect={handleFileSelect}
                onTextChange={handleTextChange}
                onSubmit={handleSubmit}
                submitting={submitting}
                submitError={upload.submitError}
                usageCaption={usageCaption}
              />
            </motion.div>
          )}

          {view === 'ready' && profileState && (
            <motion.div key="ready" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-5">
              <SkillProfileSummary
                skillCount={skillCount}
                shippedCount={shippedCount}
                strengthLabel={strongestSkill || 'Not established yet'}
              />

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleReanalyze} disabled={reanalyzing || startingOver} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 text-xs font-medium text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60">
                  {reanalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {reanalyzing ? 'Re-running…' : 'Re-run analysis'}
                </button>
                <button type="button" onClick={handleStartOver} disabled={startingOver || reanalyzing} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 text-xs font-medium text-slate-400 transition hover:border-rose-500/30 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-60">
                  {startingOver ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} {startingOver ? 'Starting over…' : 'Start over'}
                </button>
              </div>

              <AnimatePresence>
                {reanalyzeError && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    role="alert"
                    className="flex items-center gap-1.5 overflow-hidden rounded-lg border border-rose-800/50 bg-rose-950/25 px-3 py-2 text-xs text-rose-200"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {reanalyzeError}
                  </motion.p>
                )}
              </AnimatePresence>

              {profileState.analysis ? (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    <h2 className="text-sm font-semibold text-white">Target roles &amp; gaps</h2>
                  </div>
                  <SkillGapReport roles={profileState.analysis.selectedRoles} report={profileState.analysis.gaps} />
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-[#101722] p-5 text-sm text-slate-400">
                  <FolderSearch className="h-4 w-4 text-amber-300" /> Your Skill Profile is ready, but no analysis has been generated yet.
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
