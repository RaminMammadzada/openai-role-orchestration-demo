import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type RequirementWorkspace = {
  primaryRequirementPath: string;
  primaryRequirementText: string;
  todoPath?: string;
  todoText?: string;
};

export async function readUtf8(filePath: string): Promise<string> {
  return readFile(filePath, 'utf8');
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export async function writeText(filePath: string, value: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, value, 'utf8');
}

export async function loadRequirementWorkspace(primaryRequirementPath: string): Promise<RequirementWorkspace> {
  const resolvedRequirementPath = path.resolve(primaryRequirementPath);
  const requirementsDir = path.dirname(resolvedRequirementPath);
  const todoPath = path.join(requirementsDir, 'todo.md');

  let todoText: string | undefined;
  try {
    todoText = await readUtf8(todoPath);
  } catch {
    todoText = undefined;
  }

  return {
    primaryRequirementPath: resolvedRequirementPath,
    primaryRequirementText: await readUtf8(resolvedRequirementPath),
    todoPath: todoText ? todoPath : undefined,
    todoText,
  };
}

export function createRunId(prefix: string): string {
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${iso}`;
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
