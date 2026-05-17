import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID, projectStatus } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await projectStatus(DEFAULT_PROJECT_ID));
}
