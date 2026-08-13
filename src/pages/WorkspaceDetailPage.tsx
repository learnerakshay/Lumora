import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SourceRecord, SourceType } from '../lib/source-store';
import { StoredMessage, StoredCitation } from '../lib/chat/conversation-store';
import {
  ConversationOperationGate,
  ConversationStreamGuard,
  parseConversationHistoryResponse,
  reconcileCompletedTurn,
  removeDeletedMessages,
  replaceCompletedAssistant,
  shouldApplyMessageSnapshot,
} from '../lib/chat/conversation-lifecycle';
import type { ToolStatusUpdate, WebSource } from '../lib/ai/types';
import type { AIActionRequest } from '../lib/ai/actions/types';
import { getAIActionMetadata } from '../lib/ai/actions/catalog';
import { WorkspaceSourcesSidebar } from '../components/workspace/WorkspaceSourcesSidebar';
import { WorkspaceHeader } from '../components/workspace/WorkspaceHeader';
import { WorkspaceCenter } from '../components/workspace/WorkspaceCenter';
import { WorkspaceChatArea } from '../components/workspace/WorkspaceChatArea';
import { WorkspacePromptComposer, AnswerMode } from '../components/workspace/WorkspacePromptComposer';
import { AddSourceModal } from '../components/workspace/AddSourceModal';
import { SourceDetailsModal } from '../components/workspace/SourceDetailsModal';
import { SettingsModal } from '../components/dashboard/SettingsModal';
import { WorkspaceContextPanel } from '../components/workspace/WorkspaceContextPanel';
import { AlertCircle, X } from 'lucide-react';
import { citationEvidenceKey } from '../components/workspace/workspace-interactions';

interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function WorkspaceDetailPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [messages, setMessages] = useState<StoredMessage[]>([]);

  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingSources, setLoadingSources] = useState(true);
  const [refreshingSources, setRefreshingSources] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Streaming State
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingCitations, setStreamingCitations] = useState<StoredCitation[]>([]);
  const [toolExecutions, setToolExecutions] = useState<ToolStatusUpdate[]>([]);
  const [streamingWebSources, setStreamingWebSources] = useState<WebSource[]>([]);
  const [activeActionLabel, setActiveActionLabel] = useState<string | null>(null);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationRevisionRef = useRef(0);
  const operationGateRef = useRef(new ConversationOperationGate());
  const streamGuardRef = useRef(new ConversationStreamGuard());

  // Modal States
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [initialSourceType, setInitialSourceType] = useState<SourceType>('PDF');
  const [selectedSourceDetails, setSelectedSourceDetails] = useState<SourceRecord | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [contextCitations, setContextCitations] = useState<StoredCitation[] | null>(null);
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const sourceRefreshRef = useRef(false);

  // Fetch Workspace Detail
  const fetchWorkspace = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setLoadingWorkspace(true);
      setError(null);
      const res = await fetch(`/api/workspaces/${workspaceId}`);
      if (!res.ok) {
        throw new Error(`Failed to load workspace details (${res.status})`);
      }

      const payload = await res.json();
      if (payload.success && payload.data) {
        setWorkspace(payload.data);
      } else {
        throw new Error(payload.error?.message || 'Workspace not found.');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching workspace.');
    } finally {
      setLoadingWorkspace(false);
    }
  }, [workspaceId]);

  const selectedSourceIdRef = useRef<string | null>(null);
  selectedSourceIdRef.current = selectedSourceDetails?.id || null;

  // Fetch Workspace Sources
  const fetchSources = useCallback(async () => {
    if (!workspaceId) return false;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sources`);
      if (!res.ok) throw new Error('Failed to fetch sources');

      const payload = await res.json();
      if (payload.success && Array.isArray(payload.data)) {
        setSources(payload.data);
        if (selectedSourceIdRef.current) {
          const fresh = payload.data.find((s: SourceRecord) => s.id === selectedSourceIdRef.current);
          if (fresh) setSelectedSourceDetails(fresh);
        }
        return true;
      }
      throw new Error(payload.error?.message || 'Failed to fetch sources');
    } catch (err: any) {
      setActivityError(err.message || 'Unable to refresh Workspace sources.');
      return false;
    } finally {
      setLoadingSources(false);
    }
  }, [workspaceId]);

  const handleRefreshSources = useCallback(async () => {
    if (sourceRefreshRef.current) return;
    sourceRefreshRef.current = true;
    setRefreshingSources(true);
    try {
      const refreshed = await fetchSources();
      if (refreshed) setActivityError(null);
    } finally {
      sourceRefreshRef.current = false;
      setRefreshingSources(false);
    }
  }, [fetchSources]);

  // Fetch Workspace Chat Messages
  const fetchMessages = useCallback(async (): Promise<void> => {
    if (!workspaceId) return;
    const requestedAtRevision = conversationRevisionRef.current;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/messages`);
      const payload =
        res.status === 204 ? null : await res.json().catch(() => null);
      const nextMessages = parseConversationHistoryResponse(res, payload);
      if (
        shouldApplyMessageSnapshot(
          requestedAtRevision,
          conversationRevisionRef.current,
        )
      ) {
        setMessages(nextMessages);
        setHistoryError(null);
      }
    } catch (err: any) {
      if (requestedAtRevision === conversationRevisionRef.current) {
        setHistoryError(
          err.message || 'Unable to refresh conversation history.',
        );
      }
    }
  }, [workspaceId]);

  useEffect(() => {
    const activeWorkspaceId = workspaceId;
    streamGuardRef.current.invalidate();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    operationGateRef.current = new ConversationOperationGate();
    conversationRevisionRef.current += 1;
    setMessages([]);
    setHistoryError(null);
    fetchWorkspace();
    fetchSources();
    void fetchMessages();
    return () => {
      streamGuardRef.current.invalidate(activeWorkspaceId);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, [fetchWorkspace, fetchSources, fetchMessages]);

  // Polling loop when any source is currently PROCESSING or PENDING
  useEffect(() => {
    const hasActiveProcessing = sources.some(
      (s) => s.status === 'PROCESSING' || s.status === 'PENDING'
    );

    if (!hasActiveProcessing) return;

    const interval = setInterval(() => {
      fetchSources();
    }, 2000);

    return () => clearInterval(interval);
  }, [sources, fetchSources]);

  // A persisted SENDING assistant record means server-side generation is still
  // active after a reload or transport interruption. Poll only until it reaches
  // its durable SUCCESS/ERROR terminal state.
  useEffect(() => {
    if (!messages.some((message) => message.status === 'SENDING')) return;
    const interval = setInterval(() => {
      void fetchMessages();
    }, 1500);
    return () => clearInterval(interval);
  }, [messages, fetchMessages]);

  // Chat Streaming Submission Handler
  const handleSubmitMessage = async (
    promptText: string,
    mode: AnswerMode = 'DETAILED',
    action?: AIActionRequest,
    regenerateAssistant?: StoredMessage,
  ) => {
    if (
      !workspaceId ||
      !promptText.trim() ||
      messages.some((message) => message.status === 'SENDING')
    ) return;
    const capturedWorkspaceId = workspaceId;
    const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const operationId = regenerateAssistant
      ? `regenerate:${regenerateAssistant.id}:${nonce}`
      : `submit:${nonce}`;
    const operationGate = operationGateRef.current;
    if (!operationGate.begin(operationId)) return;
    streamGuardRef.current.activate(capturedWorkspaceId, operationId);
    const isCurrentOperation = () =>
      streamGuardRef.current.isCurrent(capturedWorkspaceId, operationId);
    conversationRevisionRef.current += 1;

    const isRegeneration = Boolean(regenerateAssistant);
    const tempUserMsg: StoredMessage = {
      id: `usr_${Date.now()}`,
      workspaceId: capturedWorkspaceId,
      parentMessageId: null,
      role: 'USER',
      content: promptText.trim(),
      mode,
      status: 'SUCCESS',
      action: action || null,
      createdAt: new Date().toISOString(),
    };

    if (!isRegeneration) {
      setMessages((prev) => [...prev, tempUserMsg]);
    } else {
      setRegeneratingMessageId(regenerateAssistant!.id);
    }
    setIsGenerating(true);
    setActivityError(null);
    setStreamingText('');
    setStreamingCitations([]);
    setToolExecutions([]);
    setStreamingWebSources([]);
    setActiveActionLabel(
      isRegeneration
        ? 'Regenerating response'
        : action
          ? getAIActionMetadata(action.actionId)?.label || 'AI Action'
          : null,
    );

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await fetch(`/api/workspaces/${capturedWorkspaceId}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isRegeneration
            ? { regenerateMessageId: regenerateAssistant!.id, operationId }
            : {
                message: promptText.trim(),
                mode,
                operationId,
                ...(action ? { action } : {}),
              },
        ),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const responseError =
          typeof payload?.error?.message === 'string'
            ? payload.error.message
            : typeof payload?.error === 'string'
              ? payload.error
              : null;
        throw new Error(
          responseError || 'Failed to start chat streaming session.',
        );
      }
      if (!res.body) {
        throw new Error('The chat streaming response was unavailable.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let terminalEventReceived = false;
      let completedResponse = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            if (data.type === 'chunk' && data.text) {
              if (isCurrentOperation()) {
                setStreamingText((prev) => prev + data.text);
              }
            } else if (
              data.type === 'user_persisted' &&
              !isRegeneration &&
              data.message &&
              typeof data.message === 'object' &&
              typeof data.message.id === 'string'
            ) {
              if (isCurrentOperation()) {
                setMessages((current) =>
                  current.map((item) =>
                    item.id === tempUserMsg.id
                      ? (data.message as StoredMessage)
                      : item,
                  ),
                );
              }
            } else if (
              data.type === 'tool_status' &&
              typeof data.requestId === 'string' &&
              typeof data.toolName === 'string' &&
              typeof data.status === 'string'
            ) {
              if (!isCurrentOperation()) continue;
              setToolExecutions((current) => {
                const update = data as ToolStatusUpdate;
                const existing = current.findIndex(
                  (execution) => execution.requestId === update.requestId,
                );
                if (existing === -1) return [...current, update];
                return current.map((execution, index) =>
                  index === existing ? update : execution,
                );
              });
            } else if (data.type === 'web_sources' && Array.isArray(data.sources)) {
              const validSources = data.sources.filter(
                (source: unknown): source is WebSource => {
                  if (!source || typeof source !== 'object' || Array.isArray(source)) {
                    return false;
                  }
                  const candidate = source as Record<string, unknown>;
                  if (
                    typeof candidate.title !== 'string' ||
                    typeof candidate.url !== 'string' ||
                    typeof candidate.snippet !== 'string' ||
                    typeof candidate.score !== 'number'
                  ) {
                    return false;
                  }
                  try {
                    return new URL(candidate.url).protocol === 'https:';
                  } catch {
                    return false;
                  }
                },
              );
              if (isCurrentOperation()) setStreamingWebSources(validSources);
            } else if (data.type === 'done') {
              terminalEventReceived = true;
              if (!isCurrentOperation()) continue;
              if (
                !data.message ||
                typeof data.message !== 'object' ||
                typeof data.message.id !== 'string'
              ) {
                throw new Error('The completed response was not persisted correctly.');
              }
              if (isRegeneration) {
                setMessages((current) =>
                  replaceCompletedAssistant(current, data.message as StoredMessage),
                );
              } else {
                if (
                  !data.userMessage ||
                  typeof data.userMessage !== 'object' ||
                  typeof data.userMessage.id !== 'string'
                ) {
                  throw new Error('The submitted query was not persisted correctly.');
                }
                setMessages((current) =>
                  reconcileCompletedTurn(
                    current,
                    tempUserMsg.id,
                    data.userMessage as StoredMessage,
                    data.message as StoredMessage,
                  ),
                );
              }
              conversationRevisionRef.current += 1;
              completedResponse = true;
            } else if (data.type === 'error') {
              terminalEventReceived = true;
              if (!isCurrentOperation()) continue;
              if (
                !isRegeneration &&
                data.userMessage &&
                typeof data.userMessage === 'object' &&
                typeof data.userMessage.id === 'string' &&
                data.message &&
                typeof data.message === 'object' &&
                typeof data.message.id === 'string'
              ) {
                setMessages((current) =>
                  reconcileCompletedTurn(
                    current,
                    tempUserMsg.id,
                    data.userMessage as StoredMessage,
                    data.message as StoredMessage,
                  ),
                );
                conversationRevisionRef.current += 1;
              }
              throw new Error(data.error || 'AI generation failed.');
            }
          }
        }
      }
      if (!terminalEventReceived && !abortController.signal.aborted) {
        throw new Error('The AI response stream ended before completion.');
      }
      if (terminalEventReceived && !completedResponse) {
        throw new Error('The AI response did not reach a persisted completed state.');
      }
      if (completedResponse && isCurrentOperation()) {
        void fetchMessages();
      }
    } catch (err: any) {
      if (isCurrentOperation() && err.name !== 'AbortError') {
        setActivityError(err.message || 'Error communicating with RAG response stream.');
      }
      if (!isRegeneration && isCurrentOperation()) {
        await fetchMessages();
      }
    } finally {
      if (isCurrentOperation()) {
        setIsGenerating(false);
        setStreamingText('');
        setStreamingCitations([]);
        setToolExecutions([]);
        setStreamingWebSources([]);
        setActiveActionLabel(null);
        setRegeneratingMessageId(null);
        streamGuardRef.current.invalidate(capturedWorkspaceId);
      }
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      operationGate.end(operationId);
    }
  };

  const handleSubmitAction = (
    request: AIActionRequest,
    displayMessage: string,
    mode: AnswerMode,
  ) => {
    void handleSubmitMessage(displayMessage, mode, request);
  };

  const handleRegenerateResponse = (assistantMessage: StoredMessage) => {
    if (!assistantMessage.parentMessageId) {
      setActivityError('The originating query for this response is unavailable.');
      return;
    }
    const userMessage = messages.find(
      (message) => message.id === assistantMessage.parentMessageId,
    );
    if (!userMessage) {
      setActivityError('The originating query for this response is unavailable.');
      return;
    }
    void handleSubmitMessage(
      userMessage.content,
      userMessage.mode,
      userMessage.action || undefined,
      assistantMessage,
    );
  };

  const handleCancelGeneration = async () => {
    const activeOperation = streamGuardRef.current.active;
    const transportController = abortControllerRef.current;
    if (transportController && activeOperation) {
      await fetch(`/api/workspaces/${activeOperation.workspaceId}/chat/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationId: activeOperation.operationId }),
        }).catch(() => undefined);
      transportController.abort();
      if (abortControllerRef.current === transportController) {
        abortControllerRef.current = null;
      }
      if (
        streamGuardRef.current.isCurrent(
          activeOperation.workspaceId,
          activeOperation.operationId,
        )
      ) {
        setIsGenerating(false);
        setStreamingText('');
        setStreamingCitations([]);
        setToolExecutions([]);
        setStreamingWebSources([]);
        setActiveActionLabel(null);
      }
    }
  };

  const handleClearHistory = async () => {
    if (!workspaceId) return;
    const operationId = 'clear-history';
    if (!operationGateRef.current.begin(operationId)) return;
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/messages`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to clear conversation history.');
      conversationRevisionRef.current += 1;
      setMessages([]);
      setActivityError(null);
    } catch (err: any) {
      setActivityError(err.message || 'Unable to clear conversation history.');
    } finally {
      operationGateRef.current.end(operationId);
    }
  };

  const handleDeleteQuery = async (userMessageId: string): Promise<boolean> => {
    if (!workspaceId) return false;
    const operationId = `delete:${userMessageId}`;
    if (!operationGateRef.current.begin(operationId)) return false;
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/messages/${userMessageId}`,
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof payload?.error?.message === 'string'
            ? payload.error.message
            : 'Unable to delete this query.',
        );
      }
      const deletedMessageIds = payload?.data?.deletedMessageIds;
      if (!Array.isArray(deletedMessageIds)) {
        throw new Error('The server returned an invalid delete result.');
      }
      conversationRevisionRef.current += 1;
      setMessages((current) =>
        removeDeletedMessages(current, deletedMessageIds),
      );
      setActivityError(null);
      return true;
    } catch (err: any) {
      setActivityError(err.message || 'Unable to delete this query.');
      return false;
    } finally {
      operationGateRef.current.end(operationId);
    }
  };

  // Handle Workspace Update (Rename / Edit Description)
  const handleUpdateWorkspace = async (updatedData: { name?: string; description?: string }) => {
    if (!workspace) return;
    const res = await fetch(`/api/workspaces/${workspace.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedData),
    });

    if (!res.ok) throw new Error('Failed to update workspace');

    const payload = await res.json();
    if (payload.success && payload.data) {
      setWorkspace(payload.data);
    }
  };

  // Handlers for Sources
  const handleOpenAddSource = (type: SourceType = 'PDF') => {
    setInitialSourceType(type);
    setIsAddSourceOpen(true);
  };

  const handleSourceAdded = (newSource: SourceRecord) => {
    setSources((prev) => [newSource, ...prev]);
  };

  const handleSourceUpdated = (updatedSource: SourceRecord) => {
    setSources((prev) => prev.map((s) => (s.id === updatedSource.id ? updatedSource : s)));
    setSelectedSourceDetails(updatedSource);
  };

  const handleSourceDeleted = (sourceId: string) => {
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
    if (selectedSourceDetails?.id === sourceId) {
      setSelectedSourceDetails(null);
    }
  };

  const hasIndexedSources = sources.some(
    (source) => source.type !== 'VTT' && source.status === 'COMPLETED' && source.stage === 'COMPLETED'
  );
  const visibleSources = sources.filter((source) => source.type !== 'VTT');

  const latestCitations = [...messages]
    .reverse()
    .find((message) => message.role === 'ASSISTANT' && message.citations?.length)
    ?.citations || streamingCitations;
  const displayedContextCitations = contextCitations || latestCitations;

  const handleSelectCitation = (
    citation: StoredCitation,
    evidence: StoredCitation[] = latestCitations,
  ) => {
    setContextCitations(evidence);
    setActiveCitationId(citationEvidenceKey(citation));
    setIsContextOpen(true);
  };

  const hasPersistedGeneration = messages.some(
    (message) => message.status === 'SENDING',
  );
  const chatIsGenerating = isGenerating || hasPersistedGeneration;

  if (loadingWorkspace && !workspace) {
    return (
      <div aria-busy="true" aria-label="Loading Workspace" className="flex h-screen overflow-hidden bg-[#0b0f17] text-white">
        <div className="hidden w-80 shrink-0 border-r border-slate-800 bg-[#121824] p-4 lg:block">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-800" />
          <div className="mt-7 h-10 animate-pulse rounded-xl bg-slate-800/80" />
          <div className="mt-5 h-9 animate-pulse rounded-xl bg-slate-800/60" />
          <div className="mt-5 space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="h-16 border-b border-slate-800 bg-[#121824]/80" />
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="w-full max-w-3xl space-y-5 text-center">
              <div className="mx-auto h-7 w-40 animate-pulse rounded bg-slate-800" />
              <div className="mx-auto h-4 w-72 max-w-full animate-pulse rounded bg-slate-800/70" />
              <div className="h-36 animate-pulse rounded-2xl border border-slate-800 bg-[#121824]" />
            </div>
          </div>
          <div className="h-36 border-t border-slate-800 bg-[#121824]/80" />
        </div>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="min-h-screen bg-[#0b0f17] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#121824] border border-slate-800 rounded-2xl p-6 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="text-base font-bold">Workspace Not Available</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error || 'Unable to locate workspace record.'}
          </p>
          <button
            onClick={() => navigate('/workspaces')}
            className="px-4 py-2 bg-sky-500 text-slate-950 font-bold rounded-xl text-xs"
          >
            Return to Workspaces Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#090e16] text-slate-100">
      {/* Left Sidebar â€” Desktop */}
      <div className="hidden lg:block">
        <WorkspaceSourcesSidebar
          workspace={workspace}
          sources={visibleSources}
          loading={loadingSources}
          refreshing={refreshingSources}
          onSelectSourceDetails={setSelectedSourceDetails}
          onDeleteSource={handleSourceDeleted}
          onRefreshSources={handleRefreshSources}
        />
      </div>

      {/* Mobile Sidebar Slide-over Drawer */}
      {isMobileSidebarOpen && (
        <div role="dialog" aria-modal="true" aria-label="Workspace source library" className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full w-80 max-w-[88vw] bg-[#121824] shadow-2xl animate-fade-in">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-label="Close source library"
              className="absolute top-3 right-3 p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <WorkspaceSourcesSidebar
              workspace={workspace}
              sources={visibleSources}
              loading={loadingSources}
              refreshing={refreshingSources}
              onSelectSourceDetails={(source) => {
                setIsMobileSidebarOpen(false);
                setSelectedSourceDetails(source);
              }}
              onDeleteSource={handleSourceDeleted}
              onRefreshSources={handleRefreshSources}
            />
          </div>
        </div>
      )}

      {/* Right Main Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0b0f17]">
        {/* Workspace Header */}
        <WorkspaceHeader
          workspace={workspace}
          onUpdateWorkspace={handleUpdateWorkspace}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenAddSource={() => handleOpenAddSource()}
          onToggleContext={() => setIsContextOpen(true)}
          citationCount={latestCitations.length}
        />

        {/* Center View: Shows Onboarding or Chat Thread */}
        {visibleSources.length > 0 ? (
          <WorkspaceChatArea
            messages={messages.filter((message) => message.status !== 'SENDING')}
            isGenerating={chatIsGenerating}
            streamingText={streamingText}
            streamingCitations={streamingCitations}
            toolExecutions={toolExecutions}
            streamingWebSources={streamingWebSources}
            activeActionLabel={activeActionLabel}
            regeneratingMessageId={regeneratingMessageId}
            error={activityError || historyError}
            sources={visibleSources}
            hasIndexedSources={hasIndexedSources}
            sourceCount={visibleSources.length}
            processingSourceCount={visibleSources.filter(
              (source) => source.status === 'PENDING' || source.status === 'PROCESSING'
            ).length}
            onSelectCitation={handleSelectCitation}
            onSubmitMessage={handleSubmitMessage}
            onClearHistory={handleClearHistory}
            onDeleteQuery={handleDeleteQuery}
            onRegenerateResponse={handleRegenerateResponse}
          />
        ) : (
          <WorkspaceCenter
            workspace={workspace}
            sources={visibleSources}
            onOpenAddSource={handleOpenAddSource}
          />
        )}

        {/* Bottom Prompt Composer */}
        <WorkspacePromptComposer
          hasIndexedSources={hasIndexedSources}
          isGenerating={chatIsGenerating}
          canCancelGeneration={
            isGenerating && Boolean(streamGuardRef.current.active)
          }
          sources={visibleSources}
        selectedSourceId={selectedSourceDetails?.id}
          hasConversation={messages.length > 0}
        onOpenAddSource={handleOpenAddSource}
        onSubmitMessage={handleSubmitMessage}
          onSubmitAction={handleSubmitAction}
          onCancelGeneration={handleCancelGeneration}
        />
      </main>

      <div className="hidden h-full shrink-0 xl:block">
        <WorkspaceContextPanel
          citations={displayedContextCitations}
          sources={visibleSources}
          onSelectCitation={(citation) => handleSelectCitation(citation, displayedContextCitations)}
          activeCitationId={activeCitationId}
        />
      </div>

      {isContextOpen && (
        <div role="dialog" aria-modal="true" aria-label="Response context" className="fixed inset-0 z-50 flex justify-end xl:hidden">
          <button type="button" aria-label="Close context overlay" className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsContextOpen(false)} />
          <div className="relative z-10 h-full w-[340px] max-w-[90vw] shadow-2xl">
            <WorkspaceContextPanel
              citations={displayedContextCitations}
              sources={visibleSources}
              onSelectCitation={(citation) => {
                handleSelectCitation(citation, displayedContextCitations);
              }}
              activeCitationId={activeCitationId}
              onClose={() => setIsContextOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <AddSourceModal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        workspaceId={workspace.id}
        onSourceAdded={handleSourceAdded}
        initialType={initialSourceType}
      />

      <SourceDetailsModal
        source={selectedSourceDetails}
        isOpen={Boolean(selectedSourceDetails)}
        onClose={() => setSelectedSourceDetails(null)}
        onUpdate={handleSourceUpdated}
        onDelete={handleSourceDeleted}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

