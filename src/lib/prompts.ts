import type { GenerateImagesRequest } from "./types";

export function buildCharacterSheetPrompt(input: string | GenerateImagesRequest, style = ""): string {
  const request =
    typeof input === "string"
      ? { character: input, style }
      : input;
  const characterName = request.characterName?.trim();
  const role = request.role?.trim();
  const outfit = request.outfit?.trim();
  const gear = request.gear?.trim();
  const movementStyle = request.movementStyle?.trim();
  const palette = request.palette?.trim();
  const visualStyle = request.style?.trim();
  const base = [
    "Create one high-resolution production character sheet image for AI video reference, similar to a professional animation/game model sheet.",
    "The character must be a fictional original character, not a real person, celebrity, public figure, or photorealistic identity reference.",
    characterName ? `Character name: ${characterName}` : "",
    `Core character: ${request.character.trim()}`,
    role ? `Role/archetype: ${role}` : "",
    outfit ? `Outfit and silhouette: ${outfit}` : "",
    gear ? `Gear and important details: ${gear}` : "",
    movementStyle ? `Movement/action identity: ${movementStyle}` : "",
    palette ? `Color palette: ${palette}` : "",
    visualStyle ? `Visual style: ${visualStyle}` : "",
    "One clean wide sheet/canvas containing many organized panels of the exact same character.",
    "Required top section: turnaround views, full body front, 3/4 front, side, 3/4 back, and back, consistent proportions and outfit details.",
    "Required face section: close-up facial expressions, neutral, focused, calm, alert, serious, slight smile, same face identity.",
    "Required movement section: 4-6 dynamic action or gesture poses that match the role and movement identity.",
    "Required detail section: close-ups of clothing fabric, bag/gear, shoes, accessories, key props, and silhouette.",
    "Required palette section: small clean color swatches for primary, secondary, accent, dark, and light tones.",
    "Keep identity, clothing, palette, proportions, face, hair, body type, and accessories consistent across every panel.",
    "Keep the face clearly stylized for animation/game production while preserving readable facial structure; avoid passport-photo realism or real-person likeness.",
    "Neutral clean studio background, crisp panel spacing, readable composition for Seedance 2.0 Omni Reference.",
    "No watermark, no logo. Any text labels must be non-essential; the visual panels must work even if text is ignored."
  ]
    .filter(Boolean)
    .join(" ");
  return promptForCli(base);
}

export function buildStoryboardDraftPrompt(input: {
  brief: string;
  targetDuration: number;
  sceneCount: number;
  requestedSceneCount?: number;
  pacing: string;
  visualStyle?: string;
  hasCharacterSheet: boolean;
}): string {
  const averageShotDuration = input.targetDuration / Math.max(1, input.sceneCount);
  const sustainedActionPlan = input.sceneCount <= 2 && averageShotDuration >= 12;
  const pacingNote =
    sustainedActionPlan
      ? "Pacing: sustained hero action. Each shot should feel like one continuous action set-piece with fast internal motion, not a calm setup or a montage of unrelated cuts."
      : input.pacing === "slow"
      ? "Pacing: slow cinematic. Prefer fewer, more sustained shots and restrained camera motion."
      : input.pacing === "fast"
        ? "Pacing: fast cuts. Prefer shorter shots, clearer action beats, and direct transitions."
        : input.pacing === "balanced"
          ? "Pacing: balanced. Vary shot length by narrative importance while keeping the sequence readable."
          : "Pacing: auto. Choose shot emphasis by story importance and avoid a mechanical rhythm.";
  return promptForCli(
    [
      "Create a production-ready storyboard shot list for AI video generation with Seedance 2.0 Omni Reference.",
      `Target total duration: ${input.targetDuration} seconds.`,
      `Create exactly ${input.sceneCount} scenes/shots.`,
      input.requestedSceneCount
        ? `The user explicitly requested ${input.requestedSceneCount} scenes; satisfy that exact scene count.`
        : "The scene count was selected automatically for this total duration and pacing.",
      pacingNote,
      input.visualStyle ? `Visual style: ${input.visualStyle}` : "",
      input.hasCharacterSheet
        ? "A character sheet image will be passed as @Image1. Every shot prompt must explicitly start with: Use @Image1 as the primary character sheet reference."
        : "No character sheet is selected. Write prompts that can still work from text only.",
      "Follow Seedance reference-to-video prompting practice: bind each reference to one clear role, keep @Image1 for identity/appearance, and describe action, camera, framing, lighting, sound design, and continuity in explicit natural language.",
      "If a previous shot video is later passed as @Video1, it is only for silent visual motion continuity; do not make the prompt depend on copying its sound, dialogue, ambience, or music.",
      "First create a compact storyBible for the whole sequence: location, lighting, screenDirection, characterState, propState, and endingIntent.",
      "Each shot must be feasible as an independent Seedance clip, duration 4-15 seconds.",
      "Durations must be whole seconds, vary by narrative importance, and sum exactly to the target total duration.",
      "Do not make every shot the same duration unless the requested count and total duration make that the only natural choice.",
      "Build one continuous scene, not unrelated clips. Each shot must carry a clear state handoff from the previous shot into the next shot.",
      "For every shot, include startState, action, endState, camera, and transitionToNext. The startState must match the previous shot's endState.",
      "For every shot, include firstFrameIntent and lastFrameIntent so the video generator has clear opening and ending frame guidance.",
      "For every shot, include soundDesign with the exact audio that should be generated from visible action only. Close-ups should use breath, fabric, room tone, or city ambience, not footsteps unless walking/running feet are visible.",
      "The prompt field must be concise. Do not repeat the structured fields verbatim; the app will compose the final Seedance prompt from the fields.",
      "Maintain character, outfit, palette, facial identity, scene geography, lighting direction, weather, props, and screen direction across all shots.",
      "Keep motion physically plausible between cuts. Avoid impossible jumps in pose, location, lighting, or held objects.",
      "Prefer dynamic but readable cinematic motion: motivated tracking, push-ins, whip-pan transitions, parallax, foreground occlusion, and clear body mechanics.",
      sustainedActionPlan
        ? "Use one continuous action phrase per shot. A 12-15 second hero shot may contain 3-4 connected action beats when they share the same movement direction, camera logic, location, and physical momentum."
        : "Use exactly one main physical action per shot. Split complex action into more shots instead of packing slide, sprint, leap, landing, and lookback into one clip.",
      sustainedActionPlan
        ? "For this low-scene-count plan, prefer 14-15 second sustained quality shots with clear opening and ending frame intent."
        : "For action presets, prefer 4-7 second shots over 15 second multi-action clips.",
      "Avoid requesting readable text in the video. Avoid unrelated audio such as footsteps, engines, impacts, or crowd noise unless visible in that shot.",
      "Return a qualityChecks array with short checks for duration sum, continuity, reference usage, and Seedance feasibility.",
      `Video brief: ${input.brief}`
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "character"
  );
}

export function promptForCli(input: string): string {
  return input.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
}
