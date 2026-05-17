import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";
import { DEFAULT_PROJECT_ID, projectFileUrl, projectRelativePath, writeAssetMetadata } from "./projects";
import { promptForCli, slugify } from "./prompts";
import { isRunningStatus, patchShot, readStoryboard, writeStoryboard } from "./storyboard";
import { runVibe } from "./vibeframe";
import type { StoryboardProject, StoryboardShot, VideoRatio, VideoResolution } from "./types";

const execFileAsync = promisify(execFile);
const runningShotIds = new Set<string>();
let generationQueue: Promise<void> = Promise.resolve();

type PreviousShotVideo = {
  shotId: string;
  relPath: string;
};

type ContinuityInput = {
  previousVideoReference?: string;
  originalPreviousVideoReference?: string;
  previousVideoAudioStripped?: boolean;
  continuityFrameReference?: string;
  continuityFrameToken?: string;
  references: string[];
};

export async function queueShotGeneration(
  projectId = DEFAULT_PROJECT_ID,
  shotId: string
): Promise<StoryboardProject> {
  const storyboard = await readStoryboard(projectId);
  const shot = storyboard.shots.find((item) => item.id === shotId);
  if (!shot) throw new Error("Shot not found");
  if (!isRunningStatus(shot.status)) {
    await patchShot(projectId, shotId, { status: "queued", error: undefined });
  }
  enqueueShot(projectId, shotId);
  return readStoryboard(projectId);
}

export async function queueStoryboardGeneration(projectId = DEFAULT_PROJECT_ID): Promise<StoryboardProject> {
  const storyboard = await readStoryboard(projectId);
  if (storyboard.shots.length === 0) throw new Error("Storyboard has no shots");
  const shots = storyboard.shots.map((shot) =>
    shot.status === "done" || isRunningStatus(shot.status)
      ? shot
      : { ...shot, status: "queued" as const, error: undefined, updatedAt: new Date().toISOString() }
  );
  const next = await writeStoryboard(projectId, { ...storyboard, shots });
  for (const shot of next.shots) {
    if (shot.status === "queued") enqueueShot(projectId, shot.id);
  }
  return next;
}

export async function exportStoryboard(projectId = DEFAULT_PROJECT_ID): Promise<{
  storyboard: StoryboardProject;
  relPath: string;
  url: string;
}> {
  const storyboard = await readStoryboard(projectId);
  if (storyboard.shots.length === 0) throw new Error("Storyboard has no shots");

  const incomplete = storyboard.shots.filter((shot) => shot.status !== "done" || !shot.outputRelPath);
  if (incomplete.length > 0) {
    throw new Error(`Export needs completed shots: ${incomplete.map((shot) => shot.title).join(", ")}`);
  }

  const shots = [...storyboard.shots].sort((a, b) => a.order - b.order);
  const outputDir = "assets/videos/exports";
  await mkdir(projectRelativePath(projectId, outputDir), { recursive: true });
  const relPath = `${outputDir}/${Date.now()}-storyboard-export.mp4`;
  const outputAbs = projectRelativePath(projectId, relPath);
  const { width, height } = videoDimensions(shots[0]?.ratio ?? "16:9", shots[0]?.resolution ?? "720p");
  const inputs = await Promise.all(shots.map(async (shot) => {
    const rel = shot.outputRelPath;
    if (!rel) throw new Error(`Shot has no output: ${shot.title}`);
    const abs = projectRelativePath(projectId, rel);
    if (!existsSync(abs)) throw new Error(`Shot output is missing: ${shot.title}`);
    return {
      abs,
      duration: shot.duration,
      hasAudio: await hasAudioStream(abs)
    };
  }));
  const ffmpegInputs: string[] = [];
  let nextInputIndex = 0;
  const segments = inputs.map((input) => {
    const videoInputIndex = nextInputIndex;
    nextInputIndex += 1;
    ffmpegInputs.push("-i", input.abs);
    if (input.hasAudio) {
      return { ...input, videoInputIndex, audioInputIndex: videoInputIndex };
    }
    const audioInputIndex = nextInputIndex;
    nextInputIndex += 1;
    ffmpegInputs.push(
      "-f",
      "lavfi",
      "-t",
      String(input.duration),
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000"
    );
    return { ...input, videoInputIndex, audioInputIndex };
  });
  const filter = [
    segments
      .map(
        (input, index) =>
          `[${input.videoInputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p,trim=duration=${input.duration},setpts=PTS-STARTPTS[v${index}]`
      )
      .join(";"),
    segments
      .map(
        (input, index) =>
          `[${input.audioInputIndex}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur=${input.duration},atrim=0:${input.duration},afade=t=in:st=0:d=0.05,afade=t=out:st=${Math.max(0, input.duration - 0.05).toFixed(2)}:d=0.05,asetpts=PTS-STARTPTS[a${index}]`
      )
      .join(";"),
    `${segments.map((_input, index) => `[v${index}][a${index}]`).join("")}concat=n=${segments.length}:v=1:a=1[v][a]`
  ].join(";");

  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        ...ffmpegInputs,
        "-filter_complex",
        filter,
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-movflags",
        "+faststart",
        outputAbs
      ],
      { timeout: 20 * 60 * 1000, maxBuffer: 1024 * 1024 * 64 }
    );
  } catch (error) {
    throw new Error(`FFmpeg export failed: ${errorMessage(error)}`);
  }

  await writeAssetMetadata(projectId, relPath, {
    createdAt: new Date().toISOString(),
    source: "storyboard-export",
    label: "Storyboard Export",
    shots: shots.map((shot) => ({ id: shot.id, title: shot.title, relPath: shot.outputRelPath })),
    targetDuration: storyboard.targetDuration,
    duration: shots.reduce((total, shot) => total + shot.duration, 0),
    ratio: shots[0]?.ratio ?? "16:9",
    resolution: shots[0]?.resolution ?? "720p",
    audio: "native-concat",
    audioSegments: segments.map((segment, index) => ({
      shotId: shots[index]?.id,
      title: shots[index]?.title,
      sourceHasAudio: segment.hasAudio
    }))
  });

  const next = await writeStoryboard(projectId, { ...storyboard, exportRelPath: relPath });
  return { storyboard: next, relPath, url: projectFileUrl(projectId, relPath) };
}

