import { mkdir } from "node:fs/promises";
import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID, projectRelativePath, writeAssetMetadata } from "@/lib/projects";
import { promptForCli, slugify } from "@/lib/prompts";
import { runVibe } from "@/lib/vibeframe";
import type { GenerateVideoRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateVideoRequest;
    if (!body.prompt?.trim()) {
      return NextResponse.json({ success: false, error: "Video prompt is required" }, { status: 400 });
    }
    if (!Array.isArray(body.references) || body.references.length === 0) {
      return NextResponse.json({ success: false, error: "At least one reference image is required" }, { status: 400 });
    }
    const references = validateReferences(body.references);
    const prompt = promptForCli(body.prompt);

    await mkdir(projectRelativePath(DEFAULT_PROJECT_ID, "assets/videos"), { recursive: true });
    const name = `${Date.now()}-${slugify(prompt).slice(0, 32)}`;
    const relPath = `assets/videos/${name}.mp4`;
    const args = [
      "generate",
      "video",
      prompt,
      "-p",
      "seedance",
      "--seedance-model",
      body.seedanceModel ?? "fast",
      "--duration",
      String(clampDuration(body.duration)),
      "--ratio",
      body.ratio ?? "16:9",
      "--resolution",
      body.resolution ?? "720p",
      "--ref-images",
      ...references,
      "-o",
      relPath
    ];
    if (body.generateAudio === false) {
      args.splice(args.length - 2, 0, "--no-generate-audio");
    }

    await runVibe(args, { timeoutMs: 30 * 60 * 1000 });
    await writeAssetMetadata(DEFAULT_PROJECT_ID, relPath, {
      createdAt: new Date().toISOString(),
      provider: "seedance",
      model: body.seedanceModel === "quality" ? "seedance-2.0" : "seedance-2.0-fast",
      prompt,
      references,
      duration: clampDuration(body.duration),
      ratio: body.ratio ?? "16:9",
      resolution: body.resolution ?? "720p",
      seedanceModel: body.seedanceModel ?? "fast",
      generateAudio: body.generateAudio !== false,
      source: "reference-to-video"
    });

    return NextResponse.json({
      success: true,
      video: {
        relPath,
        url: `/api/files/${encodeURIComponent(DEFAULT_PROJECT_ID)}/${relPath.split("/").map(encodeURIComponent).join("/")}`
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Video generation failed"
      },
      { status: 500 }
    );
  }
}

function clampDuration(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return 5;
  return Math.max(4, Math.min(15, Math.round(value)));
}

function validateReferences(references: string[]): string[] {
  return references.map((reference) => {
    if (reference.startsWith("http://") || reference.startsWith("https://") || reference.startsWith("data:")) {
      return reference;
    }
    if (reference.startsWith("-")) throw new Error("Reference path cannot start with '-'.");
    projectRelativePath(DEFAULT_PROJECT_ID, reference);
    return reference;
  });
}
