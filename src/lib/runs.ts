import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import packageJson from "../../package.json";
import { DEFAULT_PROJECT_ID, projectFileUrl, projectRelativePath } from "./projects";
import { publicUrlForR2Key, uploadFileToR2 } from "./r2";
import { readStoryboard } from "./storyboard";
import { getVibeCliStatus } from "./vibe-cli";

const execFileAsync = promisify(execFile);

export type SavedRun = {
  id: string;
  title: string;
  manifestRelPath: string;
  thumbnailRelPath: string;
  thumbnailUrl: string;
  exportRelPath: string;
  exportUrl: string;
};

export type PublishedRun = SavedRun & {
  videoUrl: string;
  thumbnailPublicUrl: string;
  manifestUrl: string;
};

type RunReference = {
  relPath: string;
  label: string;
  kind: "image" | "video" | "unknown";
  metadata: Record<string, unknown> | null;
  objectKey?: string;
  publicUrl?: string;
};

export async function saveCurrentRun(projectId = DEFAULT_PROJECT_ID): Promise<SavedRun> {
  const storyboard = await readStoryboard(projectId);
  if (!storyboard.exportRelPath) throw new Error("Export a storyboard before saving a run.");
  const exportAbs = projectRelativePath(projectId, storyboard.exportRelPath);
  if (!existsSync(exportAbs)) throw new Error("Storyboard export file is missing.");

  const now = new Date();
  const title = runTitle(storyboard.shots[0]?.title ?? "storyboard-run", now);
  const runDir = `runs/${title}`;
  await mkdir(projectRelativePath(projectId, runDir), { recursive: true });

  const thumbnailRelPath = `${runDir}/thumbnail.jpg`;
  await createThumbnail(exportAbs, projectRelativePath(projectId, thumbnailRelPath));

  const commit = await gitCommit();
  const vibe = await getVibeCliStatus();
  const references = await runReferences(projectId, Array.from(new Set(storyboard.shots.flatMap((shot) => shot.references))));
  const shotMetadata = await Promise.all(
    storyboard.shots.map(async (shot) => ({
      id: shot.id,
      order: shot.order,
      title: shot.title,
      duration: shot.duration,
      prompt: shot.prompt,
      references: shot.references,
      outputRelPath: shot.outputRelPath,
      generationMode: shot.generationMode,
      seedanceModel: shot.seedanceModel,
      finalPrompt: await generatedPromptForShot(projectId, shot.outputRelPath)
    }))
  );
  const manifest = {
    version: 1,
    id: title,
    createdAt: now.toISOString(),
    app: {
      name: packageJson.name,
      version: packageJson.version,
      commit
    },
    vibe,
    storyboard: {
      targetDuration: storyboard.targetDuration,
      exportRelPath: storyboard.exportRelPath,
      shots: shotMetadata
    },
    references,
    export: {
      relPath: storyboard.exportRelPath,
      thumbnailRelPath,
      metadata: await readSidecar(projectId, storyboard.exportRelPath)
    },
    publish: {
      status: "local",
      provider: "cloudflare-r2",
      videoUrl: null,
      thumbnailUrl: null,
      manifestUrl: null
    },
    notes: "",
    rating: null,
    tags: []
  };

  const manifestRelPath = `${runDir}/manifest.json`;
  await writeFile(projectRelativePath(projectId, manifestRelPath), JSON.stringify(manifest, null, 2), "utf-8");

  return {
    id: title,
    title,
    manifestRelPath,
    thumbnailRelPath,
    thumbnailUrl: projectFileUrl(projectId, thumbnailRelPath),
    exportRelPath: storyboard.exportRelPath,
    exportUrl: projectFileUrl(projectId, storyboard.exportRelPath)
  };
}

export async function publishCurrentRun(projectId = DEFAULT_PROJECT_ID): Promise<PublishedRun> {
  const run = await saveCurrentRun(projectId);
  const runDir = `runs/${run.id}`;
  const manifestAbs = projectRelativePath(projectId, run.manifestRelPath);
  const manifest = JSON.parse(await readFile(manifestAbs, "utf-8")) as Record<string, unknown>;

  const exportUpload = await uploadFileToR2({
    filePath: projectRelativePath(projectId, run.exportRelPath),
    key: `${runDir}/export.mp4`,
    contentType: "video/mp4"
  });
  const thumbnailUpload = await uploadFileToR2({
    filePath: projectRelativePath(projectId, run.thumbnailRelPath),
    key: `${runDir}/thumbnail.jpg`,
    contentType: "image/jpeg"
  });
  const references = await publishReferences(projectId, runDir, manifest["references"]);
  const manifestKey = `${runDir}/manifest.json`;
  const manifestUrl = publicUrlForR2Key(manifestKey);
  const publishedManifest = {
    ...manifest,
    references,
    export: {
      ...objectOrEmpty(manifest["export"]),
      publicUrl: exportUpload.url,
      thumbnailPublicUrl: thumbnailUpload.url
    },
    publish: {
      status: "published",
      provider: "cloudflare-r2",
      publishedAt: new Date().toISOString(),
      videoUrl: exportUpload.url,
      thumbnailUrl: thumbnailUpload.url,
      manifestUrl
    }
  };
  await writeFile(manifestAbs, JSON.stringify(publishedManifest, null, 2), "utf-8");
  await uploadFileToR2({
    filePath: manifestAbs,
    key: manifestKey,
    contentType: "application/json; charset=utf-8",
    cacheControl: "public, max-age=60"
  });

  return {
    ...run,
    videoUrl: exportUpload.url,
    thumbnailPublicUrl: thumbnailUpload.url,
    manifestUrl
  };
}

