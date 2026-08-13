import React from 'react';
import {
  BookOpen,
  Brain,
  Code2,
  Database,
  Folder,
  Sparkles,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

export type WorkspaceIdentityId =
  | 'general'
  | 'developer'
  | 'learning'
  | 'research'
  | 'study'
  | 'experimental';

export interface WorkspaceIdentity {
  id: WorkspaceIdentityId;
  label: string;
  Icon: LucideIcon;
  color: string;
  rgb: string;
}

export const WORKSPACE_IDENTITIES: readonly WorkspaceIdentity[] = [
  { id: 'general', label: 'General', Icon: Folder, color: '#22d3ee', rgb: '34 211 238' },
  { id: 'developer', label: 'Developer', Icon: Code2, color: '#60a5fa', rgb: '96 165 250' },
  { id: 'learning', label: 'Learning', Icon: Brain, color: '#c084fc', rgb: '192 132 252' },
  { id: 'research', label: 'Research', Icon: Database, color: '#2dd4bf', rgb: '45 212 191' },
  { id: 'study', label: 'Study', Icon: BookOpen, color: '#fbbf24', rgb: '251 191 36' },
  { id: 'experimental', label: 'AI / Experimental', Icon: Sparkles, color: '#a78bfa', rgb: '167 139 250' },
] as const;

const LEGACY_IDENTITY_MAP: Record<string, WorkspaceIdentityId> = {
  folder: 'general',
  code: 'developer',
  terminal: 'developer',
  cpu: 'developer',
  brain: 'learning',
  database: 'research',
  search: 'research',
  book: 'study',
  layers: 'study',
  sparkles: 'experimental',
  rocket: 'experimental',
};

export function getWorkspaceIdentity(name?: string | null): WorkspaceIdentity {
  const normalized = (name || 'general').toLowerCase();
  const identityId = LEGACY_IDENTITY_MAP[normalized] || normalized;
  return WORKSPACE_IDENTITIES.find((identity) => identity.id === identityId) || WORKSPACE_IDENTITIES[0];
}

interface WorkspaceIconProps extends LucideProps {
  name?: string | null;
}

export function WorkspaceIcon({ name, className = 'h-4 w-4', ...props }: WorkspaceIconProps) {
  const { Icon } = getWorkspaceIdentity(name);
  return <Icon className={className} strokeWidth={1.8} {...props} />;
}
