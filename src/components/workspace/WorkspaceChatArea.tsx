import React, { useEffect, useMemo, useRef, useState } from 'react';
import Markdown, { type Components } from 'react-markdown';
import {
  Bot,
  BookOpen,
  Check,
  Clock3,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  GitCompare,
  Globe,
  HelpCircle,
  ListChecks,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Route,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { StoredCitation, StoredMessage } from '../../lib/chat/conversation-store';
import type { ToolStatusUpdate, WebSource } from '../../lib/ai/types';
import type { SourceRecord } from '../../lib/source-store';
import type { ChatResponseMode } from '../../types';
import { SourceTypeIcon } from './SourceTypeIcon';
import { getResponseModeDisclosure, splitCitationMarkers } from './chat-presentation';
import { citationEvidenceKey, citationsForResponse, formatCitationTimestamp } from './workspace-interactions';
import { LearningResourceSection } from './LearningResourceSection';
import { useLearningPreferences } from '../../context/LearningPreferencesContext';

const ACTIVE_CITATION_CLASSNAME =
  'ring-2 ring-cyan-400/70 shadow-[0_0_0_1px_rgba(34,211,238,0.16),0_0_18px_rgba(34,211,238,0.35)]';

interface WorkspaceChatAreaProps {
  messages: StoredMessage[];
  isGenerating: boolean;
  streamingText: string;
  streamingCitations: StoredCitation[];
  streamingResponseMode?: ChatResponseMode | null;
  toolExecutions?: ToolStatusUpdate[];
  streamingWebSources?: WebSource[];
  generationStatusLabel?: string | null;
  regeneratingMessageId?: string | null;
  activeCitationId?: string | null;
  error?: string | null;
  loadingHistory: boolean;
  sourceCount: number;
  readySourceCount: number;
  processingSourceCount: number;
  sources: SourceRecord[];
  hasIndexedSources: boolean;
  onSelectCitation?: (citation: StoredCitation, evidence?: StoredCitation[]) => void;
  onSubmitMessage: (prompt: string) => void;
  onClearHistory: () => void;
  onDeleteQuery: (userMessageId: string) => Promise<boolean>;
  onRegenerateResponse: (assistantMessage: StoredMessage) => void;
  onOpenAddSource: () => void;
}

const KEYWORDS = new Set([
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'def',
  'else', 'export', 'false', 'finally', 'for', 'from', 'function', 'if', 'import',
  'in', 'interface', 'let', 'new', 'null', 'return', 'switch', 'throw', 'true',
  'try', 'type', 'undefined', 'var', 'while',
]);

function highlightLine(line: string) {
  const tokenPattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/.*$|\b[A-Za-z_$][\w$]*\b|\b\d+(?:\.\d+)?\b)/g;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(line)) !== null) {
    if (match.index > cursor) parts.push(line.slice(cursor, match.index));
    const token = match[0];
    const className = token.startsWith('//')
      ? 'text-slate-500 italic'
      : /^["'`]/.test(token)
        ? 'text-emerald-300'
        : KEYWORDS.has(token)
          ? 'text-violet-300'
          : /^\d/.test(token)
            ? 'text-amber-300'
            : 'text-sky-200';
    parts.push(<span key={`${match.index}-${token}`} className={className}>{token}</span>);
    cursor = match.index + token.length;
  }

  if (cursor < line.length) parts.push(line.slice(cursor));
  return parts;
}

