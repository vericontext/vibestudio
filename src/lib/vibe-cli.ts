import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { VibeCliStatus } from "./types";

const execFileAsync = promisify(execFile);

export type VibeCommand = {
  command: string;
  args: string[];
  source: VibeCliStatus["source"];
  commandLabel: string;
};

export function resolveVibeCommand(): VibeCommand {
  const command = resolveVibeCommandOptional();
  if (!command) {
    throw new Error(
      "VibeFrame CLI is not installed. Run `pnpm install` in VibeStudio, or set VIBEFRAME_CLI_COMMAND to an explicit vibe command."
    );
  }
  return command;
}

export function resolveVibeCommandOptional(): VibeCommand | null {
  const explicit = process.env.VIBEFRAME_CLI_COMMAND?.trim();
  if (explicit) {
    const [command, ...args] = splitCommand(explicit);
    if (command) {
      return {
        command,
        args,
        source: "env",
        commandLabel: [command, ...args].map(displayToken).join(" ")
      };
    }
  }

  const localBin = path.resolve(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "vibe.cmd" : "vibe"
  );
  if (existsSync(localBin)) {
    return {
      command: localBin,
      args: [],
      source: "local-package",
      commandLabel: "node_modules/.bin/vibe"
    };
  }

  return null;
}

export async function getVibeCliStatus(): Promise<VibeCliStatus> {
  const command = resolveVibeCommandOptional();
  if (!command) {
    return {
      source: "missing",
      version: null,
      commandLabel: "missing"
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync(command.command, [...command.args, "--version"], {
      cwd: process.cwd(),
      env: { ...process.env, VIBE_HUMAN_OUTPUT: undefined },
      timeout: 10_000,
      maxBuffer: 1024 * 1024
    });
    return {
      source: command.source,
      version: (stdout || stderr).trim() || null,
      commandLabel: command.commandLabel
    };
  } catch (error) {
    return {
      source: command.source,
      version: null,
      commandLabel: command.commandLabel,
      error: error instanceof Error ? error.message : "VibeFrame CLI version check failed."
    };
  }
}

function splitCommand(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;

  for (const char of input) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if ((char === "'" || char === '"') && quote === char) {
      quote = null;
      continue;
    }
    if ((char === "'" || char === '"') && !quote) {
      quote = char;
      continue;
    }
    if (/\s/.test(char) && !quote) {
      if (current) parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  if (current) parts.push(current);
  return parts;
}

function displayToken(token: string): string {
  return token.includes(path.sep) ? path.basename(token) : token;
}
