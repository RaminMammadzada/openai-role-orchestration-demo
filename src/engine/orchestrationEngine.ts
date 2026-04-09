import path from 'node:path';

import {
  OpenAIConversationsSession,
  Runner,
} from '@openai/agents';
import OpenAI from 'openai';

import type { RuntimeConfig } from '../config.ts';
import { createDeveloperAgent } from '../agents/developer.ts';
import { createDeveloperImplementationAgent } from '../agents/developerImplementation.ts';
import { createProductOwnerAgent } from '../agents/productOwner.ts';
import { createReviewerAgent } from '../agents/reviewer.ts';
import {
  ensureDir,
  loadRequirementWorkspace,
  readUtf8,
  resetDir,
  writeJson,
  writeWorkspaceFiles,
} from '../lib/files.ts';
import { createOpenAIClient, normalizeRequirementWithSDK } from '../lib/openai.ts';
import type { PromptBundle } from '../prompts.ts';
import type {
  DeveloperImplementationBundle,
  DeveloperPlan,
  ProductOwnerBrief,
  ProductReview,
} from '../schemas.ts';
import type { PersistedRunMeta, RunArtifacts, WorkflowContext } from '../types.ts';

export class OpenAIOrchestrationEngine {
  readonly client: OpenAI;
  readonly config: RuntimeConfig;
  readonly prompts: PromptBundle;
  private availableModelIdsPromise?: Promise<Set<string>>;
  private executionModelPromise?: Promise<string>;
  private reasoningModelPromise?: Promise<string>;

  constructor(config: RuntimeConfig, prompts: PromptBundle) {
    this.config = config;
    this.prompts = prompts;
    this.client = createOpenAIClient();
  }

  async runAsync(requirementPath: string): Promise<RunArtifacts> {
    const runId = this.createRunId('async');
    return this.runBriefStage(requirementPath, runId, 'async', true);
  }

