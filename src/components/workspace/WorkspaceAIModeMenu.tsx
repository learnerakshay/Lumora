import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Lightbulb, ListTree, SearchCheck, Sparkles, Zap, type LucideIcon } from 'lucide-react';
import { AI_MODE_OPTIONS, type AnswerMode } from './chat-presentation';

interface WorkspaceAIModeMenuProps {
  value: AnswerMode;
  onChange: (mode: AnswerMode) => void;
  disabled?: boolean;
}

const MODE_ICONS: Record<(typeof AI_MODE_OPTIONS)[number]['icon'], LucideIcon> = {
  zap: Zap,
  list: ListTree,
  search: SearchCheck,
  spark: Lightbulb,
};

export function WorkspaceAIModeMenu({ value, onChange, disabled = false }: WorkspaceAIModeMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = AI_MODE_OPTIONS.find((mode) => mode.id === value) || AI_MODE_OPTIONS[1];

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`AI Mode: ${selected.label}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-950/25 px-2.5 text-[11px] font-medium text-slate-300 transition-[background-color,border-color,color] duration-150 hover:border-cyan-500/35 hover:bg-cyan-400/[0.06] hover:text-cyan-100 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
      >
        <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
        <span>{selected.label}</span>
        <ChevronDown className={`h-3 w-3 text-slate-500 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div role="menu" aria-label="Choose AI response mode" className="absolute bottom-full left-0 z-50 mb-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-700/80 bg-[#111925] p-1.5 shadow-[0_22px_55px_rgba(0,0,0,0.48)] animate-fade-in">
          <p className="px-2.5 pb-2 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">AI Mode</p>
          {AI_MODE_OPTIONS.map((mode) => {
            const Icon = MODE_ICONS[mode.icon];
            const isSelected = mode.id === value;
            return (
              <button
                key={mode.id}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => { onChange(mode.id); setIsOpen(false); }}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-150 ${isSelected ? 'bg-cyan-400/[0.09] text-cyan-100' : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'}`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${isSelected ? 'border-cyan-500/30 bg-cyan-400/10 text-cyan-300' : 'border-slate-700/70 bg-slate-900/70 text-slate-400'}`}>
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">{mode.label}</span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">{mode.description}</span>
                </span>
                <Check className={`h-4 w-4 shrink-0 text-cyan-300 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
