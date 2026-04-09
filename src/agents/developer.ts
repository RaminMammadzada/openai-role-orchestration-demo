import { Agent, type RunContext } from '@openai/agents';

import type { PromptBundle } from '../prompts.ts';
import { DeveloperPlanSchema } from '../schemas.ts';
import type { WorkflowContext } from '../types.ts';

function buildInstructions(prompts: PromptBundle, runContext: RunContext<WorkflowContext>): string {
  return [
    prompts.repoGuide,
    prompts.developerAgent,
    prompts.developerSkill,
    prompts.researchNotes,
    'Runtime instructions:',
    `- Workflow mode: ${runContext.context.mode}`,
    `- Requirement file: ${runContext.context.requirementPath}`,
    `- Target workspace: ${runContext.context.targetWorkspace}`,
    '- Produce an implementation plan for the developer role.',
    '- Respect the product-owner brief and do not widen scope.',
    '- Include validation work, risks, and assumptions.',
  ].join('\n\n');
}

export function createDeveloperAgent(prompts: PromptBundle, model: string): Agent<WorkflowContext, typeof DeveloperPlanSchema> {
  return new Agent<WorkflowContext, typeof DeveloperPlanSchema>({
    name: 'Developer Agent',
    handoffDescription: 'Turns approved briefs into concrete engineering plans and delivery notes.',
    model,
    outputType: DeveloperPlanSchema,
    instructions: (runContext) => buildInstructions(prompts, runContext),
  });
}
