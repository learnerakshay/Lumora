import React, { useEffect, useRef, useState } from 'react';
import Markdown, { type Components } from 'react-markdown';
import {
  ArrowUpRight,
  Bot,
  Check,
  Clock3,
  Code2,
  Compass,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { StoredCitation, StoredMessage } from '../../lib/chat/conversation-store';

interface WorkspaceChatAreaProps {
  messages: StoredMessage[];
  isGenerating: boolean;
  streamingText: string;
  streamingCitations: StoredCitation[];
  error?: string | null;
  hasIndexedSources: boolean;
  sourceCount: number;
  processingSourceCount: number;
  onSelectCitation?: (citation: StoredCitation) => void;
  onSubmitMessage: (prompt: string) => void;
  onClearHistory: () => void;
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

const markdownComponents: Components = {
  h1: ({ children, ...props }) => <h1 {...props} className="mb-3 mt-6 text-xl font-bold tracking-tight text-white first:mt-0">{children}</h1>,
  h2: ({ children, ...props }) => <h2 {...props} className="mb-2.5 mt-5 text-lg font-bold text-white first:mt-0">{children}</h2>,
  h3: ({ children, ...props }) => <h3 {...props} className="mb-2 mt-4 text-base font-semibold text-slate-100 first:mt-0">{children}</h3>,
  p: ({ children, ...props }) => <p {...props} className="my-2 leading-7 text-slate-200 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children, ...props }) => <ul {...props} className="my-3 list-disc space-y-1.5 pl-5 marker:text-sky-400">{children}</ul>,
  ol: ({ children, ...props }) => <ol {...props} className="my-3 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-sky-400">{children}</ol>,
  li: ({ children, ...props }) => <li {...props} className="pl-1 leading-7 text-slate-200">{children}</li>,
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
  error,
  hasIndexedSources,
  sourceCount,
  processingSourceCount,
  onSelectCitation,
  onSubmitMessage,
  onClearHistory,
}: WorkspaceChatAreaProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const assistantMessages = messages.filter((message) => message.role === 'ASSISTANT').length;
  const latestActivity = messages.at(-1)?.createdAt;

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

  const starterQuestions = [
    'Summarize key insights across all Workspace sources',
    'What are the main technical specifications or findings?',
    'Compare architectural trade-offs mentioned in the sources',
    'Extract critical conclusions and actionable recommendations',
  ];

  return (
    <div
      ref={feedRef}
      onScroll={handleScroll}
      className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4 sm:px-5 md:px-6"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
            <MessageSquare className="h-4 w-4 shrink-0 text-sky-400" />
            <span className="truncate font-semibold text-slate-300">Grounded research thread</span>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="flex w-fit items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition hover:border-rose-900 hover:bg-rose-950/40 hover:text-rose-300"
              aria-label="Clear chat history"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear history</span>
            </button>
          )}
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Sources', value: sourceCount },
            { label: 'Responses', value: assistantMessages },
            { label: 'Processing', value: processingSourceCount },
            {
              label: 'Recent activity',
              value: latestActivity
                ? new Date(latestActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'New',
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-800/80 bg-slate-900/45 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{stat.label}</p>
              <p className="mt-1 truncate text-sm font-semibold tabular-nums text-slate-200">{stat.value}</p>
            </div>
          ))}
        </div>

        {messages.length === 0 && hasIndexedSources && (
          <div className="my-auto space-y-5 py-6 animate-fade-in">
            <div className="mx-auto max-w-lg text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-800/60 bg-sky-950/70 text-sky-300">
                <Compass className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-white">Start exploring your knowledge</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">Choose a prompt or ask your own question below.</p>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {starterQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => onSubmitMessage(question)}
                  className="group flex min-h-20 items-start justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/65 p-4 text-left text-xs leading-5 text-slate-300 transition duration-200 hover:-translate-y-0.5 hover:border-sky-500/50 hover:bg-slate-900 hover:text-white"
                >
                  <span>{question}</span>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-sky-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 space-y-1" aria-live="polite">
          {error && (
            <div role="alert" className="mb-5 rounded-xl border border-rose-900/70 bg-rose-950/30 px-4 py-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          {messages.map((message, index) => {
            const isUser = message.role === 'USER';
            const previousMessage = messages[index - 1];
            const startsGroup = !previousMessage || previousMessage.role !== message.role;

            return (
              <article
                key={message.id}
                className={`flex items-start gap-2.5 text-xs sm:gap-3 md:text-sm ${
                  isUser ? 'justify-end' : 'justify-start'
                } ${startsGroup ? 'pt-5' : 'pt-2'} animate-fade-in`}
              >
                {!isUser && (
                  <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-800 bg-sky-950 text-sky-300 shadow-md ${startsGroup ? '' : 'invisible'}`}>
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`min-w-0 max-w-[calc(100%-2.625rem)] rounded-2xl px-4 py-3.5 sm:max-w-[88%] sm:px-5 sm:py-4 md:max-w-[82%] ${
                    isUser
                      ? 'rounded-tr-md bg-sky-600 font-medium text-white shadow-md shadow-sky-900/20'
                      : 'rounded-tl-md border border-slate-800/90 bg-[#121824] text-slate-200 shadow-xl shadow-black/10'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap break-words leading-6">{message.content}</p>
                  ) : (
                    <div>
                      {message.mode && (
                        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          <Sparkles className="h-3 w-3 text-sky-400" />
                          <span>{message.mode.toLowerCase()} synthesis</span>
                        </div>
                      )}

                      <div className="min-w-0 break-words text-xs md:text-sm">
                        <Markdown components={markdownComponents}>{message.content}</Markdown>
                      </div>

                      {message.citations && message.citations.length > 0 && (
                        <div className="mt-4 space-y-2.5 border-t border-slate-800/80 pt-3.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                            <span>{message.citations.length} grounded {message.citations.length === 1 ? 'source' : 'sources'}</span>
                          </div>
                          <div className="flex max-w-full flex-wrap gap-2">
                            {message.citations.map((citation, citationIndex) => (
                              <button
                                key={citation.id || citationIndex}
                                type="button"
                                onClick={() => onSelectCitation?.(citation)}
                                title={citation.snippet}
                                className="group flex max-w-full items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900 px-2.5 py-1.5 text-left text-[11px] text-slate-300 transition hover:border-sky-500/60 hover:bg-slate-800 hover:text-white"
                              >
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${citation.kind === 'WEB' ? 'bg-sky-950 text-sky-400' : 'bg-emerald-950 text-emerald-400'}`}>
                                  {citation.kind === 'WEB' ? <Globe className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                                </span>
                                <span className="max-w-[12rem] truncate font-medium sm:max-w-[16rem]">{citation.title}</span>
                                <span className="shrink-0 text-[10px] text-slate-500">{formatCitationLocation(citation)}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 text-slate-500 transition group-hover:text-sky-400" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
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
            <article className="flex items-start gap-2.5 pt-5 text-xs animate-fade-in sm:gap-3 md:text-sm">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-800 bg-sky-950 text-sky-300 shadow-md">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0 max-w-[calc(100%-2.625rem)] rounded-2xl rounded-tl-md border border-sky-800/50 bg-[#121824] px-4 py-3.5 text-slate-200 shadow-xl sm:max-w-[88%] sm:px-5 sm:py-4 md:max-w-[82%]">
                {streamingText ? (
                  <div className="min-w-0 break-words text-xs md:text-sm">
                    <Markdown components={markdownComponents}>{streamingText}</Markdown>
                    <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-sky-400 align-middle" />
                  </div>
                ) : (
                  <div className="flex min-h-7 items-center gap-3 text-xs text-sky-300">
                    <div className="flex items-center gap-1" aria-hidden="true">
                      {[0, 1, 2].map((dot) => (
                        <span key={dot} className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" style={{ animationDelay: `${dot * 140}ms` }} />
                      ))}
                    </div>
                    <span>Finding relevant context and preparing a grounded response…</span>
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
