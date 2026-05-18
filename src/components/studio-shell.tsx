"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  Eye,
  Film,
  FolderOpen,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Pause,
  Plus,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Video,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import type {
  ExportTransition,
  GenerationMode,
  ProjectStatus,
  SeedanceModel,
  StoryboardDraftResult,
  StoryboardPacing,
  StoryboardProject,
  StoryboardShot,
  StudioAsset,
  VideoRatio,
  VideoResolution
} from "@/lib/types";

type KeyForm = {
  openaiApiKey: string;
  falApiKey: string;
  imgbbApiKey: string;
};

type ImageForm = {
  characterName: string;
  character: string;
  role: string;
  outfit: string;
  gear: string;
  movementStyle: string;
  palette: string;
  style: string;
  quality: "low" | "medium" | "high";
  size: "1024x1024" | "1536x1024" | "1024x1536";
};

type DraftSceneCount = "auto" | "1" | "2" | "3" | "4" | "5" | "6" | "8" | "10" | "12";

type DraftForm = {
  brief: string;
  targetDuration: number;
  sceneCount: DraftSceneCount;
  pacing: StoryboardPacing;
  aspectRatio: VideoRatio;
  visualStyle: string;
  seedanceModel: SeedanceModel;
};

type Busy =
  | "keys"
  | "images"
  | "refresh"
  | "delete"
  | "draft"
  | "recipe"
  | "shot"
  | "all"
  | "export"
  | "run"
  | "publish"
  | "gallery"
  | null;
type SaveState = "saved" | "saving" | "error";

type ReferenceOption = {
  token: string;
  relPath: string;
  label: string;
  asset: StudioAsset;
};

type PromptReference = {
  token: string;
  label: string;
  relPath?: string;
  valid: boolean;
};

type PreviewMode = "asset" | "storyboard";

type StoryboardPreviewClip = {
  shotId: string;
  order: number;
  title: string;
  duration: number;
  relPath: string;
  url: string;
};

type CharacterPreset = {
  label: string;
  detail: string;
  form: ImageForm;
};

type StoryboardPreset = {
  label: string;
  detail: string;
  form: DraftForm;
};

type PromptRecipe = {
  label: string;
  detail: string;
  sourceNote: string;
  tags: string[];
  recommendedMode: GenerationMode;
  form: DraftForm;
};

type PublishedRunState = {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailPublicUrl: string;
  manifestUrl: string;
};

type ClipLibraryFilter = "current" | "previous" | "archived";

const defaultImageForm: ImageForm = {
  characterName: "Mina",
  character:
    "A young Korean cyberpunk courier with a short black bob, teal jacket, compact messenger bag, calm confident expression",
  role: "urban courier, agile but grounded, observant and calm under pressure",
  outfit: "teal technical jacket, black cargo pants, compact crossbody messenger bag, practical sneakers",
  gear: "messenger bag, compact handheld device, small utility straps, subtle reflective details",
  movementStyle: "quick city movement, precise turns, natural walking, quiet confidence",
  palette: "teal, black, charcoal, soft gray, small cyan accents",
  style: "stylized cinematic animation, fictional game character sheet, realistic fabric, clean production reference",
  quality: "medium",
  size: "1536x1024"
};

const defaultDraftForm: DraftForm = {
  brief:
    "A 30 second cinematic intro for a Korean cyberpunk courier moving through a rain-slick night street, ending with a confident close-up.",
  targetDuration: 30,
  sceneCount: "auto",
  pacing: "auto",
  aspectRatio: "16:9",
  visualStyle: "grounded cinematic animation, realistic fabric motion, soft neon city light",
  seedanceModel: "fast"
};

const characterPresets: CharacterPreset[] = [
  {
    label: "Mina",
    detail: "Courier",
    form: defaultImageForm
  },
  {
    label: "Jaro",
    detail: "Parkour",
    form: {
      characterName: "Jaro",
      character:
        "A fictional young Korean male cyberpunk parkour scout with tousled black hair, cyan streak accents, athletic build, focused eyes, calm daring expression",
      role: "combat-free parkour scout, agile rooftop runner, stealth delivery specialist, independent and observant",
      outfit:
        "black technical hooded jacket with cyan trim, layered utility vest, tapered cargo pants, fingerless gloves, reinforced high-grip sneakers",
      gear: "compact sling pack, wrist scanner, utility straps, reflective cyan tabs, close-up panels for gloves, shoes, straps, scanner, and pack",
      movementStyle:
        "parkour vaults, wall runs, rooftop sprints, precise landings, controlled acrobatic momentum, readable full-body poses",
      palette: "black, charcoal, cool gray, cyan, deep teal, small white reflective accents",
      style:
        "stylized cinematic animation, fictional game character sheet, dynamic action reference, realistic fabric and gear, clean production layout",
      quality: "medium",
      size: "1536x1024"
    }
  },
  {
    label: "Rin",
    detail: "Blade",
    form: {
      characterName: "Rin",
      character:
        "A fictional Korean female cyberpunk blade runner with a short white tactical bob, black face mask, intense eyes, athletic parkour build, confident aggressive expression",
      role: "rain rooftop blade runner, drone evasion specialist, agile close-quarters courier, precise and fearless",
      outfit:
        "black iridescent rain jacket with red lining, cropped tactical harness, dark tapered cargo pants, flexible shin guards, high-grip boots, red utility sash",
      gear:
        "compact neon tanto blade, wrist scanner, small magnetic blade sheath, rainproof utility straps, close-up panels for mask, blade, boots, gloves, and sash",
      movementStyle:
        "wall-runs, sign vaults, low slides, blade draws, drone dodges, airborne slash poses, readable parkour body mechanics",
      palette: "black, wet charcoal, deep red, pale white hair, cyan scanner light, small neon magenta accents",
      style:
        "stylized cinematic animation, fictional game character sheet, rain action reference, realistic wet fabric and gear, clean production layout",
      quality: "high",
      size: "1536x1024"
    }
  }
];

const storyboardPresets: StoryboardPreset[] = [
  {
    label: "Neon Abyss",
    detail: "1x15s",
    form: {
      brief:
        "A 15 second timecoded micro-beat action experiment for a masked cyberpunk blade runner inside a kilometer-deep cylindrical neon megacity shaft. Use the active character sheet as the consistent character reference. The sequence starts immediately with a close activation detail, reveals the impossible vertical scale, then follows Rin stepping off a ledge, freefalling through the shaft, dodging drones, drawing a neon tanto, slicing one drone, firing a grapple, swinging to a lower gantry, and landing in a clean final pose. The video should feel like 14 rapid cinematic effect beats inside one polished action trailer shot list, not a calm continuous rooftop run.",
      targetDuration: 15,
      sceneCount: "1",
      pacing: "fast",
      aspectRatio: "16:9",
      visualStyle:
        "Seedance 2.0 quality experiment, cinematic anime realism, vertical megacity abyss, god-view scale reveal, bullet-time orbital hero beat, radial motion blur, first-person plunge, whip-pan drone reveal, chromatic aberration, rain mist, glass reflections, cyan-magenta neon, strong parallax, fast but readable micro-shot rhythm",
      seedanceModel: "quality"
    }
  },
  {
    label: "Blade Runner Hero",
    detail: "2x15s",
    form: {
      brief:
        "A 30 second two-shot hero action sequence for a masked cyberpunk blade runner. Shot 1 is a rain-soaked rooftop chase: the runner is already sprinting, wall-runs across wet concrete, dodges a scanning drone, draws a compact neon tanto blade, and vaults through a broken holographic sign. Shot 2 continues from that momentum: the runner lands into a low slide under rooftop pipes, the camera whips into a close eye-and-blade beat, then she launches into a final airborne slash through neon rain.",
      targetDuration: 30,
      sceneCount: "2",
      pacing: "fast",
      aspectRatio: "16:9",
      visualStyle:
        "Seedance 2.0 quality, cinematic anime realism, wet neon rooftop district, aggressive handheld tracking, wide 18-24mm lens, strong parallax, foreground pipes and signs, rain spray, blade light trails, fast but readable body mechanics, no calm intro",
      seedanceModel: "quality"
    }
  },
  {
    label: "Neon Chase",
    detail: "Fast",
    form: {
      brief:
        "A kinetic 30 second cyberpunk chase intro. The character starts in a rain-slick alley, detects a pursuing drone, sprints through neon reflections, vaults a street barrier, cuts through steam, and ends in a controlled close-up after escaping.",
      targetDuration: 30,
      sceneCount: "auto",
      pacing: "fast",
      aspectRatio: "16:9",
      visualStyle:
        "grounded cinematic animation, handheld tracking, foreground occlusion, wet neon reflections, strong parallax, visible body mechanics",
      seedanceModel: "fast"
    }
  },
  {
    label: "Rooftop Run",
    detail: "Action",
    form: {
      brief:
        "A 35 second rooftop parkour sequence. The character accelerates from a ledge, crosses pipes and signs, slides under a low beam, leaps a narrow gap, lands with realistic weight, then looks back toward the glowing skyline.",
      targetDuration: 35,
      sceneCount: "auto",
      pacing: "fast",
      aspectRatio: "16:9",
      visualStyle:
        "cinematic rooftop action, dynamic tracking camera, readable silhouette, practical fabric motion, dusk neon skyline, no impossible physics",
      seedanceModel: "fast"
    }
  },
  {
    label: "Delivery Heist",
    detail: "Story",
    form: {
      brief:
        "A 45 second mini heist beat. The character receives a risky delivery signal, studies the route, moves through a crowded night market, dodges a scanning light, swaps the package at a hidden terminal, and exits with a confident final glance.",
      targetDuration: 45,
      sceneCount: "auto",
      pacing: "balanced",
      aspectRatio: "16:9",
      visualStyle:
        "grounded cinematic animation, motivated camera moves, practical city detail, suspenseful but readable action, consistent lighting and geography",
      seedanceModel: "fast"
    }
  },
  {
    label: "Close Reveal",
    detail: "Moody",
    form: {
      brief:
        "A 20 second dramatic reveal. The character waits under soft city light, adjusts one piece of gear, notices something off-screen, the camera pushes into a face close-up, and the scene ends on a quiet decisive expression.",
      targetDuration: 20,
      sceneCount: "auto",
      pacing: "slow",
      aspectRatio: "16:9",
      visualStyle:
        "soft neon city light, shallow depth of field, subtle fabric movement, restrained camera push, quiet sound design without unrelated footsteps",
      seedanceModel: "fast"
    }
  }
];

const promptRecipes: PromptRecipe[] = [
  {
    label: "Neon Abyss Freefall",
    detail: "15 beats",
    sourceNote: "Experimental timecoded micro-beat prompt pattern for high-motion Seedance tests.",
    tags: ["micro-beats", "freefall", "drones"],
    recommendedMode: "omni-reference",
    form: {
      brief:
        "Use the active character sheet as the direct character reference. Create a 15 second cinematic anime-realism action sequence inside a kilometer-deep cylindrical neon megacity shaft. Same masked cyberpunk blade runner throughout: white bob hair, black rain jacket, red accents, compact neon tanto, athletic body, same face and outfit. No text, no logo, no watermark. Start immediately in motion. Fast but readable. Strong parallax, rain mist, glass reflections, drone scan beams, blade light trails. [0s-1s] Macro jacket and blade-hilt wake-up with cyan circuit-like pulse, chromatic aberration, sharp inhale. [1s-2s] Top-down god-view reveal, camera plunges into the kilometer-deep cylindrical shaft. [2s-3s] Whip-orbit 180 degrees as she leans over the abyss, hair and straps catching wind. [3s-4s] Low-angle whip tilt from boots to masked eyes as she commits. [4s-5s] Hero jump, bullet-time 270 degree orbital around her suspended silhouette. [5s-6s] Time snap into high-speed head-first fall with radial motion blur. [6s-8s] Over-shoulder vertical plunge through windows, gantries, antennae, and hologram panels. [8s-9s] Hard right roll between two industrial pylons, sparks scrape past shoulder, frame banks 70 degrees. [9s-10s] Whip-pan back to reveal two armored drones diving after her with magenta plasma trails. [10s-11s] Bullet-time twist as she draws neon tanto, plasma bolts pass inches from mask. [11s-12s] Speed snap strike, blade slices nearest drone, white spark burst, debris fan-out. [12s-13s] Grapple launch, camera follows cable arc to passing gantry. [13s-14s] Wide pull-back as she swings in a 180 degree arc across the vertical void. [14s-15s] Crouched landing on lower gantry, masked face slowly looks up, clean hold.",
      targetDuration: 15,
      sceneCount: "1",
      pacing: "fast",
      aspectRatio: "16:9",
      visualStyle:
        "timecoded micro-shot action trailer, cinematic anime realism, vertical scale, bullet-time, whip orbit, radial blur, drone VFX, glass and rain reflections, cyan-magenta neon",
      seedanceModel: "quality"
    }
  },
  {
    label: "Omni Action Chase",
    detail: "15s",
    sourceNote: "Adapted from short X-style Seedance Omni Reference action prompts.",
    tags: ["omni-reference", "tokyo", "parkour"],
    recommendedMode: "omni-reference",
    form: {
      brief:
        "Use the active character sheet as the direct character reference. Create a 15 second action video: tracking camera follows the same character running through rainy Tokyo streets, avoiding obstacles with parkour, then being cornered in a neon alley before launching into one attack beat.",
      targetDuration: 15,
      sceneCount: "1",
      pacing: "fast",
      aspectRatio: "16:9",
      visualStyle:
        "Seedance 2.0 Omni Reference, cinematic anime realism, high readability, tracking camera, wet neon reflections, foreground occlusion, no calm intro, start directly in action",
      seedanceModel: "fast"
    }
  },
  {
    label: "Storyboard Martial",
    detail: "12 beats",
    sourceNote: "Adapted from sequential storyboard-sheet martial arts prompt patterns.",
    tags: ["storyboard-sheet", "martial-arts", "keyframes"],
    recommendedMode: "omni-reference",
    form: {
      brief:
        "Use the active storyboard or character sheet as a sequential visual keyframe reference. Create a 15 second cinematic martial arts sequence in an ancient stone temple: airborne opening strike, close staff sweep, orbiting spin, floor impact, side kick, top-down aerial turn, landing stomp, sliding sweep, flurry combo, beast stance, elemental vortex, final airborne strike.",
      targetDuration: 15,
      sceneCount: "12",
      pacing: "fast",
      aspectRatio: "16:9",
      visualStyle:
        "cinematic live-action anime realism, strong silhouettes, harsh light shafts, temple smoke, dust displacement, golden-orange energy accents, fast but readable choreography, no extra characters",
      seedanceModel: "fast"
    }
  },
  {
    label: "Rhythmic Performance",
    detail: "Sports",
    sourceNote: "Adapted from rhythmic performance / batting cage Seedance prompts.",
    tags: ["performance", "rhythm", "sports"],
    recommendedMode: "omni-reference",
    form: {
      brief:
        "Use the active character sheet as the performer reference. Create a 15 second rhythmic batting cage performance inside a giant industrial indoor batting cage: synchronized batting flow, one-handed bat twirls, behind-the-back passes, stylish stance transitions, perfect hits from a pitching machine, shockwave contact moments, and a final god-tier slow-motion hero swing.",
      targetDuration: 15,
      sceneCount: "5",
      pacing: "fast",
      aspectRatio: "16:9",
      visualStyle:
        "modern painterly anime illustration, editorial sports fashion art, soft digital oil painting, visible brush strokes, clean cinematic lighting, dynamic tilted framing, foreground net occlusion",
      seedanceModel: "fast"
    }
  }
];

