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

type FallbackBeat = {
  title: string;
  startState: string;
  firstFrameIntent: string;
  action: string;
  lastFrameIntent: string;
  endState: string;
  camera: string;
  soundDesign: string;
  transitionToNext: string;
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
  const beats = selectFallbackBeats(fallbackBeatPlan(input.brief), durations.length);
  const now = new Date().toISOString();
  return durations.map((duration, index) => {
    const beat = beats[index] ?? continuationFallbackBeat(index);
    const prompt = composeShotPrompt({
      startState: beat.startState,
      firstFrameIntent: beat.firstFrameIntent,
      action: beat.action,
      lastFrameIntent: beat.lastFrameIntent,
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

function fallbackBeatPlan(brief: string): FallbackBeat[] {
  const lower = brief.toLowerCase();
  if (/\brooftop|parkour|ledge|gap|vault|slide\b/.test(lower)) return rooftopFallbackBeats();
  if (/\bchase|sprint|alley|drone|barrier|steam\b/.test(lower)) return chaseFallbackBeats();
  if (/\bheist|market|delivery|package|terminal|scanner|scan\b/.test(lower)) return heistFallbackBeats();
  if (/\breveal|close-up|closeup|portrait|face|expression\b/.test(lower)) return revealFallbackBeats();
  return generalFallbackBeats();
}

function selectFallbackBeats(beats: FallbackBeat[], sceneCount: number): FallbackBeat[] {
  if (beats.length === sceneCount) return beats;
  if (beats.length > sceneCount) {
    if (sceneCount <= 1) return [beats[0]];
    return Array.from({ length: sceneCount }, (_item, index) => {
      const sourceIndex = Math.round((index * (beats.length - 1)) / (sceneCount - 1));
      return beats[sourceIndex] ?? beats[beats.length - 1];
    });
  }
  const out = [...beats];
  while (out.length < sceneCount) {
    out.splice(Math.max(1, out.length - 1), 0, continuationFallbackBeat(out.length));
  }
  return out;
}

function continuationFallbackBeat(index: number): FallbackBeat {
  return {
    title: `Bridge Beat ${index + 1}`,
    startState: "the character continues from the previous ending pose with the same outfit, lighting, screen direction, and geography",
    firstFrameIntent: "match the previous final pose as closely as possible and keep the body readable",
    action: "perform one clear transitional movement that advances the scene without adding a second action beat",
    lastFrameIntent: "finish on a stable readable pose that can become the next starting frame",
    endState: "the character is balanced and pointed toward the next intended movement",
    camera: "controlled tracking camera with clear silhouette and no chaotic cuts",
    soundDesign: "only visible movement sounds, fabric motion, breath, and matching location ambience",
    transitionToNext: "preserve the final pose, direction, location, and lighting for the next shot"
  };
}

function rooftopFallbackBeats(): FallbackBeat[] {
  return [
    {
      title: "Rooftop Launch",
      startState: "the character is crouched on a rooftop ledge at dusk, facing left-to-right along the route",
      firstFrameIntent: "full-body silhouette on the ledge with the skyline behind and the route visible ahead",
      action: "push off from the ledge into the first controlled sprint steps",
      lastFrameIntent: "end in a forward-running pose before the first obstacle",
      endState: "the character is accelerating toward a cluster of rooftop pipes",
      camera: "low side-tracking camera with slight front three-quarter lead and strong rooftop parallax",
      soundDesign: "visible shoe scuffs, fabric flutter, controlled breath, faint rooftop wind",
      transitionToNext: "carry the same left-to-right momentum into the pipe obstacle"
    },
    {
      title: "Pipe Step",
      startState: "the character reaches the pipe cluster with forward momentum intact",
      firstFrameIntent: "feet and lower body are visible so the obstacle contact is readable",
      action: "step cleanly over one pipe cluster with compact footwork",
      lastFrameIntent: "end balanced beyond the pipe with the torso leaning into the next move",
      endState: "the character clears the pipes and approaches a sign frame",
      camera: "hip-height tracking shot with foreground pipes crossing frame",
      soundDesign: "one light metal tap, concrete footfall, fabric movement, rooftop ambience",
      transitionToNext: "keep the runner lined up for the sign-frame vault"
    },
    {
      title: "Sign Vault",
      startState: "the character arrives at a mounted sign frame on the same rooftop path",
      firstFrameIntent: "hands, hips, and feet are visible before contact",
      action: "vault across the sign frame in one readable athletic motion",
      lastFrameIntent: "end with both feet returning to the roof and momentum still forward",
      endState: "the character lands low and prepares for a lower obstacle",
      camera: "slight push-in during the vault with clean silhouette and no impossible hang time",
      soundDesign: "hand contact, brief metal flex, landing thump, breath, wind",
      transitionToNext: "drop the body line toward the upcoming low-beam slide"
    },
    {
      title: "Low Slide",
      startState: "the character is already low and approaching a beam at the same speed",
      firstFrameIntent: "the low beam fills the foreground and the body is compressed into frame",
      action: "slide under the beam in one continuous controlled movement",
      lastFrameIntent: "end with the character clearing the beam and starting to rise",
      endState: "the character exits the slide low but stable, still moving left-to-right",
      camera: "camera dips with the slide and passes close to the foreground beam",
      soundDesign: "fabric scrape, breath exhale, shoe friction, rooftop wind",
      transitionToNext: "rise out of the slide into the run-up for the gap"
    },
    {
      title: "Gap Commit",
      startState: "the character has risen from the slide and faces a narrow rooftop gap",
      firstFrameIntent: "the gap is visible and the character is in a committed takeoff posture",
      action: "take one leap across the narrow gap",
      lastFrameIntent: "end at the instant before the landing with the far roof filling frame",
      endState: "the character is crossing the gap with believable weight and trajectory",
      camera: "side-tracking push with skyline parallax and no exaggerated acrobatics",
      soundDesign: "one takeoff step, fabric rush, brief open-air wind",
      transitionToNext: "continue directly into the landing absorption"
    },
    {
      title: "Landing Absorb",
      startState: "the character arrives over the far rooftop edge from the same gap trajectory",
      firstFrameIntent: "feet are about to contact the far roof and the body is braced",
      action: "land with realistic knee absorption and regain balance",
      lastFrameIntent: "end with the character planted and turning the torso slightly",
      endState: "the character is stable near the far edge after the landing",
      camera: "tracking camera settles into a medium-wide frame as the impact resolves",
      soundDesign: "soft landing thump, shoe grip, controlled breath, distant city ambience",
      transitionToNext: "settle the body for a final skyline lookback"
    },
    {
      title: "Skyline Lookback",
      startState: "the character stands near the far rooftop edge after the landing",
      firstFrameIntent: "balanced silhouette near the edge with the skyline behind",
      action: "turn the head and upper body back toward the glowing skyline",
      lastFrameIntent: "end on a stable composed lookback pose",
      endState: "the character holds a calm final expression and readable silhouette",
      camera: "steady medium shot with subtle push-in and soft neon rim light",
      soundDesign: "soft breath, fabric settling, rooftop wind, distant city ambience, no footsteps",
      transitionToNext: "final shot, hold the pose without adding another action"
    }
  ];
}

function chaseFallbackBeats(): FallbackBeat[] {
  return [
    {
      title: "Signal Detect",
      startState: "the character stands in a rain-slick alley with a drone light beginning to search behind",
      firstFrameIntent: "medium-wide alley frame with wet neon reflections and the character readable",
      action: "notice the pursuing drone signal and shift into a ready stance",
      lastFrameIntent: "end with the body angled into the escape path",
      endState: "the character is ready to sprint out of the alley",
      camera: "handheld push-in from behind foreground steam and signage",
      soundDesign: "rain ambience, soft electronic scan, jacket movement, no footsteps yet",
      transitionToNext: "launch the prepared body angle into the first sprint"
    },
    {
      title: "Wet Sprint",
      startState: "the character launches from the alley mouth into the same screen direction",
      firstFrameIntent: "feet are visible on wet pavement at the first stride",
      action: "sprint through neon reflections for one clean acceleration beat",
      lastFrameIntent: "end approaching a low street barrier",
      endState: "the character is moving fast toward the barrier",
      camera: "side-tracking shot with wet ground reflections and foreground sign blur",
      soundDesign: "visible wet footfalls, fabric movement, rain, distant city hum",
      transitionToNext: "keep speed and direction into the barrier vault"
    },
    {
      title: "Barrier Vault",
      startState: "the character reaches a low street barrier at full but controlled speed",
      firstFrameIntent: "barrier, hands, and feet are visible before contact",
      action: "vault the barrier in one readable movement",
      lastFrameIntent: "end with feet back on pavement beyond the barrier",
      endState: "the character clears the barrier and keeps running",
      camera: "three-quarter tracking camera with a clean foreground occlusion pass",
      soundDesign: "one hand contact, barrier rattle, landing splash, breath",
      transitionToNext: "carry the landing into the steam cut"
    },
    {
      title: "Steam Cut",
      startState: "the character runs toward a venting steam column on the same street",
      firstFrameIntent: "steam blooms ahead but the silhouette remains readable",
      action: "cut through the steam with one sharp direction change",
      lastFrameIntent: "end as the character exits the steam into clearer neon light",
      endState: "the character has broken line of sight from the drone",
      camera: "brief whip-pan that resolves into a stable tracking shot",
      soundDesign: "steam hiss, one visible foot plant, fabric rush, rain ambience",
      transitionToNext: "use the clear exit frame for the escape close-up"
    },
    {
      title: "Escape Close",
      startState: "the character slows just beyond the steam with the chase behind",
      firstFrameIntent: "close medium frame with face, jacket collar, and breath visible",
      action: "turn toward camera with a controlled confident expression",
      lastFrameIntent: "end on a stable face close-up",
      endState: "the character has escaped and is composed",
      camera: "controlled push-in with shallow depth of field and soft neon edge light",
      soundDesign: "soft breath, rain, distant drone fading, no footsteps because feet are not visible",
      transitionToNext: "final shot, hold the expression"
    }
  ];
}

function heistFallbackBeats(): FallbackBeat[] {
  return [
    {
      title: "Risk Signal",
      startState: "the character is still in a crowded night-market edge with a delivery signal arriving",
      firstFrameIntent: "hands and face are readable as the signal lights the gear",
      action: "check the risky delivery signal on a compact device",
      lastFrameIntent: "end with the device lowered and the route chosen",
      endState: "the character knows the route and is ready to move",
      camera: "close medium push-in with soft crowd motion behind",
      soundDesign: "small device beep, cloth movement, market ambience, no footsteps",
      transitionToNext: "carry the chosen direction into the market pass"
    },
    {
      title: "Market Pass",
      startState: "the character enters the market route from the same direction",
      firstFrameIntent: "full body is visible among stalls and moving foreground people",
      action: "thread through one narrow market gap without colliding",
      lastFrameIntent: "end clear of the crowd and approaching a scanner beam",
      endState: "the character has reached the scanner checkpoint",
      camera: "motivated tracking shot through foreground stalls",
      soundDesign: "visible footsteps, fabric brush, crowd walla, distant rain",
      transitionToNext: "keep the body low and prepared for the scanner dodge"
    },
    {
      title: "Scanner Dodge",
      startState: "the scanner light sweeps across the route ahead",
      firstFrameIntent: "the beam path is visible before the character moves",
      action: "duck past one sweeping scanner beam",
      lastFrameIntent: "end with the character beyond the beam beside a hidden terminal",
      endState: "the character reaches the hidden terminal without being scanned",
      camera: "low tracking camera with the beam crossing foreground",
      soundDesign: "scanner sweep, one quick foot plant, breath, cloth movement",
      transitionToNext: "land beside the terminal for the package swap"
    },
    {
      title: "Package Swap",
      startState: "the character is beside the hidden terminal with the package in reach",
      firstFrameIntent: "hands, package, and terminal are all visible",
      action: "swap the package into the terminal slot",
      lastFrameIntent: "end with the terminal closed and the hands leaving frame",
      endState: "the package exchange is complete",
      camera: "tight practical close-up with no readable text requirement",
      soundDesign: "soft package slide, terminal click, fabric movement, market ambience",
      transitionToNext: "lift from the hands back to the exit direction"
    },
    {
      title: "Exit Glance",
      startState: "the character exits the terminal area into the same market lighting",
      firstFrameIntent: "medium frame with face, bag, and background route visible",
      action: "look back once with a calm confident glance",
      lastFrameIntent: "end on a stable face-and-gear composition",
      endState: "the character is clear of the exchange and composed",
      camera: "restrained push-in with foreground crowd passing briefly",
      soundDesign: "soft breath, distant market ambience, no footsteps unless feet are visible",
      transitionToNext: "final shot, hold the look"
    }
  ];
}

function revealFallbackBeats(): FallbackBeat[] {
  return [
    {
      title: "Waiting Frame",
      startState: "the character waits under soft city light in a stable location",
      firstFrameIntent: "medium-wide frame with the character still and the environment readable",
      action: "hold a quiet waiting pose while fabric and hair move subtly",
      lastFrameIntent: "end with the character noticing something off-screen",
      endState: "attention shifts toward the off-screen signal",
      camera: "slow restrained push-in with shallow depth beginning to form",
      soundDesign: "city ambience, soft fabric, light wind, no footsteps",
      transitionToNext: "carry the off-screen attention into the gear adjustment"
    },
    {
      title: "Gear Adjust",
      startState: "the character keeps looking toward the off-screen cue",
      firstFrameIntent: "hands and the gear detail are visible before contact",
      action: "adjust one visible piece of gear",
      lastFrameIntent: "end with the hand leaving the gear and the face clearer",
      endState: "the character is prepared and focused",
      camera: "close medium detail shot with stable framing",
      soundDesign: "small strap movement, soft fabric, breath, city ambience",
      transitionToNext: "lift attention from gear to face"
    },
    {
      title: "Face Push",
      startState: "the character is prepared and turned slightly toward camera",
      firstFrameIntent: "face, hair, collar, and key outfit details are sharp",
      action: "turn the eyes and head slightly toward camera",
      lastFrameIntent: "end on a composed face close-up",
      endState: "the character holds a decisive expression",
      camera: "slow close-up push with shallow depth of field",
      soundDesign: "soft breath, quiet ambience, no footsteps or impacts",
      transitionToNext: "final shot, hold the expression"
    }
  ];
}

function generalFallbackBeats(): FallbackBeat[] {
  return [
    {
      title: "Opening",
      startState: "the scene begins on a readable wide view of one continuous location before the character fully moves",
      firstFrameIntent: "establish the location, lighting direction, character silhouette, and movement direction",
      action: "enter the scene with one clean motivated movement",
      lastFrameIntent: "end with the character fully visible and aimed toward the next action",
      endState: "the character is moving in a clear direction",
      camera: "wide establishing frame with a slow motivated push-in",
      soundDesign: "location ambience, soft fabric movement, no loud footsteps until feet are visible",
      transitionToNext: "carry the same movement direction into the next shot"
    },
    {
      title: "Movement",
      startState: "the character continues from the previous direction with the same pace and posture",
      firstFrameIntent: "match the previous end pose and keep the full body readable",
      action: "perform one clear movement through the environment",
      lastFrameIntent: "end close enough to reveal face and gear detail",
      endState: "the character reaches a point where identity and gear can be seen closer",
      camera: "medium tracking shot that preserves screen direction",
      soundDesign: "visible footfalls only when feet are shown, fabric movement, matching ambience",
      transitionToNext: "end in a stable frame that can cut to a detail shot"
    },
    {
      title: "Close Detail",
      startState: "the character arrives in the same location and turns slightly toward camera",
      firstFrameIntent: "face, outfit texture, and important gear are readable",
      action: "settle into one close identity beat",
      lastFrameIntent: "end with a specific decision or attention shift",
      endState: "the character notices or decides something specific",
      camera: "close medium shot with shallow depth of field and restrained motion",
      soundDesign: "close room tone, soft breath, subtle jacket fabric, no footsteps",
      transitionToNext: "hold the decision beat so the next shot can show the resulting action"
    },
    {
      title: "Dynamic Push",
      startState: "the character launches from the previous body angle and keeps the same screen direction",
      firstFrameIntent: "body is readable at the start of the movement",
      action: "perform the strongest single physical action in the sequence",
      lastFrameIntent: "end with the action resolved into a stable pose",
      endState: "the character slows or lands into a composed final position",
      camera: "controlled handheld push or tracking move, not chaotic",
      soundDesign: "visible movement sounds only, brief fabric rush, landing or footfall only if shown",
      transitionToNext: "finish with a stable pose that can cut into the final look"
    },
    {
      title: "Final Look",
      startState: "the character settles from the previous motion into a stable final position",
      firstFrameIntent: "face and silhouette are cleanly readable",
      action: "hold one clean memorable look that resolves the scene",
      lastFrameIntent: "end on a stable final expression",
      endState: "the character holds a confident final expression",
      camera: "quiet close-up or close medium ending frame",
      soundDesign: "quiet final ambience, soft breath, subtle fabric, no footsteps or action impacts",
      transitionToNext: "final shot, no further handoff needed"
    }
  ];
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
    generationMode: input.order === 0 ? "omni-reference" : "strict-continuation",
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
  const hasStructuredFields = Boolean(
    input.startState ||
      input.firstFrameIntent ||
      input.action ||
      input.camera ||
      input.lastFrameIntent ||
      input.endState ||
      input.soundDesign ||
      input.transitionToNext
  );
  return [
    hasStructuredFields ? "Single continuous shot with one main physical action." : input.prompt,
    input.startState ? `Start state: ${input.startState}.` : "",
    input.firstFrameIntent ? `Opening frame intent: ${input.firstFrameIntent}.` : "",
    input.action ? `Main action: ${input.action}.` : "",
    input.camera ? `Camera: ${input.camera}.` : "",
    input.lastFrameIntent ? `Ending frame intent: ${input.lastFrameIntent}.` : "",
    input.endState ? `End state: ${input.endState}.` : "",
    input.soundDesign ? `Sound design: ${input.soundDesign}.` : "",
    input.transitionToNext ? `Continuity handoff: ${input.transitionToNext}.` : "",
    hasStructuredFields ? "Avoid cuts, new locations, outfit changes, identity drift, extra action beats, and unrelated sounds." : ""
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
