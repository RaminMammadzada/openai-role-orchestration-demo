import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { DeveloperImplementationBundle } from '../schemas.ts';

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

export async function resetDir(dirPath: string): Promise<void> {
  await rm(dirPath, { recursive: true, force: true });
  await ensureDir(dirPath);
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export async function writeText(filePath: string, value: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, value, 'utf8');
}

export async function writeWorkspaceFiles(
  targetWorkspace: string,
  bundle: DeveloperImplementationBundle,
): Promise<string[]> {
  const resolvedWorkspace = path.resolve(targetWorkspace);
  await ensureDir(resolvedWorkspace);

  const writtenPaths: string[] = [];
  for (const file of bundle.files) {
    const trimmedPath = file.relative_path.trim();
    if (!trimmedPath || path.isAbsolute(trimmedPath)) {
      throw new Error(`Invalid generated file path: ${file.relative_path}`);
    }

    const destinationPath = path.resolve(resolvedWorkspace, trimmedPath);
    if (
      destinationPath !== resolvedWorkspace &&
      !destinationPath.startsWith(`${resolvedWorkspace}${path.sep}`)
    ) {
      throw new Error(`Generated file escapes target workspace: ${file.relative_path}`);
    }

    await writeText(destinationPath, file.content);
    writtenPaths.push(destinationPath);
  }

  return writtenPaths;
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