  async runDeveloper(briefPath: string, updateLatest = true): Promise<RunArtifacts> {
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
    const executionModel = await this.getExecutionModel();
    const agent = createDeveloperAgent(this.prompts, executionModel);
    const result = await this.withApiRetry('developer planning', () =>
      runner.run(
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
      ),
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
      updateLatest,
    });
  }

  async runSync(requirementPath: string): Promise<RunArtifacts> {
    const runId = this.createRunId('sync');
    return this.runReviewedFlow(requirementPath, runId, 'sync');
  }

  async runDelivery(requirementPath: string): Promise<RunArtifacts> {
    const runId = this.createRunId('delivery');
    const reviewedArtifacts = await this.runReviewedFlow(requirementPath, runId, 'delivery');
    const context = this.createContext(
      reviewedArtifacts.runId,
      'delivery',
      path.resolve(requirementPath),
      reviewedArtifacts.requirement.target_workspace,
    );

    const runner = this.createRunner('Developer Implementation', reviewedArtifacts.runId);
    const executionModel = await this.getExecutionModel();
    const agent = createDeveloperImplementationAgent(this.prompts, executionModel);
    const implementationRequest = [
      `Target workspace: ${reviewedArtifacts.requirement.target_workspace}`,
      '',
      `Objective: ${reviewedArtifacts.brief?.objective ?? ''}`,
      '',
      'Constraints:',
      ...(reviewedArtifacts.brief?.constraints ?? []).map((item) => `- ${item}`),
      '',
      'Acceptance criteria:',
      ...(reviewedArtifacts.brief?.acceptance_criteria ?? []).map((item) => `- ${item}`),
      '',
      'Required files:',
      ...(reviewedArtifacts.developerPlan?.files_or_modules ?? []).map((item) => `- ${item}`),
      '',
      'Implementation steps:',
      ...(reviewedArtifacts.developerPlan?.implementation_steps ?? []).map((item) => `- ${item}`),
      '',
      'Generate the implementation files now as a minimal, working static project.',
    ].join('\n');

    const result = await this.withApiRetry('developer implementation', () =>
      runner.run(
        agent,
        [
          {
            role: 'user',
            content: implementationRequest,
          },
        ],
        {
          context,
        },
      ),
    );

    const implementationBundle = this.expectOutput<DeveloperImplementationBundle>(
      result.finalOutput,
      'developer implementation bundle',
    );
    await writeWorkspaceFiles(reviewedArtifacts.requirement.target_workspace, implementationBundle);

    return this.persistRun({
      runId: reviewedArtifacts.runId,
      mode: 'delivery',
      conversationId: reviewedArtifacts.conversationId,
      requirementPath: path.resolve(requirementPath),
      targetWorkspace: reviewedArtifacts.requirement.target_workspace,
      requirement: reviewedArtifacts.requirement,
      brief: reviewedArtifacts.brief,
      developerPlan: reviewedArtifacts.developerPlan,
      review: reviewedArtifacts.review,
      implementationBundle,
      updateLatest: true,
    });
  }

  private async runBriefStage(
    requirementPath: string,
    runId: string,
    mode: PersistedRunMeta['mode'],
    updateLatest: boolean,
  ): Promise<RunArtifacts> {
    const workspace = await loadRequirementWorkspace(requirementPath);
    const conversationId = await this.withApiRetry(
      'create conversation',
      () => this.createConversation(runId, mode, workspace.primaryRequirementPath),
    );
    const reasoningModel = await this.getReasoningModel();
    const executionModel = await this.getExecutionModel();
    const requirement = await this.withApiRetry('normalize requirement', () =>
      normalizeRequirementWithSDK({
        client: this.client,
        config: this.config,
        model: reasoningModel,
        fallbackModel: executionModel,
        conversationId,
        workspace,
      }),
    );
    const context = this.createContext(
      runId,
      mode === 'developer' ? 'async' : mode,
      workspace.primaryRequirementPath,
      requirement.target_workspace,
    );

    const session = new OpenAIConversationsSession({
      conversationId,
    });

    const runner = this.createRunner('Product Owner Brief', runId);
    const agent = createProductOwnerAgent(this.prompts, executionModel);
    const result = await this.withApiRetry('product owner brief', () =>
      runner.run(
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
      ),
    );

    const brief = this.expectOutput<ProductOwnerBrief>(result.finalOutput, 'product owner brief');
    return this.persistRun({
      runId,
      mode,
      conversationId,
      requirementPath: workspace.primaryRequirementPath,
      targetWorkspace: requirement.target_workspace,
      requirement,
      brief,
      updateLatest,
    });
  }

  private async runReviewedFlow(
    requirementPath: string,
    runId: string,
    finalMode: 'sync' | 'delivery',
  ): Promise<RunArtifacts> {
    const briefArtifacts = await this.runBriefStage(requirementPath, runId, finalMode, false);
    const developerArtifacts = await this.runDeveloper(
      path.join(briefArtifacts.runDir, 'brief.json'),
      false,
    );
    const context = this.createContext(
      developerArtifacts.runId,
      finalMode,
      path.resolve(requirementPath),
      developerArtifacts.requirement.target_workspace,
    );

    const session = new OpenAIConversationsSession({
      conversationId: developerArtifacts.conversationId,
    });

    const runner = this.createRunner('Product Owner Review', developerArtifacts.runId);
    const executionModel = await this.getExecutionModel();
    const agent = createReviewerAgent(this.prompts, executionModel);
    const result = await this.withApiRetry('product owner review', () =>
      runner.run(
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
      ),
    );

    const review = this.expectOutput<ProductReview>(result.finalOutput, 'product review');
    return this.persistRun({
      runId: developerArtifacts.runId,
      mode: finalMode,
      conversationId: developerArtifacts.conversationId,
      requirementPath: path.resolve(requirementPath),
      targetWorkspace: developerArtifacts.requirement.target_workspace,
      requirement: developerArtifacts.requirement,
      brief: developerArtifacts.brief,
      developerPlan: developerArtifacts.developerPlan,
      review,
      updateLatest: finalMode === 'sync',
    });
  }

  private createRunId(prefix: string): string {
    return `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  }

  private async getExecutionModel(): Promise<string> {
    if (!this.executionModelPromise) {
      this.executionModelPromise = this.resolveStructuredOutputModel(
        'execution',
        [this.config.model, 'gpt-5.2', 'gpt-5.2-chat-latest', 'gpt-3.5-turbo'],
      );
    }

    return this.executionModelPromise;
  }

  private async getReasoningModel(): Promise<string> {
    if (!this.reasoningModelPromise) {
      this.reasoningModelPromise = this.resolveStructuredOutputModel(
        'reasoning',
        [this.config.reasoningModel, this.config.model, 'gpt-5.2', 'gpt-5.2-chat-latest'],
      );
    }

    return this.reasoningModelPromise;
  }

  private async resolveStructuredOutputModel(label: string, candidates: string[]): Promise<string> {
    const availableModelIds = await this.getAvailableModelIds();
    for (const candidate of candidates) {
      if (availableModelIds.has(candidate) && this.supportsStructuredOutputs(candidate)) {
        if (candidate !== candidates[0]) {
          console.warn(`[fallback] ${label} model ${candidates[0]} is unavailable; using ${candidate}`);
        }
        return candidate;
      }
    }

    return candidates[0];
  }

  private supportsStructuredOutputs(model: string): boolean {
    return !model.startsWith('gpt-3.5');
  }

  private async getAvailableModelIds(): Promise<Set<string>> {
    if (!this.availableModelIdsPromise) {
      this.availableModelIdsPromise = this.client.models
        .list()
        .then((page) => new Set(page.data.map((model) => model.id)));
    }

    return this.availableModelIdsPromise;
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

  private async withApiRetry<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
    let attempt = 1;

    while (true) {
      try {
        return await fn();
      } catch (error) {
        if (!this.shouldRetryRateLimit(error) || attempt >= this.config.apiMaxRetries) {
          throw error;
        }

        const delayMs = this.getRetryDelayMs(error, attempt);
        console.warn(
          `[retry] ${operationName} was rate-limited; waiting ${Math.ceil(delayMs / 1000)}s before retry ${attempt + 1}/${this.config.apiMaxRetries}`,
        );
        await this.sleep(delayMs);
        attempt += 1;
      }
    }
  }

  private shouldRetryRateLimit(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return error.message.includes('Rate limit') || error.message.includes('429');
  }

  private getRetryDelayMs(error: unknown, attempt: number): number {
    if (error instanceof Error) {
      const secondsMatch = error.message.match(/try again in (\d+(?:\.\d+)?)s/i);
      if (secondsMatch) {
        return Math.ceil(Number.parseFloat(secondsMatch[1]) * 1000) + 1000;
      }
    }

    return this.config.apiRetryBaseDelayMs * attempt;
  }

  private async sleep(delayMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
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
    implementationBundle?: DeveloperImplementationBundle;
    updateLatest?: boolean;
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
    await writeJson(path.join(runDir, 'meta.json'), meta);
    await writeJson(path.join(runDir, 'requirement.json'), args.requirement);

    if (args.brief) {
      await writeJson(path.join(runDir, 'brief.json'), args.brief);
    }

    if (args.developerPlan) {
      await writeJson(path.join(runDir, 'developer-plan.json'), args.developerPlan);
    }

    if (args.review) {
      await writeJson(path.join(runDir, 'review.json'), args.review);
    }

    if (args.implementationBundle) {
      await writeJson(path.join(runDir, 'implementation-bundle.json'), args.implementationBundle);
    }

    if (args.updateLatest) {
      await resetDir(latestDir);
      await writeJson(path.join(latestDir, 'meta.json'), meta);
      await writeJson(path.join(latestDir, 'requirement.json'), args.requirement);

      if (args.brief) {
        await writeJson(path.join(latestDir, 'brief.json'), args.brief);
      }

      if (args.developerPlan) {
        await writeJson(path.join(latestDir, 'developer-plan.json'), args.developerPlan);
      }

      if (args.review) {
        await writeJson(path.join(latestDir, 'review.json'), args.review);
      }

      if (args.implementationBundle) {
        await writeJson(path.join(latestDir, 'implementation-bundle.json'), args.implementationBundle);
      }
    }

    return {
      runId: args.runId,
      runDir,
      conversationId: args.conversationId,
      requirement: args.requirement,
      brief: args.brief,
      developerPlan: args.developerPlan,
      review: args.review,
      implementationBundle: args.implementationBundle,
    };
  }

  private async readMeta(metaPath: string): Promise<PersistedRunMeta> {
    return JSON.parse(await readUtf8(metaPath)) as PersistedRunMeta;
  }
}
