import React, { useEffect, useMemo, useRef, useState } from 'react';
import Markdown, { type Components } from 'react-markdown';
import {
  Bot,
  Check,
  Clock3,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  MessageSquare,
  RotateCcw,
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
import { citationsForResponse } from './workspace-interactions';

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
  error?: string | null;
  sourceCount: number;
  processingSourceCount: number;
  sources: SourceRecord[];
  hasIndexedSources: boolean;
  onSelectCitation?: (citation: StoredCitation, evidence?: StoredCitation[]) => void;
  onSubmitMessage: (prompt: string) => void;
  onClearHistory: () => void;
  onDeleteQuery: (userMessageId: string) => Promise<boolean>;
  onRegenerateResponse: (assistantMessage: StoredMessage) => void;
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
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      return splitCitationMarkers(child).map((part, index) => {
        if (part.type === 'text') return part.value;
        const citation = citations[part.citationNumber - 1];
        const isAvailable = Boolean(citation && availableSourceIds.has(citation.sourceId));
        return (
          <button
            key={`${part.citationNumber}-${index}`}
            type="button"
            disabled={!isAvailable}
            onClick={() => isAvailable && citation && onSelectCitation?.(citation, citations)}
            title={isAvailable ? citation!.title : 'Cited source is no longer available'}
            aria-label={isAvailable ? `Open citation ${part.citationNumber}: ${citation!.title}` : `Citation ${part.citationNumber}: source unavailable`}
            className="mx-0.5 inline-flex translate-y-[-0.08em] items-center rounded-md border border-cyan-500/30 bg-cyan-400/[0.08] px-1.5 py-0.5 align-baseline text-[0.72em] font-semibold leading-none text-cyan-200 transition-colors duration-150 hover:border-cyan-400/55 hover:bg-cyan-400/[0.13] disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/60 disabled:text-slate-500"
          >
            {part.citationNumber}
          </button>
        );
      });
    }
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.props.children) {
      return React.cloneElement(child, {
        children: renderCitationChildren(child.props.children, citations, availableSourceIds, onSelectCitation),
      });
    }
    return child;
  });
}

