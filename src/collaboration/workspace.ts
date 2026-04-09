import path from 'node:path';

import {
  CollaborationWorkspaceSchema,
  type CollaborationComment,
  type CollaborationExchange,
  type CollaborationWorkspace,
  type DeveloperImplementationBundle,
  type DeveloperPlan,
  type ProductOwnerBrief,
  type ProductReview,
  type RequirementPacket,
} from '../schemas.ts';
import type { LatestRunSnapshot, PersistedRunMeta } from '../types.ts';
import { ensureDir, readUtf8, writeJson, writeText } from '../lib/files.ts';

const COLLAB_STATE_FILE = 'data/loan-collaboration-workspace.json';
const COLLAB_REQUIREMENT_FILE = 'requirements/loan-collaboration.md';
const COLLAB_TODO_FILE = 'requirements/loan-collaboration.todo.md';

export type CollaborationArtifacts = {
  workspace: CollaborationWorkspace;
  requirementMarkdown: string;
  todoMarkdown: string;
};

export function getCollaborationPaths(repoRoot: string): {
  statePath: string;
  requirementPath: string;
  todoPath: string;
} {
  return {
    statePath: path.join(repoRoot, COLLAB_STATE_FILE),
    requirementPath: path.join(repoRoot, COLLAB_REQUIREMENT_FILE),
    todoPath: path.join(repoRoot, COLLAB_TODO_FILE),
  };
}

export async function loadCollaborationArtifacts(repoRoot: string): Promise<CollaborationArtifacts> {
  const { statePath } = getCollaborationPaths(repoRoot);

  try {
    const parsed = CollaborationWorkspaceSchema.parse(JSON.parse(await readUtf8(statePath)));
    return {
      workspace: parsed,
      requirementMarkdown: renderRequirementMarkdown(parsed),
      todoMarkdown: renderTodoMarkdown(parsed),
    };
  } catch {
    const workspace = createDefaultWorkspace();
    await persistCollaborationWorkspace(repoRoot, workspace);
    return {
      workspace,
      requirementMarkdown: renderRequirementMarkdown(workspace),
      todoMarkdown: renderTodoMarkdown(workspace),
    };
  }
}

export async function persistCollaborationWorkspace(
  repoRoot: string,
  workspace: CollaborationWorkspace,
): Promise<CollaborationArtifacts> {
  const normalized = CollaborationWorkspaceSchema.parse({
    ...workspace,
    updated_at: new Date().toISOString(),
  });
  const requirementMarkdown = renderRequirementMarkdown(normalized);
  const todoMarkdown = renderTodoMarkdown(normalized);
  const { statePath, requirementPath, todoPath } = getCollaborationPaths(repoRoot);

  await ensureDir(path.dirname(statePath));
  await writeJson(statePath, normalized);
  await writeText(requirementPath, requirementMarkdown);
  await writeText(todoPath, todoMarkdown);

  return {
    workspace: normalized,
    requirementMarkdown,
    todoMarkdown,
  };
}

export async function addCollaborationComment(
  repoRoot: string,
  comment: Omit<CollaborationComment, 'id' | 'created_at' | 'status'> & { status?: CollaborationComment['status'] },
): Promise<CollaborationArtifacts> {
  const { workspace } = await loadCollaborationArtifacts(repoRoot);
  const nextComment: CollaborationComment = {
    id: createId('comment'),
    created_at: new Date().toISOString(),
    status: comment.status ?? 'open',
    ...comment,
  };

  return persistCollaborationWorkspace(repoRoot, {
    ...workspace,
    developer_comments: [nextComment, ...workspace.developer_comments],
  });
}

export async function addCollaborationExchange(
  repoRoot: string,
  exchange: Omit<CollaborationExchange, 'id' | 'created_at'>,
): Promise<CollaborationArtifacts> {
  const { workspace } = await loadCollaborationArtifacts(repoRoot);
  const nextExchange: CollaborationExchange = {
    id: createId('qa'),
    created_at: new Date().toISOString(),
    ...exchange,
  };

  return persistCollaborationWorkspace(repoRoot, {
    ...workspace,
    ai_exchanges: [nextExchange, ...workspace.ai_exchanges].slice(0, 12),
  });
}

export async function readLatestRunSnapshot(repoRoot: string): Promise<LatestRunSnapshot> {
  const latestDir = path.join(repoRoot, '.runs', 'latest');

  const [
    meta,
    requirement,
    brief,
    developerPlan,
    review,
    implementationBundle,
  ] = await Promise.all([
    readOptionalJson<PersistedRunMeta>(path.join(latestDir, 'meta.json')),
    readOptionalJson<RequirementPacket>(path.join(latestDir, 'requirement.json')),
    readOptionalJson<ProductOwnerBrief>(path.join(latestDir, 'brief.json')),
    readOptionalJson<DeveloperPlan>(path.join(latestDir, 'developer-plan.json')),
    readOptionalJson<ProductReview>(path.join(latestDir, 'review.json')),
    readOptionalJson<DeveloperImplementationBundle>(path.join(latestDir, 'implementation-bundle.json')),
  ]);

  return {
    meta,
    requirement,
    brief,
    developerPlan,
    review,
    implementationBundle,
  };
}

