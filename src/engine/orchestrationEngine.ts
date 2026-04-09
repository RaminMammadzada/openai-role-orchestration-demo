import path from 'node:path';

import {
  OpenAIConversationsSession,
  Runner,
} from '@openai/agents';
import OpenAI from 'openai';

import type { RuntimeConfig } from '../config.ts';
import { createDeveloperAgent } from '../agents/developer.ts';
import { createProductOwnerAgent } from '../agents/productOwner.ts';
import { createReviewerAgent } from '../agents/reviewer.ts';
import { ensureDir, loadRequirementWorkspace, readUtf8, writeJson } from '../lib/files.ts';
import { createOpenAIClient, normalizeRequirementWithSDK } from '../lib/openai.ts';
import type { PromptBundle } from '../prompts.ts';
import type { DeveloperPlan, ProductOwnerBrief, ProductReview } from '../schemas.ts';
import type { PersistedRunMeta, RunArtifacts, WorkflowContext } from '../types.ts';

export class OpenAIOrchestrationEngine {
  readonly client: OpenAI;
  readonly config: RuntimeConfig;
  readonly prompts: PromptBundle;

  constructor(config: RuntimeConfig, prompts: PromptBundle) {
    this.config = config;
    this.prompts = prompts;
    this.client = createOpenAIClient();
  }

  async runAsync(requirementPath: string): Promise<RunArtifacts> {
    const runId = this.createRunId('async');
    const workspace = await loadRequirementWorkspace(requirementPath);
    const conversationId = await this.createConversation(runId, 'async', workspace.primaryRequirementPath);
    const requirement = await normalizeRequirementWithSDK({
      client: this.client,
      config: this.config,
      conversationId,
      workspace,
    });
    const context = this.createContext(runId, 'async', workspace.primaryRequirementPath, requirement.target_workspace);

    const session = new OpenAIConversationsSession({
      conversationId,
    });

    const runner = this.createRunner('Product Owner Brief', runId);
    const agent = createProductOwnerAgent(this.prompts, this.config.model);
    const result = await runner.run(
      agent,
      [
        {
          role: 'user',
          content: JSON.stringify(requirement, null, 2),
        },
      ],
      {
        context,
        session,
      },
    );

    const brief = this.expectOutput<ProductOwnerBrief>(result.finalOutput, 'product owner brief');
    return this.persistRun({
      runId,
      mode: 'async',
      conversationId,
      requirementPath: workspace.primaryRequirementPath,
      targetWorkspace: requirement.target_workspace,
      requirement,
      brief,
    });
  }

  async runDeveloper(briefPath: string): Promise<RunArtifacts> {
    const resolvedBriefPath = path.resolve(briefPath);
    const runDir = path.dirname(resolvedBriefPath);
    const meta = await this.readMeta(path.join(runDir, 'meta.json'));
    const brief = JSON.parse(await readUtf8(resolvedBriefPath)) as ProductOwnerBrief;
    const requirement = JSON.parse(await readUtf8(path.join(runDir, 'requirement.json')));
    const context = this.createContext(
      meta.run_id,
      'developer',
      meta.requirement_path,
      meta.target_workspace,
    );

    const session = new OpenAIConversationsSession({
      conversationId: meta.conversation_id,
    });

    const runner = this.createRunner('Developer Planning', meta.run_id);
    const agent = createDeveloperAgent(this.prompts, this.config.model);
    const result = await runner.run(
      agent,
      [
        {
          role: 'user',
          content: [
            'Requirement packet:',
            JSON.stringify(requirement, null, 2),
            '',
            'Approved product-owner brief:',
            JSON.stringify(brief, null, 2),
          ].join('\n'),
        },
      ],
      {
        context,
        session,
      },
    );

    const developerPlan = this.expectOutput<DeveloperPlan>(result.finalOutput, 'developer plan');
    return this.persistRun({
      runId: meta.run_id,
      mode: 'developer',
      conversationId: meta.conversation_id,
      requirementPath: meta.requirement_path,
      targetWorkspace: meta.target_workspace,
      requirement,
      brief,
      developerPlan,
    });
  }

