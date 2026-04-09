import { Agent, type RunContext } from '@openai/agents';

import type { PromptBundle } from '../prompts.ts';
import { ProductOwnerBriefSchema } from '../schemas.ts';
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
    `- Target workspace: ${runContext.context.targetWorkspace}`,
    '- Produce a developer-ready brief with explicit scope boundaries.',
    '- Do not write implementation details unless they are necessary as constraints.',
    '- Keep all acceptance criteria testable and unambiguous.',
  ].join('\n\n');
}

export function createProductOwnerAgent(prompts: PromptBundle, model: string): Agent<WorkflowContext, typeof ProductOwnerBriefSchema> {
  return new Agent<WorkflowContext, typeof ProductOwnerBriefSchema>({
    name: 'Product Owner Agent',
    handoffDescription: 'Turns requirements into a clear engineering brief.',
    model,
    outputType: ProductOwnerBriefSchema,
    instructions: (runContext) => buildInstructions(prompts, runContext),
  });
}