export function renderRequirementMarkdown(workspace: CollaborationWorkspace): string {
  const openQuestions = [
    ...workspace.product_owner_questions,
    ...workspace.developer_comments
      .filter((comment) => comment.status === 'open' && comment.kind === 'question')
      .map((comment) => `${labelForRole(comment.author_role)} asked about ${comment.section}: ${comment.message}`),
  ];

  const developerSignals = workspace.developer_comments
    .map(
      (comment) =>
        `- [${comment.status}] ${labelForRole(comment.author_role)} • ${comment.section} • ${comment.kind}: ${comment.message}`,
    )
    .join('\n');

  return [
    `# ${workspace.workspace_title}`,
    '',
    'Prepared by: Product Owner Command Deck',
    'Status: Live collaboration workspace',
    '',
    '## Goal',
    '',
    workspace.business_goal,
    '',
    '## Context Summary',
    '',
    workspace.repository_context,
    '',
    workspace.futuristic_vision,
    '',
    `Feature request: ${workspace.feature_request}`,
    '',
    '## Target User',
    '',
    workspace.target_user,
    '',
    '## Problem Statement',
    '',
    workspace.problem_statement,
    '',
    '## Collaboration Goals',
    '',
    renderBullets(workspace.collaboration_goals),
    '',
    '## Constraints',
    '',
    renderBullets(workspace.constraints),
    '',
    '## In Scope',
    '',
    renderBullets(workspace.in_scope),
    '',
    '## Out of Scope',
    '',
    renderBullets(workspace.out_of_scope),
    '',
    '## Acceptance Criteria',
    '',
    renderBullets(workspace.acceptance_criteria),
    '',
    '## Validation',
    '',
    renderBullets(workspace.validation_checks),
    '',
    '## Open Questions',
    '',
    renderBullets(openQuestions),
    '',
    '## Product Owner Notes',
    '',
    workspace.product_owner_notes,
    '',
    '## Developer Signals',
    '',
    developerSignals || '- none yet',
    '',
  ].join('\n');
}

export function renderTodoMarkdown(workspace: CollaborationWorkspace): string {
  const unresolvedComments = workspace.developer_comments.filter((comment) => comment.status === 'open');

  const acceptanceTodos = workspace.acceptance_criteria.map(
    (criterion) => `- Validate this acceptance criterion in the prototype: ${criterion}`,
  );
  const questionTodos = workspace.product_owner_questions.map(
    (question) => `- Resolve product-owner question: ${question}`,
  );
  const commentTodos = unresolvedComments.map(
    (comment) =>
      `- Respond to ${labelForRole(comment.author_role)} ${comment.kind} in ${comment.section}: ${comment.message}`,
  );

  return [
    `# ${workspace.project_name} TODO`,
    '',
    '## Product Owner Stream',
    '',
    `- Keep [${path.basename(workspace.requirement_file)}](./${path.basename(workspace.requirement_file)}) current as the single business source of truth.`,
    `- Confirm the requested feature is framed in business language: ${workspace.feature_request}`,
    ...questionTodos,
    '',
    '## AI Collaboration Stream',
    '',
    '- Translate the product-owner brief into a developer-ready brief using the orchestration engine.',
    '- Turn the business brief into technical tasks, implementation steps, and a validation plan.',
    '- Answer product-owner questions about the codebase in business language and developer questions in technical language.',
    '- Explain the latest technical output back to the Product Owner after each orchestration run.',
    '',
    '## Developer Stream',
    '',
    `- Review the active requirement file and companion todo before implementation starts.`,
    '- Produce a developer plan that identifies touched files, risks, and validation work.',
    '- Comment on gaps, ambiguities, or risky assumptions directly in the collaboration thread.',
    ...commentTodos,
    '',
    '## Acceptance Trace',
    '',
    ...acceptanceTodos,
    '',
  ].join('\n');
}

