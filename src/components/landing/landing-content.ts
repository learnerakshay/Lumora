import { Bookmark, Lock, MessageSquareText, UploadCloud, Zap } from 'lucide-react';

export const LANDING_FEATURES = [
  { id: 'chat', variant: 'hero', icon: MessageSquareText, title: 'Grounded Workspace Chat', description: 'Ask focused questions and receive answers grounded in the sources you have added.' },
  { id: 'citations', variant: 'hero', icon: Bookmark, title: 'Source Citations', description: 'Trace supported answers directly back to the material behind them.' },
  { id: 'ingestion', variant: 'supporting', icon: UploadCloud, title: 'Multi-source Ingestion', description: 'Bring PDFs, websites, YouTube videos, and plain text into one learning flow.' },
  { id: 'privacy', variant: 'supporting', icon: Lock, title: 'Private Workspaces', description: 'Workspace-level safeguards keep each Workspace and its material separate.' },
  { id: 'streaming', variant: 'supporting', icon: Zap, title: 'Streaming Responses', description: 'Read grounded responses as they arrive and stay in the flow.' },
] as const;
