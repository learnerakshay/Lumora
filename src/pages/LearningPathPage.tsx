import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, ExternalLink, FolderPlus, Loader2 } from 'lucide-react';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { API_PATHS } from '../lib/api-paths';
import { ReadinessReportCard } from '../components/learning/ReadinessReportCard';
import { LearningStageList } from '../components/learning/LearningStageList';
import { CreateLearningWorkspaceDialog } from '../components/learning/CreateLearningWorkspaceDialog';
import {
  blankWorkspaceCreationState,
  closeCreateWorkspaceDialog,
  failCreatingWorkspace,
  openCreateWorkspaceDialog,
  startCreatingWorkspace,
  type WorkspaceCreationState,
} from '../components/learning/learning-plan-interactions';
import type { LearningPlanRecord } from '../lib/learning/learning-plan-store';
import type { WorkspaceRecord } from '../lib/workspace-store';

type ViewState = 'loading' | 'ready' | 'error';

async function parseJsonResponse(response: Response): Promise<any> {
  return response.json().catch(() => null);
}

export function LearningPathPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();

  const [view, setView] = useState<ViewState>('loading');
  const [plan, setPlan] = useState<LearningPlanRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [linkedWorkspace, setLinkedWorkspace] = useState<WorkspaceRecord | null>(null);
  const [workspaceState, setWorkspaceState] = useState<WorkspaceCreationState>(blankWorkspaceCreationState());

  const loadPlan = useCallback(async () => {
    if (!planId) return;
    setView('loading');
    setLoadError(null);
    try {
      const response = await fetch(`${API_PATHS.learning}/plan/${encodeURIComponent(planId)}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = await parseJsonResponse(response);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || 'Unable to load this learning plan.');
      }
      setPlan(payload.data);
      setView('ready');
    } catch (error: any) {
      setLoadError(error.message || 'Unable to load this learning plan.');
      setView('error');
    }
  }, [planId]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  const handleConfirmCreateWorkspace = async () => {
    if (!plan) return;
    setWorkspaceState((current) => startCreatingWorkspace(current));
    try {
      const response = await fetch(`${API_PATHS.learning}/plan/${encodeURIComponent(plan.id)}/workspace`, {
        method: 'POST',
      });
      const payload = await parseJsonResponse(response);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || 'Failed to create Learning Workspace.');
      }
      setLinkedWorkspace(payload.data.workspace);
      setWorkspaceState(blankWorkspaceCreationState());
    } catch (error: any) {
      setWorkspaceState((current) => failCreatingWorkspace(current, error.message || 'Failed to create Learning Workspace.'));
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <button
          type="button"
          onClick={() => navigate('/skills')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-cyan-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Skill Intelligence
        </button>

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
              Loading your learning plan…
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
              <p className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {loadError}
              </p>
              <button
                type="button"
                onClick={() => void loadPlan()}
                className="mt-3 rounded-lg border border-rose-700 px-3 py-1.5 text-xs font-semibold transition hover:bg-rose-900/40"
              >
                Try again
              </button>
            </motion.div>
          )}

          {view === 'ready' && plan && plan.status === 'BUILDING' && (
            <motion.div
              key="building"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-[#101722] text-sm text-slate-400"
            >
              <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
              This learning plan is still building…
            </motion.div>
          )}

          {view === 'ready' && plan && plan.status === 'FAILED' && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="rounded-2xl border border-rose-800/60 bg-rose-950/30 p-5 text-sm text-rose-200"
            >
              <p className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {plan.errorMessage || 'This learning plan could not be built.'}
              </p>
            </motion.div>
          )}

          {view === 'ready' && plan && plan.status === 'READY' && plan.path && plan.readiness && (
            <motion.div key="ready" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
              <ReadinessReportCard readiness={plan.readiness} />

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#101722] p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Ready to start building?</p>
                  <p className="text-xs text-slate-500">Create a dedicated, empty Workspace for this role — nothing is auto-added.</p>
                </div>
                {linkedWorkspace || plan.workspaceLinks.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/workspaces/${linkedWorkspace?.id || plan.workspaceLinks[0]?.workspaceId}`)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/15"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open Learning Workspace
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setWorkspaceState((current) => openCreateWorkspaceDialog(current))}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
                  >
                    <FolderPlus className="h-3.5 w-3.5" /> Create Learning Workspace
                  </button>
                )}
              </div>

              <LearningStageList stages={plan.path.stages} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CreateLearningWorkspaceDialog
        isOpen={workspaceState.dialogOpen}
        onClose={() => setWorkspaceState(closeCreateWorkspaceDialog())}
        onConfirm={() => void handleConfirmCreateWorkspace()}
        creating={workspaceState.creating}
        error={workspaceState.error}
      />
    </DashboardLayout>
  );
}
