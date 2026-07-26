export type AIActionId =
  | 'summarize'
  | 'explain'
  | 'compare'
  | 'generate_notes'
  | 'key_takeaways';

export type AIActionTarget = 'workspace' | 'source' | 'conversation' | 'text';

export interface AIActionMetadata {
  id: AIActionId;
  label: string;
  description: string;
  targets: AIActionTarget[];
}

export const AI_ACTION_CATALOG: readonly AIActionMetadata[] = [
  {
    id: 'summarize',
    label: 'Summarize',
    description: 'Create a structured summary of a source, conversation, or Workspace.',
    targets: ['workspace', 'source', 'conversation'],
  },
  {
    id: 'explain',
    label: 'Explain',
    description: 'Explain selected text, code, terms, or source concepts.',
    targets: ['text', 'source'],
  },
  {
    id: 'compare',
    label: 'Compare',
    description: 'Compare two available Workspace sources.',
    targets: ['source'],
  },
  {
    id: 'generate_notes',
    label: 'Generate Notes',
    description: 'Turn Workspace knowledge into clean Markdown notes.',
    targets: ['workspace', 'source', 'conversation'],
  },
  {
    id: 'key_takeaways',
    label: 'Key Takeaways',
    description: 'Extract insights, actions, conclusions, and recommendations.',
    targets: ['workspace', 'source', 'conversation'],
  },
] as const;

export function getAIActionMetadata(
  actionId: AIActionId,
): AIActionMetadata | undefined {
  return AI_ACTION_CATALOG.find(({ id }) => id === actionId);
}