function enqueueShot(projectId: string, shotId: string): void {
  const key = `${projectId}:${shotId}`;
  if (runningShotIds.has(key)) return;
  runningShotIds.add(key);
  generationQueue = generationQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        await runShotGeneration(projectId, shotId);
      } finally {
        runningShotIds.delete(key);
      }
    });
}

async function runShotGeneration(projectId: string, shotId: string): Promise<void> {
  try {
    const start = await patchShot(projectId, shotId, { status: "generating", error: undefined });
    const shot = findShot(start, shotId);
    validateShot(shot, projectId);
    validateContinuityDependency(start, shot);

    await mkdir(projectRelativePath(projectId, "assets/videos/storyboard"), { recursive: true });
    const continuityInput = await buildContinuityInput(start, shot, projectId);
    const prompt = buildContinuityPrompt(shot.prompt, continuityInput);
    const relPath = `assets/videos/storyboard/${shot.order + 1}-${shot.id.slice(0, 8)}-${slugify(prompt).slice(0, 28)}.mp4`;
    const args = [
      "generate",
      "video",
      prompt,
      "-p",
      "seedance",
      "--seedance-model",
      shot.seedanceModel,
      "--duration",
      String(shot.duration),
      "--ratio",
      shot.ratio,
      "--resolution",
      shot.resolution,
      "--ref-images",
      ...continuityInput.references
    ];
    if (continuityInput.previousVideoReference) args.push("--ref-videos", continuityInput.previousVideoReference);
    if (!shot.generateAudio) args.push("--no-generate-audio");
    args.push("-o", relPath);

    await runVibe(args, { projectId, timeoutMs: 30 * 60 * 1000 });
    await writeAssetMetadata(projectId, relPath, {
      createdAt: new Date().toISOString(),
      provider: "seedance",
      model: shot.seedanceModel === "quality" ? "seedance-2.0" : "seedance-2.0-fast",
      prompt,
      duration: shot.duration,
      ratio: shot.ratio,
      resolution: shot.resolution,
      seedanceModel: shot.seedanceModel,
      generateAudio: shot.generateAudio,
      source: "storyboard-shot",
      inputMode: "reference-to-video",
      characterReferences: shot.references,
      references: continuityInput.references,
      continuityVideoReference: continuityInput.previousVideoReference,
      originalContinuityVideoReference: continuityInput.originalPreviousVideoReference,
      continuityVideoAudioStripped: continuityInput.previousVideoAudioStripped,
      continuityFrameReference: continuityInput.continuityFrameReference,
      continuityFrameToken: continuityInput.continuityFrameToken,
      shotId: shot.id,
      label: shot.title
    });
    await patchShot(projectId, shotId, { status: "done", outputRelPath: relPath, error: undefined });
  } catch (error) {
    try {
      await patchShot(projectId, shotId, { status: "failed", error: videoGenerationErrorMessage(error) });
    } catch {
      // The shot may have been deleted while the generation was running.
    }
  }
}

