import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Clock3,
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
import { blankGapSelection, toggleGapSelection, type GapSelectionState } from '../components/skills/gap-selection';
import {
  blankBuildPlanAttempt,
  failBuildingPlan,
  startBuildingPlan,
  type BuildPlanAttemptState,
} from '../components/learning/learning-plan-interactions';
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

// A bare `fetch()` has no default timeout — if the server or an
// intermediate proxy ever hangs a connection open without closing it, the
// awaited promise never settles, so a surrounding try/finally never runs and
// a loading button (e.g. "Re-running…") is stuck forever. Every fetch on
// this page goes through this so a hang always resolves into a real,
// user-facing error instead of an indefinite spinner.
async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

// Re-run and start-over are documented as fast, local/deterministic
// operations (no AI or extraction provider call) — a generous but tight
// ceiling catches a genuine hang quickly. The initial analyze call can
// involve real PDF parsing and AI extraction, so it gets a much longer
// ceiling — comfortably past the 30s point where the "Deep Analysis in
// Progress" banner already reassures the user a slow-but-real analysis is
// still running.
const ANALYZE_TIMEOUT_MS = 120_000;
const REANALYZE_TIMEOUT_MS = 20_000;
const START_OVER_TIMEOUT_MS = 20_000;

export function SkillIntelligencePage() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>('loading');
  const [profileState, setProfileState] = useState<ProfileState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [upload, setUpload] = useState<UploadAttemptState>(blankUploadAttempt());
  const [submitting, setSubmitting] = useState(false);
  const [showDeepAnalysisBanner, setShowDeepAnalysisBanner] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);
  const [startingOver, setStartingOver] = useState(false);
  const submissionGate = useRef<SubmissionGate>({ current: false });
  const buildPlanGate = useRef<SubmissionGate>({ current: false });
  const deepAnalysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (deepAnalysisTimerRef.current) clearTimeout(deepAnalysisTimerRef.current);
  }, []);

  const [gapSelection, setGapSelection] = useState<GapSelectionState>(blankGapSelection());
  const [buildPlanAttempt, setBuildPlanAttempt] = useState<BuildPlanAttemptState>(blankBuildPlanAttempt());

  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((kind: 'success' | 'error', text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ kind, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

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
    setShowDeepAnalysisBanner(false);
    deepAnalysisTimerRef.current = setTimeout(() => setShowDeepAnalysisBanner(true), 30_000);
    setUpload((current) => ({ ...current, submitError: null, usageLimit: null }));
    try {
      const formData = new FormData();
      if (upload.selectedFile) {
        formData.set('file', upload.selectedFile);
      } else {
        formData.set('resumeText', upload.resumeText.trim());
      }
      const response = await fetchWithTimeout(`${API_PATHS.skills}/profile`, { method: 'POST', body: formData }, ANALYZE_TIMEOUT_MS);
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
      const message = isTimeoutError(error)
        ? 'This is taking longer than expected. Please try again.'
        : error.message || 'Resume analysis failed.';
      setUpload((current) => ({ ...current, submitError: message }));
    } finally {
      if (deepAnalysisTimerRef.current) {
        clearTimeout(deepAnalysisTimerRef.current);
        deepAnalysisTimerRef.current = null;
      }
      setShowDeepAnalysisBanner(false);
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
      const response = await fetchWithTimeout(`${API_PATHS.skills}/analysis`, { method: 'POST' }, REANALYZE_TIMEOUT_MS);
      const payload = await parseJsonResponse(response);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || 'Could not re-run the analysis.');
      }
      setProfileState(payload.data);
      showToast('success', 'Skill re-run analysis completed successfully.');
    } catch (error: any) {
      const message = isTimeoutError(error)
        ? 'The request took too long. Please try again.'
        : error.message || 'Could not re-run the analysis.';
      setReanalyzeError(message);
      showToast('error', 'Failed to re-run analysis. Please try again.');
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
      await fetchWithTimeout(`${API_PATHS.skills}/profile`, { method: 'DELETE' }, START_OVER_TIMEOUT_MS);
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
      setGapSelection(blankGapSelection());
      setBuildPlanAttempt(blankBuildPlanAttempt());
      setStartingOver(false);
    }
  };

  const handleBuildPlan = async (roleId: string) => {
    if (!tryBeginSubmission(buildPlanGate.current)) return;
    setBuildPlanAttempt(startBuildingPlan(roleId));
    try {
      const response = await fetch(`${API_PATHS.learning}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId, gapIds: gapSelection.selectedGapIds }),
      });
      const payload = await parseJsonResponse(response);
      if (!response.ok || !payload?.success) {
        const limitError = usageLimitFromPayload(payload);
        throw new Error(limitError?.message || payload?.error?.message || 'Could not build a learning plan for this role.');
      }
      notifyUsageChanged();
      setBuildPlanAttempt(blankBuildPlanAttempt());
      navigate(`/learning/${payload.data.plan.id}`);
    } catch (error: any) {
      setBuildPlanAttempt(failBuildingPlan(error.message || 'Could not build a learning plan for this role.'));
    } finally {
      releaseSubmission(buildPlanGate.current);
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
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            role="status"
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border p-4 text-xs shadow-2xl ${
              toast.kind === 'success'
                ? 'border-emerald-800 bg-emerald-950 text-emerald-200'
                : 'border-rose-800 bg-rose-950 text-rose-200'
            }`}
          >
            {toast.kind === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span className="font-medium">{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 mx-auto max-w-5xl space-y-6 px-6 py-10">
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
              {HOW_IT_WORKS.map((step, index) => {
                const isActive = index === 0;
                return (
                  <React.Fragment key={step.label}>
                    <div className={`flex items-center gap-2 rounded-xl border px-4 py-2 shadow-md backdrop-blur-md transition-colors ${isActive ? 'border-cyan-500/40 bg-cyan-400/[0.08] text-cyan-200' : 'border-slate-800 bg-slate-900/80 text-slate-400'}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full ${isActive ? 'bg-cyan-400/20 text-cyan-300' : 'bg-slate-800 text-slate-500'}`}><step.icon className="h-3 w-3" /></span>
                      <span className="text-[11px] font-medium">{step.label}</span>
                    </div>
                    {index < HOW_IT_WORKS.length - 1 && (
                      <span className="pipeline-beam w-8" aria-hidden="true"><span className="pipeline-beam-fill" /></span>
                    )}
                  </React.Fragment>
                );
              })}
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
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <AnimatePresence>
                {showDeepAnalysisBanner && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    role="status"
                    className="overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/80 p-4 shadow-[0_0_15px_rgba(6,182,212,0.1)] backdrop-blur-md"
                  >
                    <p className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
                      <Clock3 className="h-4 w-4 shrink-0" /> Deep Analysis in Progress...
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                      Lumora is cross-referencing your experience against target role benchmarks and generating explainable gap insights. Thanks for your patience!
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

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

                  <AnimatePresence>
                    {buildPlanAttempt.buildError && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        role="alert"
                        className="mb-3 flex items-center gap-1.5 overflow-hidden rounded-lg border border-rose-800/50 bg-rose-950/25 px-3 py-2 text-xs text-rose-200"
                      >
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {buildPlanAttempt.buildError}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <SkillGapReport
                    roles={profileState.analysis.selectedRoles}
                    report={profileState.analysis.gaps}
                    selection={gapSelection}
                    onToggleGap={(roleId, gapId) => setGapSelection((current) => toggleGapSelection(current, roleId, gapId))}
                    onBuildPlan={(roleId) => void handleBuildPlan(roleId)}
                    buildingRoleId={buildPlanAttempt.buildingRoleId}
                  />
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
