import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID } from "@/lib/projects";
import { queueShotGeneration } from "@/lib/storyboard-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: { shotId: string } }
) {
  try {
    return NextResponse.json(await queueShotGeneration(DEFAULT_PROJECT_ID, context.params.shotId));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Shot generation failed"
      },
      { status: 500 }
    );
  }
}
