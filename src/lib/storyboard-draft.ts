import { randomUUID } from "node:crypto";
import { readRawKeys } from "./projects";
import { buildStoryboardDraftPrompt, promptForCli } from "./prompts";
import type {
  StoryboardPacing,
  StoryboardDraftRequest,
  StoryboardDraftResult,
  StoryboardDraftStoryBible,
  StoryboardShot,
  VideoRatio
} from "./types";

const MIN_SHOT_DURATION = 4;
const MAX_SHOT_DURATION = 15;
const MAX_UI_SCENE_COUNT = 12;
const DEFAULT_OPENAI_STORYBOARD_MODEL = "gpt-5.4-mini";
const OPENAI_STORYBOARD_MODEL = process.env.OPENAI_STORYBOARD_MODEL?.trim() || DEFAULT_OPENAI_STORYBOARD_MODEL;

type RawDraft = {
  storyBible?: Record<string, unknown>;
  shots?: Array<{
    title?: unknown;
    duration?: unknown;
    startState?: unknown;
    action?: unknown;
    endState?: unknown;
    camera?: unknown;
    transitionToNext?: unknown;
    firstFrameIntent?: unknown;
    lastFrameIntent?: unknown;
    soundDesign?: unknown;
    prompt?: unknown;
  }>;
  continuityNotes?: unknown;
  qualityChecks?: unknown;
};

type OpenAiDraftResult = {
  draft: RawDraft | null;
  error?: string;
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
};

const STORYBOARD_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["storyBible", "shots", "continuityNotes", "qualityChecks"],
  properties: {
    storyBible: {
      type: "object",
      additionalProperties: false,
      required: ["location", "lighting", "screenDirection", "characterState", "propState", "endingIntent"],
      properties: {
        location: { type: "string" },
        lighting: { type: "string" },
        screenDirection: { type: "string" },
        characterState: { type: "string" },
        propState: { type: "string" },
        endingIntent: { type: "string" }
      }
    },
    shots: {
      type: "array",
      minItems: 1,
      maxItems: MAX_UI_SCENE_COUNT,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "duration",
          "startState",
          "action",
          "endState",
          "camera",
          "transitionToNext",
          "firstFrameIntent",
          "lastFrameIntent",
          "soundDesign",
          "prompt"
        ],
        properties: {
          title: { type: "string" },
          duration: { type: "integer", minimum: MIN_SHOT_DURATION, maximum: MAX_SHOT_DURATION },
          startState: { type: "string" },
          action: { type: "string" },
          endState: { type: "string" },
          camera: { type: "string" },
          transitionToNext: { type: "string" },
          firstFrameIntent: { type: "string" },
          lastFrameIntent: { type: "string" },
          soundDesign: { type: "string" },
          prompt: { type: "string" }
        }
      }
    },
    continuityNotes: {
      type: "array",
      items: { type: "string" }
    },
    qualityChecks: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

export async function draftStoryboard(
  projectId: string,
  request: StoryboardDraftRequest
): Promise<StoryboardDraftResult> {
  const targetDuration = clampTargetDuration(request.targetDuration);
  const pacing = normalizePacing(request.pacing, request.shotStrategy);
  const requestedSceneCount = normalizeRequestedSceneCount(request.sceneCount);
  const sceneCount = normalizeSceneCount(requestedSceneCount, targetDuration, pacing);
  const promptRequestedSceneCount = requestedSceneCount === sceneCount ? requestedSceneCount : undefined;
  const references = request.characterSheetRelPath ? [request.characterSheetRelPath] : [];
  const prompt = buildStoryboardDraftPrompt({
    brief: request.brief,
    targetDuration,
    sceneCount,
    requestedSceneCount: promptRequestedSceneCount,
    pacing,
    visualStyle: request.visualStyle,
    hasCharacterSheet: references.length > 0
  });

  const keys = await readRawKeys(projectId);
  let openAiError: string | undefined;
  if (keys.openai) {
    const generated = await openAiDraft(keys.openai, prompt);
    openAiError = generated.error;
    if (generated.draft?.shots?.length) {
      return {
        success: true,
        provider: "openai",
        model: OPENAI_STORYBOARD_MODEL,
        targetDuration,
        storyBible: normalizeStoryBible(generated.draft.storyBible),
        shots: normalizeDraftShots({
          rawShots: generated.draft.shots,
          targetDuration,
          sceneCount,
          pacing,
          aspectRatio: request.aspectRatio,
          visualStyle: request.visualStyle,
          references
        }),
        continuityNotes: normalizeNotes(generated.draft.continuityNotes),
        qualityChecks: normalizeNotes(generated.draft.qualityChecks),
        referenceRelPaths: references
      };
    }
  } else {
    openAiError = "OpenAI API key is not configured.";
  }

  return {
    success: true,
    provider: "fallback",
    model: "local-fallback",
    error: openAiError,
    targetDuration,
    storyBible: fallbackStoryBible(request.brief, request.visualStyle),
    shots: fallbackShots({
      brief: request.brief,
      targetDuration,
      sceneCount,
      pacing,
      aspectRatio: request.aspectRatio,
      visualStyle: request.visualStyle,
      references
    }),
    continuityNotes: [
      `Drafted locally because OpenAI storyboard generation was unavailable.${openAiError ? ` ${openAiError}` : ""}`,
      "Review each shot prompt before provider spend."
    ],
    qualityChecks: [
      "Local fallback applied deterministic shot beats.",
      "Durations were clamped and balanced to match the target duration.",
      "Review continuity before spending video provider credits."
    ],
    referenceRelPaths: references
  };
}