function CodeBlock({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<'code'> & { node?: unknown }) {
  const [copied, setCopied] = useState(false);
  const rawCode = String(children);
  const code = rawCode.replace(/\n$/, '');
  const codeLines = code.split('\n');
  const language = className?.match(/language-([\w-]+)/)?.[1];
  const isBlock = Boolean(language) || rawCode.includes('\n');

  if (!isBlock) {
    return (
      <code
        {...props}
        className="rounded-md border border-slate-700/70 bg-slate-900 px-1.5 py-0.5 font-mono text-[0.9em] text-sky-200"
      >
        {children}
      </code>
    );
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="my-4 max-w-full overflow-hidden rounded-xl border border-slate-700/80 bg-[#090d14] shadow-inner">
      <div className="flex h-9 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <Code2 className="h-3.5 w-3.5 text-sky-400" />
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={copyCode}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-slate-400 transition hover:bg-slate-800 hover:text-white"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="max-h-96 overflow-auto p-4 text-left font-mono text-[12px] leading-6 text-slate-200 [tab-size:2]">
        <code>
          {codeLines.map((line, index) => (
            <React.Fragment key={index}>
              {highlightLine(line)}
              {index < codeLines.length - 1 ? '\n' : null}
            </React.Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
}

function renderCitationChildren(
  children: React.ReactNode,
  citations: StoredCitation[],
  availableSourceIds: ReadonlySet<string>,
  onSelectCitation?: (citation: StoredCitation, evidence?: StoredCitation[]) => void,
  showInlineCitations = true,
  activeCitationId?: string | null,
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      if (!showInlineCitations) {
        return splitCitationMarkers(child).map((part) => (part.type === 'text' ? part.value : '')).join('');
      }
      return splitCitationMarkers(child).map((part, index) => {
        if (part.type === 'text') return part.value;
        const citation = citations[part.citationNumber - 1];
        const isAvailable = Boolean(citation && availableSourceIds.has(citation.sourceId));
        const evidenceKey = citation ? citationEvidenceKey(citation) : null;
        const isActive = Boolean(evidenceKey && evidenceKey === activeCitationId);
        return (
          <button
            key={`${part.citationNumber}-${index}`}
            type="button"
            data-citation-key={evidenceKey ?? undefined}
            disabled={!isAvailable}
            onClick={() => isAvailable && citation && onSelectCitation?.(citation, citations)}
            title={isAvailable ? citation!.title : 'Cited source is no longer available'}
            aria-label={isAvailable ? `Open citation ${part.citationNumber}: ${citation!.title}` : `Citation ${part.citationNumber}: source unavailable`}
            className={`mx-0.5 inline-flex translate-y-[-0.08em] items-center rounded-md border border-cyan-500/30 bg-cyan-400/[0.08] px-1.5 py-0.5 align-baseline text-[0.72em] font-semibold leading-none text-cyan-200 transition-all duration-150 hover:border-cyan-400/55 hover:bg-cyan-400/[0.13] disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/60 disabled:text-slate-500 ${isActive ? ACTIVE_CITATION_CLASSNAME : ''}`}
          >
            {part.citationNumber}
          </button>
        );
      });
    }
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.props.children) {
      return React.cloneElement(child, {
        children: renderCitationChildren(child.props.children, citations, availableSourceIds, onSelectCitation, showInlineCitations, activeCitationId),
      });
    }
    return child;
  });
}

function createMarkdownComponents(
  citations: StoredCitation[],
  availableSourceIds: ReadonlySet<string>,
  onSelectCitation?: (citation: StoredCitation, evidence?: StoredCitation[]) => void,
  showInlineCitations = true,
  activeCitationId?: string | null,
): Components {
  const citationChildren = (children: React.ReactNode) => renderCitationChildren(children, citations, availableSourceIds, onSelectCitation, showInlineCitations, activeCitationId);
  return {
  h1: ({ children, ...props }) => <h1 {...props} className="mb-3 mt-6 text-xl font-bold tracking-tight text-white first:mt-0">{children}</h1>,
  h2: ({ children, ...props }) => <h2 {...props} className="mb-2.5 mt-5 text-lg font-bold text-white first:mt-0">{children}</h2>,
  h3: ({ children, ...props }) => <h3 {...props} className="mb-2 mt-4 text-base font-semibold text-slate-100 first:mt-0">{children}</h3>,
  p: ({ children, ...props }) => <p {...props} className="my-3 leading-7 text-slate-200 first:mt-0 last:mb-0">{citationChildren(children)}</p>,
  ul: ({ children, ...props }) => <ul {...props} className="my-3 list-disc space-y-1.5 pl-5 marker:text-sky-400">{children}</ul>,
  ol: ({ children, ...props }) => <ol {...props} className="my-3 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-sky-400">{children}</ol>,
  li: ({ children, ...props }) => <li {...props} className="pl-1.5 leading-7 text-slate-200">{citationChildren(children)}</li>,
  blockquote: ({ children, ...props }) => <blockquote {...props} className="my-4 border-l-2 border-sky-500 bg-sky-950/20 px-4 py-2 text-slate-300">{children}</blockquote>,
  a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="font-medium text-sky-300 underline decoration-sky-500/40 underline-offset-4 transition hover:text-sky-200">{children}</a>,
  hr: (props) => <hr {...props} className="my-6 border-slate-700/80" />,
  table: ({ children, ...props }) => (
    <div className="my-4 max-w-full overflow-x-auto rounded-xl border border-slate-700/80">
      <table {...props} className="w-full min-w-[32rem] border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => <thead {...props} className="bg-slate-900 text-slate-200">{children}</thead>,
  th: ({ children, ...props }) => <th {...props} className="border-b border-slate-700 px-3 py-2.5 font-semibold">{children}</th>,
  td: ({ children, ...props }) => <td {...props} className="border-b border-slate-800 px-3 py-2.5 align-top text-slate-300">{children}</td>,
  pre: ({ children }) => <>{children}</>,
  code: CodeBlock,
  };
}

const GENERAL_STARTER_PROMPTS = [
  { label: 'Explain a concept', icon: BookOpen },
  { label: 'Build a learning roadmap', icon: Route },
  { label: 'Compare two technologies', icon: GitCompare },
];

const INDEXED_STARTER_PROMPTS = [
  { label: 'Summarize my sources', icon: FileText },
  { label: 'Quiz me from this Workspace', icon: HelpCircle },
  { label: 'What should I learn first?', icon: ListChecks },
];

function formatCitationLocation(citation: StoredCitation) {
  if (citation.page) return `Page ${citation.page}`;
  if (citation.timestampStartMs != null) {
    const start = formatCitationTimestamp(citation.timestampStartMs);
    if (citation.timestampEndMs != null && citation.timestampEndMs > citation.timestampStartMs) {
      return `${start} - ${formatCitationTimestamp(citation.timestampEndMs)}`;
    }
    return start;
  }
  return citation.kind === 'WEB' ? 'Web' : 'Source';
}

export function WorkspaceChatArea({
  messages,
  isGenerating,
  streamingText,
  streamingCitations,
  streamingResponseMode,
  toolExecutions = [],
  streamingWebSources = [],
  generationStatusLabel,
  regeneratingMessageId,
  activeCitationId,
  error,
  loadingHistory,
  sourceCount,
  readySourceCount,
  processingSourceCount,
  sources,
  hasIndexedSources,
  onSelectCitation,
  onSubmitMessage,
  onClearHistory,
  onDeleteQuery,
  onRegenerateResponse,
  onOpenAddSource,
}: WorkspaceChatAreaProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<string | null>(null);
  const deleteButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const { inlineCitations } = useLearningPreferences();
  const availableSourceIds = useMemo(
    () => new Set(sources.map(({ id }) => id)),
    [sources],
  );
  const streamingMarkdownComponents = useMemo(
    () => createMarkdownComponents(streamingCitations, availableSourceIds, onSelectCitation, inlineCitations, activeCitationId),
    [streamingCitations, availableSourceIds, onSelectCitation, inlineCitations, activeCitationId],
  );

  // Real, non-fabricated staged-loading timing: how long we've actually
  // been waiting for the first chunk, ticked from a real Date.now() delta —
  // never a guessed/fabricated latency number.
  const isWaitingForFirstChunk = isGenerating && !streamingText;
  const [waitElapsedMs, setWaitElapsedMs] = useState(0);
  const waitStartedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isWaitingForFirstChunk) {
      waitStartedAtRef.current = null;
      setWaitElapsedMs(0);
      return;
    }
    if (waitStartedAtRef.current === null) waitStartedAtRef.current = Date.now();
    const interval = window.setInterval(() => {
      setWaitElapsedMs(Date.now() - (waitStartedAtRef.current ?? Date.now()));
    }, 200);
    return () => window.clearInterval(interval);
  }, [isWaitingForFirstChunk]);

  // Bi-directional citation highlight: whichever inline marker or footer
  // chip matches the Context Inspector's active selection scrolls into view
  // here too, regardless of which side the click originated from.
  useEffect(() => {
    if (!activeCitationId) return;
    const feed = feedRef.current;
    if (!feed) return;
    const target = feed.querySelector(`[data-citation-key="${activeCitationId}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeCitationId]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const frame = requestAnimationFrame(() => {
      const feed = feedRef.current;
      if (!feed) return;
      feed.scrollTo({ top: feed.scrollHeight, behavior: streamingText ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, streamingText, isGenerating]);

  const handleScroll = () => {
    const feed = feedRef.current;
    if (!feed) return;
    stickToBottomRef.current = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 120;
  };

  useEffect(() => {
    if (!pendingDeleteMessageId) return;
    const trigger = deleteButtonRefs.current[pendingDeleteMessageId];
    const frame = requestAnimationFrame(() => cancelDeleteRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPendingDeleteMessageId(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      trigger?.focus();
    };
  }, [pendingDeleteMessageId]);

  const handleDeleteQuery = async (messageId: string) => {
    if (deletingMessageId || isGenerating) return;
    const feed = feedRef.current;
    const previousScrollTop = feed?.scrollTop ?? 0;
    setDeletingMessageId(messageId);
    try {
      const deleted = await onDeleteQuery(messageId);
      if (deleted) {
        requestAnimationFrame(() => {
          if (feedRef.current) feedRef.current.scrollTop = previousScrollTop;
        });
      }
    } finally {
      setDeletingMessageId(null);
      setPendingDeleteMessageId(null);
    }
  };

  const handleCopyMessage = async (message: StoredMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === message.id ? null : current));
      }, 1600);
    } catch {
      setCopiedMessageId(null);
    }
  };

  return (
    <div
      ref={feedRef}
      onScroll={handleScroll}
      className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2.5 sm:px-5 md:px-6"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <div className="mb-2 flex items-center justify-between gap-3 border-b border-slate-800/70 pb-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-400">
            <MessageSquare className="h-4 w-4 shrink-0 text-sky-400" />
            <span className="truncate font-semibold text-slate-300">Learning conversation</span>
            {readySourceCount > 0 && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                {readySourceCount} ready
              </span>
            )}
            {processingSourceCount > 0 && (
              <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {processingSourceCount} processing
              </span>
            )}
            {sourceCount === 0 && (
              <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-500">No sources yet</span>
            )}
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              disabled={isGenerating || Boolean(deletingMessageId)}
              className="flex w-fit items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition hover:border-rose-900 hover:bg-rose-950/40 hover:text-rose-300"
              aria-label="Clear chat history"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear history</span>
            </button>
          )}
        </div>

        <div className="flex-1 space-y-1" aria-live="polite">
          {processingSourceCount > 0 && (
            <div className="mb-5 overflow-hidden rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] px-4 py-3 animate-fade-in">
              <div className="flex items-center gap-2 text-xs font-medium text-cyan-200">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-cyan-300" />
                <span>Ingesting Knowledge Sources — Extracting tokens &amp; building vector embeddings…</span>
              </div>
              <span className="pipeline-beam mt-2.5 w-full" aria-hidden="true">
                <span className="pipeline-beam-fill" />
              </span>
            </div>
          )}
          {error && (
            <div role="alert" className="mb-5 rounded-xl border border-rose-900/70 bg-rose-950/30 px-4 py-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          {loadingHistory && (
            <div aria-busy="true" aria-label="Loading conversation" className="flex min-h-[340px] items-center justify-center py-8">
              <div className="w-full max-w-2xl space-y-4">
                {[1, 2, 3].map((item) => <div key={item} className={`animate-pulse rounded-2xl border border-slate-800/70 bg-slate-900/45 ${item === 2 ? 'ml-auto h-20 max-w-[72%]' : 'h-12 max-w-[86%]'}`} />)}
              </div>
            </div>
          )}

          {messages.length === 0 && !isGenerating && !loadingHistory && !error && (
            <div className="flex min-h-[340px] items-center justify-center py-8 text-center">
              <div className="w-full max-w-xl rounded-2xl border border-cyan-500/20 bg-slate-900/40 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-400"><Sparkles className="h-5 w-5" /></div>
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">{hasIndexedSources ? 'Learn from this Workspace' : 'Start learning with Lumora'}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-300">{hasIndexedSources ? 'Ask about your sources, then use the evidence in Context to go deeper.' : 'Ask anything now, or add sources when you want grounded learning with citations.'}</p>
                {!hasIndexedSources && (
                  <button type="button" onClick={onOpenAddSource} className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                    <Plus className="h-3.5 w-3.5" /> Add your first source
                  </button>
                )}
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {(hasIndexedSources ? INDEXED_STARTER_PROMPTS : GENERAL_STARTER_PROMPTS).map(({ label, icon: Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onSubmitMessage(label)}
                      className="group inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-200 shadow-sm transition-all hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-cyan-300 hover:shadow-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      <Icon className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-cyan-300" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((message, index) => {
            const isUser = message.role === 'USER';
            const messageCitations = citationsForResponse(
              message.responseMode,
              message.citations,
            );
            const previousMessage = messages[index - 1];
            const startsGroup = !previousMessage || previousMessage.role !== message.role;

            return (
              <article
                key={message.id}
              className={`group/message flex items-start gap-2.5 text-xs sm:gap-3 md:text-sm ${
                  isUser ? 'justify-end' : 'justify-start'
                } ${startsGroup ? 'pt-4' : 'pt-1.5'} animate-fade-in`}
              >
                {!isUser && (
                  <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-800 bg-sky-950 text-sky-300 shadow-md ${startsGroup ? '' : 'invisible'}`}>
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`min-w-0 max-w-[calc(100%-2.625rem)] rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 ${
                    isUser
                      ? 'rounded-tr-sm border border-slate-700/60 bg-gradient-to-br from-slate-800/95 to-slate-900/90 font-medium text-slate-100 shadow-lg shadow-black/20 sm:max-w-[78%] md:max-w-[72%]'
                      : 'w-full rounded-tl-md border border-transparent bg-transparent pl-1 text-slate-200 sm:max-w-[calc(100%-2.75rem)] sm:pr-1'
                  }`}
                >
                  {isUser ? (
                    <div>
                      <p className="whitespace-pre-wrap break-words leading-6">{message.content}</p>
                      <div className="relative mt-2 flex justify-end gap-1 border-t border-cyan-500/15 pt-2 opacity-70 transition-opacity duration-150 sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100">
                        {copiedMessageId === message.id && (
                          <span className="animate-fade-in absolute -top-7 right-0 whitespace-nowrap rounded-md border border-emerald-700/50 bg-emerald-950/95 px-2 py-1 text-[10px] font-medium text-emerald-300 shadow-lg" role="status">
                            Copied!
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleCopyMessage(message)}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-slate-400 transition-colors hover:bg-cyan-400/10 hover:text-cyan-100"
                          aria-label="Copy user message"
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {copiedMessageId === message.id ? 'Copied' : 'Copy'}
                        </button>
                        <button
                          ref={(element) => { deleteButtonRefs.current[message.id] = element; }}
                          type="button"
                          onClick={() => setPendingDeleteMessageId(message.id)}
                          disabled={isGenerating || Boolean(deletingMessageId)}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-slate-400 transition-colors hover:bg-rose-400/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Delete this query and its response"
                        >
                          <Trash2 className="h-3 w-3" />
                          {deletingMessageId === message.id ? 'Deleting…' : 'Delete'}
                        </button>
                        {pendingDeleteMessageId === message.id && (
                          <div role="dialog" aria-label="Delete this conversation turn" className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-rose-900/60 bg-[#151b27] p-4 text-left shadow-2xl shadow-black/50 sm:absolute sm:bottom-full sm:right-0 sm:left-auto sm:mb-2 sm:w-72">
                            <p className="text-xs font-semibold text-white">Delete this conversation turn?</p>
                            <p className="mt-1 text-[11px] leading-5 text-slate-400">This will remove your question and Lumora&apos;s response.</p>
                            <div className="mt-3 flex justify-end gap-2"><button ref={cancelDeleteRef} type="button" onClick={() => setPendingDeleteMessageId(null)} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">Cancel</button><button type="button" onClick={() => void handleDeleteQuery(message.id)} className="rounded-lg border border-rose-800/70 bg-rose-950/55 px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 transition hover:bg-rose-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">Delete</button></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {message.responseMode === 'GENERAL' ? (
                            <Globe className="h-3 w-3 text-violet-400" />
                          ) : message.responseMode === 'GROUNDED' ? (
                            <ShieldCheck className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Clock3 className="h-3 w-3 text-slate-500" />
                          )}
                          <span>{getResponseModeDisclosure(message.responseMode)}</span>
                        </div>
                        {message.mode && (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            <Sparkles className="h-3 w-3 text-sky-400" />
                            <span>{message.mode.toLowerCase()} synthesis</span>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 max-w-[44rem] break-words text-xs md:text-sm">
                        <Markdown components={createMarkdownComponents(messageCitations, availableSourceIds, onSelectCitation, inlineCitations, activeCitationId)}>{message.content}</Markdown>
                      </div>

                      <LearningResourceSection resources={message.resourceRecommendations || []} />

                      {inlineCitations && messageCitations.length > 0 && (
                        <div className="mt-5 space-y-2 border-t border-slate-800/60 pt-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                            <span>
                              Grounded in {messageCitations.filter(({ sourceId }) => availableSourceIds.has(sourceId)).length} available Workspace {messageCitations.filter(({ sourceId }) => availableSourceIds.has(sourceId)).length === 1 ? 'source' : 'sources'}
                              {messageCitations.some(({ sourceId }) => !availableSourceIds.has(sourceId)) ? ' · historical source unavailable' : ''}
                            </span>
                          </div>
                          <div className="no-scrollbar flex max-w-full snap-x gap-2 overflow-x-auto pb-1">
                            {messageCitations.map((citation, citationIndex) => {
                              const source = sources.find((item) => item.id === citation.sourceId);
                              const surface = !source
                                ? 'border-slate-800 bg-slate-900/60 text-slate-500'
                                : source.type === 'PDF'
                                ? 'border-rose-900/70 bg-rose-950/25 hover:border-rose-700/70'
                                : source.type === 'YOUTUBE'
                                  ? 'border-red-900/70 bg-red-950/25 hover:border-red-700/70'
                                  : source.type === 'TEXT'
                                    ? 'border-violet-900/70 bg-violet-950/25 hover:border-violet-700/70'
                                    : 'border-sky-900/70 bg-sky-950/25 hover:border-sky-700/70';
                              const evidenceKey = citationEvidenceKey(citation);
                              const isActive = evidenceKey === activeCitationId;
                              return <button
                                key={citation.id || citationIndex}
                                type="button"
                                data-citation-key={evidenceKey}
                                onClick={() => source && onSelectCitation?.(citation, messageCitations)}
                                disabled={!source}
                                title={source ? citation.snippet : 'This source has been deleted or is unavailable.'}
                                className={`group flex shrink-0 max-w-full snap-start items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[10px] text-slate-300 transition-all hover:text-white disabled:cursor-not-allowed disabled:hover:text-slate-500 ${surface} ${isActive ? ACTIVE_CITATION_CLASSNAME : ''}`}
                              >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-950/60">
                                  {source ? <SourceTypeIcon type={source.type} className="h-3 w-3" /> : <FileText className="h-3 w-3 text-slate-600" />}
                                </span>
                                <span className="max-w-[10rem] truncate font-medium sm:max-w-[14rem]">{citation.title}</span>
                                <span className="shrink-0 font-mono text-[10px] text-slate-500">
                                  {source && citation.timestampStartMs != null && <Clock3 className="mr-0.5 inline h-2.5 w-2.5 -translate-y-px" />}
                                  {source ? formatCitationLocation(citation) : 'Source unavailable'}
                                </span>
                                {source && <ExternalLink className="h-3 w-3 shrink-0 text-slate-500 transition group-hover:text-sky-400" />}
                              </button>;
                            })}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex gap-1 border-t border-slate-800/50 pt-2 opacity-75 transition-opacity duration-150 sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100">
                        <button
                          type="button"
                          onClick={() => void handleCopyMessage(message)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-slate-400 transition hover:bg-slate-900 hover:text-sky-300"
                          aria-label="Copy assistant response"
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copiedMessageId === message.id ? 'Copied' : 'Copy'}
                        </button>
                        {message.parentMessageId && (
                          <button
                            type="button"
                            onClick={() => onRegenerateResponse(message)}
                            disabled={isGenerating || Boolean(deletingMessageId)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-slate-400 transition hover:bg-slate-900 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Regenerate this assistant response"
                          >
                            <RotateCcw
                              className={`h-3.5 w-3.5 ${
                                regeneratingMessageId === message.id
                                  ? 'animate-spin'
                                  : ''
                              }`}
                            />
                            {regeneratingMessageId === message.id
                              ? 'Regenerating…'
                              : 'Regenerate'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 shadow-sm ${startsGroup ? '' : 'invisible'}`}>
                    <User className="h-4 w-4" />
                  </div>
                )}
              </article>
            );
          })}

          {isGenerating && (
            <article className="flex items-start gap-2.5 pt-4 text-xs animate-fade-in sm:gap-3 md:text-sm">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-800 bg-sky-950 text-sky-300 shadow-md">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0 max-w-[calc(100%-2.625rem)] flex-1 rounded-2xl rounded-tl-md border border-cyan-800/30 bg-cyan-950/[0.07] px-4 py-3.5 text-slate-200 shadow-[0_12px_30px_rgba(0,0,0,0.12)] sm:px-5 sm:py-4">
                {streamingResponseMode && (
                  <div
                    className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                    aria-label={`Response source: ${getResponseModeDisclosure(streamingResponseMode)}`}
                  >
                    {streamingResponseMode === 'GENERAL' ? (
                      <Globe className="h-3 w-3 text-violet-400" />
                    ) : (
                      <ShieldCheck className="h-3 w-3 text-emerald-400" />
                    )}
                    <span>{getResponseModeDisclosure(streamingResponseMode)}</span>
                  </div>
                )}
                {toolExecutions.length > 0 && (
                  <div
                    className="mb-3 flex flex-wrap gap-2"
                    aria-label="AI tool execution status"
                  >
                    {toolExecutions.map((execution) => (
                      <span
                        key={execution.requestId}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-800/60 bg-violet-950/30 px-2 py-1 text-[10px] font-medium text-violet-200"
                      >
                        <Sparkles
                          className={`h-3 w-3 ${
                            execution.status === 'running' ? 'animate-pulse' : ''
                          }`}
                        />
                        {execution.toolName === 'tavily_search'
                          ? execution.status === 'running'
                            ? 'Searching the web'
                            : 'Web search'
                          : execution.toolName}
                        <span className="text-violet-400">
                          {execution.status === 'completed'
                            ? 'complete'
                            : execution.status.replace('_', ' ')}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                {streamingWebSources.length > 0 && (
                  <div className="mb-3 rounded-xl border border-sky-900/70 bg-sky-950/20 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                      <Globe className="h-3.5 w-3.5" />
                      <span>External web sources</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {streamingWebSources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-sky-900/70 bg-slate-950/60 px-2 py-1 text-[10px] text-sky-200 transition hover:border-sky-700 hover:text-white"
                        >
                          <span className="max-w-[14rem] truncate">{source.title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {streamingText ? (
                  <div className="min-w-0 break-words text-xs md:text-sm">
                    <Markdown components={streamingMarkdownComponents}>{streamingText}</Markdown>
                    <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-sky-400 align-middle" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex min-h-7 items-center gap-2.5 text-xs text-sky-300">
                      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
                      </span>
                      <span>{generationStatusLabel || 'Thinking…'}</span>
                      <span className="font-mono text-[10px] text-slate-500" title="Real elapsed time since this request started">
                        {(waitElapsedMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="space-y-1.5" aria-hidden="true">
                      {[70, 85, 55].map((width, index) => (
                        <div
                          key={index}
                          className="h-2.5 animate-pulse rounded-full bg-slate-800/70"
                          style={{ width: `${width}%`, animationDelay: `${index * 150}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {inlineCitations && streamingCitations.length > 0 && (
                  <div className="mt-4 border-t border-slate-800/80 pt-3">
                    <div className="flex flex-wrap gap-2">
                      {streamingCitations.map((citation, index) => (
                        <span key={citation.id || index} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] text-slate-400">
                          <Clock3 className="h-3 w-3 shrink-0 text-sky-400" />
                          <span className="max-w-[12rem] truncate">{citation.title}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
