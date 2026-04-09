import process from 'node:process';

export type RuntimeConfig = {
  model: string;
  reasoningModel: string;
  repoRoot: string;
  runsDir: string;
  tracingDisabled: boolean;
  apiMaxRetries: number;
  apiRetryBaseDelayMs: number;
};

export function loadConfig(repoRoot: string): RuntimeConfig {
  return {
    model: process.env.OPENAI_MODEL ?? 'gpt-4.1',
    reasoningModel: process.env.OPENAI_REASONING_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4.1',
    repoRoot,
    runsDir: `${repoRoot}/.runs`,
    tracingDisabled:
      process.env.OPENAI_AGENTS_DISABLE_TRACING === '1' ||
      process.env.OPENAI_AGENTS_DISABLE_TRACING === 'true',
    apiMaxRetries: Number.parseInt(process.env.OPENAI_API_MAX_RETRIES ?? '4', 10),
    apiRetryBaseDelayMs: Number.parseInt(process.env.OPENAI_API_RETRY_BASE_DELAY_MS ?? '5000', 10),
  };
}

export function assertOpenAIKeyPresent(): void {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required. Copy .env.example to .env and set your key.');
  }
}