async function buildContinuityInput(
  storyboard: StoryboardProject,
  shot: StoryboardShot,
  projectId: string
): Promise<ContinuityInput> {
  const previous = previousImmediateShotVideoReference(storyboard, shot, projectId);
  if (!previous) return { references: shot.references };

  const videoReference = await createSilentContinuityVideo(projectId, previous, shot);
  const continuityFrameReference = await extractContinuityFrame(projectId, previous, shot);
  const references = [...shot.references, continuityFrameReference];
  return {
    previousVideoReference: videoReference.relPath,
    originalPreviousVideoReference: previous.relPath,
    previousVideoAudioStripped: videoReference.audioStripped,
    continuityFrameReference,
    continuityFrameToken: `@Image${references.length}`,
    references
  };
}

function buildContinuityPrompt(prompt: string, input: ContinuityInput): string {
  if (!input.previousVideoReference) return promptForCli(prompt);
  const audioGuard =
    "Treat @Video1 as a silent visual continuity reference only. Do not copy sound effects, footsteps, ambience, dialogue, or music from @Video1. Generate audio only from visible actions in this shot; if feet are not visibly walking or running, include no footstep sounds.";
  if (!input.continuityFrameToken) {
    return promptForCli(
      `${prompt} Use @Video1 only for visual motion continuity and the previous clip's ending state; keep @Image references as the source of character identity, face, outfit, and palette. ${audioGuard}`
    );
  }
  return promptForCli(
    `${prompt} Use ${input.continuityFrameToken} as the exact opening frame, pose, composition, and lighting continuity from the previous shot. Use @Video1 only for silent visual motion rhythm and ending-state continuity. Use @Image1 as the source of character identity, face, outfit, and palette. ${audioGuard}`
  );
}

function previousImmediateShotVideoReference(
  storyboard: StoryboardProject,
  shot: StoryboardShot,
  projectId: string
): PreviousShotVideo | undefined {
  const previous = storyboard.shots.find(
    (item) => item.order === shot.order - 1 && item.status === "done" && item.outputRelPath
  );
  if (!previous?.outputRelPath) return undefined;
  const abs = projectRelativePath(projectId, previous.outputRelPath);
  return existsSync(abs) ? { shotId: previous.id, relPath: previous.outputRelPath } : undefined;
}

async function extractContinuityFrame(
  projectId: string,
  previous: PreviousShotVideo,
  shot: StoryboardShot
): Promise<string> {
  const inputAbs = projectRelativePath(projectId, previous.relPath);
  const outputDir = "renders/continuity";
  await mkdir(projectRelativePath(projectId, outputDir), { recursive: true });
  const relPath = `${outputDir}/${shot.order + 1}-${shot.id.slice(0, 8)}-from-${previous.shotId.slice(0, 8)}.png`;
  const outputAbs = projectRelativePath(projectId, relPath);
  try {
    await execFileAsync(
      "ffmpeg",
      ["-y", "-sseof", "-0.5", "-i", inputAbs, "-frames:v", "1", "-update", "1", "-f", "image2", outputAbs],
      { timeout: 60 * 1000, maxBuffer: 1024 * 1024 * 16 }
    );
  } catch {
    const duration = await videoDuration(inputAbs);
    const frameTime = Math.max(0, duration - 0.75);
    await execFileAsync(
      "ffmpeg",
      ["-y", "-ss", String(frameTime), "-i", inputAbs, "-frames:v", "1", "-update", "1", "-f", "image2", outputAbs],
      { timeout: 60 * 1000, maxBuffer: 1024 * 1024 * 16 }
    );
  }
  if (!existsSync(outputAbs)) throw new Error("FFmpeg did not create a continuity frame.");
  return relPath;
}

