import React, { useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import {
  Sparkles,
  User,
  Bot,
  Trash2,
  FileText,
  Globe,
  ExternalLink,
  MessageSquare,
  Compass,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { StoredMessage, StoredCitation } from '../../lib/chat/conversation-store';

interface WorkspaceChatAreaProps {
  messages: StoredMessage[];
  isGenerating: boolean;
  streamingText: string;
  streamingCitations: StoredCitation[];
  error?: string | null;
  hasIndexedSources: boolean;
  onSelectCitation?: (citation: StoredCitation) => void;
  onSubmitMessage: (prompt: string) => void;
  onClearHistory: () => void;
}

export function WorkspaceChatArea({
  messages,
  isGenerating,
  streamingText,
  streamingCitations,
  error,
  hasIndexedSources,
  onSelectCitation,
  onSubmitMessage,
  onClearHistory,
}: WorkspaceChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom as messages or streaming text updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, isGenerating]);

  const starterQuestions = [
    'Summarize key insights across all workspace sources',
    'What are the main technical specifications or findings?',
    'Compare architectural trade-offs mentioned in sources',
    'Extract critical conclusions and actionable recommendations',
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Top Controls Bar if messages exist */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 max-w-4xl mx-auto w-full">
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
            <span>RAG Grounded Research Thread</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-emerald-400">
              Isolated Workspace
            </span>
          </div>

          <button
            type="button"
            onClick={onClearHistory}
            className="px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-rose-400 bg-slate-900/80 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900 rounded-lg transition-colors flex items-center space-x-1.5"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      )}

      {/* Starter Chips when sources exist but no messages yet */}
      {messages.length === 0 && hasIndexedSources && (
        <div className="max-w-4xl mx-auto w-full space-y-4 py-4 animate-fade-in">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
            <Compass className="w-4 h-4 text-sky-400" />
            <span>Suggested Research Prompts</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {starterQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSubmitMessage(q)}
                className="p-3 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/50 rounded-xl text-left text-xs text-slate-300 hover:text-white transition-all flex items-center justify-between group shadow-sm"
              >
                <span>{q}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 transition-colors shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div className="max-w-4xl mx-auto w-full space-y-6 flex-1">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-900/70 bg-rose-950/30 px-4 py-3 text-xs text-rose-200"
          >
            {error}
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start space-x-3 text-xs md:text-sm animate-fade-in ${
              msg.role === 'USER' ? 'justify-end' : 'justify-start'
            }`}
          >
            {/* Assistant Avatar */}
            {msg.role === 'ASSISTANT' && (
              <div className="w-7 h-7 rounded-xl bg-sky-950 border border-sky-800 text-sky-300 flex items-center justify-center shrink-0 mt-1 shadow-md">
                <Bot className="w-4 h-4" />
              </div>
            )}

            {/* Message Content Bubble */}
            <div
              className={`max-w-[88%] space-y-3 p-4 rounded-2xl ${
                msg.role === 'USER'
                  ? 'bg-sky-600 text-white font-medium shadow-md shadow-sky-900/20'
                  : 'bg-[#121824] border border-slate-800/90 text-slate-200 shadow-xl'
              }`}
            >
              {msg.role === 'USER' ? (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              ) : (
                <div className="space-y-3">
                  {/* Mode Badge */}
                  {msg.mode && (
                    <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
                      <Sparkles className="w-3 h-3 text-sky-400" />
                      <span>{msg.mode} SYNTHESIS</span>
                    </div>
                  )}

                  {/* Markdown Content */}
                  <div className="prose prose-invert max-w-none text-xs md:text-sm leading-relaxed prose-p:my-1.5 prose-headings:text-white prose-headings:font-bold prose-headings:my-2 prose-code:bg-slate-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sky-300 prose-pre:bg-slate-950 prose-pre:p-3 prose-pre:rounded-xl prose-pre:border prose-pre:border-slate-800">
                    <Markdown>{msg.content}</Markdown>
                  </div>

                  {/* Citations Badges */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/80 space-y-2">
                      <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>Grounded Source Citations ({msg.citations.length})</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((cit, cIdx) => (
                          <button
                            key={cit.id || cIdx}
                            type="button"
                            onClick={() => onSelectCitation && onSelectCitation(cit)}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/60 text-[11px] text-slate-300 hover:text-sky-300 transition-all group"
                          >
                            {cit.kind === 'WEB' ? (
                              <Globe className="w-3 h-3 text-sky-400 shrink-0" />
                            ) : (
                              <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
                            )}
                            <span className="font-medium max-w-[180px] truncate">{cit.title}</span>
                            {cit.page && <span className="text-[10px] text-slate-500 font-mono">({cit.page})</span>}
                            <ExternalLink className="w-2.5 h-2.5 text-slate-500 group-hover:text-sky-400 shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Avatar */}
            {msg.role === 'USER' && (
              <div className="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {/* Live Streaming Response Bubble */}
        {isGenerating && (
          <div className="flex items-start space-x-3 text-xs md:text-sm animate-fade-in">
            <div className="w-7 h-7 rounded-xl bg-sky-950 border border-sky-800 text-sky-300 flex items-center justify-center shrink-0 mt-1 shadow-md">
              <Bot className="w-4 h-4 animate-spin" />
            </div>

            <div className="max-w-[88%] space-y-3 p-4 rounded-2xl bg-[#121824] border border-sky-800/60 text-slate-200 shadow-xl">
              {streamingText ? (
                <div className="prose prose-invert max-w-none text-xs md:text-sm leading-relaxed prose-p:my-1.5 prose-headings:text-white prose-code:bg-slate-900">
                  <Markdown>{streamingText}</Markdown>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-xs text-sky-400 font-mono py-1">
                  <div className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                  <span>Retrieving vector embeddings & synthesizing response...</span>
                </div>
              )}

              {/* Streaming Citations */}
              {streamingCitations.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Retrieved Sources ({streamingCitations.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {streamingCitations.map((cit, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono"
                      >
                        <span>{cit.title}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