async function openAiDraft(apiKey: string, prompt: string): Promise<OpenAiDraftResult> {
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: OPENAI_STORYBOARD_MODEL,
        store: false,
        input: [
          {
            role: "system",
            content:
              "You create continuity-aware structured storyboards for AI video generation. Follow the schema exactly."
          },
          { role: "user", content: prompt }
        ],
        max_output_tokens: 4000,
        text: {
          format: {
            type: "json_schema",
            name: "storyboard_draft",
            strict: true,
            schema: STORYBOARD_DRAFT_SCHEMA
          }
        }
      })
    });
    if (!response.ok) {
      return { draft: null, error: await openAiErrorMessage(response) };
    }
    const data = (await response.json()) as OpenAiResponse;
    const refusal = extractOpenAiRefusal(data);
    if (refusal) return { draft: null, error: `OpenAI refused storyboard generation: ${refusal}` };
    const content = extractOpenAiText(data);
    if (!content) return { draft: null, error: "OpenAI returned an empty storyboard response." };
    return { draft: JSON.parse(content) as RawDraft };
  } catch (error) {
    return { draft: null, error: error instanceof Error ? error.message : "OpenAI storyboard request failed." };
  }
}

async function openAiErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) return `OpenAI returned HTTP ${response.status}.`;
  try {
    const data = JSON.parse(text) as { error?: { message?: string } };
    return data.error?.message ?? `OpenAI returned HTTP ${response.status}.`;
  } catch {
    return text.slice(0, 500);
  }
}

function extractOpenAiText(data: OpenAiResponse): string | undefined {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  for (const output of data.output ?? []) {
    for (const item of output.content ?? []) {
      if ((item.type === "output_text" || item.type === "text") && item.text?.trim()) return item.text;
    }
  }
  return undefined;
}

function extractOpenAiRefusal(data: OpenAiResponse): string | undefined {
  for (const output of data.output ?? []) {
    for (const item of output.content ?? []) {
      if (item.type === "refusal" && item.refusal?.trim()) return item.refusal;
    }
  }
  return undefined;
}

function normalizeDraftShots(input: {
  rawShots: NonNullable<RawDraft["shots"]>;
  targetDuration: number;
  sceneCount: number;
  pacing: StoryboardPacing;
  aspectRatio?: VideoRatio;
  visualStyle?: string;
  references: string[];
}): StoryboardShot[] {
  const rawShots = normalizeRawShotCount(input.rawShots, input.sceneCount);
  const durations = fitDurations(
    rawShots.map((shot) => numberOr(shot.duration, Number.NaN)),
    input.targetDuration,
    input.sceneCount,
    input.pacing
  );
  const now = new Date().toISOString();
  return rawShots.map((shot, index) =>
    makeShot({
      title: stringOr(shot.title, `Shot ${index + 1}`),
      duration: durations[index] ?? 5,
      prompt: ensureReferencePrompt(
        composeShotPrompt({
          prompt: stringOr(shot.prompt, ""),
          startState: stringOr(shot.startState, ""),
          firstFrameIntent: stringOr(shot.firstFrameIntent, ""),
          action: stringOr(shot.action, ""),
          lastFrameIntent: stringOr(shot.lastFrameIntent, ""),
          endState: stringOr(shot.endState, ""),
          camera: stringOr(shot.camera, ""),
          soundDesign: stringOr(shot.soundDesign, ""),
          transitionToNext: stringOr(shot.transitionToNext, "")
        }),
        input.visualStyle,
        input.references.length > 0
      ),
      order: index,
      references: input.references,
      aspectRatio: input.aspectRatio,
      now
    })
  );
}

