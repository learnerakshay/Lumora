import React, { useLayoutEffect, useRef, useState } from 'react';
import { Send, StopCircle } from 'lucide-react';
import type { SourceRecord } from '../../lib/source-store';
import type { AIActionRequest } from '../../lib/ai/actions/types';
import { AIActionMenu } from './AIActionMenu';
import { WorkspaceAIModeMenu } from './WorkspaceAIModeMenu';
import type { AnswerMode } from './chat-presentation';

export type { AnswerMode } from './chat-presentation';

interface WorkspacePromptComposerProps {
  hasIndexedSources: boolean;
  isGenerating?: boolean;
  canCancelGeneration?: boolean;
  onOpenAddSource: () => void;
  onSubmitMessage: (prompt: string, mode: AnswerMode) => void;
  sources?: SourceRecord[];
  selectedSourceId?: string | null;
  hasConversation?: boolean;
  onSubmitAction?: (request: AIActionRequest, displayMessage: string, mode: AnswerMode) => void;
  onCancelGeneration?: () => void;
}

export function WorkspacePromptComposer({
  hasIndexedSources,
  isGenerating = false,
  canCancelGeneration = true,
  onSubmitMessage,
  sources = [],
  selectedSourceId,
  hasConversation = false,
  onSubmitAction,
  onCancelGeneration,
}: WorkspacePromptComposerProps) {
  const [promptText, setPromptText] = useState('');
  const [selectedMode, setSelectedMode] = useState<AnswerMode>('CONCISE');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxLength = 4000;
  const maxTextareaHeight = 176;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, maxTextareaHeight);
    textarea.style.height = `${Math.max(nextHeight, 64)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxTextareaHeight ? 'auto' : 'hidden';
  }, [promptText]);

  const handleSubmit = () => {
    if (!promptText.trim() || isGenerating) return;
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
    <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-800/70 bg-[#0d131d]/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl sm:px-4 md:px-5">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-visible rounded-xl border border-slate-800 bg-slate-900/80 shadow-2xl backdrop-blur-md transition-all focus-within:border-cyan-500/80">
          <textarea
            ref={textareaRef}
            value={promptText}
            onChange={(event) => {
              if (event.target.value.length <= maxLength) setPromptText(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            rows={1}
            aria-label="Ask Lumora a question"
            placeholder={hasIndexedSources ? 'Ask about your sources or anything else…' : 'Ask Lumora anything…'}
            className="block min-h-16 max-h-44 w-full resize-none overflow-x-hidden bg-transparent px-4 pb-3 pt-4 text-sm leading-6 text-white placeholder-slate-500 transition-[height] duration-150 focus:outline-none disabled:cursor-not-allowed sm:px-5"
          />

          <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-slate-800/65 px-2.5 py-2 sm:px-3">
            <div className="flex min-w-0 items-center gap-1 rounded-xl border border-slate-800/60 bg-slate-950/20 p-0.5">
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
              <span className="h-4 w-px bg-slate-800" aria-hidden="true" />
              <WorkspaceAIModeMenu value={selectedMode} onChange={setSelectedMode} disabled={isGenerating} />
            </div>

            <div className="ml-auto flex min-w-0 items-center gap-2.5">
              <span className="hidden truncate text-[9px] text-slate-600 xl:inline">Enter to send · Shift+Enter for a new line</span>
              <span className="shrink-0 text-[9px] tabular-nums text-slate-600">{promptText.length}/{maxLength}</span>
              {isGenerating ? (
                <button
                  type="button"
                  onClick={canCancelGeneration ? onCancelGeneration : undefined}
                  disabled={!canCancelGeneration}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-rose-800/80 bg-rose-950/70 px-3 text-xs font-semibold text-rose-300 transition-colors hover:border-rose-700 hover:bg-rose-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-wait disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-400"
                  aria-label={canCancelGeneration ? 'Stop response generation' : 'Server is completing response generation'}
                >
                  <StopCircle className="h-3.5 w-3.5" />
                  <span>{canCancelGeneration ? 'Stop' : 'Completing…'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!promptText.trim()}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${promptText.trim() ? 'bg-gradient-to-br from-cyan-400 to-violet-500 text-slate-950 shadow-[0_8px_20px_rgba(34,211,238,0.25)] hover:shadow-[0_10px_24px_rgba(139,92,246,0.3)]' : 'cursor-not-allowed bg-slate-800/60 text-slate-600 opacity-45 shadow-none'}`}
                  aria-label="Send chat prompt"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
