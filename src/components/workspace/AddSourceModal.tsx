import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  FileText,
  Globe,
  AlignLeft,
  Youtube,
  Upload,
  Info,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { SourceType, SourceRecord } from '../../lib/source-store';
import { canonicalizeYouTubeUrl, extractYouTubeVideoId } from '../../lib/ingestion/youtube-url';
import { YOUTUBE_INGESTION_GUIDANCE } from './youtube-source-ux';
import { UsageLimitNotice } from '../usage/UsageLimitNotice';
import { usageLimitFromPayload } from '../../lib/usage/client';
import type { UsageLimitDetails } from '../../lib/usage/types';
import { releaseSubmission, tryBeginSubmission } from './workspace-interactions';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onSourceAdded: (source: SourceRecord) => void;
  initialType?: SourceType;
}

interface SourceOption {
  type: SourceType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeColor: string;
}

const SOURCE_OPTIONS: SourceOption[] = [
  {
    type: 'PDF',
    title: 'PDF Document',
    description: 'Upload structured PDF documents, manuals, whitepapers, or research papers.',
    icon: FileText,
    badgeColor: 'text-rose-400 bg-rose-950/60 border-rose-800/60',
  },
  {
    type: 'WEBSITE',
    title: 'Website / Webpage',
    description: 'Ingest articles, documentation pages, blogs, or online knowledge bases.',
    icon: Globe,
    badgeColor: 'text-sky-400 bg-sky-950/60 border-sky-800/60',
  },
  {
    type: 'TEXT',
    title: 'Plain Text',
    description: 'Paste raw markdown notes, unstructured text snippets, or code documentation.',
    icon: AlignLeft,
    badgeColor: 'text-violet-400 bg-violet-950/60 border-violet-800/60',
  },
  {
    type: 'YOUTUBE',
    title: 'YouTube Video',
    description: 'Extract video transcripts, timestamps, and spoken audio knowledge.',
    icon: Youtube,
    badgeColor: 'text-red-400 bg-red-950/60 border-red-800/60',
  },
];