const draftSceneCountOptions: DraftSceneCount[] = ["auto", "1", "2", "3", "4", "5", "6", "8", "10", "12"];
const pacingOptions: StoryboardPacing[] = ["auto", "slow", "balanced", "fast"];
const transitionOptions: ExportTransition[] = ["cut", "crossfade", "dip-to-black"];
const MIN_STORYBOARD_SHOT_DURATION = 4;
const MAX_STORYBOARD_SHOT_DURATION = 15;
const MAX_DRAFT_SCENE_COUNT = 12;

const shotTemplates = [
  {
    title: "Opening",
    prompt:
      "Use @Image1 as the main character identity. Establish a rain-slick cyberpunk street at night, the courier enters frame with calm confidence, teal jacket catching soft neon edge light, cinematic handheld push-in. Sound design: rain ambience and distant city hum only until visible steps enter frame."
  },
  {
    title: "Neon Tracking",
    prompt:
      "Use @Image1 as the main character identity. Medium side-tracking shot as the courier accelerates past foreground neon signs, messenger bag moving naturally, grounded realistic fabric motion, strong parallax. Sound design: synced visible footfalls, fabric movement, wet street ambience."
  },
  {
    title: "Signal Close-Up",
    prompt:
      "Use @Image1 as the main character identity. Close medium shot, the courier notices an off-screen signal and turns toward camera, facial features remain consistent, controlled confident expression, shallow depth of field. Sound design: soft breath, subtle jacket fabric, no footsteps because feet are not visible."
  },
  {
    title: "Barrier Vault",
    prompt:
      "Use @Image1 as the main character identity. Dynamic three-quarter shot as the courier vaults a low street barrier with readable body mechanics, bag and jacket follow naturally, camera tracks without chaos. Sound design: one visible contact impact, fabric rush, wet city ambience."
  },
  {
    title: "Steam Cut",
    prompt:
      "Use @Image1 as the main character identity. The courier cuts through a burst of street steam, silhouette and teal jacket remain readable, camera whip-pans into a controlled push. Sound design: steam hiss, fabric movement, no repeated footsteps unless visible."
  },
  {
    title: "Final Look",
    prompt:
      "Use @Image1 as the main character identity. Quiet close-up ending beat, the courier pauses and looks past camera with calm confidence, teal jacket collar visible, cinematic ambient city light. Sound design: quiet city ambience, soft breath, no footsteps."
  }
];

