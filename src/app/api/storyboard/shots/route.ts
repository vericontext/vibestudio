import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID } from "@/lib/projects";
import { addShot } from "@/lib/storyboard";
import type { ShotPatch } from "@/lib/storyboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ShotPatch;
    return NextResponse.json(await addShot(DEFAULT_PROJECT_ID, body));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Shot creation failed"
      },
      { status: 500 }
    );
  }
}