export function AddSourceModal({
  isOpen,
  onClose,
  workspaceId,
  onSourceAdded,
  initialType = 'PDF',
}: AddSourceModalProps) {
  const [selectedType, setSelectedType] = useState<SourceType>(initialType);
  const [titleInput, setTitleInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageLimit, setUsageLimit] = useState<UsageLimitDetails | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedType(initialType === 'VTT' ? 'PDF' : initialType);
    setError(null);
    setUsageLimit(null);
  }, [initialType, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!titleInput) {
        setTitleInput(file.name);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let finalTitle = titleInput.trim();
    let finalUrl = urlInput.trim();
    let finalSize = '0 KB';
    let payloadRawContent: string | undefined = textContent || undefined;

    if (selectedType === 'PDF') {
      if (!selectedFile && !finalUrl) {
        setError('Please select a PDF document file or enter a valid PDF URL.');
        return;
      }
      if (!finalTitle) {
        finalTitle = selectedFile ? selectedFile.name : finalUrl.split('/').pop() || 'Document.pdf';
      }
      if (selectedFile) {
        if (selectedFile.type !== 'application/pdf') {
          setError('The selected file is not a PDF.');
          return;
        }
        if (selectedFile.size > 20 * 1024 * 1024) {
          setError('PDF files cannot exceed 20 MB.');
          return;
        }
        finalSize = `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`;
        payloadRawContent = undefined;
      }
    } else if (selectedType === 'WEBSITE') {
      if (!finalUrl) {
        setError('Please enter a valid website URL starting with http:// or https://');
        return;
      }
      if (!finalTitle) {
        finalTitle = finalUrl.replace(/^https?:\/\//, '');
      }
      finalSize = 'Auto Ingest';
    } else if (selectedType === 'YOUTUBE') {
      const videoId = finalUrl ? extractYouTubeVideoId(finalUrl) : null;
      if (!videoId) {
        setError('Enter a valid YouTube video URL.');
        return;
      }
      finalUrl = canonicalizeYouTubeUrl(finalUrl)!;
      if (!finalTitle) {
        finalTitle = `YouTube Video (${videoId})`;
      }
      finalSize = 'Auto Transcript';
    } else if (selectedType === 'TEXT') {
      if (!textContent.trim()) {
        setError('Please paste or type text content for this source.');
        return;
      }
      if (!finalTitle) {
        finalTitle = textContent.trim().slice(0, 32) + '...';
      }
      finalSize = `${(textContent.length / 1024).toFixed(1)} KB`;
      payloadRawContent = textContent;
    }

    if (!tryBeginSubmission(submittingRef)) return;
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.set('title', finalTitle);
      formData.set('type', selectedType);
      if (finalUrl) formData.set('url', finalUrl);
      if (payloadRawContent) formData.set('rawContent', payloadRawContent);
      if (selectedFile) formData.set('file', selectedFile);
      formData.set(
        'metadata',
        JSON.stringify({
          uploadedAt: new Date().toISOString(),
          originalFileName: selectedFile?.name || null,
          clientReportedSize: finalSize,
        }),
      );

      const res = await fetch(`/api/workspaces/${workspaceId}/sources`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const limitError = usageLimitFromPayload(errJson);
        if (limitError) {
          setUsageLimit(limitError.details);
          return;
        }
        throw new Error(errJson.error?.message || 'Failed to add source.');
      }

      const payload = await res.json();
      if (payload.success && payload.data) {
        onSourceAdded(payload.data);
        handleClose();
      } else {
        throw new Error(payload.error?.message || 'Failed to create source.');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating source.');
    } finally {
      releaseSubmission(submittingRef);
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    releaseSubmission(submittingRef);
    setTitleInput('');
    setUrlInput('');
    setTextContent('');
    setSelectedFile(null);
    setError(null);
    setUsageLimit(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="add-source-title" className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-800 bg-[#121824] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div>
            <h2 id="add-source-title" className="text-base font-bold text-white">Add Knowledge Source</h2>
            <p className="text-xs text-slate-400">
              Add material Lumora can process and use in grounded answers.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close add source dialog"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
          {/* Source Type Grid */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              Choose a source type
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {SOURCE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => {
                      setSelectedType(opt.type);
                      setError(null);
                      setUsageLimit(null);
                    }}
                    aria-pressed={isSelected}
                    className={`flex flex-col p-3 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'bg-sky-950/50 border-sky-500/80 ring-1 ring-sky-500/50'
                        : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className={`p-1.5 rounded-lg border ${opt.badgeColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-bold text-white mb-0.5">{opt.title}</span>
                    <p className="text-[10px] text-slate-400 leading-tight">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source Configuration Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-800/80">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Source details</label>
            </div>

            {usageLimit && (
              <div className="overflow-hidden rounded-xl border border-amber-400/20">
                <UsageLimitNotice details={usageLimit} onDismiss={() => setUsageLimit(null)} />
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-center space-x-2 p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Custom Title Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">
                Source title <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="e.g. Lumora System Specs"
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Type Specific Fields */}
            {selectedType === 'PDF' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-400">PDF Document File</label>
                  <div className="relative border-2 border-dashed border-slate-800 hover:border-sky-500/50 rounded-xl p-4 text-center bg-slate-900/40 transition-colors">
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleFileChange}
                      aria-label="Choose PDF document"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-300 font-medium">
                      {selectedFile ? selectedFile.name : 'Choose a PDF document'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {selectedFile ? 'Ready to upload' : 'PDF only · Maximum size 20 MB'}
                    </p>
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-500 uppercase font-mono tracking-wider">
                  — or use a PDF URL —
                </div>

                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/document.pdf"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            )}

            {selectedType === 'WEBSITE' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-400">Webpage URL</label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://docs.lumora.ai/knowledge-operating-system"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            )}

            {selectedType === 'YOUTUBE' && (
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-slate-400">YouTube Video URL</label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
                <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-500">
                  <Info aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                  <span>{YOUTUBE_INGESTION_GUIDANCE}</span>
                </p>
              </div>
            )}

            {selectedType === 'TEXT' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-400">Plain Text / Markdown Snippet</label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={5}
                  placeholder="Paste documentation notes, specs, meeting transcripts, or text snippets here..."
                  className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 leading-relaxed"
                />
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border border-slate-800 hover:border-slate-700 text-xs text-slate-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center space-x-1.5 rounded-xl bg-cyan-300 px-5 py-2 text-xs font-semibold text-slate-950 shadow-sm shadow-cyan-500/10 transition-colors hover:bg-cyan-200 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Adding source...</span>
                  </>
                ) : (
                  <span>Add Source</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
