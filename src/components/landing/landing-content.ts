import { Bookmark, FileCode, FileText, Globe, Layers3, Lock, MessageSquareText, Video, Zap } from 'lucide-react';

export const LANDING_FEATURES = [
  { icon: Lock, title: 'Private Workspaces', description: 'Workspace-level safeguards keep each Workspace and its source material separate.' },
  { icon: MessageSquareText, title: 'Grounded Workspace Chat', description: 'Ask questions in a focused conversation grounded in the sources you have added.' },
  { icon: Layers3, title: 'Multi-source Learning', description: 'Connect insights across PDFs, websites, YouTube videos, and plain text in one Workspace.' },
  { icon: FileText, title: 'PDF Documents', description: 'Import PDF documents and use their content in grounded conversations.' },
  { icon: Globe, title: 'Web Pages', description: 'Bring articles and documentation into the same learning flow as your other sources.' },
  { icon: Video, title: 'YouTube Videos', description: 'Learn from supported YouTube videos through their available transcripts.' },
  { icon: FileCode, title: 'Plain Text', description: 'Add notes and other plain text directly to a Workspace.' },
  { icon: Zap, title: 'Streaming Responses', description: 'Read responses as they arrive instead of waiting for the entire answer.' },
  { icon: Bookmark, title: 'Source Citations', description: 'Trace supported answers back to the source material behind them.' },
] as const;
