import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_PROJECT_ID, projectRelativePath } from "./projects";

type GalleryRunSummary = {
  id: string;
  title: string;
  createdAt: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number | null;
  shotCount: number;
  tags: string[];
};

type GalleryIndex = {
  version: 1;
  updatedAt: string;
  runs: GalleryRunSummary[];
};

const EXAMPLES_DIR = path.resolve(process.cwd(), "examples");
const GALLERY_RUNS_DIR = path.join(EXAMPLES_DIR, "runs");
const GALLERY_INDEX_FILE = path.join(EXAMPLES_DIR, "index.json");

export async function addRunToGallery(projectId = DEFAULT_PROJECT_ID, runId: string): Promise<{
  entryRelPath: string;
  indexRelPath: string;
  entry: Record<string, unknown>;
}> {
  if (!/^[a-z0-9-]+$/.test(runId)) throw new Error("Invalid run id.");
  const manifestPath = projectRelativePath(projectId, `runs/${runId}/manifest.json`);
  if (!existsSync(manifestPath)) throw new Error("Run manifest was not found. Save or publish the run first.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as Record<string, unknown>;
  const entry = galleryEntryFromManifest(manifest);
  await mkdir(GALLERY_RUNS_DIR, { recursive: true });
  const entryPath = path.join(GALLERY_RUNS_DIR, `${runId}.json`);
  await writeFile(entryPath, `${JSON.stringify(entry, null, 2)}\n`, "utf-8");

  const index = await readGalleryIndex();
  const summary = gallerySummary(entry);
  const runs = [summary, ...index.runs.filter((run) => run.id !== summary.id)].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  await mkdir(EXAMPLES_DIR, { recursive: true });
  await writeFile(
    GALLERY_INDEX_FILE,
    `${JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), runs }, null, 2)}\n`,
    "utf-8"
  );

  return {
    entryRelPath: path.relative(process.cwd(), entryPath).split(path.sep).join("/"),
    indexRelPath: path.relative(process.cwd(), GALLERY_INDEX_FILE).split(path.sep).join("/"),
    entry
  };
}

function galleryEntryFromManifest(manifest: Record<string, unknown>): Record<string, unknown> {
  const publish = objectOrEmpty(manifest["publish"]);
  const videoUrl = stringField(publish, "videoUrl");
  const thumbnailUrl = stringField(publish, "thumbnailUrl");
  const manifestUrl = stringField(publish, "manifestUrl");
  if (!videoUrl || !thumbnailUrl || !manifestUrl) {
    throw new Error("Run must be published to R2 before it can be added to the public gallery.");
  }
  const storyboard = objectOrEmpty(manifest["storyboard"]);
  const exportData = objectOrEmpty(manifest["export"]);
  const exportMetadata = objectOrEmpty(exportData["metadata"]);
  const shots = arrayOfObjects(storyboard["shots"]);
  const references = arrayOfObjects(manifest["references"]);
  const characterReference = references.find((reference) => stringField(reference, "publicUrl")) ?? {};
  const characterMetadata = objectOrEmpty(characterReference["metadata"]);
  const title = runTitle(manifest, shots, characterMetadata);
  const tags = runTags(manifest, shots);
  const publicShots = shots.map((shot) => ({
    title: stringField(shot, "title"),
    duration: numberField(shot, "duration"),
    generationMode: stringField(shot, "generationMode"),
    seedanceModel: stringField(shot, "seedanceModel"),
    prompt: stringField(shot, "prompt"),
    finalPrompt: stringField(shot, "finalPrompt")
  }));

  return {
    version: 1,
    id: stringField(manifest, "id"),
    title,
    createdAt: stringField(manifest, "createdAt"),
    tags,
    notes: stringField(manifest, "notes"),
    urls: { videoUrl, thumbnailUrl, manifestUrl },
    models: {
      image: stringField(characterMetadata, "model"),
      video: Array.from(new Set(shots.map((shot) => stringField(shot, "seedanceModel")).filter(Boolean))),
      vibe: stringField(objectOrEmpty(manifest["vibe"]), "version")
    },
    character: {
      name: stringField(characterMetadata, "characterName"),
      label: stringField(characterReference, "label"),
      imageUrl: stringField(characterReference, "publicUrl"),
      prompt: stringField(characterMetadata, "prompt"),
      fields: {
        character: stringField(characterMetadata, "character"),
        role: stringField(characterMetadata, "role"),
        outfit: stringField(characterMetadata, "outfit"),
        gear: stringField(characterMetadata, "gear"),
        movementStyle: stringField(characterMetadata, "movementStyle"),
        palette: stringField(characterMetadata, "palette"),
        visualStyle: stringField(characterMetadata, "visualStyle")
      }
    },
    storyboard: {
      targetDuration: numberField(storyboard, "targetDuration"),
      duration: numberField(exportMetadata, "duration"),
      shotCount: publicShots.length,
      exportMode: stringField(objectOrEmpty(exportMetadata["exportSettings"]), "mode")
    },
    shots: publicShots,
    copyBlocks: copyBlocks(characterMetadata, publicShots)
  };
}

async function readGalleryIndex(): Promise<GalleryIndex> {
  if (!existsSync(GALLERY_INDEX_FILE)) {
    return { version: 1, updatedAt: new Date().toISOString(), runs: [] };
  }
  try {
    const raw = JSON.parse(await readFile(GALLERY_INDEX_FILE, "utf-8")) as Partial<GalleryIndex>;
    return {
      version: 1,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
      runs: Array.isArray(raw.runs) ? raw.runs : []
    };
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), runs: [] };
  }
}

