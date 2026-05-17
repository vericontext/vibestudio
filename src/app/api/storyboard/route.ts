import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID } from "@/lib/projects";
import { readStoryboard, writeStoryboard } from "@/lib/storyboard";
import type { StoryboardProject } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readStoryboard(DEFAULT_PROJECT_ID));
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<StoryboardProject>;
    return NextResponse.json(await writeStoryboard(DEFAULT_PROJECT_ID, body));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Storyboard save failed"
      },
      { status: 500 }
    );
  }
}
