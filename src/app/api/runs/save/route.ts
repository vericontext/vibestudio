import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID } from "@/lib/projects";
import { saveCurrentRun } from "@/lib/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return NextResponse.json({ success: true, run: await saveCurrentRun(DEFAULT_PROJECT_ID) });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Run save failed"
      },
      { status: 400 }
    );
  }
}
