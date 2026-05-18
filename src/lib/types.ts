export type ProviderKeyStatus = {
  configured: boolean;
  masked: string | null;
};

export type ProjectStatus = {
  projectId: string;
  projectDir: string;
  keys: {
    openai: ProviderKeyStatus;
    fal: ProviderKeyStatus;
    imgbb: ProviderKeyStatus;
  };
  vibe: VibeCliStatus;
  assets: StudioAsset[];
};

export type VibeCliStatus = {
  source: "env" | "local-package" | "missing";
  version: string | null;
  commandLabel: string;
  error?: string;
};

export type StudioAsset = {
  id: string;
  kind: "image" | "video";
  name: string;
  relPath: string;
  url: string;
  createdAt: string | null;
  metadata?: Record<string, unknown>;
};

export type VideoRatio = "16:9" | "9:16" | "1:1";

export type VideoResolution = "480p" | "720p" | "1080p";

export type SeedanceModel = "quality" | "fast";

export type GenerationMode = "omni-reference" | "strict-continuation" | "keyframe-bridge";

export type ExportTransition = "cut" | "crossfade" | "dip-to-black";

export type GenerateImagesRequest = {
  characterName?: string;
  character: string;
  role?: string;
  outfit?: string;
  gear?: string;
  movementStyle?: string;
  palette?: string;
  style?: string;
  quality?: "low" | "medium" | "high";
  size?: "1024x1024" | "1536x1024" | "1024x1536";
};

export type GenerateVideoRequest = {
  prompt: string;
  references: string[];
  duration?: number;
  ratio?: VideoRatio;
  resolution?: VideoResolution;
  seedanceModel?: SeedanceModel;
  generateAudio?: boolean;
};

export type ShotStatus =
  | "draft"
  | "queued"
  | "uploading"
  | "submitted"
  | "generating"
  | "downloading"
  | "done"
  | "failed"
  | "cancelled";

export type StoryboardShot = {
  id: string;
  order: number;
  title: string;
  duration: number;
  prompt: string;
  references: string[];
  ratio: VideoRatio;
  resolution: VideoResolution;
  seedanceModel: SeedanceModel;
  generationMode: GenerationMode;
  trimHeadSec: number;
  trimTailSec: number;
  transitionAfter: ExportTransition;
  transitionDurationSec: number;
  generateAudio: boolean;
  status: ShotStatus;
  outputRelPath?: string;
  error?: string;
  providerTaskId?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoryboardProject = {
  targetDuration: number;
  shots: StoryboardShot[];
  exportRelPath?: string;
  createdAt: string;
  updatedAt: string;
};

export type ShotStrategy = "5s-dense" | "10s-cinematic" | "mixed";
export type StoryboardPacing = "auto" | "slow" | "balanced" | "fast";

export type StoryboardDraftRequest = {
  brief: string;
  targetDuration?: number;
  sceneCount?: number;
  pacing?: StoryboardPacing;
  /** Legacy pacing hint kept for compatibility with older clients. */
  shotStrategy?: ShotStrategy;
  aspectRatio?: VideoRatio;
  visualStyle?: string;
  characterSheetRelPath?: string;
};

export type StoryboardDraftStoryBible = {
  location: string;
  lighting: string;
  screenDirection: string;
  characterState: string;
  propState: string;
  endingIntent: string;
};

export type StoryboardDraftResult = {
  success: true;
  provider: "openai" | "fallback";
  model?: string;
  error?: string;
  targetDuration: number;
  storyBible?: StoryboardDraftStoryBible;
  shots: StoryboardShot[];
  continuityNotes: string[];
  qualityChecks?: string[];
  referenceRelPaths: string[];
};

export type JobResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; detail?: unknown };