async function generatedPromptForShot(projectId: string, relPath: string | undefined): Promise<string | undefined> {
  if (!relPath) return undefined;
  const meta = await readSidecar(projectId, relPath);
  return typeof meta?.prompt === "string" ? meta.prompt : undefined;
}

async function readSidecar(projectId: string, relPath: string | undefined): Promise<Record<string, unknown> | null> {
  if (!relPath) return null;
  const sidecar = projectRelativePath(projectId, `${relPath}.json`);
  if (!existsSync(sidecar)) return null;
  try {
    return JSON.parse(await readFile(sidecar, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function runReferences(projectId: string, relPaths: string[]): Promise<RunReference[]> {
  const result: RunReference[] = [];
  for (const relPath of relPaths) {
    const abs = projectRelativePath(projectId, relPath);
    if (!existsSync(abs)) continue;
    const metadata = await readSidecar(projectId, relPath);
    result.push({
      relPath,
      label: typeof metadata?.["label"] === "string" ? metadata["label"] : path.basename(relPath),
      kind: kindForPath(relPath),
      metadata
    });
  }
  return result;
}

async function publishReferences(
  projectId: string,
  runDir: string,
  value: unknown
): Promise<Array<Record<string, unknown>>> {
  if (!Array.isArray(value)) return [];
  const published: Array<Record<string, unknown>> = [];
  for (const [index, item] of value.entries()) {
    const reference = objectOrEmpty(item);
    const relPath = typeof reference["relPath"] === "string" ? reference["relPath"] : "";
    if (!relPath) continue;
    const abs = projectRelativePath(projectId, relPath);
    if (!existsSync(abs)) {
      published.push(reference);
      continue;
    }
    const key = `${runDir}/references/${String(index + 1).padStart(2, "0")}-${publicFileName(relPath)}`;
    const upload = await uploadFileToR2({
      filePath: abs,
      key,
      contentType: contentTypeForPath(relPath)
    });
    published.push({ ...reference, objectKey: upload.key, publicUrl: upload.url });
  }
  return published;
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function publicFileName(relPath: string): string {
  return path
    .basename(relPath)
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");
}

function kindForPath(relPath: string): RunReference["kind"] {
  const ext = path.extname(relPath).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return "image";
  if ([".mp4", ".mov", ".webm"].includes(ext)) return "video";
  return "unknown";
}

function contentTypeForPath(relPath: string): string {
  const ext = path.extname(relPath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

async function createThumbnail(inputAbs: string, outputAbs: string): Promise<void> {
  const duration = await videoStreamDuration(inputAbs);
  const seek = Math.max(0, duration > 0 ? duration / 2 : 0.5);
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-ss",
      String(seek),
      "-i",
      inputAbs,
      "-frames:v",
      "1",
      "-vf",
      "scale=960:-2,format=yuvj420p",
      "-q:v",
      "3",
      outputAbs
    ],
    { timeout: 60 * 1000, maxBuffer: 1024 * 1024 * 16 }
  );
}

async function videoStreamDuration(inputAbs: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "default=noprint_wrappers=1:nokey=1", inputAbs],
      { timeout: 30 * 1000, maxBuffer: 1024 * 1024 }
    );
    const duration = Number.parseFloat(stdout.trim());
    if (Number.isFinite(duration) && duration > 0) return duration;
  } catch {
    // Fall through to format duration for files that do not expose stream duration.
  }
  return videoDuration(inputAbs);
}

async function videoDuration(inputAbs: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", inputAbs],
      { timeout: 30 * 1000, maxBuffer: 1024 * 1024 }
    );
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) ? duration : 0;
  } catch {
    return 0;
  }
}

async function gitCommit(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: process.cwd(),
      timeout: 10 * 1000,
      maxBuffer: 1024 * 1024
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function runTitle(title: string, now: Date): string {
  const date = now.toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 36) || "storyboard-run";
  return `${date}-${slug}`;
}
