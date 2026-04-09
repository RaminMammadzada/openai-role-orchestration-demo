import 'dotenv/config';

import path from 'node:path';

import { assertOpenAIKeyPresent, loadConfig } from './config.ts';
import { OpenAIOrchestrationEngine } from './engine/orchestrationEngine.ts';
import { loadPromptBundle } from './prompts.ts';

function usage(): string {
  return [
    'Usage:',
    '  node src/cli.ts sync <requirements-file>',
    '  node src/cli.ts async <requirements-file>',
    '  node src/cli.ts developer <brief-json>',
    '  node src/cli.ts deliver <requirements-file>',
  ].join('\n');
}

async function main(): Promise<void> {
  const [, , command, target] = process.argv;
  if (!command || !target) {
    throw new Error(usage());
  }

  const repoRoot = process.cwd();
  assertOpenAIKeyPresent();

  const config = loadConfig(repoRoot);
  const prompts = await loadPromptBundle(repoRoot);
  const engine = new OpenAIOrchestrationEngine(config, prompts);

  if (command === 'sync') {
    const result = await engine.runSync(path.resolve(target));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'async') {
    const result = await engine.runAsync(path.resolve(target));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'developer') {
    const result = await engine.runDeveloper(path.resolve(target));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'deliver') {
    const result = await engine.runDelivery(path.resolve(target));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  throw new Error(usage());
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
