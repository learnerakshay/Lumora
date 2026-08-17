import type { RoleDefinition } from './types';

export const ROLE_CATALOG: readonly RoleDefinition[] = [
  {
    roleId: 'frontend-react-engineer',
    title: 'Frontend Engineer (React)',
    family: 'frontend',
    requirements: [
      { topic: 'javascript', label: 'JavaScript fundamentals', weight: 3, minEvidenceLevel: 'APPLIED' },
      { topic: 'react', label: 'React', weight: 3, minEvidenceLevel: 'SHIPPED' },
      { topic: 'typescript', label: 'TypeScript', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'nextjs', label: 'Next.js', weight: 1, minEvidenceLevel: 'APPLIED' },
    ],
    projectArchetypes: [
      { id: 'deployed-react-app', label: 'A deployed, non-tutorial React application', signatureTopics: ['react'] },
    ],
    interviewCompetencies: [
      { topic: 'dsa', label: 'Data structures & algorithms' },
      { topic: 'system-design', label: 'Frontend system design' },
    ],
  },
  {
    roleId: 'backend-node-engineer',
    title: 'Backend Engineer (Node.js)',
    family: 'backend',
    requirements: [
      { topic: 'nodejs', label: 'Node.js runtime & APIs', weight: 3, minEvidenceLevel: 'SHIPPED' },
      { topic: 'javascript', label: 'JavaScript / TypeScript', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'postgresql', label: 'PostgreSQL', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'authentication', label: 'Authentication & authorization', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'backend', label: 'Backend service design', weight: 1, minEvidenceLevel: 'APPLIED' },
    ],
    projectArchetypes: [
      { id: 'api-with-persistence', label: 'A REST or GraphQL API backed by a real database', signatureTopics: ['nodejs', 'postgresql'] },
    ],
    interviewCompetencies: [
      { topic: 'dsa', label: 'Data structures & algorithms' },
      { topic: 'dbms', label: 'Database internals' },
      { topic: 'system-design', label: 'System design' },
    ],
  },
  {
    roleId: 'fullstack-engineer',
    title: 'Full-Stack Engineer',
    family: 'fullstack',
    requirements: [
      { topic: 'react', label: 'React', weight: 3, minEvidenceLevel: 'APPLIED' },
      { topic: 'nodejs', label: 'Node.js backend', weight: 3, minEvidenceLevel: 'APPLIED' },
      { topic: 'postgresql', label: 'PostgreSQL', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'full-stack', label: 'End-to-end product delivery', weight: 2, minEvidenceLevel: 'SHIPPED' },
      { topic: 'authentication', label: 'Authentication & authorization', weight: 1, minEvidenceLevel: 'APPLIED' },
    ],
    projectArchetypes: [
      { id: 'end-to-end-web-app', label: 'An end-to-end web app you built and shipped', signatureTopics: ['react', 'nodejs'] },
    ],
    interviewCompetencies: [
      { topic: 'dsa', label: 'Data structures & algorithms' },
      { topic: 'system-design', label: 'System design' },
      { topic: 'dbms', label: 'Database internals' },
    ],
  },
  {
    roleId: 'backend-golang-engineer',
    title: 'Backend Engineer (Go)',
    family: 'backend',
    requirements: [
      { topic: 'golang', label: 'Go', weight: 3, minEvidenceLevel: 'SHIPPED' },
      { topic: 'postgresql', label: 'PostgreSQL', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'backend', label: 'Backend service design', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'docker', label: 'Docker', weight: 1, minEvidenceLevel: 'APPLIED' },
    ],
    projectArchetypes: [
      { id: 'go-service', label: 'A Go service backed by a database', signatureTopics: ['golang'] },
    ],
    interviewCompetencies: [
      { topic: 'dsa', label: 'Data structures & algorithms' },
      { topic: 'system-design', label: 'System design' },
      { topic: 'operating-systems', label: 'Concurrency & operating systems' },
    ],
  },
  {
    roleId: 'backend-python-engineer',
    title: 'Backend Engineer (Python)',
    family: 'backend',
    requirements: [
      { topic: 'python', label: 'Python', weight: 3, minEvidenceLevel: 'SHIPPED' },
      { topic: 'backend', label: 'Backend service design', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'postgresql', label: 'PostgreSQL', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'authentication', label: 'Authentication & authorization', weight: 1, minEvidenceLevel: 'APPLIED' },
    ],
    projectArchetypes: [
      { id: 'python-api-service', label: 'A Python API service backed by a database', signatureTopics: ['python'] },
    ],
    interviewCompetencies: [
      { topic: 'dsa', label: 'Data structures & algorithms' },
      { topic: 'dbms', label: 'Database internals' },
    ],
  },
  {
    roleId: 'mobile-react-native-engineer',
    title: 'Mobile Engineer (React Native)',
    family: 'mobile',
    requirements: [
      { topic: 'react-native', label: 'React Native', weight: 3, minEvidenceLevel: 'SHIPPED' },
      { topic: 'javascript', label: 'JavaScript / TypeScript', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'mobile-development', label: 'Mobile app delivery', weight: 2, minEvidenceLevel: 'APPLIED' },
    ],
    projectArchetypes: [
      { id: 'published-mobile-app', label: 'A mobile app you built end to end', signatureTopics: ['react-native'] },
    ],
    interviewCompetencies: [
      { topic: 'dsa', label: 'Data structures & algorithms' },
      { topic: 'system-design', label: 'Mobile app architecture' },
    ],
  },
  {
    roleId: 'devops-platform-engineer',
    title: 'DevOps / Platform Engineer',
    family: 'devops-cloud',
    requirements: [
      { topic: 'docker', label: 'Docker', weight: 3, minEvidenceLevel: 'APPLIED' },
      { topic: 'kubernetes', label: 'Kubernetes', weight: 3, minEvidenceLevel: 'APPLIED' },
      { topic: 'devops', label: 'CI/CD & deployment automation', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'aws', label: 'AWS', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'nginx', label: 'Nginx / reverse proxies', weight: 1, minEvidenceLevel: 'MENTIONED' },
    ],
    projectArchetypes: [
      { id: 'containerized-cicd-deployment', label: 'A containerized project with a working CI/CD pipeline', signatureTopics: ['docker', 'devops'] },
    ],
    interviewCompetencies: [
      { topic: 'operating-systems', label: 'Operating systems' },
      { topic: 'computer-networks', label: 'Computer networks' },
      { topic: 'system-design', label: 'System design' },
    ],
  },
  {
    roleId: 'cloud-backend-engineer',
    title: 'Cloud Backend Engineer',
    family: 'devops-cloud',
    requirements: [
      { topic: 'aws', label: 'AWS', weight: 3, minEvidenceLevel: 'APPLIED' },
      { topic: 'serverless', label: 'Serverless architecture', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'backend', label: 'Backend service design', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'docker', label: 'Docker', weight: 1, minEvidenceLevel: 'MENTIONED' },
    ],
    projectArchetypes: [
      { id: 'cloud-deployed-service', label: 'A backend service deployed on cloud infrastructure', signatureTopics: ['aws'] },
    ],
    interviewCompetencies: [
      { topic: 'system-design', label: 'System design' },
      { topic: 'computer-networks', label: 'Computer networks' },
    ],
  },
  {
    roleId: 'applied-ai-engineer',
    title: 'AI/ML Engineer (Applied AI)',
    family: 'ai-ml',
    requirements: [
      { topic: 'python', label: 'Python', weight: 3, minEvidenceLevel: 'APPLIED' },
      { topic: 'generative-ai', label: 'Generative AI / LLM integration', weight: 3, minEvidenceLevel: 'SHIPPED' },
      { topic: 'ai-agents', label: 'AI agents & tool orchestration', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'data-science', label: 'Data science fundamentals', weight: 1, minEvidenceLevel: 'MENTIONED' },
    ],
    projectArchetypes: [
      { id: 'deployed-ai-agent', label: 'A deployed AI agent or RAG project', signatureTopics: ['generative-ai', 'ai-agents'] },
    ],
    interviewCompetencies: [
      { topic: 'dsa', label: 'Data structures & algorithms' },
      { topic: 'system-design', label: 'System design for AI-backed products' },
    ],
  },
  {
    roleId: 'data-engineer',
    title: 'Data Engineer',
    family: 'data',
    requirements: [
      { topic: 'python', label: 'Python', weight: 3, minEvidenceLevel: 'APPLIED' },
      { topic: 'postgresql', label: 'PostgreSQL', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'dbms', label: 'Database & data modeling', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'data-science', label: 'Data science fundamentals', weight: 2, minEvidenceLevel: 'APPLIED' },
    ],
    projectArchetypes: [
      { id: 'data-pipeline', label: 'A data pipeline moving and transforming real data', signatureTopics: ['python', 'dbms'] },
    ],
    interviewCompetencies: [
      { topic: 'dbms', label: 'Database internals' },
      { topic: 'dsa', label: 'Data structures & algorithms' },
    ],
  },
  {
    roleId: 'systems-infra-engineer',
    title: 'Systems / Infrastructure Engineer',
    family: 'backend',
    requirements: [
      { topic: 'cpp', label: 'C++', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'rust', label: 'Rust', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'operating-systems', label: 'Operating systems', weight: 3, minEvidenceLevel: 'APPLIED' },
      { topic: 'computer-networks', label: 'Computer networks', weight: 2, minEvidenceLevel: 'APPLIED' },
    ],
    projectArchetypes: [
      { id: 'systems-level-project', label: 'A systems-level project (OS, networking, or a performance-critical service)', signatureTopics: ['cpp', 'rust', 'operating-systems'] },
    ],
    interviewCompetencies: [
      { topic: 'operating-systems', label: 'Operating systems' },
      { topic: 'dsa', label: 'Data structures & algorithms' },
      { topic: 'computer-networks', label: 'Computer networks' },
    ],
  },
  {
    roleId: 'open-source-platform-contributor',
    title: 'Open Source / Platform Contributor',
    family: 'backend',
    requirements: [
      { topic: 'git-github', label: 'Git & GitHub workflows', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'open-source', label: 'Open source contribution', weight: 3, minEvidenceLevel: 'APPLIED' },
      { topic: 'backend', label: 'Backend service design', weight: 2, minEvidenceLevel: 'APPLIED' },
      { topic: 'docker', label: 'Docker', weight: 1, minEvidenceLevel: 'MENTIONED' },
    ],
    projectArchetypes: [
      { id: 'open-source-contribution', label: 'A merged, non-trivial open source contribution', signatureTopics: ['open-source'] },
    ],
    interviewCompetencies: [
      { topic: 'system-design', label: 'System design' },
      { topic: 'dsa', label: 'Data structures & algorithms' },
    ],
  },
] as const;

export function getRoleDefinition(roleId: string): RoleDefinition | undefined {
  return ROLE_CATALOG.find((role) => role.roleId === roleId);
}
