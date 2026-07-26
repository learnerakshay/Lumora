import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Play,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AI_ACTION_CATALOG,
  type AIActionId,
  type AIActionTarget,
} from '../../lib/ai/actions/catalog';
import type { AIActionRequest } from '../../lib/ai/actions/types';

interface ActionSourceOption {
  id: string;
  title: string;
  type: string;
  status: string;
}

interface AIActionMenuProps {
  sources: ActionSourceOption[];
  selectedSourceId?: string | null;
  hasConversation: boolean;
  draftText: string;
  disabled?: boolean;
  onRun: (request: AIActionRequest, displayMessage: string) => void;
}

const TARGET_LABELS: Record<'workspace' | 'source' | 'conversation', string> = {
  workspace: 'the entire Workspace',
  source: 'the selected source',
  conversation: 'the current conversation',
};

export function AIActionMenu({
  sources,
  selectedSourceId,
  hasConversation,
  draftText,
  disabled = false,
  onRun,
}: AIActionMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [actionId, setActionId] = useState<AIActionId | null>(null);
  const [target, setTarget] = useState<AIActionTarget>('workspace');
  const [sourceId, setSourceId] = useState('');
  const [compareSourceId, setCompareSourceId] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState<'beginner' | 'detailed'>('detailed');
  const [error, setError] = useState<string | null>(null);

  const readySources = useMemo(
    () => sources.filter(({ status }) => status === 'COMPLETED'),
    [sources],
  );
  const selectedAction = AI_ACTION_CATALOG.find(({ id }) => id === actionId);
  const actionAvailability = (id: AIActionId) => {
    if (id === 'explain') return { available: true, reason: '' };
    if (id === 'compare') {
      return {
        available: readySources.length >= 2,
        reason: 'Requires two completed sources',
      };
    }
    return {
      available: readySources.length > 0 || hasConversation,
      reason: 'Requires a completed source or conversation',
    };
  };

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const chooseAction = (id: AIActionId) => {
    setActionId(id);
    setError(null);
    const preferredSource =
      readySources.find(({ id: source }) => source === selectedSourceId)?.id ||
      readySources[0]?.id ||
      '';
    setSourceId(preferredSource);
    setCompareSourceId(
      readySources.find(({ id }) => id !== preferredSource)?.id || '',
    );
    setSubject(draftText.trim());
    if (id === 'explain') {
      setTarget(draftText.trim() || readySources.length === 0 ? 'text' : 'source');
    } else if (id === 'compare') {
      setTarget('source');
    } else {
      setTarget(
        selectedSourceId && preferredSource
          ? 'source'
          : readySources.length > 0
            ? 'workspace'
            : hasConversation
              ? 'conversation'
              : 'workspace',
      );
    }
  };

  const reset = () => {
    setActionId(null);
    setError(null);
  };

  const runAction = () => {
    if (!selectedAction) return;
    let request: AIActionRequest;
    let displayMessage: string;

    if (actionId === 'compare') {
      if (!sourceId || !compareSourceId || sourceId === compareSourceId) {
        setError('Select two different completed sources.');
        return;
      }
      const left = readySources.find(({ id }) => id === sourceId)!;
      const right = readySources.find(({ id }) => id === compareSourceId)!;
      request = {
        actionId,
        input: { sourceIds: [sourceId, compareSourceId] },
      };
      displayMessage = `Compare "${left.title}" with "${right.title}"`;
    } else if (actionId === 'explain') {
      if (target === 'text') {
        if (!subject.trim()) {
          setError('Enter text, code, a term, or a concept to explain.');
          return;
        }
        request = {
          actionId,
          input: { target: 'text', subject: subject.trim(), level },
        };
        displayMessage = `Explain: ${subject.trim().slice(0, 120)}`;
      } else {
        const source = readySources.find(({ id }) => id === sourceId);
        if (!source) {
          setError('Select a completed source.');
          return;
        }
        request = {
          actionId,
          input: { target: 'source', sourceId, level },
        };
        displayMessage = `Explain "${source.title}"`;
      }
    } else {
      if (target === 'source') {
        const source = readySources.find(({ id }) => id === sourceId);
        if (!source) {
          setError('Select a completed source.');
          return;
        }
        request = { actionId: actionId!, input: { target, sourceId } };
        displayMessage = `${selectedAction.label} "${source.title}"`;
      } else {
        request = { actionId: actionId!, input: { target } };
        displayMessage = `${selectedAction.label} ${TARGET_LABELS[target as 'workspace' | 'conversation']}`;
      }
    }

    onRun(request, displayMessage);
    setIsOpen(false);
    reset();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open);
          if (isOpen) reset();
        }}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-violet-300 transition hover:bg-violet-950/60 hover:text-violet-200 disabled:cursor-not-allowed disabled:text-slate-600"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>AI Actions</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <div
          role={selectedAction ? 'dialog' : 'menu'}
          aria-label={selectedAction ? `Configure ${selectedAction.label}` : 'AI Actions'}
          className="absolute -left-10 bottom-full z-40 mb-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-700 bg-[#121824] shadow-2xl shadow-black/40 animate-fade-in sm:left-0"
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-3">
            <div>
              <p className="text-xs font-bold text-white">AI Actions</p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Run a grounded action using available context.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                reset();
              }}
              aria-label="Close AI Actions"
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {!selectedAction ? (
            <div className="space-y-1 p-2">
              {AI_ACTION_CATALOG.map((action) => {
                const availability = actionAvailability(action.id);
                return (
                  <button
                    key={action.id}
                    type="button"
                    role="menuitem"
                    aria-disabled={!availability.available}
                    onClick={() => {
                      if (availability.available) chooseAction(action.id);
                    }}
                    className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      availability.available
                        ? 'hover:bg-slate-800/80'
                        : 'cursor-not-allowed opacity-45'
                    }`}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-violet-900/70 bg-violet-950/50 text-violet-300">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <span>
                      <span className="block text-xs font-semibold text-slate-100">
                        {action.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
                        {availability.available
                          ? action.description
                          : availability.reason}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3 p-3.5">
              <button
                type="button"
                onClick={reset}
                className="text-[10px] font-semibold text-sky-400 hover:text-sky-300"
              >
                ← All actions
              </button>
              <div>
                <p className="text-sm font-bold text-white">{selectedAction.label}</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">
                  {selectedAction.description}
                </p>
              </div>

              {actionId !== 'compare' && actionId !== 'explain' && (
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Context
                  </span>
                  <select
                    value={target}
                    onChange={(event) => {
                      setTarget(event.target.value as AIActionTarget);
                      setError(null);
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
                  >
                    <option value="workspace" disabled={readySources.length === 0}>
                      Entire Workspace
                    </option>
                    <option value="source" disabled={readySources.length === 0}>
                      Selected source
                    </option>
                    <option value="conversation" disabled={!hasConversation}>
                      Current conversation
                    </option>
                  </select>
                </label>
              )}

              {actionId === 'explain' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {(['text', 'source'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTarget(value)}
                        disabled={value === 'source' && readySources.length === 0}
                        className={`rounded-xl border px-2.5 py-2 text-[10px] font-semibold transition ${
                          target === value
                            ? 'border-violet-600 bg-violet-950/50 text-violet-200'
                            : 'border-slate-800 text-slate-500 hover:border-slate-700'
                        }`}
                      >
                        {value === 'text' ? 'Text or concept' : 'Selected source'}
                      </button>
                    ))}
                  </div>
                  {target === 'text' && (
                    <textarea
                      value={subject}
                      onChange={(event) => setSubject(event.target.value.slice(0, 8_000))}
                      rows={4}
                      placeholder="Paste text, code, a technical term, or a concept…"
                      className="w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs leading-5 text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-500"
                    />
                  )}
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Explanation level
                    </span>
                    <select
                      value={level}
                      onChange={(event) =>
                        setLevel(event.target.value as 'beginner' | 'detailed')
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
                    >
                      <option value="beginner">Beginner-friendly</option>
                      <option value="detailed">Detailed</option>
                    </select>
                  </label>
                </>
              )}

              {(target === 'source' || actionId === 'compare') && (
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {actionId === 'compare' ? 'First source' : 'Source'}
                  </span>
                  <select
                    value={sourceId}
                    onChange={(event) => {
                      setSourceId(event.target.value);
                      setError(null);
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
                  >
                    {readySources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.title} · {source.type}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {actionId === 'compare' && (
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Second source
                  </span>
                  <select
                    value={compareSourceId}
                    onChange={(event) => {
                      setCompareSourceId(event.target.value);
                      setError(null);
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
                  >
                    {readySources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.title} · {source.type}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {error && (
                <p role="alert" className="text-[10px] leading-4 text-rose-300">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={runAction}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-violet-400 active:scale-[0.99]"
              >
                <Play className="h-3.5 w-3.5" />
                Run {selectedAction.label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
