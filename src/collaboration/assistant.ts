import path from 'node:path';

import type { RuntimeConfig } from '../config.ts';
import { createOpenAIClient } from '../lib/openai.ts';
import { readUtf8 } from '../lib/files.ts';
import type { CollaborationWorkspace } from '../schemas.ts';
import type { LatestRunSnapshot } from '../types.ts';

const QUESTION_CONTEXT_FILES = [
  'README.md',
  'docs/how-the-system-works.md',
  'requirements/loan-collaboration.md',
  'src/server.ts',
  'src/collaboration/workspace.ts',
  'src/engine/orchestrationEngine.ts',
  'src/lib/openai.ts',
];

export async function answerCollaborationQuestion(args: {
  config: RuntimeConfig;
  repoRoot: string;
  workspace: CollaborationWorkspace;
  latestRun: LatestRunSnapshot;
  role: 'product_owner' | 'developer';
  question: string;
}): Promise<string> {
  const client = createOpenAIClient();
  const contextFiles = await loadContextFiles(args.repoRoot);
  const latestRunSummary = buildLatestRunSummary(args.latestRun);
  const rolePrompt =
    args.role === 'product_owner'
      ? [
          'You are an AI collaboration translator for Product Owners.',
          'Lead with a business-friendly answer in plain language.',
          'Only mention technical details when they help explain tradeoffs, risks, or files likely to change.',
          'If the repo context is incomplete, say so directly.',
        ].join('\n')
      : [
          'You are an AI collaboration assistant for software engineers.',
          'Answer as a pragmatic senior developer.',
          'Be direct about files, architecture, risks, and missing context.',
          'If the repo context is incomplete, say so directly.',
        ].join('\n');

  const response = await client.responses.create({
    model: args.config.model,
    instructions: rolePrompt,
    input: [
      'Active collaboration workspace:',
      JSON.stringify(
        {
          workspace_title: args.workspace.workspace_title,
          business_goal: args.workspace.business_goal,
          feature_request: args.workspace.feature_request,
          repository_name: args.workspace.repository_name,
          repository_context: args.workspace.repository_context,
          acceptance_criteria: args.workspace.acceptance_criteria,
          product_owner_questions: args.workspace.product_owner_questions,
          latest_open_comments: args.workspace.developer_comments.slice(0, 6),
        },
        null,
        2,
      ),
      '',
      'Latest orchestration snapshot:',
      latestRunSummary,
      '',
      'Relevant repository context:',
      contextFiles,
      '',
      `User question (${args.role}): ${args.question}`,
    ].join('\n'),
  });

  const answer = response.output_text?.trim();
  if (!answer) {
    throw new Error('OpenAI returned an empty answer for the collaboration question.');
  }

  return answer;
}

async function loadContextFiles(repoRoot: string): Promise<string> {
  const chunks: string[] = [];

  for (const relativePath of QUESTION_CONTEXT_FILES) {
    const absolutePath = path.join(repoRoot, relativePath);
    try {
      const content = await readUtf8(absolutePath);
      chunks.push([`FILE: ${relativePath}`, clip(content, 7000)].join('\n'));
    } catch {
      continue;
    }
  }

  return chunks.join('\n\n');
}

function buildLatestRunSummary(latestRun: LatestRunSnapshot): string {
  if (!latestRun.meta) {
    return 'No orchestration run has completed yet.';
  }

  return JSON.stringify(
    {
      meta: latestRun.meta,
      brief_objective: latestRun.brief?.objective,
      developer_plan_summary: latestRun.developerPlan?.summary,
      review_decision: latestRun.review?.decision,
      implementation_files: latestRun.implementationBundle?.files.map((file) => file.relative_path),
    },
    null,
    2,
  );
}

function clip(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}\n...[truncated]`;
}
