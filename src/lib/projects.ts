import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { ProjectStatus, ProviderKeyStatus, StudioAsset } from "./types";
import { getVibeCliStatus } from "./vibe-cli";

export const DEFAULT_PROJECT_ID = "default";
export const WORKSPACE_DIR = path.resolve(process.cwd(), "workspace");

export function projectDir(projectId = DEFAULT_PROJECT_ID): string {
  return path.join(WORKSPACE_DIR, safeSegment(projectId));
}

export function projectRelativePath(projectId: string, relPath: string): string {
  const root = projectDir(projectId);
  const abs = path.resolve(root, relPath);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error("Path escapes project directory");
  }
  return abs;
}

export function projectFileUrl(projectId: string, relPath: string): string {
  return `/api/files/${encodeURIComponent(projectId)}/${relPath.split("/").map(encodeURIComponent).join("/")}`;
}

export async function ensureProject(projectId = DEFAULT_PROJECT_ID): Promise<string> {
  const dir = projectDir(projectId);
  await mkdir(path.join(dir, ".vibeframe"), { recursive: true });
  await mkdir(path.join(dir, "assets", "characters"), { recursive: true });
  await mkdir(path.join(dir, "assets", "videos"), { recursive: true });
  await mkdir(path.join(dir, "renders"), { recursive: true });
  return dir;
}

export async function projectStatus(projectId = DEFAULT_PROJECT_ID): Promise<ProjectStatus> {
  const dir = await ensureProject(projectId);
  return {
    projectId,
    projectDir: dir,
    keys: await readKeyStatus(projectId),
    vibe: await getVibeCliStatus(),
    assets: await listAssets(projectId)
  };
}

export async function saveProjectKeys(
  projectId: string,
  keys: { openaiApiKey?: string; falApiKey?: string }
): Promise<ProjectStatus["keys"]> {
  await ensureProject(projectId);
  const existing = await readRawKeys(projectId);
  const next = {
    openai: keys.openaiApiKey?.trim() || existing.openai,
    fal: keys.falApiKey?.trim() || existing.fal
  };
  const config = [
    'version: "1.0.0"',
    "llm:",
    "  provider: openai",
    "providers:",
    next.openai ? `  openai: "${escapeYaml(next.openai)}"` : "  openai:",
    next.fal ? `  fal: "${escapeYaml(next.fal)}"` : "  fal:",
    "defaults:",
    "  imageProvider: openai",
    "  videoProvider: seedance",
    "  aspectRatio: 16:9",
    "  exportQuality: standard",
    "upload:",
    "  provider: imgbb",
    "  ttlSeconds: 3600",
    "repl:",
    "  autoSave: true",
    ""
  ].join("\n");
  await writeFile(projectRelativePath(projectId, ".vibeframe/config.yaml"), config, "utf-8");
  return readKeyStatus(projectId);
}

export async function readKeyStatus(projectId: string): Promise<ProjectStatus["keys"]> {
  const keys = await readRawKeys(projectId);
  return {
    openai: keyStatus(keys.openai),
    fal: keyStatus(keys.fal)
  };
}

export async function readRawKeys(projectId: string): Promise<{ openai?: string; fal?: string }> {
  const configPath = projectRelativePath(projectId, ".vibeframe/config.yaml");
  if (!existsSync(configPath)) return {};
  const raw = await readFile(configPath, "utf-8");
  return {
    openai: readYamlScalar(raw, "openai"),
    fal: readYamlScalar(raw, "fal")
  };
}

export async function listAssets(projectId = DEFAULT_PROJECT_ID): Promise<StudioAsset[]> {
  await ensureProject(projectId);
  const assetsDir = projectRelativePath(projectId, "assets");
  const files = await walk(assetsDir);
  const result: StudioAsset[] = [];
  for (const file of files) {
    const rel = path.relative(projectDir(projectId), file).split(path.sep).join("/");
    const ext = path.extname(file).toLowerCase();
    const kind =
      [".png", ".jpg", ".jpeg", ".webp"].includes(ext)
        ? "image"
        : [".mp4", ".mov", ".webm"].includes(ext)
          ? "video"
          : null;
    if (!kind) continue;
    const meta = await readAssetMetadata(file);
    const s = await stat(file);
    result.push({
      id: rel,
      kind,
      name: path.basename(file),
      relPath: rel,
      url: projectFileUrl(projectId, rel),
      createdAt: meta?.createdAt ? String(meta.createdAt) : s.birthtime.toISOString(),
      metadata: meta ?? undefined
    });
  }
  return result.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function writeAssetMetadata(
  projectId: string,
  relPath: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const abs = projectRelativePath(projectId, relPath);
  const metaPath = `${abs}.json`;
  await writeFile(metaPath, JSON.stringify({ ...metadata, relPath }, null, 2), "utf-8");
}

export async function deleteAsset(projectId: string, relPath: string): Promise<void> {
  const abs = projectRelativePath(projectId, relPath);
  const assetsDir = projectRelativePath(projectId, "assets");
  if (!abs.startsWith(assetsDir + path.sep)) {
    throw new Error("Only project assets can be deleted");
  }
  await rm(abs, { force: true });
  await rm(`${abs}.json`, { force: true });
}

async function readAssetMetadata(file: string): Promise<Record<string, unknown> | null> {
  const metaPath = `${file}.json`;
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(await readFile(metaPath, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(abs)));
    else files.push(abs);
  }
  return files;
}

function safeSegment(input: string): string {
  const value = input.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  return value || DEFAULT_PROJECT_ID;
}

function readYamlScalar(raw: string, key: string): string | undefined {
  const match = raw.match(new RegExp(`^\\s*${key}:\\s*(.*)$`, "m"));
  const value = match?.[1]?.trim();
  if (!value) return undefined;
  return value.replace(/^"|"$/g, "");
}

function keyStatus(value?: string): ProviderKeyStatus {
  return {
    configured: Boolean(value),
    masked: value ? `${value.slice(0, 4)}...${value.slice(-4)}` : null
  };
}

function escapeYaml(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
