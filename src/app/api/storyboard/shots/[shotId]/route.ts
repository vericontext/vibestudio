import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID } from "@/lib/projects";
import { deleteShot, patchShot } from "@/lib/storyboard";
import type { ShotPatch } from "@/lib/storyboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: { shotId: string } }
) {
  try {
    const body = (await request.json()) as ShotPatch;
    return NextResponse.json(await patchShot(DEFAULT_PROJECT_ID, context.params.shotId, body));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Shot update failed"
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { shotId: string } }
) {
  try {
    return NextResponse.json(await deleteShot(DEFAULT_PROJECT_ID, context.params.shotId));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Shot deletion failed"
      },
      { status: 500 }
    );
  }
}
