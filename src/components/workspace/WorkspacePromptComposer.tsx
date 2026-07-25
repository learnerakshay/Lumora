import React, { useState } from 'react';
import { Send, Paperclip, AlertCircle, Sparkles, StopCircle } from 'lucide-react';

export type AnswerMode = 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE';

interface WorkspacePromptComposerProps {
  hasIndexedSources: boolean;
  isGenerating?: boolean;
  onOpenAddSource: () => void;
  onSubmitMessage: (prompt: string, mode: AnswerMode) => void;
  onCancelGeneration?: () => void;
}

export function WorkspacePromptComposer({
  hasIndexedSources,
  isGenerating = false,
  onOpenAddSource,
  onSubmitMessage,
  onCancelGeneration,
}: WorkspacePromptComposerProps) {
  const [promptText, setPromptText] = useState('');
  const [selectedMode, setSelectedMode] = useState<AnswerMode>('DETAILED');
  const maxLength = 4000;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (hasIndexedSources && promptText.trim() && !isGenerating) {
        handleSubmit();
      }
    }
  };

  const handleSubmit = () => {
    if (!promptText.trim() || !hasIndexedSources || isGenerating) return;
    onSubmitMessage(promptText.trim(), selectedMode);
    setPromptText('');
  };

  return (
    <div className="p-4 md:p-5 bg-[#121824]/95 border-t border-slate-800/80 shrink-0 sticky bottom-0 z-10 select-none">
      <div className="max-w-4xl mx-auto space-y-2.5">
        {/* Helper Banner when no indexed sources exist */}
        {!hasIndexedSources && (
          <div className="flex items-center justify-between p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl text-xs text-amber-300 animate-fade-in">
            <div className="flex items-center space-x-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">
                Add and process at least one knowledge source to enable grounded AI research & conversation.
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenAddSource}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] shrink-0 transition-colors"
            >
              + Add Source
            </button>
          </div>
        )}

        {/* Mode Selector Header Bar */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono hidden sm:inline">
              Synthesis Mode:
            </span>
            {(
              [
                { id: 'CONCISE', label: 'Concise' },
                { id: 'DETAILED', label: 'Detailed' },
                { id: 'CRITICAL', label: 'Deep Critical' },
                { id: 'CREATIVE', label: 'Creative' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMode(m.id)}
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                  selectedMode === m.id
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <span className="text-[10px] font-mono text-slate-500 hidden md:inline">
            {promptText.length} / {maxLength}
          </span>
        </div>

        {/* Textarea Composer Container */}
        <div
          className={`relative rounded-2xl border transition-all ${
            hasIndexedSources
              ? 'bg-slate-900/90 border-slate-800 focus-within:border-sky-500/80 focus-within:ring-1 focus-within:ring-sky-500/50'
              : 'bg-slate-900/40 border-slate-800/60 opacity-75'
          }`}
        >
          <textarea
            value={promptText}
            onChange={(e) => {
              if (e.target.value.length <= maxLength) {
                setPromptText(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            disabled={!hasIndexedSources || isGenerating}
            rows={2}
            placeholder={
              hasIndexedSources
                ? 'Ask anything about your workspace sources... (e.g., Summarize key findings or compare architectural trade-offs)'
                : 'Knowledge composer locked — Ingest a source to start asking questions...'
            }
            className="w-full px-4 pt-3 pb-10 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none resize-none disabled:cursor-not-allowed leading-relaxed"
          />

          {/* Bottom Controls inside composer */}
          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
            {/* Attachment shortcut */}
            <div className="flex items-center space-x-2 pointer-events-auto">
              <button
                type="button"
                onClick={onOpenAddSource}
                className="p-1.5 text-slate-400 hover:text-sky-300 rounded-lg hover:bg-slate-800/80 transition-colors flex items-center space-x-1 text-[11px]"
                title="Attach Source"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-medium">Attach Source</span>
              </button>

              <span className="text-[10px] text-slate-600 font-mono hidden md:inline">
                <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">Enter</kbd> send, <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">Shift+Enter</kbd> newline
              </span>
            </div>

            {/* Right: Submit or Cancel */}
            <div className="flex items-center space-x-2 pointer-events-auto">
              {isGenerating ? (
                <button
                  type="button"
                  onClick={onCancelGeneration}
                  className="px-3 py-1.5 bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-800 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
                  title="Cancel Generation"
                >
                  <StopCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!hasIndexedSources || !promptText.trim()}
                  className={`p-2 rounded-xl transition-all flex items-center justify-center ${
                    hasIndexedSources && promptText.trim()
                      ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                  title="Send Research Prompt"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
