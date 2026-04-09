import 'dotenv/config';

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { CollaborationWorkspaceSchema } from './schemas.ts';
import { answerCollaborationQuestion } from './collaboration/assistant.ts';
import {
  addCollaborationComment,
  addCollaborationExchange,
  getCollaborationPaths,
  loadCollaborationArtifacts,
  persistCollaborationWorkspace,
  readLatestRunSnapshot,
} from './collaboration/workspace.ts';
import { loadConfig } from './config.ts';
import { OpenAIOrchestrationEngine } from './engine/orchestrationEngine.ts';
import { loadPromptBundle } from './prompts.ts';

const repoRoot = process.cwd();
const config = loadConfig(repoRoot);
const publicDir = path.join(repoRoot, 'web');
const promptsPromise = loadPromptBundle(repoRoot);
let enginePromise: Promise<OpenAIOrchestrationEngine> | undefined;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(response, 200, { ok: true });
    }

    if (request.method === 'GET' && url.pathname === '/api/state') {
      return sendJson(response, 200, await buildBootstrapState());
    }

    if (request.method === 'PUT' && url.pathname === '/api/workspace') {
      const body = await readJsonBody(request);
      const workspace = CollaborationWorkspaceSchema.parse(body.workspace ?? body);
      await persistCollaborationWorkspace(repoRoot, workspace);
      return sendJson(response, 200, await buildBootstrapState());
    }

    if (request.method === 'POST' && url.pathname === '/api/comments') {
      const body = await readJsonBody(request);
      const authorRole = readEnum(body.author_role, ['product_owner', 'developer']);
      const kind = readEnum(body.kind, ['comment', 'question', 'decision']);
      const section = readRequiredString(body.section, 'section');
      const message = readRequiredString(body.message, 'message');

      await addCollaborationComment(repoRoot, {
        author_role: authorRole,
        kind,
        section,
        message,
      });
      return sendJson(response, 200, await buildBootstrapState());
    }

    if (request.method === 'POST' && url.pathname === '/api/questions') {
      ensureOpenAIKey();

      const body = await readJsonBody(request);
      const role = readEnum(body.role, ['product_owner', 'developer']);
      const question = readRequiredString(body.question, 'question');
      const { workspace } = await loadCollaborationArtifacts(repoRoot);
      const latestRun = await readLatestRunSnapshot(repoRoot);
      const answer = await answerCollaborationQuestion({
        config,
        repoRoot,
        workspace,
        latestRun,
        role,
        question,
      });

      await addCollaborationExchange(repoRoot, {
        role,
        question,
        answer,
      });

      return sendJson(response, 200, {
        answer,
        state: await buildBootstrapState(),
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/orchestrate') {
      ensureOpenAIKey();

      const body = await readJsonBody(request);
      const mode = readEnum(body.mode, ['async', 'sync', 'deliver']);
      const engine = await getEngine();
      const requirementPath = getCollaborationPaths(repoRoot).requirementPath;

      const result =
        mode === 'async'
          ? await engine.runAsync(requirementPath)
          : mode === 'sync'
            ? await engine.runSync(requirementPath)
            : await engine.runDelivery(requirementPath);

      return sendJson(response, 200, {
        run: result,
        state: await buildBootstrapState(),
      });
    }

    if (request.method === 'GET') {
      return serveStaticFile(url.pathname, response);
    }

    return sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendJson(response, 500, { error: message });
  }
});

await loadCollaborationArtifacts(repoRoot);

const port = Number.parseInt(process.env.PORT ?? process.env.COLLAB_PORT ?? '3000', 10);
server.listen(port, () => {
  console.log(`Collaboration cockpit running at http://127.0.0.1:${port}`);
});

async function buildBootstrapState(): Promise<{
  workspace: Awaited<ReturnType<typeof loadCollaborationArtifacts>>['workspace'];
  requirementMarkdown: string;
  todoMarkdown: string;
  latestRun: Awaited<ReturnType<typeof readLatestRunSnapshot>>;
  hasOpenAIKey: boolean;
}> {
  const artifacts = await loadCollaborationArtifacts(repoRoot);
  const latestRun = await readLatestRunSnapshot(repoRoot);

  return {
    ...artifacts,
    latestRun,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
  };
}

async function getEngine(): Promise<OpenAIOrchestrationEngine> {
  if (!enginePromise) {
    enginePromise = promptsPromise.then((prompts) => new OpenAIOrchestrationEngine(config, prompts));
  }

  return enginePromise;
}

async function serveStaticFile(urlPathname: string, response: ServerResponse): Promise<void> {
  const relativePath =
    urlPathname === '/' ? 'index.html' : urlPathname.replace(/^\/+/, '');
  const filePath = path.resolve(publicDir, relativePath);

  if (!filePath.startsWith(`${publicDir}${path.sep}`) && filePath !== publicDir) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, { 'content-type': getContentType(filePath) });
    response.end(content);
  } catch {
    sendJson(response, 404, { error: 'Static asset not found' });
  }
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody) as Record<string, unknown>;
}

function ensureOpenAIKey(): void {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for orchestration and AI questions.');
  }
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function readEnum<T extends string>(value: unknown, allowed: T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`Expected one of: ${allowed.join(', ')}`);
  }

  return value as T;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload, null, 2));
}

function getContentType(filePath: string): string {
  if (filePath.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  }

  if (filePath.endsWith('.js')) {
    return 'application/javascript; charset=utf-8';
  }

  return 'text/html; charset=utf-8';
}