function gallerySummary(entry: Record<string, unknown>): GalleryRunSummary {
  const urls = objectOrEmpty(entry["urls"]);
  const storyboard = objectOrEmpty(entry["storyboard"]);
  return {
    id: stringField(entry, "id"),
    title: stringField(entry, "title"),
    createdAt: stringField(entry, "createdAt"),
    thumbnailUrl: stringField(urls, "thumbnailUrl"),
    videoUrl: stringField(urls, "videoUrl"),
    duration: numberField(storyboard, "duration"),
    shotCount: numberField(storyboard, "shotCount") ?? 0,
    tags: stringArray(entry["tags"])
  };
}

function copyBlocks(characterMetadata: Record<string, unknown>, shots: Array<Record<string, unknown>>) {
  const blocks = [];
  const characterPrompt = stringField(characterMetadata, "prompt");
  if (characterPrompt) blocks.push({ label: "Character sheet prompt", text: characterPrompt });
  const shotPrompts = shots
    .map((shot, index) => `Shot ${index + 1} - ${stringField(shot, "title")}\n${stringField(shot, "prompt")}`)
    .join("\n\n");
  if (shotPrompts.trim()) blocks.push({ label: "Storyboard shot prompts", text: shotPrompts });
  const finalPrompts = shots
    .map((shot, index) => `Shot ${index + 1} - ${stringField(shot, "title")}\n${stringField(shot, "finalPrompt")}`)
    .join("\n\n");
  if (finalPrompts.trim()) blocks.push({ label: "Final provider prompts", text: finalPrompts });
  return blocks;
}

function runTitle(
  manifest: Record<string, unknown>,
  shots: Array<Record<string, unknown>>,
  characterMetadata: Record<string, unknown>
): string {
  const explicit = stringField(manifest, "title");
  if (explicit) return explicit;
  const characterName = stringField(characterMetadata, "characterName");
  const firstShot = titleCase(stringField(shots[0] ?? {}, "title"));
  if (characterName && firstShot) return `${characterName} - ${firstShot}`;
  return titleCase(stringField(manifest, "id").replace(/^\d+-/, ""));
}

function runTags(manifest: Record<string, unknown>, shots: Array<Record<string, unknown>>): string[] {
  const tags = new Set(["character-sheet", "seedance"]);
  for (const tag of stringArray(manifest["tags"])) tags.add(tag);
  for (const shot of shots) {
    const mode = stringField(shot, "generationMode");
    const model = stringField(shot, "seedanceModel");
    if (mode) tags.add(mode);
    if (model) tags.add(model);
  }
  return Array.from(tags);
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function arrayOfObjects(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(objectOrEmpty) : [];
}

function stringField(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function numberField(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