async function createSilentContinuityVideo(
  projectId: string,
  previous: PreviousShotVideo,
  shot: StoryboardShot
): Promise<{ relPath: string; audioStripped: boolean }> {
  const inputAbs = projectRelativePath(projectId, previous.relPath);
  const outputDir = "renders/continuity";
  await mkdir(projectRelativePath(projectId, outputDir), { recursive: true });
  const relPath = `${outputDir}/${shot.order + 1}-${shot.id.slice(0, 8)}-motion-from-${previous.shotId.slice(0, 8)}.mp4`;
  const outputAbs = projectRelativePath(projectId, relPath);
  try {
    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", inputAbs, "-map", "0:v:0", "-c:v", "copy", "-an", "-movflags", "+faststart", outputAbs],
      { timeout: 90 * 1000, maxBuffer: 1024 * 1024 * 16 }
    );
  } catch {
    try {
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-i",
          inputAbs,
          "-map",
          "0:v:0",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "20",
          "-pix_fmt",
          "yuv420p",
          "-an",
          "-movflags",
          "+faststart",
          outputAbs
        ],
        { timeout: 180 * 1000, maxBuffer: 1024 * 1024 * 32 }
      );
    } catch {
      return { relPath: previous.relPath, audioStripped: false };
    }
  }
  if (!existsSync(outputAbs)) return { relPath: previous.relPath, audioStripped: false };
  return { relPath, audioStripped: true };
}

async function videoDuration(input: string): Promise<number> {
  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", input],
    { timeout: 30 * 1000, maxBuffer: 1024 * 1024 }
  );
  const duration = Number.parseFloat(stdout.trim());
  return Number.isFinite(duration) ? duration : 0;
}

async function hasAudioStream(input: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type", "-of", "csv=p=0", input],
      { timeout: 30 * 1000, maxBuffer: 1024 * 1024 }
    );
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

function findShot(storyboard: StoryboardProject, shotId: string): StoryboardShot {
  const shot = storyboard.shots.find((item) => item.id === shotId);
  if (!shot) throw new Error("Shot not found");
  return shot;
}

function validateShot(shot: StoryboardShot, projectId: string): void {
  if (!shot.prompt.trim()) throw new Error("Shot prompt is required");
  if (shot.references.length === 0) throw new Error("At least one reference image is required");
  for (const reference of shot.references) {
    if (reference.startsWith("-")) throw new Error("Reference path cannot start with '-'.");
    if (!reference.startsWith("http://") && !reference.startsWith("https://") && !reference.startsWith("data:")) {
      projectRelativePath(projectId, reference);
    }
  }
  for (const match of shot.prompt.matchAll(/@Image(\d+)/g)) {
    const index = Number.parseInt(match[1], 10);
    if (index < 1 || index > shot.references.length) {
      throw new Error(`${match[0]} is not selected in this shot's references`);
    }
  }
}

function validateContinuityDependency(storyboard: StoryboardProject, shot: StoryboardShot): void {
  if (shot.order === 0) return;
  const previous = storyboard.shots.find((item) => item.order === shot.order - 1);
  if (!previous) return;
  if (previous.status === "done" && previous.outputRelPath) return;
  throw new Error(
    `Previous shot must complete before generating this shot for continuity: ${previous.title} (${previous.status}). Retry the previous shot first.`
  );
}

function videoDimensions(ratio: VideoRatio, resolution: VideoResolution): { width: number; height: number } {
  const shortSide = resolution === "480p" ? 480 : resolution === "1080p" ? 1080 : 720;
  if (ratio === "1:1") return { width: toEven(shortSide), height: toEven(shortSide) };
  if (ratio === "9:16") return { width: toEven(shortSide), height: toEven(Math.round((shortSide * 16) / 9)) };
  return { width: toEven(Math.round((shortSide * 16) / 9)), height: toEven(shortSide) };
}

function toEven(value: number): number {
  return value % 2 === 0 ? value : value + 1;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const withStderr = error as Error & { stderr?: string };
    return withStderr.stderr?.trim() || error.message;
  }
  return "Unknown error";
}

function videoGenerationErrorMessage(error: unknown): string {
  const message = errorMessage(error);
  if (!/Unprocessable Entity|HTTP 422/i.test(message)) return message;
  return [
    message,
    "Seedance/fal rejected the request before returning a video. Common causes are unsupported reference media, a rejected face/person reference, or an invalid option combination. Try a more stylized fictional character sheet, fast model, 5-10s duration, or native audio off. Newer VibeFrame runs will include the fal validation body when fal returns it."
  ].join("\n\n");
}
