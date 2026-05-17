import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { DEFAULT_PROJECT_ID, ensureProject, projectRelativePath } from "./projects";
import type {
  GenerationMode,
  SeedanceModel,
  StoryboardProject,
  StoryboardShot,
  VideoRatio,
  VideoResolution
} from "./types";

const STORYBOARD_FILE = "storyboard.json";

export type ShotPatch = Partial<
  Pick<
    StoryboardShot,
    | "title"
    | "duration"
    | "prompt"
    | "references"
    | "ratio"
    | "resolution"
    | "seedanceModel"
    | "generationMode"
    | "generateAudio"
    | "status"
    | "outputRelPath"
    | "error"
    | "providerTaskId"
  >
>;

export async function readStoryboard(projectId = DEFAULT_PROJECT_ID): Promise<StoryboardProject> {
  await ensureProject(projectId);
  const file = projectRelativePath(projectId, STORYBOARD_FILE);
  if (!existsSync(file)) return createEmptyStoryboard();
  try {
    const raw = JSON.parse(await readFile(file, "utf-8")) as Partial<StoryboardProject>;
    return normalizeStoryboard(raw);
  } catch {
    return createEmptyStoryboard();
  }
}

export async function writeStoryboard(
  projectId: string,
  storyboard: Partial<StoryboardProject>
): Promise<StoryboardProject> {
  await ensureProject(projectId);
  const next = normalizeStoryboard(storyboard);
  await writeFile(projectRelativePath(projectId, STORYBOARD_FILE), JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export async function addShot(
  projectId: string,
  patch: ShotPatch = {}
): Promise<StoryboardProject> {
  const storyboard = await readStoryboard(projectId);
  const shot = createShot({
    order: storyboard.shots.length,
    title: patch.title ?? `Shot ${storyboard.shots.length + 1}`,
    prompt: patch.prompt,
    references: patch.references,
    duration: patch.duration,
    ratio: patch.ratio,
    resolution: patch.resolution,
    seedanceModel: patch.seedanceModel,
    generateAudio: patch.generateAudio
  });
  return writeStoryboard(projectId, { ...storyboard, shots: [...storyboard.shots, shot] });
}

export async function patchShot(
  projectId: string,
  shotId: string,
  patch: ShotPatch
): Promise<StoryboardProject> {
  const storyboard = await readStoryboard(projectId);
  const shots = storyboard.shots.map((shot) =>
    shot.id === shotId ? normalizeShot({ ...shot, ...patch, updatedAt: new Date().toISOString() }, shot.order) : shot
  );
  if (!shots.some((shot) => shot.id === shotId)) {
    throw new Error("Shot not found");
  }
  return writeStoryboard(projectId, { ...storyboard, shots });
}

export async function deleteShot(projectId: string, shotId: string): Promise<StoryboardProject> {
  const storyboard = await readStoryboard(projectId);
  const shots = storyboard.shots.filter((shot) => shot.id !== shotId);
  if (shots.length === storyboard.shots.length) throw new Error("Shot not found");
  return writeStoryboard(projectId, { ...storyboard, shots });
}

export function createEmptyStoryboard(): StoryboardProject {
  const now = new Date().toISOString();
  return {
    targetDuration: 30,
    shots: [],
    createdAt: now,
    updatedAt: now
  };
}

export function createShot(input: {
  order: number;
  title?: string;
  duration?: number;
  prompt?: string;
  references?: string[];
  ratio?: VideoRatio;
  resolution?: VideoResolution;
  seedanceModel?: SeedanceModel;
  generationMode?: GenerationMode;
  generateAudio?: boolean;
}): StoryboardShot {
  const now = new Date().toISOString();
  return normalizeShot(
    {
      id: randomUUID(),
      order: input.order,
      title: input.title ?? `Shot ${input.order + 1}`,
      duration: input.duration ?? 5,
      prompt:
        input.prompt ??
        "Use @Image1 as the main character identity. Create a cinematic shot with consistent clothing, face, and color palette.",
      references: input.references ?? [],
      ratio: input.ratio ?? "16:9",
      resolution: input.resolution ?? "720p",
      seedanceModel: input.seedanceModel ?? "fast",
      generationMode: input.generationMode ?? defaultGenerationMode(input.order),
      generateAudio: input.generateAudio ?? true,
      status: "draft",
      createdAt: now,
      updatedAt: now
    },
    input.order
  );
}

export function normalizeStoryboard(input: Partial<StoryboardProject>): StoryboardProject {
  const now = new Date().toISOString();
  const createdAt = stringOr(input.createdAt, now);
  const shots = Array.isArray(input.shots)
    ? input.shots.map((shot, index) => normalizeShot(shot, index)).sort((a, b) => a.order - b.order)
    : [];
  return {
    targetDuration: clampTargetDuration(input.targetDuration),
    shots: shots.map((shot, index) => ({ ...shot, order: index })),
    exportRelPath: typeof input.exportRelPath === "string" ? input.exportRelPath : undefined,
    createdAt,
    updatedAt: now
  };
}

export function normalizeShot(input: Partial<StoryboardShot>, order: number): StoryboardShot {
  const now = new Date().toISOString();
  const createdAt = stringOr(input.createdAt, now);
  return {
    id: stringOr(input.id, randomUUID()),
    order,
    title: stringOr(input.title, `Shot ${order + 1}`).slice(0, 80),
    duration: clampShotDuration(input.duration),
    prompt: stringOr(input.prompt, ""),
    references: Array.isArray(input.references) ? input.references.filter((item) => typeof item === "string") : [],
    ratio: normalizeRatio(input.ratio),
    resolution: normalizeResolution(input.resolution),
    seedanceModel: normalizeSeedanceModel(input.seedanceModel),
    generationMode: normalizeGenerationMode(input.generationMode, order),
    generateAudio: input.generateAudio !== false,
    status: normalizeStatus(input.status),
    outputRelPath: typeof input.outputRelPath === "string" ? input.outputRelPath : undefined,
    error: typeof input.error === "string" ? input.error : undefined,
    providerTaskId: typeof input.providerTaskId === "string" ? input.providerTaskId : undefined,
    createdAt,
    updatedAt: stringOr(input.updatedAt, now)
  };
}

export function totalStoryboardDuration(storyboard: StoryboardProject): number {
  return storyboard.shots.reduce((total, shot) => total + shot.duration, 0);
}

export function isRunningStatus(status: StoryboardShot["status"]): boolean {
  return ["queued", "uploading", "submitted", "generating", "downloading"].includes(status);
}

function clampTargetDuration(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 30;
  return Math.max(5, Math.min(180, Math.round(value)));
}

function clampShotDuration(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 5;
  return Math.max(4, Math.min(15, Math.round(value)));
}

function normalizeRatio(value: unknown): VideoRatio {
  return value === "9:16" || value === "1:1" || value === "16:9" ? value : "16:9";
}

function normalizeResolution(value: unknown): VideoResolution {
  return value === "480p" || value === "1080p" || value === "720p" ? value : "720p";
}

function normalizeSeedanceModel(value: unknown): SeedanceModel {
  return value === "quality" || value === "fast" ? value : "fast";
}

function defaultGenerationMode(order: number): GenerationMode {
  return order === 0 ? "omni-reference" : "strict-continuation";
}

function normalizeGenerationMode(value: unknown, order: number): GenerationMode {
  if (value === "omni-reference" || value === "strict-continuation") {
    return value;
  }
  if (value === "keyframe-bridge") return "strict-continuation";
  return defaultGenerationMode(order);
}

function normalizeStatus(value: unknown): StoryboardShot["status"] {
  const allowed: StoryboardShot["status"][] = [
    "draft",
    "queued",
    "uploading",
    "submitted",
    "generating",
    "downloading",
    "done",
    "failed",
    "cancelled"
  ];
  return allowed.includes(value as StoryboardShot["status"]) ? (value as StoryboardShot["status"]) : "draft";
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
