import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, FileType, Image as ImageIcon, Loader2, Sparkles, Type, Upload, X } from 'lucide-react';

const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const FORMAT_CHIPS: Array<{ label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { label: 'PDF', icon: FileType },
  { label: 'JPG / PNG / WEBP', icon: ImageIcon },
];

// Realistic sample resumes for a 1-click demo path — lets a judge or a new
// visitor see a full gap analysis without needing a local file to upload.
const SAMPLE_RESUMES: ReadonlyArray<{ emoji: string; label: string; text: string }> = [
  {
    emoji: '🚀',
    label: 'Senior React Engineer',
    text: `Priya Nair
Senior Frontend Engineer

EXPERIENCE
Senior Frontend Engineer — Zenith Retail (2021–Present)
- Led the migration of a 40k-line Angular app to React 18 + TypeScript, cutting bundle size by 35%.
- Built a component library used across 6 product teams, adopted with Storybook and visual regression tests.
- Owned performance budget: reduced Time to Interactive from 4.2s to 1.6s via code-splitting and route-based lazy loading.
- Mentored 4 junior engineers on React hooks, state management, and accessibility (WCAG 2.1 AA).

Frontend Engineer — Northwind Labs (2018–2021)
- Built real-time dashboards with React, Redux, and WebSockets for a logistics tracking product.
- Wrote Jest/React Testing Library suites, raising coverage from 40% to 85%.
- Integrated CI/CD via GitHub Actions for automated lint, test, and preview deploys.

SKILLS
React, TypeScript, Redux, Next.js, Tailwind CSS, Jest, React Testing Library, Webpack, Vite, GraphQL, REST APIs, Node.js, Git, CI/CD, Web Accessibility, Performance Optimization

EDUCATION
B.Tech in Computer Science — VIT Vellore (2018)`,
  },
  {
    emoji: '🤖',
    label: 'AI/ML Architect',
    text: `Arjun Mehta
AI / Machine Learning Architect

EXPERIENCE
ML Architect — Solstice AI (2020–Present)
- Designed and shipped a retrieval-augmented generation (RAG) pipeline serving 2M+ queries/month, using pgvector and OpenAI embeddings.
- Led model evaluation framework comparing GPT-4-class, Llama, and Mistral models on domain-specific benchmarks.
- Built a feature store and MLOps pipeline (MLflow, Airflow, Docker, Kubernetes) cutting model deployment time from weeks to days.
- Owned architecture for a multi-tenant vector search system handling 50M+ embeddings with sub-200ms latency.

Machine Learning Engineer — Vertex Analytics (2017–2020)
- Built fraud-detection models (XGBoost, LightGBM) reducing false positives by 22%.
- Productionized models via FastAPI microservices with A/B testing and shadow deployments.
- Trained and fine-tuned NLP models (BERT-family) for document classification.

SKILLS
Python, PyTorch, TensorFlow, LangChain, RAG, Vector Databases (pgvector, Pinecone), MLOps, Kubernetes, Docker, AWS SageMaker, Feature Engineering, Distributed Training, LLM Fine-tuning, SQL

EDUCATION
M.S. in Computer Science, Machine Learning — IIIT Hyderabad (2017)`,
  },
  {
    emoji: '📊',
    label: 'Lead Data Scientist',
    text: `Sara Thomas
Lead Data Scientist

EXPERIENCE
Lead Data Scientist — Meridian Health Analytics (2019–Present)
- Led a team of 5 data scientists building predictive models for patient readmission risk, improving recall by 18%.
- Designed the org's experimentation framework (A/B testing, causal inference) adopted by 3 product lines.
- Built end-to-end pipelines in Python/SQL processing 500GB+ of clinical data daily via Airflow and dbt.
- Presented quarterly insights to executive leadership, directly informing a $2M resource allocation decision.

Data Scientist — Bright Path Insurance (2016–2019)
- Built churn-prediction models (Random Forest, Gradient Boosting) improving retention campaign ROI by 30%.
- Automated reporting dashboards in Tableau, replacing 15 hours/week of manual analyst work.
- Partnered with engineering to productionize models via batch scoring jobs.

SKILLS
Python, R, SQL, Pandas, Scikit-learn, XGBoost, A/B Testing, Causal Inference, Statistical Modeling, Tableau, Airflow, dbt, Data Storytelling, Stakeholder Communication

EDUCATION
M.S. in Statistics — Indian Statistical Institute (2016)`,
  },
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
      className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#101621]/90 shadow-2xl backdrop-blur-2xl"
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
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all duration-300 ${
                    dragActive
                      ? 'border-cyan-300 bg-cyan-400/[0.07]'
                      : 'dropzone-breathing border-slate-700/80 hover:border-cyan-500/60 hover:bg-slate-900/60'
                  }`}
                >
                  <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={handleInputChange} />
                  <motion.span
                    animate={{ scale: dragActive ? 1.08 : 1, y: [0, -4, 0] }}
                    transition={{ y: { repeat: Infinity, duration: 2.4, ease: 'easeInOut' }, scale: { duration: 0.2 } }}
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-600">Try a sample</span>
          {SAMPLE_RESUMES.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => { onTextChange(sample.text); switchMode('text'); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-[11px] font-medium text-slate-300 transition-all hover:border-cyan-500/50 hover:bg-slate-800 hover:text-white"
            >
              <span aria-hidden="true">{sample.emoji}</span>{sample.label}
            </button>
          ))}
        </div>

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
            whileTap={canSubmit && !submitting ? { scale: 0.99 } : undefined}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-all sm:w-auto ${
              submitting || !canSubmit
                ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md hover:scale-[1.01] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] active:scale-[0.99]'
            }`}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {submitting ? 'Extracting skill nodes & mapping experience…' : 'Analyze resume'}
          </motion.button>
        </div>
      </div>
    </motion.form>
  );
}
