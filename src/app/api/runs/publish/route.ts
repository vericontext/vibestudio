import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID } from "@/lib/projects";
import { publishCurrentRun } from "@/lib/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return NextResponse.json({ success: true, run: await publishCurrentRun(DEFAULT_PROJECT_ID) });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Run publish failed"
      },
      { status: 500 }
    );
  }
}
