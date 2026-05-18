import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID, patchAssetMetadata } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { relPath?: string; archived?: boolean };
    if (!body.relPath) {
      return NextResponse.json({ success: false, error: "relPath is required" }, { status: 400 });
    }
    const archived = body.archived !== false;
    const metadata = await patchAssetMetadata(
      DEFAULT_PROJECT_ID,
      body.relPath,
      archived
        ? { archivedAt: new Date().toISOString(), archivedReason: "user" }
        : { archivedAt: undefined, archivedReason: undefined }
    );
    return NextResponse.json({ success: true, metadata });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Asset archive failed"
      },
      { status: 500 }
    );
  }
}