function fallbackShots(input: {
  brief: string;
  targetDuration: number;
  sceneCount: number;
  pacing: StoryboardPacing;
  aspectRatio?: VideoRatio;
  visualStyle?: string;
  references: string[];
}): StoryboardShot[] {
  const durations = durationsForPlan(input.targetDuration, input.sceneCount, input.pacing);
  const beats = [
    {
      title: "Opening",
      startState: "the scene begins on a readable wide view of the location before the character fully enters",
      action: "establish the main location and character presence with a clean cinematic opening frame",
      endState: "the character is fully visible and moving in a clear direction",
      camera: "wide establishing frame with a slow push-in",
      soundDesign: "low rain ambience, distant neon hum, soft fabric movement, no loud footsteps until the character's feet are visible",
      transitionToNext: "carry the character's movement direction into the next shot"
    },
    {
      title: "Movement",
      startState: "the character continues from the previous direction with the same pace and posture",
      action: "show the character moving through the scene with one clear physical action and consistent silhouette",
      endState: "the character reaches a point where the face and gear can be seen closer",
      camera: "medium tracking shot that preserves screen direction",
      soundDesign: "controlled footfalls synced only to visible steps, light bag strap movement, wet street ambience",
      transitionToNext: "end close enough for the next shot to pick up facial identity and outfit detail"
    },
    {
      title: "Close Detail",
      startState: "the character arrives in the same location and turns slightly toward camera",
      action: "move into a close medium shot that shows face identity, outfit texture, and important gear details",
      endState: "the character notices or decides something specific",
      camera: "close medium shot with shallow depth of field and restrained motion",
      soundDesign: "close room tone, soft breath, subtle jacket fabric, no footsteps because feet are not visible",
      transitionToNext: "hold the decision beat so the next shot can show the resulting action"
    },
    {
      title: "Story Beat",
      startState: "the character continues from the decision beat without changing outfit, lighting, or location logic",
      action: "show the character making a decision or interacting with a key object in the environment",
      endState: "the interaction creates a reason for stronger movement",
      camera: "medium shot with a clear readable action",
      soundDesign: "small prop handling sound, restrained electronic cue, ambience matching the same location",
      transitionToNext: "end with the body angled into the dynamic movement of the next shot"
    },
    {
      title: "Dynamic Push",
      startState: "the character launches from the previous body angle and keeps the same screen direction",
      action: "create the most dynamic moment with controlled camera motion and readable action",
      endState: "the character slows or lands into a composed final position",
      camera: "controlled handheld push or tracking move, not chaotic",
      soundDesign: "visible movement sounds only, brief fabric rush, landing or footfall only if shown in frame, no unrelated repeated footsteps",
      transitionToNext: "finish with a stable pose that can cut into the final look"
    },
    {
      title: "Final Look",
      startState: "the character settles from the previous motion into a stable final position",
      action: "end on a clean memorable pose or look that resolves the scene",
      endState: "the character holds a confident final expression",
      camera: "quiet close-up or close medium ending frame",
      soundDesign: "quiet final ambience, soft breath, subtle fabric, no footsteps or action impacts",
      transitionToNext: "final shot, no further handoff needed"
    }
  ];
  const now = new Date().toISOString();
  return durations.map((duration, index) => {
    const beat = beats[index] ?? {
      title: `Shot ${index + 1}`,
      startState: "continue from the previous shot's ending state",
      action: "continue the visual story with one clear cinematic action",
      endState: "end in a stable readable pose for the next cut",
      camera: "simple cinematic camera movement",
      soundDesign: "audio matches only the visible action in this shot, no unrelated carryover sounds",
      transitionToNext: "preserve screen direction and scene continuity"
    };
    const prompt = composeShotPrompt({
      startState: beat.startState,
      action: beat.action,
      endState: beat.endState,
      camera: beat.camera,
      soundDesign: beat.soundDesign,
      transitionToNext: beat.transitionToNext,
      prompt: [
        `Video brief: ${input.brief}`,
        input.visualStyle ? `Visual style: ${input.visualStyle}` : ""
      ]
        .filter(Boolean)
        .join(". ")
    });
    return makeShot({
      title: beat.title,
      duration,
      prompt: ensureReferencePrompt(prompt, input.visualStyle, input.references.length > 0),
      order: index,
      references: input.references,
      aspectRatio: input.aspectRatio,
      now
    });
  });
}

