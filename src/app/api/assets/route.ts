import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID, listAssets } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ assets: await listAssets(DEFAULT_PROJECT_ID) });
}
