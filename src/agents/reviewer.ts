import { Agent, type RunContext } from '@openai/agents';

import type { PromptBundle } from '../prompts.ts';
import { ProductReviewSchema } from '../schemas.ts';
import type { WorkflowContext } from '../types.ts';

function buildInstructions(prompts: PromptBundle, runContext: RunContext<WorkflowContext>): string {
  return [
    prompts.repoGuide,
    prompts.productOwnerAgent,
    prompts.productOwnerSkill,
    prompts.researchNotes,
    'Runtime instructions:',
    `- Workflow mode: ${runContext.context.mode}`,
    `- Requirement file: ${runContext.context.requirementPath}`,
    '- Review the developer plan against the product-owner brief only.',
    '- Accept the plan only if it fully covers the stated acceptance criteria.',
    '- Keep the review short and decision-oriented.',
  ].join('\n\n');
}

export function createReviewerAgent(prompts: PromptBundle, model: string): Agent<WorkflowContext, typeof ProductReviewSchema> {
  return new Agent<WorkflowContext, typeof ProductReviewSchema>({
    name: 'Product Review Agent',
    handoffDescription: 'Checks whether the developer output satisfies the brief.',
    model,
    outputType: ProductReviewSchema,
    instructions: (runContext) => buildInstructions(prompts, runContext),
  });
}