function makeShot(input: {
  title: string;
  duration: number;
  prompt: string;
  order: number;
  references: string[];
  aspectRatio?: VideoRatio;
  now: string;
}): StoryboardShot {
  return {
    id: randomUUID(),
    order: input.order,
    title: input.title.slice(0, 80),
    duration: clampShotDuration(input.duration),
    prompt: promptForCli(input.prompt),
    references: input.references,
    ratio: input.aspectRatio ?? "16:9",
    resolution: "720p",
    seedanceModel: "fast",
    generateAudio: true,
    status: "draft",
    createdAt: input.now,
    updatedAt: input.now
  };
}

function ensureReferencePrompt(prompt: string, visualStyle: string | undefined, hasReference: boolean): string {
  const base = prompt.trim() || "Create one cinematic shot with a clear camera move and consistent character identity.";
  const reference =
    hasReference && !/\bUse\s+@Image1\b/i.test(base)
      ? "Use @Image1 as the primary character sheet reference."
      : "";
  const consistency = "Keep face, hair, outfit, palette, proportions, and gear consistent.";
  const audio =
    "Native audio must match only the visible action in this shot; do not carry over footsteps, impacts, engines, dialogue, music, or ambience from another shot unless explicitly visible here.";
  const style = visualStyle && !base.includes(visualStyle) ? `Visual style: ${visualStyle}.` : "";
  return [reference, base, consistency, audio, style].filter(Boolean).join(" ");
}

