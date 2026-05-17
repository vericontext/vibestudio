import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID } from "@/lib/projects";
import { draftStoryboard } from "@/lib/storyboard-draft";
import type { StoryboardDraftRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StoryboardDraftRequest;
    if (!body.brief?.trim()) {
      return NextResponse.json({ success: false, error: "Storyboard brief is required" }, { status: 400 });
    }
    return NextResponse.json(await draftStoryboard(DEFAULT_PROJECT_ID, body));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Storyboard draft failed"
      },
      { status: 500 }
    );
  }
}
