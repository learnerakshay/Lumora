import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessWorkspaceEvidenceSufficiency,
  isWorkspaceMetaQuestion,
  latestGroundedFollowUpTopicQuery,
  NO_SOURCES_META_RESPONSE,
  normalizedDistinctiveTopicQuery,
  selectInitialChatRoute,
  selectResponseModeAfterRetrieval,
} from './grounding-router';

function evidence(content: string, sourceTitle: string) {
  return { content, sourceTitle };
}

test('A1: zero sources plus a general question selects GENERAL without retrieval', () => {
  assert.deepEqual(
    selectInitialChatRoute({
      sourceCount: 0,
      query: 'Give me a roadmap to become a backend engineer.',
      isAIAction: false,
    }),
    { kind: 'GENERAL_WITHOUT_RETRIEVAL', responseMode: 'GENERAL' },
  );
});

test('B1/B2: zero-source Workspace meta variants are deterministic and honest', () => {
  const variants = [
    'What did I upload?',
    'What are my sources?',
    'Summarize my uploaded documents',
    "What's in this Workspace?",
    'What are my notes about?',
    'Show me the information in my sources',
  ];
  for (const query of variants) {
    assert.equal(isWorkspaceMetaQuestion(query), true, query);
    assert.equal(
      selectInitialChatRoute({ sourceCount: 0, query, isAIAction: false }).kind,
      'DETERMINISTIC_NO_SOURCES',
    );
  }
  assert.match(NO_SOURCES_META_RESPONSE, /currently no sources in this Workspace/i);
});

test('meta detection does not swallow ordinary general questions', () => {
  for (const query of [
    'How does document indexing work?',
    'Summarize the benefits of taking notes',
    'What is a developer workspace in VS Code?',
  ]) {
    assert.equal(isWorkspaceMetaQuestion(query), false, query);
  }
});

test('C1: genuinely answerable Workspace evidence remains GROUNDED', () => {
  const assessment = assessWorkspaceEvidenceSufficiency(
    'Explain binary search and its time complexity.',
    [
      evidence(
        'Binary search repeatedly halves a sorted search space and has logarithmic time complexity.',
        'DSA Search Algorithms',
      ),
    ],
  );
  assert.deepEqual(assessment, {
    sufficient: true,
    reason: 'complete_topic_coverage',
    topicGroupCount: 2,
    coveredTopicGroupCount: 2,
  });
  assert.equal(
    selectResponseModeAfterRetrieval({
      hasContext: true,
      hasSufficientEvidence: assessment.sufficient,
      isAIAction: false,
      isWorkspaceMeta: false,
    }),
    'GROUNDED',
  );
});

test('C2: semantically retrieved evidence still grounds when it covers the topic', () => {
  const assessment = assessWorkspaceEvidenceSufficiency(
    'How does Kubernetes orchestration work?',
    [
      evidence(
        'Kubernetes orchestration schedules and manages container workloads across a cluster.',
        'K8s Guide',
      ),
    ],
  );
  assert.equal(assessment.sufficient, true);
  assert.equal(
    selectResponseModeAfterRetrieval({
      hasContext: true,
      hasSufficientEvidence: assessment.sufficient,
      isAIAction: false,
      isWorkspaceMeta: false,
    }),
    'GROUNDED',
  );
});

test('C1/C2/C3: real DSA topic phrases remain answerable without request adjectives', () => {
  const fixtures = [
    {
      query: 'What are the most important interview questions for Linked List?',
      topic: 'linked list',
      content: 'Linked List questions include reversal, cycle detection, and merging sorted lists.',
    },
    {
      query: 'What are the most important Binary Tree questions?',
      topic: 'binary tree',
      content: 'Binary Tree practice covers traversals, height, diameter, and lowest common ancestor.',
    },
    {
      query: 'Give me the key Dynamic Programming interview questions.',
      topic: 'dynamic programming',
      content: 'Dynamic Programming questions cover knapsack, subsequences, and grid paths.',
    },
  ];
  for (const fixture of fixtures) {
    assert.equal(normalizedDistinctiveTopicQuery(fixture.query), fixture.topic);
    assert.equal(
      assessWorkspaceEvidenceSufficiency(
        fixture.topic,
        [evidence(fixture.content, 'DSA Mastery')],
      ).sufficient,
      true,
      fixture.query,
    );
  }
});

test('bounded recovery can promote a missed deep-section topic without loosening Case D', () => {
  const query = 'What are the most important interview questions for Linked List?';
  const recoveryQuery = normalizedDistinctiveTopicQuery(query);
  assert.equal(recoveryQuery, 'linked list');
  const initial = [
    evidence('Arrays, sorting, hashing, and graph interview questions.', 'DSA Mastery'),
  ];
  const recovered = [
    evidence('Linked List reversal, cycle detection, and merge questions.', 'DSA Mastery'),
    ...initial,
  ];
  assert.equal(
    assessWorkspaceEvidenceSufficiency(recoveryQuery!, initial).sufficient,
    false,
  );
  assert.equal(
    assessWorkspaceEvidenceSufficiency(recoveryQuery!, recovered).sufficient,
    true,
  );
  assert.equal(
    assessWorkspaceEvidenceSufficiency(
      'kubernetes',
      recovered,
    ).sufficient,
    false,
  );
});

