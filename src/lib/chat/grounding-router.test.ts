import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessWorkspaceEvidenceSufficiency,
  GENERAL_FALLBACK_PREAMBLE,
  isWorkspaceMetaQuestion,
  latestGroundedFollowUpTopicQuery,
  NO_SOURCES_META_RESPONSE,
  normalizedDistinctiveTopicQuery,
  selectInitialChatRoute,
  selectResponseModeAfterRetrieval,
} from './grounding-router';
import { GeneralResponseSafeStream } from './citation-consistency';

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

// Regression coverage for a production report: source-specific questions
// about a READY YouTube source ("what does the speaker discuss...", "what is
// the main topic...") incorrectly fell back to GENERAL because discourse and
// temporal-reference words ("speaker", "discuss", "topic", "main", "first",
// "minute") were treated as required content topics that a transcript's own
// spoken content would never literally contain. Fixture mirrors the reported
// evidence shape: a video about turning viral trends into engineering
// projects, phrased differently than the questions to avoid lucky lexical
// matches.
const VIRAL_TRENDS_VIDEO_EVIDENCE = [
  evidence(
    'So today I want to walk through what happens after something goes viral online. ' +
      'Once a trend has enough technical depth, engineers can scope it into a real project within a weekend. ' +
      'That project usually starts as a rough prototype before it is polished into something people would actually ship.',
    'How Viral Trends Become Engineering Projects',
  ),
];

test('YouTube: structural/source-reference questions ground via the existing semantic-only path', () => {
  for (const query of [
    'Summarize this video.',
    'What is the main topic discussed in this video?',
    'What does the speaker discuss in the first 2 minutes?',
  ]) {
    const assessment = assessWorkspaceEvidenceSufficiency(query, VIRAL_TRENDS_VIDEO_EVIDENCE);
    assert.equal(assessment.reason, 'semantic_only_query', query);
    assert.equal(assessment.topicGroupCount, 0, query);
    assert.equal(assessment.sufficient, true, query);
    assert.equal(
      selectResponseModeAfterRetrieval({
        hasContext: true,
        hasSufficientEvidence: assessment.sufficient,
        isAIAction: false,
        isWorkspaceMeta: false,
      }),
      'GROUNDED',
      query,
    );
  }
});

