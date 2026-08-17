import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, FileType, Image as ImageIcon, Sparkles, Upload, X } from 'lucide-react';

const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const FORMAT_CHIPS: Array<{ label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { label: 'PDF', icon: FileType },
  { label: 'JPG / PNG / WEBP', icon: ImageIcon },
];

interface ResumeUploadPanelProps {
  selectedFile: File | null;
  resumeText: string;
  onFileSelect: (file: File | null) => void;
  onTextChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  submitting: boolean;
  submitError: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResumeUploadPanel({
  selectedFile,
  resumeText,
  onFileSelect,
  onTextChange,
  onSubmit,
  submitting,
  submitError,
}: ResumeUploadPanelProps) {
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [dragActive, setDragActive] = useState(false);
  const [localFileError, setLocalFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = (file: File) => {
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setLocalFileError('That file type is not supported. Upload a PDF, JPG, PNG, or WEBP.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setLocalFileError('That file is larger than 5 MB. Try a smaller file.');
      return;
    }
    setLocalFileError(null);
    onFileSelect(file);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) acceptFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  };

  const clearFile = () => {
    setLocalFileError(null);
    onFileSelect(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const canSubmit = Boolean(selectedFile) || resumeText.trim().length > 0;

  return (
    <motion.form
      layout
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="overflow-hidden rounded-2xl border border-slate-700/65 bg-gradient-to-br from-[#121b28] to-[#101722] shadow-[inset_0_1px_0_rgba(255,255,255,0.025),0_16px_36px_rgba(0,0,0,0.16)]"
    >
      <div className="flex items-center gap-1 border-b border-slate-800/80 p-1.5">
        {(['file', 'text'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMode(tab)}
            className={`relative flex-1 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
              mode === tab ? 'text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {mode === tab && (
              <motion.span
                layoutId="upload-tab-highlight"
                className="absolute inset-0 rounded-xl bg-cyan-300"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{tab === 'file' ? 'Upload file' : 'Paste text'}</span>
          </button>
        ))}
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          {mode === 'file' ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.16 }}
            >
              {selectedFile ? (
                <div className="flex items-center gap-3 rounded-xl border border-cyan-400/30 bg-cyan-400/[0.06] p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-300">
                    {selectedFile.type === 'application/pdf' ? <FileType className="h-4.5 w-4.5" /> : <ImageIcon className="h-4.5 w-4.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-100">{selectedFile.name}</p>
                    <p className="text-[10px] text-slate-500">{formatFileSize(selectedFile.size)} · ready to analyze</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    aria-label="Remove selected file"
                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-rose-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                    dragActive
                      ? 'border-cyan-300 bg-cyan-400/[0.08] scale-[1.01]'
                      : 'border-slate-700 hover:border-cyan-400/40 hover:bg-slate-900/40'
                  }`}
                >
                  <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={handleInputChange} />
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-300">
                    <Upload className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-sm font-semibold text-slate-100">Drop your resume here, or click to browse</span>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                    {FORMAT_CHIPS.map(({ label, icon: Icon }) => (
                      <span key={label} className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[10px] font-medium text-slate-400">
                        <Icon className="h-3 w-3" /> {label}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-600">One file · up to 5 MB</span>
                </label>
              )}
              {localFileError && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-300"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {localFileError}</p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="text"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.16 }}
            >
              <textarea
                value={resumeText}
                onChange={(event) => onTextChange(event.target.value)}
                placeholder="Paste the full text of your resume here…"
                rows={9}
                className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950/40 p-4 text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
              />
              <p className="mt-2 text-[10px] text-slate-600">Plain text works best — headings, bullet points, and line breaks are all fine.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {submitError && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex items-center gap-1.5 overflow-hidden text-xs text-rose-300"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {submitError}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          type="submit"
          disabled={submitting || !canSubmit}
          whileTap={canSubmit && !submitting ? { scale: 0.98 } : undefined}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/15 transition hover:from-cyan-200 hover:to-sky-300 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:shadow-none sm:w-auto sm:px-8"
        >
          {submitting ? (
            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
              <Sparkles className="h-4 w-4" />
            </motion.span>
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {submitting ? 'Analyzing your resume…' : 'Analyze resume'}
        </motion.button>
      </div>
    </motion.form>
  );
}