test('a contextual follow-up reuses only the latest genuinely grounded topic', () => {
  const priorUser = {
    id: 'user-linked-list',
    workspaceId: 'workspace-1',
    parentMessageId: null,
    role: 'USER' as const,
    content: 'Explain linked lists from my PDF.',
    mode: 'CONCISE' as const,
    responseMode: null,
    status: 'SUCCESS' as const,
    action: null,
    createdAt: new Date().toISOString(),
  };
  const priorAssistant = {
    ...priorUser,
    id: 'assistant-linked-list',
    parentMessageId: priorUser.id,
    role: 'ASSISTANT' as const,
    content: 'A grounded explanation.',
    responseMode: 'GROUNDED' as const,
    citations: [{ id: 'citation-1' }],
  };
  assert.equal(
    normalizedDistinctiveTopicQuery('What are the most important ones for interviews?'),
    null,
  );
  assert.equal(
    latestGroundedFollowUpTopicQuery([priorUser, priorAssistant]),
    'linked list',
  );
  assert.equal(
    assessWorkspaceEvidenceSufficiency(
      'linked list',
      [evidence('Important Linked List interview problems.', 'DSA Mastery')],
    ).sufficient,
    true,
  );
});

test('question scaffolding and singular/plural forms do not block legitimate grounding', () => {
  const assessment = assessWorkspaceEvidenceSufficiency(
    'What are the differences between arrays and linked lists?',
    [evidence('An array stores contiguous elements. Linked list nodes use pointers.', 'Arrays and Linked Lists')],
  );
  assert.equal(assessment.topicGroupCount, 2);
  assert.equal(assessment.coveredTopicGroupCount, 2);
  assert.equal(assessment.sufficient, true);
});

test('D1: DSA roadmap evidence cannot ground a Kubernetes roadmap', () => {
  const assessment = assessWorkspaceEvidenceSufficiency(
    'Give me a roadmap to learn Kubernetes.',
    [
      evidence(
        'Start with arrays, linked lists, trees, graphs, and dynamic programming.',
        'DSA Roadmap',
      ),
    ],
  );
  assert.equal(assessment.sufficient, false);
  assert.equal(assessment.reason, 'missing_topic_coverage');
  assert.equal(
    selectResponseModeAfterRetrieval({
      hasContext: true,
      hasSufficientEvidence: assessment.sufficient,
      isAIAction: false,
      isWorkspaceMeta: false,
    }),
    'GENERAL',
  );
});

test('D2: adjacent roadmap evidence cannot ground multiple uncovered topics', () => {
  const assessment = assessWorkspaceEvidenceSufficiency(
    'Give me a roadmap to learn MLOps and System Design.',
    [evidence('This roadmap covers data structures, algorithms, and coding interviews.', 'DSA Roadmap')],
  );
  assert.deepEqual(assessment, {
    sufficient: false,
    reason: 'missing_topic_coverage',
    topicGroupCount: 2,
    coveredTopicGroupCount: 0,
  });
  assert.equal(
    selectResponseModeAfterRetrieval({
      hasContext: true,
      hasSufficientEvidence: assessment.sufficient,
      isAIAction: false,
      isWorkspaceMeta: false,
    }),
    'GENERAL',
  );
});

test('D3: HTML/CSS interview evidence cannot ground backend infrastructure', () => {
  const assessment = assessWorkspaceEvidenceSufficiency(
    'Explain backend deployment infrastructure.',
    [
      evidence(
        'HTML semantics, CSS specificity, Flexbox, and frontend interview questions.',
        'HTML CSS Interview Notes',
      ),
    ],
  );
  assert.equal(assessment.sufficient, false);
  assert.equal(
    selectResponseModeAfterRetrieval({
      hasContext: true,
      hasSufficientEvidence: assessment.sufficient,
      isAIAction: false,
      isWorkspaceMeta: false,
    }),
    'GENERAL',
  );
});

test('mixed coverage is conservatively GENERAL when any requested topic is missing', () => {
  const assessment = assessWorkspaceEvidenceSufficiency(
    'Give me a roadmap for System Design and MLOps.',
    [
      evidence(
        'System design covers load balancing, caching, and distributed databases.',
        'System Design Guide',
      ),
    ],
  );
  assert.equal(assessment.topicGroupCount, 2);
  assert.equal(assessment.coveredTopicGroupCount, 1);
  assert.equal(assessment.sufficient, false);
  assert.equal(
    selectResponseModeAfterRetrieval({
      hasContext: true,
      hasSufficientEvidence: assessment.sufficient,
      isAIAction: false,
      isWorkspaceMeta: false,
    }),
    'GENERAL',
  );
});

test('generic follow-ups preserve the existing semantic retrieval decision', () => {
  const assessment = assessWorkspaceEvidenceSufficiency(
    'Summarize the key takeaways.',
    [evidence('The retrieved passage selected by semantic search.', 'Workspace Notes')],
  );
  assert.equal(assessment.reason, 'semantic_only_query');
  assert.equal(assessment.sufficient, true);
});

test('empty post-threshold evidence becomes GENERAL for ordinary questions', () => {
  for (const query of [
    'Give me a roadmap to become a DevOps engineer.',
    'How should I structure a strength-training plan?',
  ]) {
    assert.equal(isWorkspaceMetaQuestion(query), false);
    assert.equal(
      selectResponseModeAfterRetrieval({
        hasContext: false,
        hasSufficientEvidence: false,
        isAIAction: false,
        isWorkspaceMeta: false,
      }),
      'GENERAL',
    );
  }
});

test('unsupported Workspace-meta questions and context-free AI Actions do not become general chat', () => {
  assert.equal(
    selectResponseModeAfterRetrieval({
      hasContext: false,
      hasSufficientEvidence: false,
      isAIAction: false,
      isWorkspaceMeta: true,
    }),
    'GROUNDED',
  );
  assert.equal(
    selectResponseModeAfterRetrieval({
      hasContext: false,
      hasSufficientEvidence: false,
      isAIAction: true,
      isWorkspaceMeta: false,
    }),
    null,
  );
});
