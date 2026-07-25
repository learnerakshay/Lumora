import React, { useState } from 'react';
import {
  X,
  FileText,
  Globe,
  AlignLeft,
  Youtube,
  Subtitles,
  Upload,
  Info,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { SourceType, SourceRecord } from '../../lib/source-store';

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
    badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
  },
  {
    type: 'YOUTUBE',
    title: 'YouTube Video',
    description: 'Extract video transcripts, timestamps, and spoken audio knowledge.',
    icon: Youtube,
    badgeColor: 'text-red-400 bg-red-950/60 border-red-800/60',
  },
  {
    type: 'VTT',
    title: 'VTT Captions',
    description: 'Upload WebVTT subtitle tracks, video captions, or meeting transcript files.',
    icon: Subtitles,
    badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
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
  const [fileRawText, setFileRawText] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!titleInput) {
        setTitleInput(file.name);
      }

      // Read file content text
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFileRawText(event.target.result as string);
        }
      };
      reader.readAsText(file);
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
        finalSize = `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`;
        payloadRawContent = fileRawText || `[PDF Document: ${selectedFile.name}]`;
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
      if (!finalUrl || (!finalUrl.includes('youtube.com') && !finalUrl.includes('youtu.be'))) {
        setError('Please enter a valid YouTube link (e.g. https://www.youtube.com/watch?v=...)');
        return;
      }
      if (!finalTitle) {
        finalTitle = `YouTube Video (${finalUrl.substring(finalUrl.length - 11)})`;
      }
      finalSize = 'Auto Transcript';
    } else if (selectedType === 'VTT') {
      if (!selectedFile && !textContent && !finalUrl) {
        setError('Please upload a .vtt subtitle file, enter a URL, or paste caption text.');
        return;
      }
      if (!finalTitle) {
        finalTitle = selectedFile ? selectedFile.name : 'Subtitle_Captions.vtt';
      }
      if (selectedFile) {
        finalSize = `${(selectedFile.size / 1024).toFixed(1)} KB`;
        payloadRawContent = fileRawText || textContent;
      }
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

    try {
      setSubmitting(true);
      const res = await fetch(`/api/workspaces/${workspaceId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finalTitle,
          type: selectedType,
          url: finalUrl || null,
          fileSize: finalSize,
          rawContent: payloadRawContent,
          metadata: {
            uploadedAt: new Date().toISOString(),
            originalFileName: selectedFile?.name || null,
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
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
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitleInput('');
    setUrlInput('');
    setTextContent('');
    setSelectedFile(null);
    setFileRawText(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-[#121824] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div>
            <h2 className="text-base font-bold text-white">Add Knowledge Source</h2>
            <p className="text-xs text-slate-400">
              Ingest, chunk, and generate vector embeddings for your workspace.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Source Type Grid */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              1. Choose Source Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
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
                    }}
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
              <label className="text-xs font-semibold text-slate-300">2. Configure Ingestion</label>
            </div>

            {error && (
              <div className="flex items-center space-x-2 p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Custom Title Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">
                Source Title <span className="text-slate-500">(Optional - auto-generated if blank)</span>
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
                      accept=".pdf,.txt"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-300 font-medium">
                      {selectedFile ? selectedFile.name : 'Click or drop PDF document here'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Supports documents up to 25MB</p>
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-500 uppercase font-mono tracking-wider">
                  — or enter PDF web URL —
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
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-400">YouTube Video URL</label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            )}

            {selectedType === 'VTT' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-400">WebVTT Subtitle File</label>
                  <div className="relative border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-xl p-3 text-center bg-slate-900/40 transition-colors">
                    <input
                      type="file"
                      accept=".vtt,.txt"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Subtitles className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-300 font-medium">
                      {selectedFile ? selectedFile.name : 'Upload .vtt caption file'}
                    </p>
                  </div>
                </div>

                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={3}
                  placeholder="WEBVTT&#10;00:00:00.000 --> 00:00:05.000&#10;Welcome to Lumora AI Knowledge Operating System."
                  className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
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
                  className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 leading-relaxed font-mono"
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
                className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Ingestion...</span>
                  </>
                ) : (
                  <span>Add Knowledge Source</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
