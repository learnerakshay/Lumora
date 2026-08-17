import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, FileType, Image as ImageIcon, Sparkles, Type, Upload, X } from 'lucide-react';

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
  usageCaption?: string | null;
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
  usageCaption,
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

  const switchMode = (tab: 'file' | 'text') => {
    setLocalFileError(null);
    setMode(tab);
  };

  const canSubmit = Boolean(selectedFile) || resumeText.trim().length > 0;
  const visibleError = localFileError || submitError;

  return (
    <motion.form
      layout
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="overflow-hidden rounded-2xl border border-slate-700/60 bg-[#101722] shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_16px_36px_rgba(0,0,0,0.18)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-5 pt-4">
        <div className="flex items-center gap-5">
          {(['file', 'text'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => switchMode(tab)}
              className={`relative flex items-center gap-1.5 pb-3 text-xs font-semibold transition ${
                mode === tab ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab === 'file' ? <Upload className="h-3.5 w-3.5" /> : <Type className="h-3.5 w-3.5" />}
              {tab === 'file' ? 'Upload file' : 'Paste text'}
              {mode === tab && (
                <motion.span
                  layoutId="upload-tab-underline"
                  className="absolute -bottom-px left-0 right-0 h-[2px] rounded-full bg-cyan-300"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
            </button>
          ))}
        </div>
        {usageCaption && <span className="pb-3 text-[10px] font-medium text-slate-500">{usageCaption}</span>}
      </div>

      <div className="p-5">
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
                <div className="flex items-center gap-3 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.05] p-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-300">
                    {selectedFile.type === 'application/pdf' ? <FileType className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
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
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
                    dragActive
                      ? 'border-cyan-300 bg-cyan-400/[0.07]'
                      : 'border-slate-700/80 hover:border-cyan-400/35 hover:bg-slate-900/40'
                  }`}
                >
                  <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={handleInputChange} />
                  <motion.span
                    animate={dragActive ? { scale: 1.08 } : { scale: 1 }}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-300"
                  >
                    <Upload className="h-4 w-4" />
                  </motion.span>
                  <span className="text-[13px] font-semibold text-slate-100">Drop your resume here, or click to browse</span>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {FORMAT_CHIPS.map(({ label, icon: Icon }) => (
                      <span key={label} className="inline-flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-900/60 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        <Icon className="h-2.5 w-2.5" /> {label}
                      </span>
                    ))}
                    <span className="text-[10px] text-slate-600">· up to 5 MB</span>
                  </div>
                </label>
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
                rows={7}
                className="w-full resize-none rounded-xl border border-slate-700/80 bg-slate-950/40 p-3.5 text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
              />
              <p className="mt-1.5 text-[10px] text-slate-600">Plain text works best — headings, bullet points, and line breaks are all fine.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {visibleError && (
            <motion.p
              key={visibleError}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex items-center gap-1.5 overflow-hidden rounded-lg border border-rose-800/50 bg-rose-950/25 px-3 py-2 text-xs text-rose-200"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {visibleError}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-5 flex items-center justify-end">
          <motion.button
            type="submit"
            disabled={submitting || !canSubmit}
            whileTap={canSubmit && !submitting ? { scale: 0.98 } : undefined}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-sm font-semibold text-slate-950 shadow-md shadow-cyan-500/10 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none sm:w-auto sm:px-7"
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
      </div>
    </motion.form>
  );
}