  async runSync(requirementPath: string): Promise<RunArtifacts> {
    const asyncArtifacts = await this.runAsync(requirementPath);
    const developerArtifacts = await this.runDeveloper(path.join(asyncArtifacts.runDir, 'brief.json'));
    const context = this.createContext(
      developerArtifacts.runId,
      'sync',
      path.resolve(requirementPath),
      developerArtifacts.requirement.target_workspace,
    );

    const session = new OpenAIConversationsSession({
      conversationId: developerArtifacts.conversationId,
    });

    const runner = this.createRunner('Product Owner Review', developerArtifacts.runId);
    const agent = createReviewerAgent(this.prompts, this.config.model);
    const result = await runner.run(
      agent,
      [
        {
          role: 'user',
          content: [
            'Requirement packet:',
            JSON.stringify(developerArtifacts.requirement, null, 2),
            '',
            'Product-owner brief:',
            JSON.stringify(developerArtifacts.brief, null, 2),
            '',
            'Developer plan:',
            JSON.stringify(developerArtifacts.developerPlan, null, 2),
          ].join('\n'),
        },
      ],
      {
        context,
        session,
      },
    );

    const review = this.expectOutput<ProductReview>(result.finalOutput, 'product review');
    return this.persistRun({
      runId: developerArtifacts.runId,
      mode: 'sync',
      conversationId: developerArtifacts.conversationId,
      requirementPath: path.resolve(requirementPath),
      targetWorkspace: developerArtifacts.requirement.target_workspace,
      requirement: developerArtifacts.requirement,
      brief: developerArtifacts.brief,
      developerPlan: developerArtifacts.developerPlan,
      review,
    });
  }

  private createRunId(prefix: string): string {
    return `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  }

  private createContext(
    runId: string,
    mode: WorkflowContext['mode'],
    requirementPath: string,
    targetWorkspace: string,
  ): WorkflowContext {
    return {
      runId,
      mode,
      repoRoot: this.config.repoRoot,
      requirementPath,
      targetWorkspace,
    };
  }

  private createRunner(workflowName: string, runId: string): Runner {
    return new Runner({
      workflowName,
      groupId: runId,
      tracingDisabled: this.config.tracingDisabled,
      traceMetadata: {
        repo_root: this.config.repoRoot,
        run_id: runId,
      },
    });
  }

  private async createConversation(runId: string, mode: string, requirementPath: string): Promise<string> {
    const conversation = await this.client.conversations.create({
      metadata: {
        run_id: runId,
        mode,
        requirement_path: requirementPath,
      },
    });
    return conversation.id;
  }

  private expectOutput<T>(value: T | undefined, label: string): T {
    if (!value) {
      throw new Error(`Expected ${label}, but the agent returned no final output.`);
    }
    return value;
  }

  private async persistRun(args: {
    runId: string;
    mode: PersistedRunMeta['mode'];
    conversationId: string;
    requirementPath: string;
    targetWorkspace: string;
    requirement: any;
    brief?: ProductOwnerBrief;
    developerPlan?: DeveloperPlan;
    review?: ProductReview;
  }): Promise<RunArtifacts> {
    const runDir = path.join(this.config.runsDir, args.runId);
    const latestDir = path.join(this.config.runsDir, 'latest');

    const meta: PersistedRunMeta = {
      run_id: args.runId,
      mode: args.mode,
      conversation_id: args.conversationId,
      requirement_path: args.requirementPath,
      target_workspace: args.targetWorkspace,
      model: this.config.model,
      reasoning_model: this.config.reasoningModel,
      created_at: new Date().toISOString(),
    };

    await ensureDir(runDir);
    await ensureDir(latestDir);
    await writeJson(path.join(runDir, 'meta.json'), meta);
    await writeJson(path.join(runDir, 'requirement.json'), args.requirement);
    await writeJson(path.join(latestDir, 'meta.json'), meta);
    await writeJson(path.join(latestDir, 'requirement.json'), args.requirement);

    if (args.brief) {
      await writeJson(path.join(runDir, 'brief.json'), args.brief);
      await writeJson(path.join(latestDir, 'brief.json'), args.brief);
    }

    if (args.developerPlan) {
      await writeJson(path.join(runDir, 'developer-plan.json'), args.developerPlan);
      await writeJson(path.join(latestDir, 'developer-plan.json'), args.developerPlan);
    }

    if (args.review) {
      await writeJson(path.join(runDir, 'review.json'), args.review);
      await writeJson(path.join(latestDir, 'review.json'), args.review);
    }

    return {
      runId: args.runId,
      runDir,
      conversationId: args.conversationId,
      requirement: args.requirement,
      brief: args.brief,
      developerPlan: args.developerPlan,
      review: args.review,
    };
  }

  private async readMeta(metaPath: string): Promise<PersistedRunMeta> {
    return JSON.parse(await readUtf8(metaPath)) as PersistedRunMeta;
  }
}