function composeShotPrompt(input: {
  prompt: string;
  startState?: string;
  firstFrameIntent?: string;
  action?: string;
  lastFrameIntent?: string;
  endState?: string;
  camera?: string;
  soundDesign?: string;
  transitionToNext?: string;
}): string {
  return [
    input.prompt,
    input.startState ? `Start state: ${input.startState}.` : "",
    input.firstFrameIntent ? `Opening frame intent: ${input.firstFrameIntent}.` : "",
    input.action ? `Main action: ${input.action}.` : "",
    input.camera ? `Camera: ${input.camera}.` : "",
    input.lastFrameIntent ? `Ending frame intent: ${input.lastFrameIntent}.` : "",
    input.endState ? `End state: ${input.endState}.` : "",
    input.soundDesign ? `Sound design: ${input.soundDesign}.` : "",
    input.transitionToNext ? `Continuity handoff: ${input.transitionToNext}.` : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function durationsForPlan(total: number, sceneCount: number, pacing: StoryboardPacing): number[] {
  return fitDurations([], total, sceneCount, pacing);
}

function fitDurations(
  values: number[],
  total: number,
  sceneCount: number,
  pacing: StoryboardPacing
): number[] {
  const fallback = weightedDurations(total, sceneCount, pacing);
  const out = Array.from({ length: sceneCount }, (_item, index) =>
    Number.isFinite(values[index]) ? clampShotDuration(values[index]) : fallback[index]
  );
  let sum = out.reduce((acc, value) => acc + value, 0);
  while (sum < total) {
    const index = preferredDurationIndexes(sceneCount, pacing).find((item) => out[item] < MAX_SHOT_DURATION);
    if (index === undefined) break;
    out[index] += 1;
    sum = out.reduce((acc, value) => acc + value, 0);
  }
  while (sum > total) {
    const index = [...preferredDurationIndexes(sceneCount, pacing)]
      .reverse()
      .find((item) => out[item] > MIN_SHOT_DURATION);
    if (index === undefined) break;
    out[index] -= 1;
    sum = out.reduce((acc, value) => acc + value, 0);
  }
  return out;
}

function weightedDurations(total: number, sceneCount: number, pacing: StoryboardPacing): number[] {
  const out = Array.from({ length: sceneCount }, () => MIN_SHOT_DURATION);
  let remaining = total - sceneCount * MIN_SHOT_DURATION;
  const order = preferredDurationIndexes(sceneCount, pacing);
  while (remaining > 0) {
    const index = order.find((item) => out[item] < MAX_SHOT_DURATION);
    if (index === undefined) break;
    out[index] += 1;
    remaining -= 1;
  }
  return out;
}

function preferredDurationIndexes(sceneCount: number, pacing: StoryboardPacing): number[] {
  return Array.from({ length: sceneCount }, (_item, index) => index).sort((a, b) => {
    const diff = durationWeight(b, sceneCount, pacing) - durationWeight(a, sceneCount, pacing);
    return diff === 0 ? a - b : diff;
  });
}

function durationWeight(index: number, sceneCount: number, pacing: StoryboardPacing): number {
  if (sceneCount <= 1) return 1;
  const position = index / (sceneCount - 1);
  const endingBoost = position > 0.7 ? 0.25 : 0;
  const openingBoost = index === 0 ? 0.15 : 0;
  const middleBoost = Math.abs(position - 0.55) < 0.18 ? 0.12 : 0;
  const alternating = index % 2 === 0 ? 0.05 : -0.05;
  if (pacing === "slow") return 1 + openingBoost + endingBoost + middleBoost * 0.5;
  if (pacing === "fast") return 1 + endingBoost * 0.6 + alternating;
  return 1 + openingBoost + endingBoost + middleBoost + alternating;
}

function normalizeStoryBible(value: unknown): StoryboardDraftStoryBible {
  const source = isRecord(value) ? value : {};
  return {
    location: stringOr(source.location, "single continuous cinematic location"),
    lighting: stringOr(source.lighting, "consistent motivated cinematic lighting"),
    screenDirection: stringOr(source.screenDirection, "preserve screen direction across cuts"),
    characterState: stringOr(source.characterState, "same character identity, outfit, posture logic, and emotional arc"),
    propState: stringOr(source.propState, "props and gear remain physically consistent"),
    endingIntent: stringOr(source.endingIntent, "end on a clean readable state for the final clip")
  };
}

function fallbackStoryBible(brief: string, visualStyle: string | undefined): StoryboardDraftStoryBible {
  return {
    location: brief.trim() || "single continuous cinematic location",
    lighting: visualStyle?.trim() || "consistent motivated cinematic lighting",
    screenDirection: "preserve the same movement direction and geography between shots",
    characterState: "carry the character's posture, expression, outfit, and motion state forward between cuts",
    propState: "keep all bags, gear, handheld props, weather, and environment details stable",
    endingIntent: "each shot should end in a readable frame that can become the next shot's opening reference"
  };
}

function normalizeNotes(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizePacing(value: unknown, legacyStrategy: unknown): StoryboardPacing {
  if (value === "auto" || value === "slow" || value === "balanced" || value === "fast") return value;
  if (legacyStrategy === "10s-cinematic") return "slow";
  if (legacyStrategy === "5s-dense") return "fast";
  if (legacyStrategy === "mixed") return "balanced";
  return "auto";
}

function normalizeRequestedSceneCount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(1, Math.min(MAX_UI_SCENE_COUNT, Math.round(value)));
}

function normalizeSceneCount(
  requestedSceneCount: number | undefined,
  targetDuration: number,
  pacing: StoryboardPacing
): number {
  const minCount = Math.max(1, Math.ceil(targetDuration / MAX_SHOT_DURATION));
  const maxCount = Math.max(minCount, Math.min(MAX_UI_SCENE_COUNT, Math.floor(targetDuration / MIN_SHOT_DURATION)));
  if (requestedSceneCount) return Math.max(minCount, Math.min(maxCount, requestedSceneCount));
  const secondsPerScene =
    pacing === "slow" ? 10 :
    pacing === "fast" ? 5 :
    6;
  return Math.max(minCount, Math.min(maxCount, Math.round(targetDuration / secondsPerScene)));
}

function normalizeRawShotCount(
  rawShots: NonNullable<RawDraft["shots"]>,
  sceneCount: number
): NonNullable<RawDraft["shots"]> {
  const out = rawShots.slice(0, sceneCount);
  while (out.length < sceneCount) out.push({});
  return out;
}

function clampTargetDuration(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 30;
  return Math.max(5, Math.min(180, Math.round(value)));
}

function clampShotDuration(value: number): number {
  return Math.max(MIN_SHOT_DURATION, Math.min(MAX_SHOT_DURATION, Math.round(value)));
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