function createMarkdownComponents(
  citations: StoredCitation[],
  availableSourceIds: ReadonlySet<string>,
  onSelectCitation?: (citation: StoredCitation, evidence?: StoredCitation[]) => void,
): Components {
  const citationChildren = (children: React.ReactNode) => renderCitationChildren(children, citations, availableSourceIds, onSelectCitation);
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

function formatCitationLocation(citation: StoredCitation) {
  if (citation.page) return `Page ${citation.page}`;
  if (citation.timestampStartMs != null) {
    const totalSeconds = Math.floor(citation.timestampStartMs / 1000);
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
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
  error,
  sourceCount,
  processingSourceCount,
  sources,
  hasIndexedSources,
  onSelectCitation,
  onSubmitMessage,
  onClearHistory,
  onDeleteQuery,
  onRegenerateResponse,
}: WorkspaceChatAreaProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const availableSourceIds = useMemo(
    () => new Set(sources.map(({ id }) => id)),
    [sources],
  );
  const streamingMarkdownComponents = useMemo(
    () => createMarkdownComponents(streamingCitations, availableSourceIds, onSelectCitation),
    [streamingCitations, availableSourceIds, onSelectCitation],
  );

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

  const handleDeleteQuery = async (messageId: string) => {
    if (deletingMessageId || isGenerating) return;
    if (
      !window.confirm(
        'Delete this query and its assistant response? This cannot be undone.',
      )
    ) {
      return;
    }
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
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
            <MessageSquare className="h-4 w-4 shrink-0 text-sky-400" />
            <span className="truncate font-semibold text-slate-300">Learning conversation</span>
            <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-500">{sourceCount} {sourceCount === 1 ? 'source' : 'sources'}</span>
            {processingSourceCount > 0 && <span className="inline-flex items-center gap-1.5 text-[10px] text-sky-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />{processingSourceCount} processing</span>}
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
          {error && (
            <div role="alert" className="mb-5 rounded-xl border border-rose-900/70 bg-rose-950/30 px-4 py-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          {messages.length === 0 && !isGenerating && (
            <div className="flex min-h-[340px] items-center justify-center py-8 text-center">
              <div className="w-full max-w-xl">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-800/60 bg-sky-950/40 text-sky-300"><Sparkles className="h-5 w-5" /></div>
                <h2 className="mt-4 text-xl font-semibold text-white">{hasIndexedSources ? 'What would you like to understand?' : 'Ask anything to get started'}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{hasIndexedSources ? 'Lumora uses strong matching Workspace evidence when available and clearly discloses general answers.' : 'Lumora can answer with general knowledge now. Add sources anytime for grounded answers with citations.'}</p>
                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {(hasIndexedSources
                    ? ['Summarize the key ideas', 'Explain the hardest concept', 'What should I learn first?']
                    : ['Build me a learning roadmap', 'Explain a difficult concept', 'Help me plan what to learn']).map((question) => (
                    <button key={question} type="button" onClick={() => onSubmitMessage(question)} className="rounded-xl border border-slate-800 bg-slate-900/55 px-3 py-3 text-left text-xs leading-5 text-slate-300 transition hover:border-sky-700/70 hover:bg-slate-900 hover:text-white">{question}</button>
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
                      ? 'rounded-tr-md border border-cyan-500/20 bg-[linear-gradient(145deg,rgba(8,145,178,0.2),rgba(15,23,42,0.78))] font-medium text-slate-100 shadow-[0_10px_28px_rgba(0,0,0,0.15)] sm:max-w-[78%] md:max-w-[72%]'
                      : 'w-full rounded-tl-md border border-transparent bg-transparent pl-1 text-slate-200 sm:max-w-[calc(100%-2.75rem)] sm:pr-1'
                  }`}
                >
                  {isUser ? (
                    <div>
                      <p className="whitespace-pre-wrap break-words leading-6">{message.content}</p>
                      <div className="mt-2 flex justify-end gap-1 border-t border-cyan-500/15 pt-2 opacity-70 transition-opacity duration-150 sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100">
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
                          type="button"
                          onClick={() => void handleDeleteQuery(message.id)}
                          disabled={isGenerating || Boolean(deletingMessageId)}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-slate-400 transition-colors hover:bg-rose-400/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Delete this query and its response"
                        >
                          <Trash2 className="h-3 w-3" />
                          {deletingMessageId === message.id ? 'Deleting…' : 'Delete'}
                        </button>
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
                        <Markdown components={createMarkdownComponents(messageCitations, availableSourceIds, onSelectCitation)}>{message.content}</Markdown>
                      </div>

                      {messageCitations.length > 0 && (
                        <div className="mt-5 space-y-2 border-t border-slate-800/60 pt-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                            <span>
                              Grounded in {messageCitations.filter(({ sourceId }) => availableSourceIds.has(sourceId)).length} available Workspace {messageCitations.filter(({ sourceId }) => availableSourceIds.has(sourceId)).length === 1 ? 'source' : 'sources'}
                              {messageCitations.some(({ sourceId }) => !availableSourceIds.has(sourceId)) ? ' · historical source unavailable' : ''}
                            </span>
                          </div>
                          <div className="flex max-w-full flex-wrap gap-2">
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
                              return <button
                                key={citation.id || citationIndex}
                                type="button"
                                onClick={() => source && onSelectCitation?.(citation, messageCitations)}
                                disabled={!source}
                                title={source ? citation.snippet : 'This source has been deleted or is unavailable.'}
                                className={`group flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[10px] text-slate-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:hover:text-slate-500 ${surface}`}
                              >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-950/60">
                                  {source ? <SourceTypeIcon type={source.type} className="h-3 w-3" /> : <FileText className="h-3 w-3 text-slate-600" />}
                                </span>
                                <span className="max-w-[12rem] truncate font-medium sm:max-w-[16rem]">{citation.title}</span>
                                <span className="shrink-0 text-[10px] text-slate-500">{source ? formatCitationLocation(citation) : 'Source unavailable'}</span>
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
                  <div className="flex min-h-7 items-center gap-3 text-xs text-sky-300">
                    <div className="flex items-center gap-1" aria-hidden="true">
                      {[0, 1, 2].map((dot) => (
                        <span key={dot} className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" style={{ animationDelay: `${dot * 140}ms` }} />
                      ))}
                    </div>
                    <span>
                      {generationStatusLabel || 'Finding relevant context and preparing a grounded response…'}
                    </span>
                  </div>
                )}

                {streamingCitations.length > 0 && (
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
