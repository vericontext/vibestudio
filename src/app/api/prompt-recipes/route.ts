import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID } from "@/lib/projects";
import { savePromptRecipe } from "@/lib/prompt-recipes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      prompt?: string;
      sourceUrl?: string;
      sourceNote?: string;
      tags?: string[];
      recommendedMode?: "omni-reference" | "strict-continuation";
    };
    return NextResponse.json({
      success: true,
      recipe: await savePromptRecipe(DEFAULT_PROJECT_ID, body)
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Prompt recipe save failed"
      },
      { status: 400 }
    );
  }
}
