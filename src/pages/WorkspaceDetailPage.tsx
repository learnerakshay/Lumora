import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SourceRecord, SourceType } from '../lib/source-store';
import { StoredMessage, StoredCitation } from '../lib/chat/conversation-store';
import { WorkspaceSourcesSidebar } from '../components/workspace/WorkspaceSourcesSidebar';
import { WorkspaceHeader } from '../components/workspace/WorkspaceHeader';
import { WorkspaceCenter } from '../components/workspace/WorkspaceCenter';
import { WorkspaceChatArea } from '../components/workspace/WorkspaceChatArea';
import { WorkspacePromptComposer, AnswerMode } from '../components/workspace/WorkspacePromptComposer';
import { AddSourceModal } from '../components/workspace/AddSourceModal';
import { SourceDetailsModal } from '../components/workspace/SourceDetailsModal';
import { SettingsModal } from '../components/dashboard/SettingsModal';
import { AlertCircle, X } from 'lucide-react';

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
  const [error, setError] = useState<string | null>(null);

  // Streaming State
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingCitations, setStreamingCitations] = useState<StoredCitation[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Modal States
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [initialSourceType, setInitialSourceType] = useState<SourceType>('PDF');
  const [selectedSourceDetails, setSelectedSourceDetails] = useState<SourceRecord | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
    if (!workspaceId) return;
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
      }
    } catch (err) {
      // Fall back silently
    } finally {
      setLoadingSources(false);
    }
  }, [workspaceId]);

  // Fetch Workspace Chat Messages
  const fetchMessages = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/messages`);
      if (!res.ok) return;
      const payload = await res.json();
      if (payload.success && Array.isArray(payload.data)) {
        setMessages(payload.data);
      }
    } catch (err) {
      // Ignore error
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchWorkspace();
    fetchSources();
    fetchMessages();
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

  // Chat Streaming Submission Handler
  const handleSubmitMessage = async (promptText: string, mode: AnswerMode = 'DETAILED') => {
    if (!workspaceId || isGenerating || !promptText.trim()) return;

    // Optimistically add user message
    const tempUserMsg: StoredMessage = {
      id: `usr_${Date.now()}`,
      workspaceId,
      role: 'USER',
      content: promptText.trim(),
      mode,
      status: 'SUCCESS',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setIsGenerating(true);
    setStreamingText('');
    setStreamingCitations([]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: promptText.trim(), mode }),
        signal: abortController.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error('Failed to start chat streaming session.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.type === 'start') {
                if (data.citations) setStreamingCitations(data.citations);
              } else if (data.type === 'chunk' && data.text) {
                setStreamingText((prev) => prev + data.text);
              } else if (data.type === 'done') {
                fetchMessages();
              } else if (data.type === 'error') {
                setError(data.error || 'AI generation failed.');
              }
            } catch (e) {
              // Partial buffer guard
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Error communicating with RAG response stream.');
      }
    } finally {
      setIsGenerating(false);
      setStreamingText('');
      setStreamingCitations([]);
      abortControllerRef.current = null;
      fetchMessages();
    }
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  const handleClearHistory = async () => {
    if (!workspaceId) return;
    try {
      await fetch(`/api/workspaces/${workspaceId}/messages`, { method: 'DELETE' });
      setMessages([]);
    } catch (err) {
      // Ignore
    }
  };

  const handleSelectCitation = (cit: StoredCitation) => {
    // Locate source in current sources list
    const matchedSource = sources.find(
      (s) => s.title.toLowerCase().trim() === cit.title.toLowerCase().trim() || s.id === cit.chunkId
    );
    if (matchedSource) {
      setSelectedSourceDetails(matchedSource);
    } else if (cit.url) {
      window.open(cit.url, '_blank', 'noopener,noreferrer');
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
    (s) => s.status === 'COMPLETED' || s.status === 'PROCESSING'
  );

  if (loadingWorkspace && !workspace) {
    return (
      <div className="min-h-screen bg-[#0b0f17] text-white flex items-center justify-center p-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-mono">Initializing Lumora Workspace Shell...</p>
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
    <div className="flex h-screen bg-[#0b0f17] text-slate-100 overflow-hidden">
      {/* Left Sidebar — Desktop */}
      <div className="hidden lg:block">
        <WorkspaceSourcesSidebar
          workspace={workspace}
          sources={sources}
          loading={loadingSources}
          onOpenAddSource={handleOpenAddSource}
          onSelectSourceDetails={setSelectedSourceDetails}
          onDeleteSource={handleSourceDeleted}
          onRefreshSources={fetchSources}
        />
      </div>

      {/* Mobile Sidebar Slide-over Drawer */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative w-80 max-w-[85vw] bg-[#121824] h-full shadow-2xl z-10">
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <WorkspaceSourcesSidebar
              workspace={workspace}
              sources={sources}
              loading={loadingSources}
              onOpenAddSource={(type) => {
                setIsMobileSidebarOpen(false);
                handleOpenAddSource(type);
              }}
              onSelectSourceDetails={(source) => {
                setIsMobileSidebarOpen(false);
                setSelectedSourceDetails(source);
              }}
              onDeleteSource={handleSourceDeleted}
              onRefreshSources={fetchSources}
            />
          </div>
        </div>
      )}

      {/* Right Main Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0b0f17]">
        {/* Workspace Header */}
        <WorkspaceHeader
          workspace={workspace}
          onUpdateWorkspace={handleUpdateWorkspace}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Center View: Shows Onboarding or Chat Thread */}
        {messages.length > 0 || isGenerating ? (
          <WorkspaceChatArea
            messages={messages}
            isGenerating={isGenerating}
            streamingText={streamingText}
            streamingCitations={streamingCitations}
            hasIndexedSources={hasIndexedSources}
            onSelectCitation={handleSelectCitation}
            onSubmitMessage={handleSubmitMessage}
            onClearHistory={handleClearHistory}
          />
        ) : (
          <WorkspaceCenter
            workspace={workspace}
            sources={sources}
            onOpenAddSource={handleOpenAddSource}
          />
        )}

        {/* Bottom Prompt Composer */}
        <WorkspacePromptComposer
          hasIndexedSources={hasIndexedSources}
          isGenerating={isGenerating}
          onOpenAddSource={() => handleOpenAddSource()}
          onSubmitMessage={handleSubmitMessage}
          onCancelGeneration={handleCancelGeneration}
        />
      </div>

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