export function StudioShell() {
  const [project, setProject] = useState<ProjectStatus | null>(null);
  const [storyboard, setStoryboard] = useState<StoryboardProject | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [preview, setPreview] = useState<StudioAsset | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("asset");
  const [storyboardPreviewIndex, setStoryboardPreviewIndex] = useState(0);
  const [keys, setKeys] = useState<KeyForm>({ openaiApiKey: "", falApiKey: "", imgbbApiKey: "" });
  const [imageForm, setImageForm] = useState<ImageForm>(defaultImageForm);
  const [draftForm, setDraftForm] = useState<DraftForm>(defaultDraftForm);
  const [draftPreview, setDraftPreview] = useState<StoryboardDraftResult | null>(null);
  const [publishedRun, setPublishedRun] = useState<PublishedRunState | null>(null);
  const [clipLibraryOpen, setClipLibraryOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [log, setLog] = useState<string[]>([]);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStoryboard = useRef<StoryboardProject | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const imageAssets = useMemo(
    () => project?.assets.filter((asset) => asset.kind === "image") ?? [],
    [project]
  );
  const videoAssets = useMemo(
    () => project?.assets.filter((asset) => asset.kind === "video") ?? [],
    [project]
  );
  const exportAssets = useMemo(() => videoAssets.filter(isExportAsset), [videoAssets]);
  const clipAssets = useMemo(() => videoAssets.filter((asset) => !isExportAsset(asset)), [videoAssets]);
  const activeClipAssets = useMemo(() => clipAssets.filter((asset) => !isArchivedAsset(asset)), [clipAssets]);
  const archivedClipAssets = useMemo(() => clipAssets.filter(isArchivedAsset), [clipAssets]);
  const activeCharacterSheet = useMemo(() => preferredReferenceAssets(project?.assets ?? [])[0] ?? null, [project]);
  const selectedShot = useMemo(
    () => storyboard?.shots.find((shot) => shot.id === selectedShotId) ?? storyboard?.shots[0] ?? null,
    [storyboard, selectedShotId]
  );
  const shotTakesByShotId = useMemo(
    () => buildShotTakeMap(storyboard, activeClipAssets),
    [storyboard, activeClipAssets]
  );
  const selectedOutputPaths = useMemo(
    () => new Set((storyboard?.shots ?? []).map((shot) => shot.outputRelPath).filter(Boolean) as string[]),
    [storyboard]
  );
  const looseClipAssets = useMemo(
    () => activeClipAssets.filter((asset) => !isCurrentStoryboardTake(asset, storyboard)),
    [activeClipAssets, storyboard]
  );
  const selectedShotTakes = selectedShot ? shotTakesByShotId.get(selectedShot.id) ?? [] : [];
  const selectedShotAsset = useMemo(
    () =>
      selectedShot?.outputRelPath
        ? project?.assets.find((asset) => asset.relPath === selectedShot.outputRelPath) ?? null
        : null,
    [project?.assets, selectedShot?.outputRelPath]
  );
  const selectedContinuity = useMemo(
    () => continuityStatusForShot(selectedShot, selectedShotAsset),
    [selectedShot, selectedShotAsset]
  );
  const selectedRefs = selectedShot?.references ?? [];
  const totalDuration = storyboard?.shots.reduce((total, shot) => total + shot.duration, 0) ?? 0;
  const hasRunningShots = storyboard?.shots.some((shot) => isRunningStatus(shot.status)) ?? false;
  const allShotsReady =
    Boolean(storyboard?.shots.length) &&
    storyboard?.shots.every((shot) => shot.status === "done" && shot.outputRelPath);
  const canSaveRun = Boolean(storyboard?.exportRelPath) && busy === null;
  const canPublishRun = Boolean(storyboard?.exportRelPath) && busy === null;
  const canAddGallery = Boolean(publishedRun?.id) && busy === null;
  const storyboardPreviewClips = useMemo(
    () => buildStoryboardPreviewClips(storyboard, project?.assets ?? []),
    [storyboard, project?.assets]
  );
  const storyboardPreviewMissingShots = useMemo(
    () => buildStoryboardPreviewMissingShots(storyboard, storyboardPreviewClips),
    [storyboard, storyboardPreviewClips]
  );

  const referenceOptions = useMemo(
    () =>
      selectedRefs.flatMap((relPath, index) => {
        const asset = project?.assets.find((item) => item.kind === "image" && item.relPath === relPath);
        if (!asset) return [];
        return [
          {
            token: `@Image${index + 1}`,
            relPath,
            label: (asset.metadata?.["label"] as string) || asset.name,
            asset
          }
        ];
      }),
    [project, selectedRefs]
  );
  const mentionOptions = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase();
    return referenceOptions.filter(
      (option) =>
        option.token.toLowerCase().includes(query) ||
        option.label.toLowerCase().includes(query) ||
        query.length === 0
    );
  }, [mentionQuery, referenceOptions]);
  const promptReferences = useMemo(
    () => parsePromptReferences(selectedShot?.prompt ?? "", referenceOptions),
    [selectedShot?.prompt, referenceOptions]
  );
  const selectedNeedsUploadHost = Boolean(selectedShot && shotNeedsUploadHost(selectedShot));
  const hasUploadHost = Boolean(project?.keys.imgbb.configured);
  const workflowStep = activeCharacterSheet ? (storyboard?.shots.length ? (allShotsReady ? 4 : 3) : 2) : 1;
  const draftSceneCountValue = draftForm.sceneCount === "auto" ? undefined : Number.parseInt(draftForm.sceneCount, 10);
  const draftSceneRange = useMemo(() => draftSceneRangeFor(draftForm.targetDuration), [draftForm.targetDuration]);
  const draftSuggestedSceneCount = useMemo(
    () => suggestedDraftSceneCount(draftForm.targetDuration, draftForm.pacing),
    [draftForm.targetDuration, draftForm.pacing]
  );
  const draftSceneCountInvalid =
    draftSceneCountValue !== undefined &&
    (draftSceneCountValue < draftSceneRange.min || draftSceneCountValue > draftSceneRange.max);
  const draftSceneHint = draftSceneCountInvalid
    ? `Scene count must be ${draftSceneRange.min}-${draftSceneRange.max} for ${draftForm.targetDuration}s.`
    : draftSceneCountValue
      ? `${draftSceneCountValue} scenes, variable ${MIN_STORYBOARD_SHOT_DURATION}-${MAX_STORYBOARD_SHOT_DURATION}s shots.`
      : `Auto scenes: about ${draftSuggestedSceneCount}, variable ${MIN_STORYBOARD_SHOT_DURATION}-${MAX_STORYBOARD_SHOT_DURATION}s shots.`;

  useEffect(() => {
    void refreshAll("refresh");
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  useEffect(() => {
    latestStoryboard.current = storyboard;
    if (!storyboard) return;
    if (selectedShotId && storyboard.shots.some((shot) => shot.id === selectedShotId)) return;
    setSelectedShotId(storyboard.shots[0]?.id ?? null);
  }, [storyboard, selectedShotId]);

  useEffect(() => {
    setPublishedRun(null);
  }, [storyboard?.exportRelPath]);

  useEffect(() => {
    if (!project) return;
    setPreview((current) =>
      current && project.assets.some((asset) => asset.relPath === current.relPath)
        ? current
        : project.assets[0] ?? null
    );
  }, [project]);

  useEffect(() => {
    if (previewMode !== "storyboard") return;
    if (storyboardPreviewClips.length === 0) {
      setPreviewMode("asset");
      setStoryboardPreviewIndex(0);
      return;
    }
    if (storyboardPreviewIndex >= storyboardPreviewClips.length) {
      setStoryboardPreviewIndex(storyboardPreviewClips.length - 1);
    }
  }, [previewMode, storyboardPreviewClips.length, storyboardPreviewIndex]);

  useEffect(() => {
    if (!hasRunningShots) return;
    const interval = setInterval(() => {
      void refreshStoryboard();
      void refreshProject();
    }, 4000);
    return () => clearInterval(interval);
  }, [hasRunningShots]);

  async function refreshAll(source: Busy = null) {
    setBusy(source);
    try {
      const [projectData, storyboardData] = await Promise.all([
        requestJson<ProjectStatus>("/api/project"),
        requestJson<StoryboardProject>("/api/storyboard")
      ]);
      setProject(projectData);
      setStoryboard(storyboardData);
      latestStoryboard.current = storyboardData;
      setPreview((current) => current ?? projectData.assets[0] ?? null);
      setSaveState("saved");
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setBusy(null);
    }
  }

  async function refreshProject() {
    try {
      setProject(await requestJson<ProjectStatus>("/api/project"));
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Project refresh failed");
    }
  }

  async function refreshStoryboard() {
    try {
      const next = await requestJson<StoryboardProject>("/api/storyboard");
      setStoryboard(next);
      latestStoryboard.current = next;
      setSaveState("saved");
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Storyboard refresh failed");
    }
  }

  async function saveStoryboardNow(board = latestStoryboard.current): Promise<StoryboardProject | null> {
    if (!board) return null;
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    setSaveState("saving");
    try {
      const saved = await requestJson<StoryboardProject>("/api/storyboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(board)
      });
      setStoryboard(saved);
      latestStoryboard.current = saved;
      setSaveState("saved");
      return saved;
    } catch (error) {
      setSaveState("error");
      pushLog(error instanceof Error ? error.message : "Storyboard save failed");
      return null;
    }
  }

  function setStoryboardAndPersist(next: StoryboardProject) {
    setStoryboard(next);
    latestStoryboard.current = next;
    setSaveState("saving");
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void saveStoryboardNow(next);
    }, 600);
  }

  async function saveKeys() {
    setBusy("keys");
    try {
      const data = await requestJson<{ success: true }>("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(keys)
      });
      if (!data.success) throw new Error("Key save failed");
      setKeys({ openaiApiKey: "", falApiKey: "", imgbbApiKey: "" });
      pushLog("Project keys saved");
      await refreshProject();
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Key save failed");
    } finally {
      setBusy(null);
    }
  }

  async function generateImages() {
    setBusy("images");
    try {
      const data = await requestJson<{ success: true; images?: Array<{ relPath: string }> }>("/api/images/character-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(imageForm)
      });
      const firstImage = data.images?.[0]?.relPath;
      pushLog(firstImage ? "Generated character sheet" : "Image generation finished");
      await refreshProject();
      if (firstImage && selectedShot) {
        updateSelectedShot({ references: unique([firstImage, ...selectedShot.references]) });
      }
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Image generation failed");
    } finally {
      setBusy(null);
    }
  }

  function applyCharacterPreset(preset: CharacterPreset) {
    setImageForm({ ...preset.form });
    pushLog(`Loaded ${preset.label} character preset`);
  }

  async function removeAsset(asset: StudioAsset) {
    setBusy("delete");
    try {
      await requestJson<{ success: true }>("/api/assets/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relPath: asset.relPath })
      });
      if (storyboard && asset.kind === "image") {
        const next = {
          ...storyboard,
          shots: storyboard.shots.map((shot) => ({
            ...shot,
            references: shot.references.filter((reference) => reference !== asset.relPath),
            updatedAt: new Date().toISOString()
          })),
          updatedAt: new Date().toISOString()
        };
        setStoryboardAndPersist(next);
      }
      setPreview((current) => (current?.relPath === asset.relPath ? null : current));
      pushLog(`Deleted ${(asset.metadata?.["label"] as string) || asset.name}`);
      await refreshProject();
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Asset deletion failed");
    } finally {
      setBusy(null);
    }
  }

  async function archiveAsset(asset: StudioAsset, archived = true) {
    if (archived && storyboard?.shots.some((shot) => shot.outputRelPath === asset.relPath)) {
      pushLog("Select another take before archiving the selected take");
      return;
    }
    setBusy("delete");
    try {
      await requestJson<{ success: true }>("/api/assets/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relPath: asset.relPath, archived })
      });
      setPreview((current) => (archived && current?.relPath === asset.relPath ? null : current));
      pushLog(`${archived ? "Archived" : "Restored"} ${(asset.metadata?.["label"] as string) || asset.name}`);
      await refreshProject();
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Asset archive failed");
    } finally {
      setBusy(null);
    }
  }

  async function archiveUnselectedTakes(shot: StoryboardShot, takes: StudioAsset[]) {
    const candidates = takes.filter((asset) => asset.relPath !== shot.outputRelPath);
    if (candidates.length === 0) {
      pushLog("No unselected takes to archive");
      return;
    }
    setBusy("delete");
    try {
      await Promise.all(
        candidates.map((asset) =>
          requestJson<{ success: true }>("/api/assets/archive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ relPath: asset.relPath, archived: true })
          })
        )
      );
      pushLog(`Archived ${candidates.length} unselected take${candidates.length === 1 ? "" : "s"}`);
      await refreshProject();
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Archive takes failed");
    } finally {
      setBusy(null);
    }
  }

  async function draftStoryboard() {
    setBusy("draft");
    try {
      const data = await requestJson<StoryboardDraftResult>("/api/storyboard/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: draftForm.brief,
          targetDuration: draftForm.targetDuration,
          sceneCount: draftSceneCountValue,
          pacing: draftForm.pacing,
          aspectRatio: draftForm.aspectRatio,
          visualStyle: draftForm.visualStyle,
          characterSheetRelPath: activeCharacterSheet?.relPath
        })
      });
      setDraftPreview(data);
      pushLog(`Drafted ${data.shots.length} storyboard shots (${data.provider})`);
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Storyboard draft failed");
    } finally {
      setBusy(null);
    }
  }

  function applyStoryboardPreset(preset: StoryboardPreset) {
    setDraftForm({ ...preset.form });
    setDraftPreview(null);
    pushLog(`Loaded ${preset.label} storyboard preset`);
  }

  function applyPromptRecipe(recipe: PromptRecipe) {
    setDraftForm({ ...recipe.form });
    setDraftPreview(null);
    pushLog(`Loaded ${recipe.label} prompt recipe`);
  }

  async function saveSelectedPromptRecipe() {
    if (!selectedShot) return;
    setBusy("recipe");
    try {
      const data = await requestJson<{ success: true; recipe: { title: string } }>("/api/prompt-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedShot.title,
          prompt: selectedShot.prompt,
          sourceNote: "Saved from VibeStudio Shot Inspector.",
          tags: ["local", selectedShot.generationMode, selectedShot.seedanceModel],
          recommendedMode: selectedShot.generationMode === "omni-reference" ? "omni-reference" : "strict-continuation"
        })
      });
      pushLog(`Saved prompt recipe: ${data.recipe.title}`);
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Prompt recipe save failed");
    } finally {
      setBusy(null);
    }
  }

  function applyDraftStoryboard() {
    if (!draftPreview) return;
    const now = new Date().toISOString();
    const shots = draftPreview.shots.map((shot, index) => ({
      ...shot,
      id: newId(),
      order: index,
      seedanceModel: draftForm.seedanceModel,
      status: "draft" as const,
      outputRelPath: undefined,
      error: undefined,
      createdAt: now,
      updatedAt: now
    }));
    const next: StoryboardProject = {
      targetDuration: draftPreview.targetDuration,
      shots,
      createdAt: storyboard?.createdAt ?? now,
      updatedAt: now
    };
    setSelectedShotId(shots[0]?.id ?? null);
    setStoryboardAndPersist(next);
    pushLog("Applied storyboard draft");
  }

  function createDefaultStoryboard() {
    const refs = activeCharacterSheet
      ? [activeCharacterSheet.relPath]
      : preferredReferenceAssets(project?.assets ?? []).map((asset) => asset.relPath);
    const now = new Date().toISOString();
    const shots = shotTemplates.map((template, index) => ({
      id: newId(),
      order: index,
      title: template.title,
      duration: 5,
      prompt: template.prompt,
      references: refs,
      ratio: "16:9" as VideoRatio,
      resolution: "720p" as VideoResolution,
      seedanceModel: "fast" as SeedanceModel,
      generationMode: index === 0 ? "omni-reference" as GenerationMode : "strict-continuation" as GenerationMode,
      trimHeadSec: 0,
      trimTailSec: 0,
      transitionAfter: "cut" as ExportTransition,
      transitionDurationSec: 0.25,
      generateAudio: true,
      status: "draft" as const,
      createdAt: now,
      updatedAt: now
    }));
    const next: StoryboardProject = {
      targetDuration: 30,
      shots,
      createdAt: storyboard?.createdAt ?? now,
      updatedAt: now
    };
    setSelectedShotId(shots[0]?.id ?? null);
    setStoryboardAndPersist(next);
    pushLog("Created 30s storyboard");
  }

  function addShot() {
    const now = new Date().toISOString();
    const refs = selectedShot?.references.length
      ? selectedShot.references
      : activeCharacterSheet
        ? [activeCharacterSheet.relPath]
        : preferredReferenceAssets(project?.assets ?? []).map((asset) => asset.relPath);
    const currentShots = storyboard?.shots ?? [];
    const nextShot: StoryboardShot = {
      id: newId(),
      order: currentShots.length,
      title: `Shot ${currentShots.length + 1}`,
      duration: 5,
      prompt:
        "Use @Image1 as the main character identity. Create the next cinematic beat with consistent face, outfit, and palette.",
      references: refs,
      ratio: selectedShot?.ratio ?? "16:9",
      resolution: selectedShot?.resolution ?? "720p",
      seedanceModel: selectedShot?.seedanceModel ?? "fast",
      generationMode: currentShots.length === 0 ? "omni-reference" : "strict-continuation",
      trimHeadSec: 0,
      trimTailSec: 0,
      transitionAfter: "cut",
      transitionDurationSec: 0.25,
      generateAudio: true,
      status: "draft",
      createdAt: now,
      updatedAt: now
    };
    const next = ensureStoryboard(storyboard, now);
    setSelectedShotId(nextShot.id);
    setStoryboardAndPersist({
      ...next,
      shots: [...next.shots, nextShot],
      updatedAt: now
    });
  }

  function duplicateShot(shot: StoryboardShot) {
    if (!storyboard) return;
    const now = new Date().toISOString();
    const insertAt = shot.order + 1;
    const copy: StoryboardShot = {
      ...shot,
      id: newId(),
      title: `${shot.title} Copy`,
      status: "draft",
      outputRelPath: undefined,
      error: undefined,
      providerTaskId: undefined,
      createdAt: now,
      updatedAt: now
    };
    const shots = [
      ...storyboard.shots.slice(0, insertAt),
      copy,
      ...storyboard.shots.slice(insertAt)
    ].map((item, index) => ({ ...item, order: index }));
    setSelectedShotId(copy.id);
    setStoryboardAndPersist({ ...storyboard, shots, updatedAt: now });
  }

  function deleteStoryboardShot(shot: StoryboardShot) {
    if (!storyboard) return;
    const now = new Date().toISOString();
    const shots = storyboard.shots
      .filter((item) => item.id !== shot.id)
      .map((item, index) => ({ ...item, order: index }));
    setSelectedShotId(shots[Math.min(shot.order, shots.length - 1)]?.id ?? null);
    setStoryboardAndPersist({ ...storyboard, shots, updatedAt: now });
  }

  function moveShot(shot: StoryboardShot, direction: -1 | 1) {
    if (!storyboard) return;
    const target = shot.order + direction;
    if (target < 0 || target >= storyboard.shots.length) return;
    const shots = [...storyboard.shots];
    const [removed] = shots.splice(shot.order, 1);
    shots.splice(target, 0, removed);
    const now = new Date().toISOString();
    setStoryboardAndPersist({
      ...storyboard,
      shots: shots.map((item, index) => ({ ...item, order: index, updatedAt: now })),
      updatedAt: now
    });
  }

  function updateSelectedShot(patch: Partial<StoryboardShot>) {
    if (!storyboard || !selectedShot) return;
    const now = new Date().toISOString();
    const shots = storyboard.shots.map((shot) =>
      shot.id === selectedShot.id ? { ...shot, ...patch, updatedAt: now } : shot
    );
    setStoryboardAndPersist({ ...storyboard, shots, updatedAt: now });
  }

  function selectShotTake(shotId: string, asset: StudioAsset) {
    if (!storyboard) return;
    const now = new Date().toISOString();
    const shots = storyboard.shots.map((shot) =>
      shot.id === shotId
        ? { ...shot, status: "done" as const, outputRelPath: asset.relPath, error: undefined, updatedAt: now }
        : shot
    );
    setSelectedShotId(shotId);
    setStoryboardAndPersist({ ...storyboard, shots, updatedAt: now });
    previewAsset(asset);
    pushLog(`Selected take: ${(asset.metadata?.["label"] as string) || asset.name}`);
  }

  function toggleRef(relPath: string) {
    if (!selectedShot) {
      pushLog("Select or create a shot before adding references");
      return;
    }
    const nextRefs = selectedShot.references.includes(relPath)
      ? selectedShot.references.filter((item) => item !== relPath)
      : [...selectedShot.references, relPath];
    updateSelectedShot({ references: nextRefs });
  }

  function updateMention(value: string, cursor: number) {
    const beforeCursor = value.slice(0, cursor);
    const match = beforeCursor.match(/(^|\s)(@[a-zA-Z0-9_-]*)$/);
    if (!match) {
      setMentionQuery(null);
      setMentionIndex(0);
      return;
    }
    setMentionQuery(match[2].slice(1));
    setMentionIndex(0);
  }

  function updatePrompt(value: string, cursor: number) {
    updateSelectedShot({ prompt: value });
    updateMention(value, cursor);
  }

  function insertMention(option: ReferenceOption) {
    if (!selectedShot) return;
    const textarea = promptRef.current;
    const value = selectedShot.prompt;
    const cursor = textarea?.selectionStart ?? value.length;
    const beforeCursor = value.slice(0, cursor);
    const afterCursor = value.slice(cursor);
    const match = beforeCursor.match(/(^|\s)(@[a-zA-Z0-9_-]*)$/);
    const start = match ? cursor - match[2].length : cursor;
    const prefix = value.slice(0, start);
    const nextPrefix = `${prefix}${prefix.length > 0 && !/\s$/.test(prefix) ? " " : ""}${option.token} `;
    const nextValue = nextPrefix + afterCursor.replace(/^\s+/, "");
    updateSelectedShot({ prompt: nextValue });
    setMentionQuery(null);
    setMentionIndex(0);
    requestAnimationFrame(() => {
      promptRef.current?.focus();
      promptRef.current?.setSelectionRange(nextPrefix.length, nextPrefix.length);
    });
  }

  function previewAsset(asset: StudioAsset | null) {
    setPreview(asset);
    setPreviewMode("asset");
  }

  function previewStoryboard() {
    if (storyboardPreviewClips.length === 0) {
      pushLog("Generate at least one storyboard shot before preview");
      return;
    }
    const selectedIndex = selectedShotId
      ? storyboardPreviewClips.findIndex((clip) => clip.shotId === selectedShotId)
      : -1;
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
    setStoryboardPreviewIndex(nextIndex);
    setSelectedShotId(storyboardPreviewClips[nextIndex].shotId);
    setPreviewMode("storyboard");
    pushLog(`Previewing ${storyboardPreviewClips.length} storyboard clips`);
  }

  function updateStoryboardPreviewIndex(index: number) {
    if (storyboardPreviewClips.length === 0) return;
    const nextIndex = Math.max(0, Math.min(index, storyboardPreviewClips.length - 1));
    setStoryboardPreviewIndex(nextIndex);
    setSelectedShotId(storyboardPreviewClips[nextIndex].shotId);
  }

  function handlePromptKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionOptions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMentionIndex((index) => (index + 1) % mentionOptions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setMentionIndex((index) => (index - 1 + mentionOptions.length) % mentionOptions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      insertMention(mentionOptions[mentionIndex] ?? mentionOptions[0]);
    } else if (event.key === "Escape") {
      setMentionQuery(null);
      setMentionIndex(0);
    }
  }

  async function generateSelectedShot() {
    if (!selectedShot) return;
    const saved = await saveStoryboardNow();
    if (!saved) return;
    setBusy("shot");
    try {
      const next = await requestJson<StoryboardProject>(`/api/storyboard/shots/${selectedShot.id}/generate`, {
        method: "POST"
      });
      setStoryboard(next);
      latestStoryboard.current = next;
      pushLog(`Queued ${selectedShot.title}`);
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Shot generation failed");
    } finally {
      setBusy(null);
    }
  }

  async function generateAllShots() {
    if (!canGenerateAll) {
      pushLog("Complete references and upload keys before queueing storyboard generation");
      return;
    }
    const qualityCount = storyboard?.shots.filter((shot) => shot.seedanceModel === "quality").length ?? 0;
    if (
      qualityCount > 0 &&
      !window.confirm(
        `This queues ${qualityCount} Seedance quality shot${qualityCount === 1 ? "" : "s"}. For cost control, generating selected shots one at a time is recommended. Continue?`
      )
    ) {
      pushLog("Cancelled quality storyboard queue");
      return;
    }
    const saved = await saveStoryboardNow();
    if (!saved) return;
    setBusy("all");
    try {
      const next = await requestJson<StoryboardProject>("/api/storyboard/generate-all", { method: "POST" });
      setStoryboard(next);
      latestStoryboard.current = next;
      pushLog("Queued storyboard generation");
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Storyboard generation failed");
    } finally {
      setBusy(null);
    }
  }

  async function exportStory() {
    const saved = await saveStoryboardNow();
    if (!saved) return;
    setBusy("export");
    try {
      const data = await requestJson<{ storyboard: StoryboardProject; relPath: string; url: string }>(
        "/api/storyboard/export",
        { method: "POST" }
      );
      setStoryboard(data.storyboard);
      latestStoryboard.current = data.storyboard;
      pushLog("Exported storyboard");
      await refreshProject();
      previewAsset({
        id: data.relPath,
        kind: "video",
        name: "Storyboard Export",
        relPath: data.relPath,
        url: data.url,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Storyboard export failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveRun() {
    const saved = await saveStoryboardNow();
    if (!saved) return;
    setBusy("run");
    try {
      const data = await requestJson<{
        success: true;
        run: {
          title: string;
          manifestRelPath: string;
          thumbnailRelPath: string;
          thumbnailUrl: string;
          exportRelPath: string;
          exportUrl: string;
        };
      }>("/api/runs/save", { method: "POST" });
      pushLog(`Saved run snapshot: ${data.run.title}`);
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Run save failed");
    } finally {
      setBusy(null);
    }
  }

  async function publishRun() {
    const saved = await saveStoryboardNow();
    if (!saved) return;
    setBusy("publish");
    try {
      const data = await requestJson<{
        success: true;
        run: PublishedRunState;
      }>("/api/runs/publish", { method: "POST" });
      setPublishedRun(data.run);
      pushLog(`Published run to R2: ${data.run.title}`);
      pushLog(`Public video: ${data.run.videoUrl}`);
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Run publish failed");
    } finally {
      setBusy(null);
    }
  }

  async function addPublishedRunToGallery() {
    if (!publishedRun) return;
    setBusy("gallery");
    try {
      const data = await requestJson<{
        success: true;
        gallery: { entryRelPath: string; indexRelPath: string };
      }>("/api/gallery/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: publishedRun.id })
      });
      pushLog(`Added gallery entry: ${data.gallery.entryRelPath}`);
      pushLog(`Updated gallery index: ${data.gallery.indexRelPath}`);
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Gallery export failed");
    } finally {
      setBusy(null);
    }
  }

  function pushLog(message: string) {
    setLog((items) => [`${new Date().toLocaleTimeString()}  ${message}`, ...items].slice(0, 10));
  }

  const canGenerateSelected =
    Boolean(selectedShot?.prompt.trim()) &&
    Boolean(selectedShot?.references.length) &&
    (!selectedNeedsUploadHost || hasUploadHost) &&
    busy !== "shot" &&
    busy !== "all" &&
    !hasRunningShots;
  const canGenerateAll =
    Boolean(storyboard?.shots.length) &&
    storyboard!.shots.every((shot) => shot.prompt.trim() && shot.references.length > 0) &&
    storyboard!.shots.every((shot) => !shotNeedsUploadHost(shot) || hasUploadHost) &&
    busy !== "all" &&
    !hasRunningShots;

  return (
    <>
    <main className="grid h-screen grid-rows-[52px_minmax(0,1fr)] bg-panel2 text-ink">
      <header className="flex items-center justify-between border-b border-border bg-white px-4 shadow-tool">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-ink text-white">
            <Clapperboard size={17} />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-5">VibeStudio</h1>
            <p className="text-xs leading-4 text-muted">Project {project?.projectId ?? "default"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="hidden sm:inline">{saveState === "saving" ? "Saving" : saveState === "error" ? "Save error" : "Saved"}</span>
          <KeyPill
            label="VibeFrame"
            value={project?.vibe.version}
            ok={project?.vibe.source !== "missing" && Boolean(project?.vibe.version)}
            title={
              project?.vibe.error
                ? project.vibe.error
                : project?.vibe.commandLabel
                  ? `${project.vibe.source}: ${project.vibe.commandLabel}`
                  : undefined
            }
          />
          <KeyPill label="OpenAI" value={project?.keys.openai.masked} ok={project?.keys.openai.configured} />
          <KeyPill label="fal.ai" value={project?.keys.fal.masked} ok={project?.keys.fal.configured} />
          <KeyPill label="ImgBB" value={project?.keys.imgbb.masked} ok={project?.keys.imgbb.configured} />
          <button
            onClick={() => refreshAll("refresh")}
            className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-white hover:bg-panel"
            aria-label="Refresh"
          >
            <RefreshCw size={15} className={busy === "refresh" ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[280px_minmax(520px,1fr)_410px]">
        <aside className="min-h-0 border-r border-border bg-panel">
          <SectionHeader icon={<ImageIcon size={16} />} label="Assets" count={project?.assets.length ?? 0} />
          <div className="scrollbar h-[calc(100vh-101px)] overflow-auto p-3">
            <ActiveCharacterSheet asset={activeCharacterSheet} onPreview={previewAsset} />
            <AssetGroup
              title="Images"
              assets={imageAssets}
              selectedRefs={selectedRefs}
              onToggleRef={toggleRef}
              onPreview={previewAsset}
              onDelete={removeAsset}
            />
            <ClipSummary
              assets={activeClipAssets}
              archivedCount={archivedClipAssets.length}
              looseCount={looseClipAssets.length}
              selectedOutputPaths={selectedOutputPaths}
              onPreview={previewAsset}
              onArchive={(asset) => archiveAsset(asset, true)}
              onOpenLibrary={() => setClipLibraryOpen(true)}
            />
            <AssetGroup
              title="Exports"
              assets={exportAssets}
              selectedRefs={selectedRefs}
              onPreview={previewAsset}
              onDelete={removeAsset}
            />
          </div>
        </aside>

        <section className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_260px] bg-[#f2f6f9]">
          <div className="flex min-h-0 items-center justify-center p-5">
            <Preview
              mode={previewMode}
              asset={preview}
              storyboardPreview={{
                clips: storyboardPreviewClips,
                index: storyboardPreviewIndex,
                missingShots: storyboardPreviewMissingShots
              }}
              onStoryboardIndexChange={updateStoryboardPreviewIndex}
            />
          </div>
          <StoryboardLane
            storyboard={storyboard}
            assets={project?.assets ?? []}
            takesByShotId={shotTakesByShotId}
            selectedShotId={selectedShot?.id ?? null}
            totalDuration={totalDuration}
            previewClipCount={storyboardPreviewClips.length}
            previewMissingCount={storyboardPreviewMissingShots.length}
            hasRunningShots={hasRunningShots}
            allShotsReady={Boolean(allShotsReady)}
            canGenerateSelected={canGenerateSelected}
            canSaveRun={canSaveRun}
            canPublishRun={canPublishRun}
            canAddGallery={canAddGallery}
            canGenerateAll={canGenerateAll}
            busy={busy}
            onCreateDefault={draftStoryboard}
            onAddShot={addShot}
            onSelectShot={setSelectedShotId}
            onPreview={previewAsset}
            onPreviewStoryboard={previewStoryboard}
            onGenerateSelected={generateSelectedShot}
            onDuplicate={duplicateShot}
            onDelete={deleteStoryboardShot}
            onMove={moveShot}
            onGenerateAll={generateAllShots}
            onExport={exportStory}
            onSaveRun={saveRun}
            onPublishRun={publishRun}
            onAddGallery={addPublishedRunToGallery}
          />
        </section>

        <aside className="scrollbar min-h-0 overflow-auto border-l border-border bg-white">
          <WorkflowRail step={workflowStep} />
          <Panel title="Keys" icon={<KeyRound size={16} />}>
            <div className="grid gap-2">
              <input
                value={keys.openaiApiKey}
                onChange={(event) => setKeys((value) => ({ ...value, openaiApiKey: event.target.value }))}
                placeholder="OPENAI_API_KEY"
                type="password"
                className="h-9 rounded border border-border px-3 text-sm outline-none focus:border-accent"
              />
              <input
                value={keys.falApiKey}
                onChange={(event) => setKeys((value) => ({ ...value, falApiKey: event.target.value }))}
                placeholder="FAL_API_KEY"
                type="password"
                className="h-9 rounded border border-border px-3 text-sm outline-none focus:border-accent"
              />
              <input
                value={keys.imgbbApiKey}
                onChange={(event) => setKeys((value) => ({ ...value, imgbbApiKey: event.target.value }))}
                placeholder="IMGBB_API_KEY for strict continuation"
                type="password"
                className="h-9 rounded border border-border px-3 text-sm outline-none focus:border-accent"
              />
              <IconButton onClick={saveKeys} disabled={busy === "keys"} icon={<Save size={15} />} label="Save keys" />
            </div>
          </Panel>

          <Panel title="Character Sheet" icon={<Sparkles size={16} />}>
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                {characterPresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => applyCharacterPreset(preset)}
                    className="flex h-9 items-center justify-between rounded border border-border bg-white px-3 text-left text-xs hover:bg-panel"
                    title={`${preset.label} ${preset.detail}`}
                  >
                    <span className="font-semibold text-ink">{preset.label}</span>
                    <span className="text-muted">{preset.detail}</span>
                  </button>
                ))}
              </div>
              <input
                value={imageForm.characterName}
                onChange={(event) =>
                  setImageForm((value) => ({ ...value, characterName: event.target.value }))
                }
                placeholder="Character name"
                className="h-9 rounded border border-border px-3 text-sm outline-none focus:border-accent"
              />
              <textarea
                value={imageForm.character}
                onChange={(event) =>
                  setImageForm((value) => ({ ...value, character: event.target.value }))
                }
                className="min-h-24 resize-none rounded border border-border p-3 text-sm outline-none focus:border-accent"
              />
              <input
                value={imageForm.role}
                onChange={(event) => setImageForm((value) => ({ ...value, role: event.target.value }))}
                placeholder="Role / archetype"
                className="h-9 rounded border border-border px-3 text-sm outline-none focus:border-accent"
              />
              <textarea
                value={imageForm.outfit}
                onChange={(event) => setImageForm((value) => ({ ...value, outfit: event.target.value }))}
                placeholder="Outfit and silhouette"
                className="min-h-14 resize-none rounded border border-border p-3 text-sm outline-none focus:border-accent"
              />
              <textarea
                value={imageForm.gear}
                onChange={(event) => setImageForm((value) => ({ ...value, gear: event.target.value }))}
                placeholder="Gear and close-up details"
                className="min-h-14 resize-none rounded border border-border p-3 text-sm outline-none focus:border-accent"
              />
              <input
                value={imageForm.movementStyle}
                onChange={(event) => setImageForm((value) => ({ ...value, movementStyle: event.target.value }))}
                placeholder="Movement style"
                className="h-9 rounded border border-border px-3 text-sm outline-none focus:border-accent"
              />
              <input
                value={imageForm.palette}
                onChange={(event) => setImageForm((value) => ({ ...value, palette: event.target.value }))}
                placeholder="Palette"
                className="h-9 rounded border border-border px-3 text-sm outline-none focus:border-accent"
              />
              <textarea
                value={imageForm.style}
                onChange={(event) => setImageForm((value) => ({ ...value, style: event.target.value }))}
                className="min-h-16 resize-none rounded border border-border p-3 text-sm outline-none focus:border-accent"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={imageForm.quality}
                  onChange={(value) =>
                    setImageForm((current) => ({ ...current, quality: value as ImageForm["quality"] }))
                  }
                  options={["low", "medium", "high"]}
                />
                <Select
                  value={imageForm.size}
                  onChange={(value) =>
                    setImageForm((current) => ({ ...current, size: value as ImageForm["size"] }))
                  }
                  options={["1024x1024", "1536x1024", "1024x1536"]}
                />
              </div>
              <IconButton
                onClick={generateImages}
                disabled={busy === "images"}
                icon={busy === "images" ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
                label="Generate character sheet"
              />
            </div>
          </Panel>

          <Panel title="Prompt Recipes" icon={<Sparkles size={16} />}>
            <div className="grid gap-2">
              {promptRecipes.map((recipe) => (
                <button
                  key={recipe.label}
                  onClick={() => applyPromptRecipe(recipe)}
                  className="rounded border border-border bg-white p-2 text-left hover:bg-panel"
                  title={recipe.sourceNote}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-ink">{recipe.label}</span>
                    <span className="rounded bg-panel2 px-2 py-0.5 text-[11px] text-muted">{recipe.detail}</span>
                  </div>
                  <div className="mt-1 max-h-8 overflow-hidden text-xs text-muted">{recipe.form.brief}</div>
                </button>
              ))}
              <div className="rounded border border-border bg-panel p-2 text-xs text-muted">
                External prompts are stored as adapted recipes with source notes, not raw prompt dumps.
              </div>
            </div>
          </Panel>

          <Panel title="Storyboard Draft" icon={<Film size={16} />}>
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                {storyboardPresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => applyStoryboardPreset(preset)}
                    className="flex h-9 items-center justify-between rounded border border-border bg-white px-3 text-left text-xs hover:bg-panel"
                    title={`${preset.label} ${preset.detail}`}
                  >
                    <span className="font-semibold text-ink">{preset.label}</span>
                    <span className="text-muted">{preset.detail}</span>
                  </button>
                ))}
              </div>
              <textarea
                value={draftForm.brief}
                onChange={(event) => setDraftForm((value) => ({ ...value, brief: event.target.value }))}
                className="min-h-28 resize-none rounded border border-border p-3 text-sm outline-none focus:border-accent"
              />
              <textarea
                value={draftForm.visualStyle}
                onChange={(event) => setDraftForm((value) => ({ ...value, visualStyle: event.target.value }))}
                className="min-h-14 resize-none rounded border border-border p-3 text-sm outline-none focus:border-accent"
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-[11px] font-semibold text-muted">
                  Total sec
                  <NumberInput
                    value={draftForm.targetDuration}
                    min={5}
                    max={180}
                    onChange={(value) => setDraftForm((current) => ({ ...current, targetDuration: value }))}
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-semibold text-muted">
                  Scenes
                  <Select
                    value={draftForm.sceneCount}
                    onChange={(value) =>
                      setDraftForm((current) => ({ ...current, sceneCount: value as DraftSceneCount }))
                    }
                    options={draftSceneCountOptions}
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-semibold text-muted">
                  Pacing
                  <Select
                    value={draftForm.pacing}
                    onChange={(value) =>
                      setDraftForm((current) => ({ ...current, pacing: value as StoryboardPacing }))
                    }
                    options={pacingOptions}
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-semibold text-muted">
                  Ratio
                  <Select
                    value={draftForm.aspectRatio}
                    onChange={(value) => setDraftForm((current) => ({ ...current, aspectRatio: value as VideoRatio }))}
                    options={["16:9", "9:16", "1:1"]}
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-semibold text-muted">
                  Model
                  <Select
                    value={draftForm.seedanceModel}
                    onChange={(value) =>
                      setDraftForm((current) => ({ ...current, seedanceModel: value as SeedanceModel }))
                    }
                    options={["fast", "quality"]}
                  />
                </label>
              </div>
              <div
                className={`rounded border p-2 text-xs ${
                  draftSceneCountInvalid ? "border-warn bg-[#fff7ed] text-warn" : "border-border bg-panel text-muted"
                }`}
              >
                {draftSceneHint}
              </div>
              {draftForm.seedanceModel === "quality" ? (
                <div className="rounded border border-warn bg-[#fff7ed] p-2 text-xs text-warn">
                  Quality mode can be slow and expensive. Generate selected shots one at a time before queueing all.
                </div>
              ) : null}
              <div className="rounded border border-border bg-panel p-2 text-xs text-muted">
                {activeCharacterSheet
                  ? `@Image1 will use ${String(activeCharacterSheet.metadata?.["label"] ?? activeCharacterSheet.name)}`
                  : "Generate or select a character sheet first for the best Seedance consistency."}
              </div>
              <IconButton
                onClick={draftStoryboard}
                disabled={busy === "draft" || !draftForm.brief.trim() || draftSceneCountInvalid}
                icon={busy === "draft" ? <Loader2 size={15} className="animate-spin" /> : <Film size={15} />}
                label="Draft storyboard"
              />
              <DraftPreview result={draftPreview} onApply={applyDraftStoryboard} />
            </div>
          </Panel>

          <Panel title="Shot Inspector" icon={<Film size={16} />}>
            {!selectedShot ? (
              <div className="grid gap-3">
                <EmptyLine label="No shot selected" />
                <IconButton onClick={draftStoryboard} icon={<Plus size={15} />} label="Draft storyboard" />
              </div>
            ) : (
              <div className="grid gap-2">
                <input
                  value={selectedShot.title}
                  onChange={(event) => updateSelectedShot({ title: event.target.value })}
                  className="h-9 rounded border border-border px-3 text-sm font-semibold outline-none focus:border-accent"
                />
                <div className="relative">
                  <textarea
                    ref={promptRef}
                    value={selectedShot.prompt}
                    onChange={(event) => updatePrompt(event.target.value, event.target.selectionStart)}
                    onClick={(event) => updateMention(event.currentTarget.value, event.currentTarget.selectionStart)}
                    onKeyDown={handlePromptKeyDown}
                    onKeyUp={(event) => {
                      if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) return;
                      updateMention(event.currentTarget.value, event.currentTarget.selectionStart);
                    }}
                    className="min-h-36 w-full resize-none rounded border border-border p-3 text-sm outline-none focus:border-accent"
                  />
                  {mentionOptions.length > 0 ? (
                    <div className="absolute left-2 right-2 top-[calc(100%+4px)] z-20 overflow-hidden rounded border border-border bg-white shadow-lg">
                      {mentionOptions.map((option, index) => (
                        <button
                          key={option.relPath}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            insertMention(option);
                          }}
                          className={`flex h-12 w-full items-center gap-2 px-2 text-left text-xs ${
                            index === mentionIndex ? "bg-panel2" : "bg-white"
                          }`}
                        >
                          <span className="h-8 w-10 shrink-0 overflow-hidden rounded border border-border bg-panel">
                            <Thumb asset={option.asset} />
                          </span>
                          <span className="font-semibold text-ink">{option.token}</span>
                          <span className="min-w-0 truncate text-muted">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <PromptReferenceList references={promptReferences} />
                <div
                  className={`rounded border p-2 text-xs ${
                    selectedContinuity.tone === "ready"
                      ? "border-accent bg-[#e8f5f5] text-ink"
                      : "border-border bg-panel text-muted"
                  }`}
                >
                  <div className="font-semibold">{selectedContinuity.label}</div>
                  <div className="mt-0.5">{selectedContinuity.detail}</div>
                </div>
                {selectedNeedsUploadHost && !hasUploadHost ? (
                  <div className="rounded border border-warn bg-[#fff7ed] p-2 text-xs text-warn">
                    Strict continuation uses Seedance image-to-video and needs IMGBB_API_KEY for the extracted start frame.
                  </div>
                ) : null}
                <TakeStrip
                  shot={selectedShot}
                  takes={selectedShotTakes}
                  selectedRelPath={selectedShot.outputRelPath}
                  onSelect={(asset) => selectShotTake(selectedShot.id, asset)}
                  onPreview={previewAsset}
                  onArchive={(asset) => archiveAsset(asset, true)}
                  onArchiveUnselected={() => archiveUnselectedTakes(selectedShot, selectedShotTakes)}
                />
                <ReferenceStrip
                  references={referenceOptions}
                  onPreview={previewAsset}
                  onRemove={(relPath) =>
                    updateSelectedShot({
                      references: selectedShot.references.filter((item) => item !== relPath)
                    })
                  }
                />
                <div className="grid grid-cols-4 gap-2">
                  <NumberInput
                    value={selectedShot.duration}
                    onChange={(value) => updateSelectedShot({ duration: value })}
                  />
                  <Select
                    value={selectedShot.ratio}
                    onChange={(value) => updateSelectedShot({ ratio: value as VideoRatio })}
                    options={["16:9", "9:16", "1:1"]}
                  />
                  <Select
                    value={selectedShot.resolution}
                    onChange={(value) => updateSelectedShot({ resolution: value as VideoResolution })}
                    options={["480p", "720p", "1080p"]}
                  />
                  <Select
                    value={selectedShot.seedanceModel}
                    onChange={(value) => updateSelectedShot({ seedanceModel: value as SeedanceModel })}
                    options={["fast", "quality"]}
                  />
                </div>
                <label className="grid gap-1 text-[11px] font-semibold text-muted">
                  Generation mode
                  <Select
                    value={selectedShot.generationMode}
                    onChange={(value) => updateSelectedShot({ generationMode: value as GenerationMode })}
                    options={["omni-reference", "strict-continuation"]}
                  />
                </label>
                <div className="grid gap-2 rounded border border-border bg-panel p-2">
                  <div className="text-[11px] font-semibold text-muted">Export cut</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1 text-[11px] font-semibold text-muted">
                      Trim head
                      <DecimalInput
                        value={selectedShot.trimHeadSec}
                        min={0}
                        max={3}
                        step={0.05}
                        onChange={(value) => updateSelectedShot({ trimHeadSec: value })}
                      />
                    </label>
                    <label className="grid gap-1 text-[11px] font-semibold text-muted">
                      Trim tail
                      <DecimalInput
                        value={selectedShot.trimTailSec}
                        min={0}
                        max={3}
                        step={0.05}
                        onChange={(value) => updateSelectedShot({ trimTailSec: value })}
                      />
                    </label>
                    <label className="grid gap-1 text-[11px] font-semibold text-muted">
                      Transition after
                      <Select
                        value={selectedShot.transitionAfter}
                        onChange={(value) => updateSelectedShot({ transitionAfter: value as ExportTransition })}
                        options={transitionOptions}
                      />
                    </label>
                    <label className="grid gap-1 text-[11px] font-semibold text-muted">
                      Transition sec
                      <DecimalInput
                        value={selectedShot.transitionDurationSec}
                        min={0.1}
                        max={1.5}
                        step={0.05}
                        onChange={(value) => updateSelectedShot({ transitionDurationSec: value })}
                      />
                    </label>
                  </div>
                </div>
                <PromptLintMessages shot={selectedShot} references={referenceOptions} />
                <div className="grid grid-cols-3 gap-2">
                  {[5, 10, 15].map((duration) => (
                    <button
                      key={duration}
                      onClick={() => updateSelectedShot({ duration })}
                      className={`h-8 rounded border px-2 text-xs font-medium ${
                        selectedShot.duration === duration
                          ? "border-accent bg-[#e8f5f5] text-ink"
                          : "border-border bg-white text-muted hover:bg-panel"
                      }`}
                    >
                      {duration}s
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => updateSelectedShot({ generateAudio: !selectedShot.generateAudio })}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded border border-border bg-white px-3 text-sm hover:bg-panel"
                >
                  {selectedShot.generateAudio ? <Volume2 size={15} /> : <VolumeX size={15} />}
                  Native audio {selectedShot.generateAudio ? "on" : "off"}
                </button>
                {selectedShot.error ? (
                  <div className="rounded border border-warn bg-[#fff7ed] p-2 text-xs text-warn">
                    {selectedShot.error}
                  </div>
                ) : null}
                <IconButton
                  onClick={generateSelectedShot}
                  disabled={!canGenerateSelected}
                  icon={busy === "shot" ? <Loader2 size={15} className="animate-spin" /> : <Video size={15} />}
                  label={selectedShot.status === "failed" ? "Retry shot" : "Generate selected"}
                />
                <button
                  onClick={saveSelectedPromptRecipe}
                  disabled={busy === "recipe" || !selectedShot.prompt.trim()}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded border border-border bg-white px-3 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed"
                >
                  {busy === "recipe" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Save as recipe
                </button>
              </div>
            )}
          </Panel>

          <Panel title="Jobs" icon={<Eye size={16} />}>
            <div className="grid gap-1 text-xs text-muted">
              {hasRunningShots ? <div className="font-medium text-ink">Generation queue is running</div> : null}
              {log.length === 0 ? <EmptyLine label="Idle" /> : log.map((item) => <div key={item}>{item}</div>)}
            </div>
          </Panel>
        </aside>
      </div>
    </main>
    {clipLibraryOpen ? (
      <ClipLibrary
        storyboard={storyboard}
        activeClips={activeClipAssets}
        archivedClips={archivedClipAssets}
        selectedOutputPaths={selectedOutputPaths}
        onClose={() => setClipLibraryOpen(false)}
        onPreview={previewAsset}
        onSelectTake={selectShotTake}
        onArchive={(asset) => archiveAsset(asset, true)}
        onRestore={(asset) => archiveAsset(asset, false)}
      />
    ) : null}
    </>
  );
}

function KeyPill({
  label,
  value,
  ok,
  title
}: {
  label: string;
  value?: string | null;
  ok?: boolean;
  title?: string;
}) {
  return (
    <div className="flex h-8 items-center gap-2 rounded border border-border bg-panel px-2" title={title}>
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-accent" : "bg-warn"}`} />
      <span>{label}</span>
      <span className="font-mono">{value ?? "unset"}</span>
    </div>
  );
}

function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number | string }) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-border px-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </div>
      <span className="rounded bg-panel2 px-2 py-0.5 text-xs text-muted">{count}</span>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-border p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function WorkflowRail({ step }: { step: number }) {
  const items = ["Sheet", "Storyboard", "Clips", "Export"];
  return (
    <section className="border-b border-border p-3">
      <div className="grid grid-cols-4 gap-1">
        {items.map((item, index) => {
          const active = index + 1 === step;
          const done = index + 1 < step;
          return (
            <div
              key={item}
              className={`rounded border px-2 py-1.5 text-center text-[11px] font-medium ${
                active
                  ? "border-accent bg-[#e8f5f5] text-ink"
                  : done
                    ? "border-border bg-panel text-ink"
                    : "border-border bg-white text-muted"
              }`}
            >
              {index + 1} {item}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ActiveCharacterSheet({
  asset,
  onPreview
}: {
  asset: StudioAsset | null;
  onPreview: (asset: StudioAsset) => void;
}) {
  return (
    <div className="mb-5 rounded border border-accent bg-white p-2">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-ink">Active Sheet</span>
        <span className="rounded bg-[#e8f5f5] px-2 py-0.5 text-accent">@Image1</span>
      </div>
      {asset ? (
        <button onClick={() => onPreview(asset)} className="block w-full overflow-hidden rounded border border-border bg-panel">
          <div className="h-28">
            <Thumb asset={asset} />
          </div>
          <div className="truncate px-2 py-1.5 text-left text-xs font-medium">
            {(asset.metadata?.["label"] as string) || asset.name}
          </div>
        </button>
      ) : (
        <EmptyLine label="No character sheet" />
      )}
    </div>
  );
}

function AssetGroup({
  title,
  assets,
  selectedRefs,
  onToggleRef,
  onPreview,
  onDelete
}: {
  title: string;
  assets: StudioAsset[];
  selectedRefs: string[];
  onToggleRef?: (relPath: string) => void;
  onPreview: (asset: StudioAsset) => void;
  onDelete: (asset: StudioAsset) => void;
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 text-xs font-semibold uppercase text-muted">{title}</div>
      <div className="grid gap-2">
        {assets.length === 0 ? (
          <EmptyLine label="Empty" />
        ) : (
          assets.map((asset) => {
            const refIndex = selectedRefs.indexOf(asset.relPath);
            const selected = refIndex >= 0;
            return (
              <div
                key={asset.id}
                className={`overflow-hidden rounded border bg-white ${selected ? "border-accent" : "border-border"}`}
              >
                <button onClick={() => onPreview(asset)} className="block h-32 w-full bg-panel">
                  <Thumb asset={asset} />
                </button>
                <div className="flex items-center justify-between gap-2 p-2 text-xs">
                  <button
                    onClick={() => onPreview(asset)}
                    className="min-w-0 truncate text-left font-medium"
                    title={asset.relPath}
                  >
                    {(asset.metadata?.["label"] as string) || asset.name}
                  </button>
                  {asset.kind === "image" && onToggleRef ? (
                    <button
                      onClick={() => onToggleRef(asset.relPath)}
                      className={`h-7 rounded px-2 ${selected ? "bg-accent text-white" : "bg-panel2 text-ink"}`}
                      title={selected ? "Remove from selected shot" : "Use in selected shot"}
                    >
                      {selected ? `@Image${refIndex + 1}` : "Ref"}
                    </button>
                  ) : null}
                  <button
                    onClick={() => onDelete(asset)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded bg-panel2 text-ink hover:bg-panel"
                    aria-label="Delete asset"
                    title="Delete asset"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ClipSummary({
  assets,
  archivedCount,
  looseCount,
  selectedOutputPaths,
  onPreview,
  onArchive,
  onOpenLibrary
}: {
  assets: StudioAsset[];
  archivedCount: number;
  looseCount: number;
  selectedOutputPaths: Set<string>;
  onPreview: (asset: StudioAsset) => void;
  onArchive: (asset: StudioAsset) => void;
  onOpenLibrary: () => void;
}) {
  const recent = assets.slice(0, 5);
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase text-muted">
        <span>Clips</span>
        <button onClick={onOpenLibrary} className="rounded bg-panel2 px-2 py-0.5 text-[11px] normal-case text-ink hover:bg-white">
          Library
        </button>
      </div>
      <button
        onClick={onOpenLibrary}
        className="mb-2 grid w-full grid-cols-3 gap-1 rounded border border-border bg-white p-2 text-left text-[11px] text-muted hover:bg-panel"
      >
        <span><strong className="text-ink">{assets.length}</strong> active</span>
        <span><strong className="text-ink">{looseCount}</strong> loose</span>
        <span><strong className="text-ink">{archivedCount}</strong> archived</span>
      </button>
      <div className="grid gap-2">
        {recent.length === 0 ? (
          <EmptyLine label="No active clips" />
        ) : (
          recent.map((asset) => {
            const selected = selectedOutputPaths.has(asset.relPath);
            return (
              <div key={asset.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] overflow-hidden rounded border border-border bg-white">
                <button onClick={() => onPreview(asset)} className="h-12 bg-panel">
                  <Thumb asset={asset} />
                </button>
                <button onClick={() => onPreview(asset)} className="min-w-0 px-2 text-left text-xs">
                  <div className="truncate font-medium">{(asset.metadata?.["label"] as string) || asset.name}</div>
                  <div className="truncate text-[11px] text-muted">
                    {selected ? "selected take" : clipAssetSubtitle(asset)}
                  </div>
                </button>
                <button
                  onClick={() => onArchive(asset)}
                  disabled={selected}
                  title={selected ? "Select another take before archiving" : "Archive clip"}
                  aria-label="Archive clip"
                  className="m-2 inline-flex h-8 w-8 items-center justify-center rounded bg-panel2 text-ink hover:bg-panel disabled:cursor-not-allowed disabled:text-muted"
                >
                  <Archive size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StoryboardLane({
  storyboard,
  assets,
  takesByShotId,
  selectedShotId,
  totalDuration,
  previewClipCount,
  previewMissingCount,
  hasRunningShots,
  allShotsReady,
  canGenerateSelected,
  canSaveRun,
  canPublishRun,
  canAddGallery,
  canGenerateAll,
  busy,
  onCreateDefault,
  onAddShot,
  onSelectShot,
  onPreview,
  onPreviewStoryboard,
  onGenerateSelected,
  onDuplicate,
  onDelete,
  onMove,
  onGenerateAll,
  onExport,
  onSaveRun,
  onPublishRun,
  onAddGallery
}: {
  storyboard: StoryboardProject | null;
  assets: StudioAsset[];
  takesByShotId: Map<string, StudioAsset[]>;
  selectedShotId: string | null;
  totalDuration: number;
  previewClipCount: number;
  previewMissingCount: number;
  hasRunningShots: boolean;
  allShotsReady: boolean;
  canGenerateSelected: boolean;
  canSaveRun: boolean;
  canPublishRun: boolean;
  canAddGallery: boolean;
  canGenerateAll: boolean;
  busy: Busy;
  onCreateDefault: () => void;
  onAddShot: () => void;
  onSelectShot: (id: string) => void;
  onPreview: (asset: StudioAsset) => void;
  onPreviewStoryboard: () => void;
  onGenerateSelected: () => void;
  onDuplicate: (shot: StoryboardShot) => void;
  onDelete: (shot: StoryboardShot) => void;
  onMove: (shot: StoryboardShot, direction: -1 | 1) => void;
  onGenerateAll: () => void;
  onExport: () => void;
  onSaveRun: () => void;
  onPublishRun: () => void;
  onAddGallery: () => void;
}) {
  const shots = storyboard?.shots ?? [];
  return (
    <div className="min-w-0 border-t border-border bg-white">
      <div className="flex h-12 items-center justify-between gap-3 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Play size={16} />
          <span>Storyboard</span>
          <span className="rounded bg-panel2 px-2 py-0.5 text-xs text-muted">
            {totalDuration}s / {storyboard?.targetDuration ?? 30}s
          </span>
          {previewClipCount > 0 ? (
            <span className="rounded bg-panel2 px-2 py-0.5 text-xs text-muted">
              {previewClipCount} clips{previewMissingCount > 0 ? ` / ${previewMissingCount} missing` : ""}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <MiniButton onClick={onCreateDefault} icon={<Film size={14} />} label="Draft" />
          <MiniButton onClick={onAddShot} icon={<Plus size={14} />} label="Shot" />
          <MiniButton
            onClick={onPreviewStoryboard}
            disabled={previewClipCount === 0}
            icon={<Play size={14} />}
            label="Preview"
            title={
              previewClipCount === 0
                ? "Generate at least one shot before preview"
                : previewMissingCount > 0
                  ? `${previewMissingCount} storyboard shots are not generated yet`
                  : "Preview generated storyboard clips"
            }
          />
          <MiniButton
            onClick={onGenerateSelected}
            disabled={!canGenerateSelected}
            icon={busy === "shot" ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
            label="Selected"
            title="Generate selected shot"
          />
          <MiniButton
            onClick={onGenerateAll}
            disabled={!canGenerateAll}
            icon={busy === "all" ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
            label="All"
          />
          <MiniButton
            onClick={onExport}
            disabled={!allShotsReady || busy === "export"}
            icon={busy === "export" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            label="Export"
          />
          <MiniButton
            onClick={onSaveRun}
            disabled={!canSaveRun}
            icon={busy === "run" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            label="Run"
            title={canSaveRun ? "Save prompt/result run snapshot" : "Export first before saving a run"}
          />
          <MiniButton
            onClick={onPublishRun}
            disabled={!canPublishRun}
            icon={busy === "publish" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            label="Publish"
            title={canPublishRun ? "Upload current export, thumbnail, manifest, and references to R2" : "Export first before publishing"}
          />
          <MiniButton
            onClick={onAddGallery}
            disabled={!canAddGallery}
            icon={busy === "gallery" ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
            label="Gallery"
            title={canAddGallery ? "Write curated examples JSON for GitHub Pages" : "Publish to R2 before adding to gallery"}
          />
        </div>
      </div>
      <div className="scrollbar flex h-[207px] gap-3 overflow-x-auto p-3">
        {shots.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-border text-sm text-muted">
            Draft a storyboard from the brief, then generate short Seedance clips and export one video.
          </div>
        ) : (
          shots.map((shot) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              selected={shot.id === selectedShotId}
              asset={assets.find((asset) => asset.relPath === shot.outputRelPath) ?? null}
              takes={takesByShotId.get(shot.id) ?? []}
              onSelect={() => onSelectShot(shot.id)}
              onPreview={onPreview}
              onDuplicate={() => onDuplicate(shot)}
              onDelete={() => onDelete(shot)}
              onMoveLeft={() => onMove(shot, -1)}
              onMoveRight={() => onMove(shot, 1)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ShotCard({
  shot,
  selected,
  asset,
  takes,
  onSelect,
  onPreview,
  onDuplicate,
  onDelete,
  onMoveLeft,
  onMoveRight
}: {
  shot: StoryboardShot;
  selected: boolean;
  asset: StudioAsset | null;
  takes: StudioAsset[];
  onSelect: () => void;
  onPreview: (asset: StudioAsset) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}) {
  const selectedTakeIndex = asset ? takes.findIndex((take) => take.relPath === asset.relPath) : -1;
  const takeLabel =
    takes.length > 0 ? `Take ${selectedTakeIndex >= 0 ? selectedTakeIndex + 1 : 1}/${takes.length}` : null;
  return (
    <div
      className={`h-[190px] w-[252px] shrink-0 overflow-hidden rounded border bg-white ${
        selected ? "border-accent shadow-sm" : "border-border"
      }`}
    >
      <button
        onClick={() => {
          onSelect();
          if (asset) onPreview(asset);
        }}
        className="relative block h-[110px] w-full bg-panel text-left"
      >
        {asset ? (
          <Thumb asset={asset} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            <ShotStatusBadge status={shot.status} />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-white/90 px-2 py-0.5 text-[11px] font-semibold">
          {shot.order + 1}
        </span>
        {takeLabel ? (
          <span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
            {takeLabel}
          </span>
        ) : null}
      </button>
      <div className="grid h-[80px] grid-rows-[auto_auto] gap-2 p-2 text-xs">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <button onClick={onSelect} className="min-w-0 truncate text-left font-semibold" title={shot.title}>
            {shot.title}
          </button>
          <span className="shrink-0 text-muted">{shot.duration}s</span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <ShotStatusBadge status={shot.status} compact />
          {takes.length > 1 ? (
            <span className="shrink-0 rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">
              {takes.length} takes
            </span>
          ) : null}
          <div className="grid shrink-0 grid-cols-4 gap-1">
            <button className="card-tool" onClick={onMoveLeft} aria-label="Move shot left">
              <ChevronLeft size={13} />
            </button>
            <button className="card-tool" onClick={onMoveRight} aria-label="Move shot right">
              <ChevronRight size={13} />
            </button>
            <button className="card-tool" onClick={onDuplicate} aria-label="Duplicate shot">
              <Copy size={13} />
            </button>
            <button className="card-tool" onClick={onDelete} aria-label="Delete shot">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShotStatusBadge({ status, compact = false }: { status: StoryboardShot["status"]; compact?: boolean }) {
  const running = isRunningStatus(status);
  const failed = status === "failed";
  const done = status === "done";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
        done
          ? "bg-[#e8f5f5] text-accent"
          : failed
            ? "bg-[#fff7ed] text-warn"
            : running
              ? "bg-panel2 text-ink"
              : "bg-panel2 text-muted"
      }`}
    >
      {running ? <Loader2 size={compact ? 11 : 13} className="animate-spin" /> : failed ? <AlertTriangle size={compact ? 11 : 13} /> : done ? <CheckCircle2 size={compact ? 11 : 13} /> : null}
      {status}
    </span>
  );
}

function DraftPreview({
  result,
  onApply
}: {
  result: StoryboardDraftResult | null;
  onApply: () => void;
}) {
  if (!result) return null;
  const total = result.shots.reduce((sum, shot) => sum + shot.duration, 0);
  return (
    <div className="grid gap-2 rounded border border-border bg-panel p-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-ink">
          Draft preview
        </span>
        <span
          className={`rounded px-2 py-0.5 ${
            result.provider === "openai" ? "bg-[#e8f5f5] text-accent" : "bg-[#fff7ed] text-warn"
          }`}
        >
          {result.provider === "openai" ? "AI draft" : "Local fallback"} / {result.model ?? "unknown"} / {result.shots.length} scenes / {total}s
        </span>
      </div>
      <div className="scrollbar grid max-h-44 gap-1 overflow-auto">
        {result.shots.map((shot) => (
          <div key={shot.id} className="rounded border border-border bg-white p-2 text-xs">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate font-semibold">{shot.order + 1}. {shot.title}</span>
              <span className="shrink-0 text-muted">{shot.duration}s</span>
            </div>
            <p className="line-clamp-2 text-muted">{shot.prompt}</p>
          </div>
        ))}
      </div>
      {result.provider === "fallback" ? (
        <div className="rounded border border-warn bg-[#fff7ed] p-2 text-xs text-warn">
          Local fallback was used. {result.error ? `${result.error} ` : ""}Review continuity and prompts before provider spend.
        </div>
      ) : null}
      {result.storyBible ? (
        <div className="grid gap-1 rounded border border-border bg-white p-2 text-xs text-muted">
          <div className="font-semibold text-ink">Story bible</div>
          <div>Location: {result.storyBible.location}</div>
          <div>Lighting: {result.storyBible.lighting}</div>
          <div>Direction: {result.storyBible.screenDirection}</div>
        </div>
      ) : null}
      {result.continuityNotes.length > 0 ? (
        <div className="grid gap-1 rounded border border-border bg-white p-2 text-xs text-muted">
          {result.continuityNotes.map((note) => (
            <div key={note}>{note}</div>
          ))}
        </div>
      ) : null}
      {result.qualityChecks?.length ? (
        <div className="grid gap-1 rounded border border-border bg-white p-2 text-xs text-muted">
          {result.qualityChecks.map((check) => (
            <div key={check}>{check}</div>
          ))}
        </div>
      ) : null}
      <IconButton onClick={onApply} icon={<CheckCircle2 size={15} />} label="Apply to storyboard" />
    </div>
  );
}

function TakeStrip({
  shot,
  takes,
  selectedRelPath,
  onSelect,
  onPreview,
  onArchive,
  onArchiveUnselected
}: {
  shot: StoryboardShot;
  takes: StudioAsset[];
  selectedRelPath?: string;
  onSelect: (asset: StudioAsset) => void;
  onPreview: (asset: StudioAsset) => void;
  onArchive: (asset: StudioAsset) => void;
  onArchiveUnselected: () => void;
}) {
  const unselectedCount = takes.filter((asset) => asset.relPath !== selectedRelPath).length;
  return (
    <div className="grid gap-2 rounded border border-border bg-panel p-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="font-semibold text-ink">Takes</div>
        <div className="flex items-center gap-2">
          <span className="text-muted">{takes.length} for shot {shot.order + 1}</span>
          <button
            onClick={onArchiveUnselected}
            disabled={unselectedCount === 0}
            className="rounded border border-border bg-white px-2 py-1 text-[11px] font-medium hover:bg-panel disabled:cursor-not-allowed disabled:text-muted"
          >
            Archive unselected
          </button>
        </div>
      </div>
      {takes.length === 0 ? (
        <EmptyLine label="No takes generated yet" />
      ) : (
        <div className="scrollbar flex gap-2 overflow-x-auto">
          {takes.map((asset, index) => {
            const selected = asset.relPath === selectedRelPath;
            return (
              <div
                key={asset.id}
                className={`relative h-[86px] w-[116px] shrink-0 overflow-hidden rounded border bg-white ${
                  selected ? "border-accent" : "border-border"
                }`}
              >
                <button
                  onClick={() => onSelect(asset)}
                  className="block h-14 w-full bg-panel"
                  title="Select this take"
                >
                  <Thumb asset={asset} />
                </button>
                <button
                  onClick={() => onPreview(asset)}
                  className="grid w-full gap-0.5 px-1.5 py-1 text-left text-[10px]"
                  title="Preview this take"
                >
                  <span className="truncate font-semibold">Take {index + 1}</span>
                  <span className="truncate text-muted">{clipAssetSubtitle(asset)}</span>
                </button>
                <span className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  selected ? "bg-accent text-white" : "bg-white/90 text-ink"
                }`}>
                  {selected ? "Selected" : "Take"}
                </span>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onArchive(asset);
                  }}
                  disabled={selected}
                  title={selected ? "Select another take before archiving" : "Archive take"}
                  aria-label="Archive take"
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded bg-white/90 shadow-tool disabled:cursor-not-allowed disabled:text-muted"
                >
                  <Archive size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReferenceStrip({
  references,
  onPreview,
  onRemove
}: {
  references: ReferenceOption[];
  onPreview: (asset: StudioAsset) => void;
  onRemove: (relPath: string) => void;
}) {
  return (
    <div className="scrollbar flex min-h-[92px] gap-2 overflow-x-auto rounded border border-border bg-panel p-2">
      {references.length === 0 ? (
        <div className="flex w-full items-center justify-center text-xs text-muted">No references selected</div>
      ) : (
        references.map((reference) => (
          <div key={reference.relPath} className="group relative h-[74px] w-[92px] shrink-0 overflow-hidden rounded border border-border bg-white">
            <button onClick={() => onPreview(reference.asset)} className="h-full w-full">
              <Thumb asset={reference.asset} />
            </button>
            <span className="absolute left-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold">
              {reference.token}
            </span>
            <button
              onClick={() => onRemove(reference.relPath)}
              className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded bg-white/90 opacity-0 shadow-tool group-hover:opacity-100"
              aria-label="Remove reference"
            >
              <X size={12} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function preferredReferenceAssets(assets: StudioAsset[]): StudioAsset[] {
  const images = assets.filter((asset) => asset.kind === "image");
  const singleSheet = images.find(
    (asset) =>
      asset.metadata?.["sheetKind"] === "omni-reference" ||
      asset.metadata?.["sheet"] === true ||
      asset.metadata?.["label"] === "Character Sheet" ||
      asset.name === "character-sheet.png"
  );
  if (singleSheet) return [singleSheet];

  const priority = new Map([
    ["full-front", 0],
    ["three-quarter", 1],
    ["side", 2],
    ["back", 3],
    ["face-closeup", 4],
    ["expression-closeup", 5]
  ]);
  return [...images]
    .sort((a, b) => {
      const aRank = priority.get(String(a.metadata?.["variant"] ?? "")) ?? 100;
      const bRank = priority.get(String(b.metadata?.["variant"] ?? "")) ?? 100;
      if (aRank !== bRank) return aRank - bRank;
      return a.relPath.localeCompare(b.relPath);
    })
    .slice(0, 6);
}

function draftSceneRangeFor(targetDuration: number): { min: number; max: number } {
  const duration = Math.max(5, Math.min(180, Math.round(targetDuration || 30)));
  const min = Math.max(1, Math.ceil(duration / MAX_STORYBOARD_SHOT_DURATION));
  const max = Math.max(
    min,
    Math.min(MAX_DRAFT_SCENE_COUNT, Math.floor(duration / MIN_STORYBOARD_SHOT_DURATION))
  );
  return { min, max };
}

function suggestedDraftSceneCount(targetDuration: number, pacing: StoryboardPacing): number {
  const duration = Math.max(5, Math.min(180, Math.round(targetDuration || 30)));
  const range = draftSceneRangeFor(duration);
  const secondsPerScene = pacing === "slow" ? 10 : pacing === "fast" ? 5 : 6;
  return Math.max(range.min, Math.min(range.max, Math.round(duration / secondsPerScene)));
}

function PromptReferenceList({ references }: { references: PromptReference[] }) {
  if (references.length === 0) return null;
  return (
    <div className="flex min-h-7 flex-wrap gap-1">
      {references.map((reference) => (
        <span
          key={`${reference.token}-${reference.relPath ?? "missing"}`}
          className={`inline-flex h-7 max-w-full items-center gap-1 rounded border px-2 text-xs ${
            reference.valid
              ? "border-accent bg-[#e8f5f5] text-ink"
              : "border-warn bg-[#fff7ed] text-warn"
          }`}
          title={reference.relPath ?? "Reference not selected"}
        >
          <span className="font-semibold">{reference.token}</span>
          <span className="truncate">{reference.label}</span>
        </span>
      ))}
    </div>
  );
}

function PromptLintMessages({ shot, references }: { shot: StoryboardShot; references: ReferenceOption[] }) {
  const messages = promptLintMessages(shot, references);
  if (messages.length === 0) return null;
  return (
    <div className="grid gap-1 rounded border border-warn bg-[#fff7ed] p-2 text-xs text-warn">
      {messages.map((message) => (
        <div key={message}>{message}</div>
      ))}
    </div>
  );
}

function parsePromptReferences(prompt: string, options: ReferenceOption[]): PromptReference[] {
  const uniqueTokens = Array.from(new Set(prompt.match(/@Image\d+/g) ?? []));
  return uniqueTokens.map((token) => {
    const option = options.find((item) => item.token === token);
    return {
      token,
      label: option?.label ?? "Missing",
      relPath: option?.relPath,
      valid: Boolean(option)
    };
  });
}

function promptLintMessages(shot: StoryboardShot, references: ReferenceOption[]): string[] {
  const messages: string[] = [];
  if (shot.prompt.length > 900) {
    messages.push("Prompt is long. Shorter single-action prompts usually follow better.");
  }
  const actionCount = countActionWords(shot.prompt);
  if (actionCount >= 5) {
    messages.push(`This shot appears to contain ${actionCount} action beats. Split it into shorter shots.`);
  }
  if (shot.generationMode === "omni-reference" && /exact opening frame|start exactly|seamlessly from/i.test(shot.prompt)) {
    messages.push("Omni Reference cannot guarantee an exact first frame. Use Strict Continuation for scene joins.");
  }
  if (shot.generationMode !== "omni-reference" && references.length > 0 && /@Image\d+/i.test(shot.prompt)) {
    messages.push("Strict modes use a provided start frame, not @Image tokens. Mentions will be rewritten at generation time.");
  }
  if (shot.generationMode === "keyframe-bridge") {
    messages.push("Bridge mode currently locks the starting frame; ending keyframes are planned as a follow-up.");
  }
  return messages;
}

function countActionWords(prompt: string): number {
  const matches = prompt.match(
    /\b(accelerates?|sprints?|runs?|vaults?|slides?|leaps?|jumps?|lands?|turns?|looks?|dodges?|checks?|adjusts?|crosses?|rises?|drops?|pushes?|pulls?|throws?|catches?)\b/gi
  );
  return matches?.length ?? 0;
}

function shotNeedsUploadHost(shot: StoryboardShot): boolean {
  return shot.order > 0 && (shot.generationMode === "strict-continuation" || shot.generationMode === "keyframe-bridge");
}

function continuityStatusForShot(
  shot: StoryboardShot | null,
  asset: StudioAsset | null
): { label: string; detail: string; tone: "idle" | "ready" } {
  if (!shot || shot.order === 0) {
    return {
      label: "No continuity",
      detail: "First storyboard shot starts from the selected image references only.",
      tone: "idle"
    };
  }
  const frame = stringMetadata(asset, "continuityFrameReference");
  const startImage = stringMetadata(asset, "startImageReference");
  const inputMode = stringMetadata(asset, "inputMode");
  const video = stringMetadata(asset, "continuityVideoReference");
  const token = stringMetadata(asset, "continuityFrameToken");
  const audioStripped = asset?.metadata?.["continuityVideoAudioStripped"] === true;
  if (startImage || inputMode === "image-to-video" || inputMode === "image-to-video-start-end") {
    return {
      label: inputMode === "image-to-video-start-end" ? "Start frame locked" : "Starting frame locked",
      detail: "The previous clip's last frame was sent as the Seedance image-to-video starting frame.",
      tone: "ready"
    };
  }
  if (frame && video) {
    return {
      label: "Previous video + last frame",
      detail: `${token || "Last frame"} was added as an opening-frame reference, with ${audioStripped ? "silent " : ""}@Video1 for visual motion continuity.`,
      tone: "ready"
    };
  }
  if (video) {
    return {
      label: "Previous video",
      detail: `The previous clip was passed as ${audioStripped ? "silent " : ""}@Video1 for visual motion continuity.`,
      tone: "ready"
    };
  }
  if (shot.status === "done") {
    return {
      label: "No continuity",
      detail: "This clip was generated without an immediate completed previous shot.",
      tone: "idle"
    };
  }
  return {
    label: shot.generationMode === "omni-reference" ? "Reference continuity pending" : "Strict continuation pending",
    detail:
      shot.generationMode === "omni-reference"
        ? "When generated after the previous shot completes, VibeStudio will add its video and extracted last frame as references."
        : "When generated after the previous shot completes, VibeStudio will use its last frame as the Seedance starting frame.",
    tone: "idle"
  };
}

function stringMetadata(asset: StudioAsset | null, key: string): string | undefined {
  const value = asset?.metadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function Preview({
  mode,
  asset,
  storyboardPreview,
  onStoryboardIndexChange
}: {
  mode: PreviewMode;
  asset: StudioAsset | null;
  storyboardPreview: {
    clips: StoryboardPreviewClip[];
    index: number;
    missingShots: StoryboardShot[];
  };
  onStoryboardIndexChange: (index: number) => void;
}) {
  if (mode === "storyboard") {
    if (storyboardPreview.clips.length > 0) {
      return (
        <StoryboardPlaylistPreview
          clips={storyboardPreview.clips}
          index={storyboardPreview.index}
          missingShots={storyboardPreview.missingShots}
          onIndexChange={onStoryboardIndexChange}
        />
      );
    }
    return (
      <div className="flex aspect-video w-full max-w-5xl items-center justify-center rounded border border-dashed border-border bg-white text-sm text-muted">
        Generate at least one storyboard shot before preview.
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex aspect-video w-full max-w-5xl items-center justify-center rounded border border-dashed border-border bg-white text-sm text-muted">
        Preview
      </div>
    );
  }
  return (
    <div className="flex w-full max-w-5xl items-center justify-center overflow-hidden rounded border border-border bg-black">
      {asset.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.url} alt="" className="max-h-[calc(100vh-360px)] w-full object-contain" />
      ) : (
        <video src={asset.url} controls className="max-h-[calc(100vh-360px)] w-full" />
      )}
    </div>
  );
}

function StoryboardPlaylistPreview({
  clips,
  index,
  missingShots,
  onIndexChange
}: {
  clips: StoryboardPreviewClip[];
  index: number;
  missingShots: StoryboardShot[];
  onIndexChange: (index: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const safeIndex = Math.max(0, Math.min(index, clips.length - 1));
  const clip = clips[safeIndex];
  const totalDuration = clips.reduce((sum, item) => sum + item.duration, 0);
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === clips.length - 1;

  useEffect(() => {
    setClipError(null);
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    if (playing) {
      void video.play().catch(() => setPlaying(false));
    }
  }, [clip.relPath]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }, [playing]);

  function goTo(nextIndex: number) {
    setClipError(null);
    onIndexChange(nextIndex);
  }

  function restart() {
    if (safeIndex === 0) {
      if (videoRef.current) videoRef.current.currentTime = 0;
    } else {
      goTo(0);
    }
    setPlaying(true);
  }

  function handleEnded() {
    if (isLast) {
      setPlaying(false);
      return;
    }
    goTo(safeIndex + 1);
  }

  return (
    <div className="grid w-full max-w-5xl overflow-hidden rounded border border-border bg-white shadow-tool">
      <div className="relative flex min-h-0 items-center justify-center bg-black">
        <video
          key={clip.relPath}
          ref={videoRef}
          src={clip.url}
          controls
          className="max-h-[calc(100vh-420px)] w-full bg-black"
          onEnded={handleEnded}
          onError={() => {
            setClipError("This clip could not be loaded.");
            setPlaying(false);
          }}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
        <div className="absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
          Storyboard preview
        </div>
      </div>
      <div className="grid gap-2 border-t border-border p-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {clip.order + 1}. {clip.title}
            </div>
            <div className="text-xs text-muted">
              {safeIndex + 1} / {clips.length} clips / {clip.duration}s clip / {totalDuration}s generated
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <PreviewToolButton
              onClick={() => goTo(safeIndex - 1)}
              disabled={isFirst}
              icon={<ChevronLeft size={15} />}
              label="Previous clip"
            />
            <PreviewToolButton
              onClick={() => setPlaying((value) => !value)}
              icon={playing ? <Pause size={15} /> : <Play size={15} />}
              label={playing ? "Pause" : "Play"}
            />
            <PreviewToolButton
              onClick={() => goTo(safeIndex + 1)}
              disabled={isLast}
              icon={<ChevronRight size={15} />}
              label="Next clip"
            />
            <PreviewToolButton onClick={restart} icon={<RotateCcw size={15} />} label="Restart storyboard preview" />
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded bg-panel2">
          <div
            className="h-full rounded bg-accent"
            style={{ width: `${((safeIndex + 1) / clips.length) * 100}%` }}
          />
        </div>
        <div className="grid min-h-4 gap-1 text-xs text-muted">
          {clipError ? <div className="truncate text-warn">{clipError}</div> : null}
          {missingShots.length > 0 ? (
            <div className="truncate text-warn">Missing: {formatMissingShots(missingShots)}</div>
          ) : (
            <div>All generated clips are included in this preview.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewToolButton({
  onClick,
  disabled,
  icon,
  label
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-white text-ink hover:bg-panel disabled:cursor-not-allowed"
    >
      {icon}
    </button>
  );
}

function ClipLibrary({
  storyboard,
  activeClips,
  archivedClips,
  selectedOutputPaths,
  onClose,
  onPreview,
  onSelectTake,
  onArchive,
  onRestore
}: {
  storyboard: StoryboardProject | null;
  activeClips: StudioAsset[];
  archivedClips: StudioAsset[];
  selectedOutputPaths: Set<string>;
  onClose: () => void;
  onPreview: (asset: StudioAsset) => void;
  onSelectTake: (shotId: string, asset: StudioAsset) => void;
  onArchive: (asset: StudioAsset) => void;
  onRestore: (asset: StudioAsset) => void;
}) {
  const [filter, setFilter] = useState<ClipLibraryFilter>("current");
  const currentTakeMap = buildShotTakeMap(storyboard, activeClips);
  const previousClips = activeClips.filter((asset) => !isCurrentStoryboardTake(asset, storyboard));
  const shots = sortedStoryboardShots(storyboard);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-6">
      <div className="grid max-h-[82vh] w-full max-w-5xl grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded border border-border bg-white shadow-xl">
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FolderOpen size={16} />
            Clip Library
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-panel" aria-label="Close library">
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 border-b border-border p-3">
          {(["current", "previous", "archived"] as ClipLibraryFilter[]).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`h-8 rounded border px-3 text-xs font-medium ${
                filter === item ? "border-accent bg-[#e8f5f5] text-ink" : "border-border bg-white text-muted hover:bg-panel"
              }`}
            >
              {item === "current" ? "Current storyboard" : item === "previous" ? "Previous / loose" : "Archived"}
            </button>
          ))}
        </div>
        <div className="scrollbar overflow-auto p-4">
          {filter === "current" ? (
            <div className="grid gap-4">
              {shots.length === 0 ? <EmptyLine label="No storyboard shots" /> : null}
              {shots.map((shot) => (
                <ClipLibraryShotGroup
                  key={shot.id}
                  shot={shot}
                  clips={currentTakeMap.get(shot.id) ?? []}
                  selectedOutputPaths={selectedOutputPaths}
                  onPreview={onPreview}
                  onSelect={(asset) => onSelectTake(shot.id, asset)}
                  onArchive={onArchive}
                />
              ))}
            </div>
          ) : filter === "previous" ? (
            <ClipLibraryGrid
              clips={previousClips}
              emptyLabel="No previous or loose clips"
              selectedOutputPaths={selectedOutputPaths}
              onPreview={onPreview}
              onArchive={onArchive}
            />
          ) : (
            <ClipLibraryGrid
              clips={archivedClips}
              emptyLabel="No archived clips"
              selectedOutputPaths={selectedOutputPaths}
              onPreview={onPreview}
              onRestore={onRestore}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ClipLibraryShotGroup({
  shot,
  clips,
  selectedOutputPaths,
  onPreview,
  onSelect,
  onArchive
}: {
  shot: StoryboardShot;
  clips: StudioAsset[];
  selectedOutputPaths: Set<string>;
  onPreview: (asset: StudioAsset) => void;
  onSelect: (asset: StudioAsset) => void;
  onArchive: (asset: StudioAsset) => void;
}) {
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between text-xs">
        <div className="font-semibold text-ink">
          {shot.order + 1}. {shot.title}
        </div>
        <div className="text-muted">{clips.length} takes</div>
      </div>
      <ClipLibraryGrid
        clips={clips}
        emptyLabel="No takes for this shot"
        selectedOutputPaths={selectedOutputPaths}
        onPreview={onPreview}
        onSelect={onSelect}
        onArchive={onArchive}
      />
    </section>
  );
}

function ClipLibraryGrid({
  clips,
  emptyLabel,
  selectedOutputPaths,
  onPreview,
  onSelect,
  onArchive,
  onRestore
}: {
  clips: StudioAsset[];
  emptyLabel: string;
  selectedOutputPaths: Set<string>;
  onPreview: (asset: StudioAsset) => void;
  onSelect?: (asset: StudioAsset) => void;
  onArchive?: (asset: StudioAsset) => void;
  onRestore?: (asset: StudioAsset) => void;
}) {
  if (clips.length === 0) return <EmptyLine label={emptyLabel} />;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {clips.map((asset) => {
        const selected = selectedOutputPaths.has(asset.relPath);
        return (
          <div key={asset.id} className={`overflow-hidden rounded border bg-white ${selected ? "border-accent" : "border-border"}`}>
            <button onClick={() => onPreview(asset)} className="block h-28 w-full bg-panel">
              <Thumb asset={asset} />
            </button>
            <div className="grid gap-2 p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => onPreview(asset)} className="min-w-0 truncate text-left font-semibold">
                  {(asset.metadata?.["label"] as string) || asset.name}
                </button>
                {selected ? <span className="rounded bg-[#e8f5f5] px-2 py-0.5 text-[10px] text-accent">Selected</span> : null}
              </div>
              <div className="truncate text-[11px] text-muted">{clipAssetSubtitle(asset)}</div>
              <div className="flex gap-2">
                {onSelect ? (
                  <button onClick={() => onSelect(asset)} className="h-7 rounded bg-ink px-2 text-[11px] font-medium text-white">
                    Select take
                  </button>
                ) : null}
                {onArchive ? (
                  <button
                    onClick={() => onArchive(asset)}
                    disabled={selected}
                    className="h-7 rounded border border-border px-2 text-[11px] font-medium hover:bg-panel disabled:cursor-not-allowed disabled:text-muted"
                  >
                    Archive
                  </button>
                ) : null}
                {onRestore ? (
                  <button onClick={() => onRestore(asset)} className="h-7 rounded border border-border px-2 text-[11px] font-medium hover:bg-panel">
                    Restore
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Thumb({ asset }: { asset: StudioAsset }) {
  if (asset.kind === "video") {
    return <video src={asset.url} muted className="h-full w-full object-cover" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset.url} alt="" className="h-full w-full object-cover" />;
}

function IconButton({
  onClick,
  disabled,
  icon,
  label
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center justify-center gap-2 rounded bg-ink px-3 text-sm font-medium text-white hover:bg-[#263542] disabled:cursor-not-allowed disabled:bg-muted"
    >
      {icon}
      {label}
    </button>
  );
}

function MiniButton({
  onClick,
  disabled,
  icon,
  label,
  title
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex h-8 items-center justify-center gap-1 rounded border border-border bg-white px-2 text-xs font-medium hover:bg-panel disabled:cursor-not-allowed"
    >
      {icon}
      {label}
    </button>
  );
}

function Select({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded border border-border bg-white px-2 text-sm outline-none focus:border-accent"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function NumberInput({
  value,
  onChange,
  min = 4,
  max = 15
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(Number.parseInt(event.target.value, 10) || 5)}
      min={min}
      max={max}
      type="number"
      className="h-9 rounded border border-border px-2 text-sm outline-none focus:border-accent"
    />
  );
}

function DecimalInput({
  value,
  onChange,
  min,
  max,
  step
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <input
      value={value}
      onChange={(event) => {
        const next = Number.parseFloat(event.target.value);
        if (!Number.isFinite(next)) return;
        onChange(Math.max(min, Math.min(max, Math.round(next * 100) / 100)));
      }}
      min={min}
      max={max}
      step={step}
      type="number"
      className="h-9 rounded border border-border px-2 text-sm outline-none focus:border-accent"
    />
  );
}

function EmptyLine({ label }: { label: string }) {
  return <div className="rounded border border-dashed border-border p-3 text-center text-xs text-muted">{label}</div>;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = (await response.json().catch(() => null)) as (T & { success?: boolean; error?: string }) | null;
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error ?? `Request failed: ${response.status}`);
  }
  return data as T;
}

function ensureStoryboard(storyboard: StoryboardProject | null, now: string): StoryboardProject {
  return (
    storyboard ?? {
      targetDuration: 30,
      shots: [],
      createdAt: now,
      updatedAt: now
    }
  );
}

function isRunningStatus(status: StoryboardShot["status"]): boolean {
  return ["queued", "uploading", "submitted", "generating", "downloading"].includes(status);
}

function isExportAsset(asset: StudioAsset): boolean {
  return asset.metadata?.["source"] === "storyboard-export" || asset.relPath.includes("/exports/");
}

function isArchivedAsset(asset: StudioAsset): boolean {
  return typeof asset.metadata?.["archivedAt"] === "string";
}

function isStoryboardShotAsset(asset: StudioAsset): boolean {
  return asset.kind === "video" && asset.metadata?.["source"] === "storyboard-shot";
}

function shotIdForAsset(asset: StudioAsset): string | null {
  const shotId = asset.metadata?.["shotId"];
  return typeof shotId === "string" ? shotId : null;
}

function buildShotTakeMap(
  storyboard: StoryboardProject | null,
  assets: StudioAsset[]
): Map<string, StudioAsset[]> {
  const shots = sortedStoryboardShots(storyboard);
  const shotIds = new Set(shots.map((shot) => shot.id));
  const selectedPathToShotId = new Map(
    shots.flatMap((shot) => (shot.outputRelPath ? [[shot.outputRelPath, shot.id] as const] : []))
  );
  const map = new Map<string, StudioAsset[]>();
  for (const asset of assets) {
    if (!isStoryboardShotAsset(asset)) continue;
    const metadataShotId = shotIdForAsset(asset);
    const shotId = metadataShotId && shotIds.has(metadataShotId) ? metadataShotId : selectedPathToShotId.get(asset.relPath);
    if (!shotId) continue;
    const items = map.get(shotId) ?? [];
    items.push(asset);
    map.set(shotId, items);
  }
  for (const [shotId, items] of map) {
    map.set(
      shotId,
      [...items].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    );
  }
  return map;
}

function isCurrentStoryboardTake(asset: StudioAsset, storyboard: StoryboardProject | null): boolean {
  if (!isStoryboardShotAsset(asset)) return false;
  const shots = storyboard?.shots ?? [];
  const metadataShotId = shotIdForAsset(asset);
  return shots.some((shot) => shot.id === metadataShotId || shot.outputRelPath === asset.relPath);
}

function clipAssetSubtitle(asset: StudioAsset): string {
  const seedanceModel = asset.metadata?.["seedanceModel"];
  const durationValue = asset.metadata?.["duration"];
  const inputModeValue = asset.metadata?.["inputMode"];
  const model = typeof seedanceModel === "string" ? seedanceModel : "video";
  const duration = typeof durationValue === "number" ? `${durationValue}s` : null;
  const inputMode = typeof inputModeValue === "string" ? inputModeValue : null;
  return [model, duration, inputMode].filter(Boolean).join(" / ");
}

function buildStoryboardPreviewClips(
  storyboard: StoryboardProject | null,
  assets: StudioAsset[]
): StoryboardPreviewClip[] {
  const videoAssets = new Map(
    assets.filter((asset) => asset.kind === "video").map((asset) => [asset.relPath, asset])
  );
  return sortedStoryboardShots(storyboard).flatMap((shot) => {
    if (!shot.outputRelPath) return [];
    const asset = videoAssets.get(shot.outputRelPath);
    if (!asset) return [];
    return [
      {
        shotId: shot.id,
        order: shot.order,
        title: shot.title,
        duration: shot.duration,
        relPath: asset.relPath,
        url: asset.url
      }
    ];
  });
}

function buildStoryboardPreviewMissingShots(
  storyboard: StoryboardProject | null,
  clips: StoryboardPreviewClip[]
): StoryboardShot[] {
  const clipShotIds = new Set(clips.map((clip) => clip.shotId));
  return sortedStoryboardShots(storyboard).filter((shot) => !clipShotIds.has(shot.id));
}

function sortedStoryboardShots(storyboard: StoryboardProject | null): StoryboardShot[] {
  return [...(storyboard?.shots ?? [])].sort((a, b) => a.order - b.order);
}

function formatMissingShots(shots: StoryboardShot[]): string {
  const visible = shots.slice(0, 3).map((shot) => `${shot.order + 1}. ${shot.title}`);
  const hiddenCount = shots.length - visible.length;
  return `${visible.join(", ")}${hiddenCount > 0 ? ` +${hiddenCount} more` : ""}`;
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