test('YouTube: a genuine topic question phrased with speaker/suggest framing still grounds', () => {
  const query =
    'According to this video, how does the speaker suggest developers turn viral trends into engineering projects?';
  const assessment = assessWorkspaceEvidenceSufficiency(query, VIRAL_TRENDS_VIDEO_EVIDENCE);
  // The real topic tokens (viral, trend, project) are still extracted and
  // still required — this is complete_topic_coverage, not an empty group.
  assert.equal(assessment.topicGroupCount, 1);
  assert.equal(assessment.coveredTopicGroupCount, 1);
  assert.equal(assessment.reason, 'complete_topic_coverage');
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

test('YouTube: an unsupported topic in the same Workspace still safely falls back to GENERAL', () => {
  const assessment = assessWorkspaceEvidenceSufficiency(
    'Does this video mention Kubernetes or Docker deployment pipelines?',
    VIRAL_TRENDS_VIDEO_EVIDENCE,
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

test('ordinary verb-tense question phrasing ("used for", "was created", "implemented") grounds instead of over-requiring the inflection as a topic', () => {
  // Regression: canonicalToken() only strips plural -s/-es/-ies, not verb
  // tenses, so a 4-letter inflection like "used" was compared literally and
  // never matched its already-scaffolding base form "use" — it was silently
  // treated as a REQUIRED content topic with no matching scaffolding entry.
  // A question phrased with ordinary verbs ("What is X used for?", "How was
  // X created?") then failed the coverage gate and fell back to GENERAL even
  // though the retrieved evidence plainly answered the question.
  const kubernetesEvidence = [
    evidence(
      'Kubernetes is a container orchestration platform that automates deployment, ' +
        'scaling, and management of containerized applications across clusters.',
      'Kubernetes Explained',
    ),
  ];
  for (const query of [
    'What is Kubernetes used for?',
    'What are the uses of Kubernetes?',
    'How is Kubernetes implemented?',
    'How was Kubernetes created?',
  ]) {
    const assessment = assessWorkspaceEvidenceSufficiency(query, kubernetesEvidence);
    assert.equal(assessment.sufficient, true, query);
    assert.equal(assessment.reason, 'complete_topic_coverage', query);
    assert.equal(
      selectResponseModeAfterRetrieval({
        hasContext: true,
        hasSufficientEvidence: assessment.sufficient,
        isAIAction: false,
        isWorkspaceMeta: false,
      }),
      'GROUNDED',
      query,
    );
  }

  // The same verb-tense phrasing about a genuinely different, uncovered
  // topic must still fall back to GENERAL — proving the fix only stopped
  // double-counting the question's own grammar, not the actual topic word.
  const offTopic = assessWorkspaceEvidenceSufficiency(
    'What is Terraform used for?',
    kubernetesEvidence,
  );
  assert.equal(offTopic.sufficient, false);
  assert.equal(offTopic.reason, 'missing_topic_coverage');
});

test('full lifecycle: no source stays GENERAL, a newly-READY relevant source grounds, then an unrelated question returns to GENERAL', () => {
  const transcriptEvidence = [
    evidence(
      'Kubernetes is a container orchestration platform that automates deployment, ' +
        'scaling, and management of containerized applications across clusters.',
      'Kubernetes Explained',
    ),
  ];

  // 1. Workspace initially has no source — an ordinary question routes
  // GENERAL without ever attempting retrieval.
  const beforeIngestion = selectInitialChatRoute({
    sourceCount: 0,
    query: 'What is Kubernetes used for?',
    isAIAction: false,
  });
  assert.deepEqual(beforeIngestion, { kind: 'GENERAL_WITHOUT_RETRIEVAL', responseMode: 'GENERAL' });

  // 2. The YouTube source is now READY (sourceCount reflects it) — the same
  // conversation, asking the same kind of question, now attempts retrieval.
  const afterIngestion = selectInitialChatRoute({
    sourceCount: 1,
    query: 'What is Kubernetes used for?',
    isAIAction: false,
  });
  assert.deepEqual(afterIngestion, { kind: 'RETRIEVE' });

  // 3. Retrieval returns trusted chunks (simulated: assertCandidateIntegrity
  // and the embedding-contract checks are covered separately in
  // rag-service.test.ts) and evidence sufficiency passes.
  const coveredAssessment = assessWorkspaceEvidenceSufficiency(
    'What is Kubernetes used for?',
    transcriptEvidence,
  );
  assert.equal(coveredAssessment.sufficient, true);
  const coveredMode = selectResponseModeAfterRetrieval({
    hasContext: true,
    hasSufficientEvidence: coveredAssessment.sufficient,
    isAIAction: false,
    isWorkspaceMeta: false,
  });
  assert.equal(coveredMode, 'GROUNDED');

  // 4. An unrelated question in the SAME conversation, against the SAME
  // active evidence, still returns GENERAL with no fabricated coverage —
  // proving this fix does not weaken the grounding gate into "Workspace has
  // a source -> always GROUNDED".
  const unrelatedAssessment = assessWorkspaceEvidenceSufficiency(
    'What is the capital of France?',
    transcriptEvidence,
  );
  assert.equal(unrelatedAssessment.sufficient, false);
  const unrelatedMode = selectResponseModeAfterRetrieval({
    hasContext: true,
    hasSufficientEvidence: unrelatedAssessment.sufficient,
    isAIAction: false,
    isWorkspaceMeta: false,
  });
  assert.equal(unrelatedMode, 'GENERAL');
});

test('GENERAL fallback text never claims Lumora lacks access to an existing source, and stays citation-free', () => {
  assert.doesNotMatch(GENERAL_FALLBACK_PREAMBLE, /access|upload|share the video|don't have/i);
  assert.match(GENERAL_FALLBACK_PREAMBLE, /doesn't contain enough material/i);

  const emitted: string[] = [];
  const stream = new GeneralResponseSafeStream((text) => emitted.push(text));
  const modelText = 'Kubernetes is a container orchestration platform released by Google.';
  const fullResponse = `${GENERAL_FALLBACK_PREAMBLE}${modelText}`;
  stream.push(GENERAL_FALLBACK_PREAMBLE);
  stream.push(modelText);
  stream.finish(fullResponse);
  const combined = emitted.join('');
  assert.equal(combined, fullResponse);
  assert.doesNotMatch(combined, /\[Citation/i);

  const leakingStream = new GeneralResponseSafeStream(() => undefined);
  assert.throws(() => leakingStream.finish('Fabricated fact [Citation #1].'));
});
