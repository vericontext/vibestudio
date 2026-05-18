import { NextResponse } from "next/server";
import { addRunToGallery } from "@/lib/gallery";
import { DEFAULT_PROJECT_ID } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { runId?: string };
    if (!body.runId) {
      return NextResponse.json({ success: false, error: "runId is required" }, { status: 400 });
    }
    return NextResponse.json({ success: true, gallery: await addRunToGallery(DEFAULT_PROJECT_ID, body.runId) });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gallery export failed"
      },
      { status: 500 }
    );
  }
}
