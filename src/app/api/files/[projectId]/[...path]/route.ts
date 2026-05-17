import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { projectRelativePath } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: { projectId: string; path: string[] } }
) {
  try {
    const relPath = context.params.path.map(decodeURIComponent).join("/");
    const abs = projectRelativePath(context.params.projectId, relPath);
    const file = await readFile(abs);
    const info = await stat(abs);
    return new Response(file, {
      headers: {
        "Content-Type": contentType(path.extname(abs)),
        "Content-Length": String(info.size),
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

function contentType(ext: string): string {
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".json": "application/json"
  };
  return map[ext.toLowerCase()] ?? "application/octet-stream";
}
