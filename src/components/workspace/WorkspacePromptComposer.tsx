import React, { useLayoutEffect, useRef, useState } from 'react';
import { Send, StopCircle } from 'lucide-react';
import type { SourceRecord } from '../../lib/source-store';
import type { AIActionRequest } from '../../lib/ai/actions/types';
import { AIActionMenu } from './AIActionMenu';

export type AnswerMode = 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE';

interface WorkspacePromptComposerProps {
  hasIndexedSources: boolean;
  isGenerating?: boolean;
  canCancelGeneration?: boolean;
  onOpenAddSource: () => void;
  onSubmitMessage: (prompt: string, mode: AnswerMode) => void;
  sources?: SourceRecord[];
  selectedSourceId?: string | null;
  hasConversation?: boolean;
  onSubmitAction?: (
    request: AIActionRequest,
    displayMessage: string,
    mode: AnswerMode,
  ) => void;
  onCancelGeneration?: () => void;
}

const ANSWER_MODES: { id: AnswerMode; label: string }[] = [
  { id: 'CONCISE', label: 'Concise' },
  { id: 'DETAILED', label: 'Detailed' },
  { id: 'CRITICAL', label: 'Critical' },
  { id: 'CREATIVE', label: 'Creative' },
];

export function WorkspacePromptComposer({
  hasIndexedSources,
  isGenerating = false,
  canCancelGeneration = true,
  onOpenAddSource,
  onSubmitMessage,
  sources = [],
  selectedSourceId,
  hasConversation = false,
  onSubmitAction,
  onCancelGeneration,
}: WorkspacePromptComposerProps) {
  const [promptText, setPromptText] = useState('');
  const [selectedMode, setSelectedMode] = useState<AnswerMode>('DETAILED');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxLength = 4000;
  const maxTextareaHeight = 176;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, maxTextareaHeight);
    textarea.style.height = `${Math.max(nextHeight, 48)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxTextareaHeight ? 'auto' : 'hidden';
  }, [promptText]);

  const handleSubmit = () => {
    if (!promptText.trim() || !hasIndexedSources || isGenerating) return;
    onSubmitMessage(promptText.trim(), selectedMode);
    setPromptText('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-800/80 bg-[#0d131d]/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-4 md:px-5">
      <div className="mx-auto max-w-3xl space-y-2.5">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div aria-label="Synthesis mode" className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto">
            <span className="hidden shrink-0 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:inline">
              Mode
            </span>
            {ANSWER_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                disabled={!hasIndexedSources || isGenerating}
                onClick={() => setSelectedMode(mode.id)}
                aria-pressed={selectedMode === mode.id}
                className={`shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition-[background-color,border-color,color,box-shadow,opacity] duration-150 disabled:cursor-not-allowed ${
                  selectedMode === mode.id
                    ? 'border-cyan-400/35 bg-cyan-400/10 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.08)]'
                    : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                } ${!hasIndexedSources ? 'opacity-40' : ''}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <span className="hidden shrink-0 text-[10px] tabular-nums text-slate-500 sm:inline">
            {promptText.length}/{maxLength}
          </span>
        </div>

        <div
          className={`rounded-2xl border transition-[border-color,background-color,box-shadow,opacity] duration-200 ${
            hasIndexedSources
              ? 'border-slate-700/90 bg-slate-900/90 shadow-lg shadow-black/10 focus-within:border-cyan-400/65 focus-within:bg-[#141d2a] focus-within:shadow-[0_12px_34px_rgba(0,0,0,0.2),0_0_22px_rgba(34,211,238,0.07)]'
              : 'border-slate-800/45 bg-slate-900/25 opacity-65 shadow-none'
          }`}
        >
          <textarea
            ref={textareaRef}
            value={promptText}
            onChange={(event) => {
              if (event.target.value.length <= maxLength) setPromptText(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            disabled={!hasIndexedSources || isGenerating}
            rows={1}
            aria-label="Ask a question about Workspace sources"
            placeholder={
              hasIndexedSources
                ? 'Ask a question about your sources…'
                : 'Add a source to start asking questions…'
            }
            className="block min-h-12 max-h-44 w-full resize-none overflow-x-hidden bg-transparent px-4 pb-2 pt-3.5 text-sm leading-6 text-white placeholder-slate-500 transition-[height] duration-150 focus:outline-none disabled:cursor-not-allowed sm:px-5"
          />

          <div className="flex min-h-11 items-center justify-between gap-3 border-t border-slate-800/70 px-2.5 py-2 sm:px-3">
            <div className="flex min-w-0 items-center gap-2">
              {onSubmitAction && (
                <AIActionMenu
                  sources={sources}
                  selectedSourceId={selectedSourceId}
                  hasConversation={hasConversation}
                  draftText={promptText}
                  disabled={isGenerating || !hasIndexedSources}
                  onRun={(request, displayMessage) => {
                    onSubmitAction(request, displayMessage, selectedMode);
                    setPromptText('');
                  }}
                />
              )}
              <span className="hidden text-[10px] text-slate-500 lg:inline">
                Enter to send · Shift + Enter for a new line
              </span>
            </div>

            {isGenerating ? (
              <button
                type="button"
                onClick={canCancelGeneration ? onCancelGeneration : undefined}
                disabled={!canCancelGeneration}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-rose-800 bg-rose-950 px-3 text-xs font-bold text-rose-300 transition hover:bg-rose-900 disabled:cursor-wait disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-400"
                aria-label={canCancelGeneration ? 'Stop response generation' : 'Server is completing response generation'}
              >
                <StopCircle className="h-3.5 w-3.5" />
                <span>{canCancelGeneration ? 'Stop' : 'Completing…'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!hasIndexedSources || !promptText.trim()}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                  hasIndexedSources && promptText.trim()
                    ? 'bg-cyan-300 text-slate-950 shadow-md shadow-cyan-500/20 hover:bg-cyan-200'
                    : 'cursor-not-allowed bg-slate-800/70 text-slate-500 opacity-55'
                }`}
                aria-label="Send research prompt"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
