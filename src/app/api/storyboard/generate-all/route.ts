import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID } from "@/lib/projects";
import { queueStoryboardGeneration } from "@/lib/storyboard-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return NextResponse.json(await queueStoryboardGeneration(DEFAULT_PROJECT_ID));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Storyboard generation failed"
      },
      { status: 500 }
    );
  }
}