function createDefaultWorkspace(): CollaborationWorkspace {
  return {
    workspace_id: 'loan-collaboration-control-room',
    workspace_title: 'Loan Term Collaboration Booster Control Room',
    project_name: 'Orbit Flow Deck',
    repository_name: 'sample-loan-calculator',
    repository_context:
      'A sample GitHub repository contains an existing loan calculator. The next business request is a loan term calculation feature, and the prototype should reduce friction between business experts and software engineers while they shape, review, and explain the change.',
    business_goal:
      'Build an AI-powered collaboration cockpit where Product Owners can shape the loan-term requirement, developers can respond with technical feedback, and both sides can see how the orchestration converts business intent into executable technical work.',
    feature_request:
      'Extend the sample loan calculator with a loan term calculation feature and make the collaboration around that feature transparent, fast, and explainable.',
    target_user:
      'A product owner and a software engineer working together on the same loan-calculator enhancement but speaking in different levels of abstraction.',
    problem_statement:
      'Modern software teams lose time translating between business requirements, technical tasks, and code explanations. The collaboration loop around a loan term feature should feel immediate, traceable, and understandable to both sides.',
    futuristic_vision:
      'The workspace should feel like a shared operating deck: Product Owners edit the live business brief, developers leave technical signals in context, and AI continuously converts requirements into next actions, questions, plans, and delivery artifacts.',
    product_owner_notes:
      'Keep the prototype business-friendly first. The Product Owner should never need to read raw code to understand whether the team is still aligned.',
    collaboration_goals: [
      'Understand the existing codebase and documentation quickly.',
      'Translate business intent into technical tasks without manual handoff documents.',
      'Let business users ask natural-language questions about the repository and current implementation.',
      'Explain technical plans and changes back in product language.',
    ],
    constraints: [
      'The prototype must use a plain HTML, CSS, and JavaScript frontend.',
      'The orchestration engine remains the source of technical planning and delivery outputs.',
      'The Product Owner should edit requirements in the UI instead of editing markdown by hand.',
      'A requirement-specific todo file should stay synchronized automatically.',
    ],
    in_scope: [
      'Product Owner workspace for editing the live loan-term requirement.',
      'Automatic generation of a requirement markdown file and a companion todo file.',
      'Developer collaboration thread with comments, questions, and decisions.',
      'AI-powered question answering about the repo, requirements, and latest orchestration outputs.',
      'Buttons to run async, sync, and delivery orchestration against the active requirement.',
      'Futuristic collaboration dashboard for business and technical users.',
    ],
    out_of_scope: [
      'A full GitHub pull request automation workflow.',
      'Multi-user authentication or real-time websockets.',
      'Direct editing of arbitrary repository files from the browser.',
      'Production-grade access control or audit logs.',
    ],
    acceptance_criteria: [
      'A Product Owner can update the active requirement in the browser and save it without editing markdown directly.',
      'Saving Product Owner changes rewrites the requirement markdown and a synchronized companion todo file automatically.',
      'A developer can leave comments or questions in the workspace and the Product Owner can see them immediately on refresh.',
      'A user can ask AI questions about the codebase or latest orchestration output and receive a role-appropriate answer.',
      'A user can trigger async, sync, and delivery orchestration runs from the UI and see the latest output summary.',
      'The interface feels like a futuristic collaboration environment on desktop and mobile screens.',
    ],
    validation_checks: [
      'Open the UI and save an updated requirement from the Product Owner panel.',
      'Confirm the requirement markdown and companion todo file update after save.',
      'Add a developer comment and confirm it appears in the collaboration thread and generated markdown.',
      'Ask at least one Product Owner style question and verify the answer is understandable without code knowledge.',
      'Run at least one orchestration mode from the UI and verify the latest run summary refreshes.',
      'Check the dashboard layout on a narrow and a wide viewport.',
    ],
    product_owner_questions: [
      'Which files are most likely to change when the loan term feature is implemented?',
      'Can the AI explain the technical plan back in product language after a delivery run?',
    ],
    developer_comments: [
      {
        id: 'seed-question-acceptance-criteria',
        author_role: 'developer',
        kind: 'question',
        section: 'acceptance criteria',
        message:
          'Should the loan term feature support both monthly and yearly repayment views, or is one repayment cadence enough for the first slice?',
        status: 'open',
        created_at: new Date().toISOString(),
      },
      {
        id: 'seed-comment-repo-context',
        author_role: 'developer',
        kind: 'comment',
        section: 'repo context',
        message: 'We should surface the exact loan-term assumptions in the first delivery slice.',
        status: 'open',
        created_at: new Date().toISOString(),
      },
    ],
    ai_exchanges: [],
    requirement_file: COLLAB_REQUIREMENT_FILE,
    todo_file: COLLAB_TODO_FILE,
    updated_at: new Date().toISOString(),
  };
}

async function readOptionalJson<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readUtf8(filePath)) as T;
  } catch {
    return undefined;
  }
}

function renderBullets(items: string[]): string {
  if (items.length === 0) {
    return '- none';
  }

  return items.map((item) => `- ${item}`).join('\n');
}

function labelForRole(role: CollaborationComment['author_role'] | CollaborationExchange['role']): string {
  return role === 'product_owner' ? 'Product Owner' : 'Developer';
}

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
