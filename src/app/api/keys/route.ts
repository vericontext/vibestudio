import { NextResponse } from "next/server";
import { DEFAULT_PROJECT_ID, saveProjectKeys } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    openaiApiKey?: string;
    falApiKey?: string;
    imgbbApiKey?: string;
  };
  const keys = await saveProjectKeys(DEFAULT_PROJECT_ID, {
    openaiApiKey: body.openaiApiKey,
    falApiKey: body.falApiKey,
    imgbbApiKey: body.imgbbApiKey
  });
  return NextResponse.json({ success: true, keys });
}
