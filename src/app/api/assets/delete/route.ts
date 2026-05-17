import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID, deleteAsset } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { relPath?: string };
    if (!body.relPath) {
      return NextResponse.json({ success: false, error: "relPath is required" }, { status: 400 });
    }
    await deleteAsset(DEFAULT_PROJECT_ID, body.relPath);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Asset deletion failed"
      },
      { status: 500 }
    );
  }
}
