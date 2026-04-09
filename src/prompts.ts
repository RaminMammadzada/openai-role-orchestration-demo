import path from 'node:path';

import { readUtf8 } from './lib/files.ts';

export type PromptBundle = {
  repoGuide: string;
  productOwnerAgent: string;
  productOwnerSkill: string;
  developerAgent: string;
  developerSkill: string;
  researchNotes: string;
};

export async function loadPromptBundle(repoRoot: string): Promise<PromptBundle> {
  const repoGuidePath = path.join(repoRoot, 'AGENTS.md');
  const productOwnerAgentPath = path.join(repoRoot, 'agents', 'product-owner.md');
  const productOwnerSkillPath = path.join(repoRoot, 'skills', 'product-owner', 'SKILL.md');
  const developerAgentPath = path.join(repoRoot, 'agents', 'developer.md');
  const developerSkillPath = path.join(repoRoot, 'skills', 'developer', 'SKILL.md');
  const researchNotesPath = path.join(repoRoot, 'docs', 'openai-orchestration-research.md');

  return {
    repoGuide: await readUtf8(repoGuidePath),
    productOwnerAgent: await readUtf8(productOwnerAgentPath),
    productOwnerSkill: await readUtf8(productOwnerSkillPath),
    developerAgent: await readUtf8(developerAgentPath),
    developerSkill: await readUtf8(developerSkillPath),
    researchNotes: await readUtf8(researchNotesPath),
  };
}
