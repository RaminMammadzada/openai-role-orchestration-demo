import { Agent, type RunContext } from '@openai/agents';

import type { PromptBundle } from '../prompts.ts';
import { DeveloperImplementationBundleSchema } from '../schemas.ts';
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
    '- You are now performing implementation, not planning.',
    '- Return a complete file bundle that can be written directly into the target workspace.',
    '- Only include files that are required to satisfy the accepted plan.',
    '- Keep the implementation small, production-ready, and aligned with the approved scope.',
    '- Use plain HTML, CSS, and JavaScript unless the brief explicitly requires something else.',
    '- File contents must be returned as raw strings without markdown fences.',
  ].join('\n\n');
}

export function createDeveloperImplementationAgent(
  prompts: PromptBundle,
  model: string,
): Agent<WorkflowContext, typeof DeveloperImplementationBundleSchema> {
  return new Agent<WorkflowContext, typeof DeveloperImplementationBundleSchema>({
    name: 'Developer Implementation Agent',
    handoffDescription: 'Turns an accepted developer plan into a concrete file bundle.',
    model,
    outputType: DeveloperImplementationBundleSchema,
    instructions: (runContext) => buildInstructions(prompts, runContext),
  });
}
