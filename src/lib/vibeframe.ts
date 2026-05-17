import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DEFAULT_PROJECT_ID, ensureProject, projectDir } from "./projects";
import { resolveVibeCommand } from "./vibe-cli";

const execFileAsync = promisify(execFile);

export type VibeRunResult = {
  raw: string;
  json: unknown;
};

export async function runVibe(
  args: string[],
  opts: { projectId?: string; timeoutMs?: number } = {}
): Promise<VibeRunResult> {
  const projectId = opts.projectId ?? DEFAULT_PROJECT_ID;
  await ensureProject(projectId);
  const cli = resolveVibeCommand();
  const finalArgs = cli.args.concat(args, "--json");
  const { stdout, stderr } = await execFileAsync(cli.command, finalArgs, {
    cwd: projectDir(projectId),
    env: { ...process.env, VIBE_HUMAN_OUTPUT: undefined },
    timeout: opts.timeoutMs ?? 10 * 60 * 1000,
    maxBuffer: 1024 * 1024 * 64
  });
  const output = `${stdout}\n${stderr}`.trim();
  return { raw: output, json: parseJsonOutput(stdout || stderr) };
}

function parseJsonOutput(output: string): unknown {
  const trimmed = output.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    throw new Error(`VibeFrame did not return JSON: ${trimmed.slice(0, 500)}`);
  }
}
