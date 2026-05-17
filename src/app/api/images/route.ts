import { mkdir } from "node:fs/promises";
import { NextResponse } from "next/server";
import { buildCharacterSheetPrompt, slugify } from "@/lib/prompts";
import { DEFAULT_PROJECT_ID, projectFileUrl, projectRelativePath, writeAssetMetadata } from "@/lib/projects";
import { runVibe } from "@/lib/vibeframe";
import type { GenerateImagesRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateImagesRequest;
    if (!body.character?.trim()) {
      return NextResponse.json({ success: false, error: "Character prompt is required" }, { status: 400 });
    }

    const slug = slugify(body.characterName || body.character);
    const prompt = buildCharacterSheetPrompt(body);
    const baseRelDir = `assets/characters/${slug}`;
    await mkdir(projectRelativePath(DEFAULT_PROJECT_ID, baseRelDir), { recursive: true });

    const relPath = `${baseRelDir}/character-sheet-${Date.now()}.png`;
    await runVibe(
      [
        "generate",
        "image",
        prompt,
        "-p",
        "openai",
        "-m",
        "2",
        "--quality",
        body.quality ?? "medium",
        "--size",
        body.size ?? "1536x1024",
        "-o",
        relPath
      ],
      { timeoutMs: 6 * 60 * 1000 }
    );
    await writeAssetMetadata(DEFAULT_PROJECT_ID, relPath, {
      createdAt: new Date().toISOString(),
      provider: "openai",
      model: "gpt-image-2",
      label: body.characterName?.trim() ? `${body.characterName.trim()} Sheet` : "Character Sheet",
      prompt,
      source: "character-sheet",
      sheet: true,
      sheetKind: "omni-reference",
      characterName: body.characterName?.trim() || undefined,
      character: body.character,
      role: body.role,
      outfit: body.outfit,
      gear: body.gear,
      movementStyle: body.movementStyle,
      palette: body.palette,
      visualStyle: body.style
    });

    return NextResponse.json({
      success: true,
      images: [
        {
          variant: "character-sheet",
          label: body.characterName?.trim() ? `${body.characterName.trim()} Sheet` : "Character Sheet",
          relPath,
          url: projectFileUrl(DEFAULT_PROJECT_ID, relPath)
        }
      ]
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Image generation failed"
      },
      { status: 500 }
    );
  }
}
