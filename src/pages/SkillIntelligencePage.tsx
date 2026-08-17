import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Brain, FileText, Loader2, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { UsageLimitNotice } from '../components/usage/UsageLimitNotice';
import { usageLimitFromPayload } from '../lib/usage/client';
import { notifyUsageChanged } from '../components/usage/UsageProvider';
import type { UsageLimitDetails } from '../lib/usage/types';
import { API_PATHS } from '../lib/api-paths';
import { SkillGapReport, SkillProfileSummary } from '../components/skills/SkillGapReport';
import type { SkillProfileRecord, RoleAnalysisRecord } from '../lib/skills/skill-profile-store';

interface ProfileState {
  profile: SkillProfileRecord;
  analysis: RoleAnalysisRecord | null;
}

type ViewState = 'loading' | 'empty' | 'ready' | 'error';

async function parseJsonResponse(response: Response): Promise<any> {
  return response.json().catch(() => null);
}

export function SkillIntelligencePage() {
  const [view, setView] = useState<ViewState>('loading');
  const [state, setState] = useState<ProfileState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [resumeText, setResumeText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [usageLimit, setUsageLimit] = useState<UsageLimitDetails | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const submittingRef = useRef(false);

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
        setState(payload.data);
        setView('ready');
      } else {
        setState(null);
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    if (file) setResumeText('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!selectedFile && !resumeText.trim()) {
      setSubmitError('Upload a resume PDF or image, or paste your resume text.');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setUsageLimit(null);
    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.set('file', selectedFile);
      } else {
        formData.set('resumeText', resumeText.trim());
      }
      const response = await fetch(`${API_PATHS.skills}/profile`, { method: 'POST', body: formData });
      const payload = await parseJsonResponse(response);
      if (!response.ok || !payload?.success) {
        const limitError = usageLimitFromPayload(payload);
        if (limitError) {
          setUsageLimit(limitError.details);
          return;
        }
        throw new Error(payload?.error?.message || 'Resume analysis failed.');
      }
      notifyUsageChanged();
      setState(payload.data);
      setView('ready');
      setSelectedFile(null);
      setResumeText('');
    } catch (error: any) {
      setSubmitError(error.message || 'Resume analysis failed.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      const response = await fetch(`${API_PATHS.skills}/analysis`, { method: 'POST' });
      const payload = await parseJsonResponse(response);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || 'Could not re-run the analysis.');
      }
      setState(payload.data);
    } catch (error: any) {
      setLoadError(error.message || 'Could not re-run the analysis.');
    } finally {
      setReanalyzing(false);
    }
  };

  const handleStartOver = async () => {
    try {
      await fetch(`${API_PATHS.skills}/profile`, { method: 'DELETE' });
    } finally {
      setState(null);
      setView('empty');
    }
  };

  const skillCount = state?.profile.normalizedSkills?.length ?? 0;
  const shippedCount = state?.profile.normalizedSkills?.filter((skill) => skill.evidenceLevel === 'SHIPPED').length ?? 0;
  const strongestSkill = state?.profile.normalizedSkills
    ?.filter((skill) => skill.evidenceLevel === 'SHIPPED')
    .sort((a, b) => b.evidenceRefs.length - a.evidenceRefs.length)[0]?.label;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="border-b border-cyan-400/10 pb-7">
          <div className="mb-2 flex items-center gap-2 text-cyan-300">
            <span className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] p-1.5 shadow-[0_0_16px_rgba(34,211,238,0.08)]"><Brain className="h-3.5 w-3.5" /></span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Skill Intelligence</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Role gap analysis</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Upload a resume and Lumora identifies your skills and evidence, matches you against target roles, and explains exactly what is missing for each one.
          </p>
        </div>

        {usageLimit && (
          <div className="overflow-hidden rounded-2xl border border-amber-400/20">
            <UsageLimitNotice details={usageLimit} onDismiss={() => setUsageLimit(null)} />
          </div>
        )}

        {view === 'loading' && (
          <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-800 bg-[#101722] text-sm text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your Skill Profile…
          </div>
        )}

        {view === 'error' && (
          <div role="alert" className="rounded-2xl border border-rose-800/60 bg-rose-950/30 p-5 text-sm text-rose-200">
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadProfile()} className="mt-3 rounded-lg border border-rose-700 px-3 py-1.5 text-xs font-semibold hover:bg-rose-900/40">Try again</button>
          </div>
        )}

        {view === 'empty' && (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-700/65 bg-gradient-to-br from-[#121b28] to-[#101722] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.025),0_12px_28px_rgba(0,0,0,0.12)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${selectedFile ? 'border-cyan-400/50 bg-cyan-400/[0.05]' : 'border-slate-700 hover:border-slate-600'}`}>
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={handleFileChange} />
                <FileText className="h-6 w-6 text-cyan-300" />
                <span className="text-xs font-semibold text-slate-200">{selectedFile ? selectedFile.name : 'Upload resume PDF or image'}</span>
                <span className="text-[10px] text-slate-500">PDF, JPG, PNG, or WEBP · up to 5 MB</span>
              </label>
              <div className="flex flex-col rounded-xl border border-slate-700 p-3">
                <textarea
                  value={resumeText}
                  onChange={(event) => { setResumeText(event.target.value); if (event.target.value) setSelectedFile(null); }}
                  placeholder="…or paste your resume text here"
                  rows={6}
                  className="w-full flex-1 resize-none bg-transparent text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
                />
              </div>
            </div>

            {submitError && <p className="mt-4 text-xs text-rose-300">{submitError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {submitting ? 'Analyzing resume…' : 'Analyze resume'}
            </button>
          </form>
        )}

        {view === 'ready' && state && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SkillProfileSummary
                skillCount={skillCount}
                shippedCount={shippedCount}
                strengthLabel={strongestSkill || 'Not established yet'}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleReanalyze} disabled={reanalyzing} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 text-xs font-medium text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-200 disabled:opacity-60">
                {reanalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Re-run analysis
              </button>
              <button type="button" onClick={handleStartOver} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 text-xs font-medium text-slate-400 transition hover:border-rose-500/30 hover:text-rose-300">
                <Trash2 className="h-3.5 w-3.5" /> Start over
              </button>
            </div>

            {state.analysis && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                  <h2 className="text-sm font-semibold text-white">Target roles &amp; gaps</h2>
                </div>
                <SkillGapReport roles={state.analysis.selectedRoles} report={state.analysis.gaps} />
              </div>
            )}
          </div>
        )}

        {view === 'ready' && !state?.analysis && (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-[#101722] p-5 text-sm text-slate-400">
            <AlertCircle className="h-4 w-4 text-amber-300" /> Your Skill Profile is ready, but no analysis has been generated yet.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
