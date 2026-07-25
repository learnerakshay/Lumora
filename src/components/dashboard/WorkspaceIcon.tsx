import React from 'react';
import {
  Folder,
  Brain,
  Database,
  Sparkles,
  BookOpen,
  Code,
  Cpu,
  Rocket,
  Terminal,
  Search,
  Layers,
  LucideProps,
} from 'lucide-react';

interface WorkspaceIconProps extends LucideProps {
  name?: string | null;
}

export const WORKSPACE_ICONS = [
  { id: 'brain', label: 'Brain / AI', Icon: Brain },
  { id: 'folder', label: 'Folder', Icon: Folder },
  { id: 'database', label: 'Database', Icon: Database },
  { id: 'sparkles', label: 'Sparkles', Icon: Sparkles },
  { id: 'book', label: 'Book', Icon: BookOpen },
  { id: 'code', label: 'Code', Icon: Code },
  { id: 'cpu', label: 'CPU', Icon: Cpu },
  { id: 'rocket', label: 'Rocket', Icon: Rocket },
  { id: 'terminal', label: 'Terminal', Icon: Terminal },
  { id: 'search', label: 'Search', Icon: Search },
];

export function WorkspaceIcon({ name, className = 'w-4 h-4', ...props }: WorkspaceIconProps) {
  const iconId = (name || 'folder').toLowerCase();

  switch (iconId) {
    case 'brain':
      return <Brain className={className} {...props} />;
    case 'database':
      return <Database className={className} {...props} />;
    case 'sparkles':
      return <Sparkles className={className} {...props} />;
    case 'book':
      return <BookOpen className={className} {...props} />;
    case 'code':
      return <Code className={className} {...props} />;
    case 'cpu':
      return <Cpu className={className} {...props} />;
    case 'rocket':
      return <Rocket className={className} {...props} />;
    case 'terminal':
      return <Terminal className={className} {...props} />;
    case 'search':
      return <Search className={className} {...props} />;
    case 'layers':
      return <Layers className={className} {...props} />;
    case 'folder':
    default:
      return <Folder className={className} {...props} />;
  }
}
