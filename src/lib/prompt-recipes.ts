import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { DEFAULT_PROJECT_ID, projectRelativePath } from "./projects";

export type SavedPromptRecipe = {
  id: string;
  title: string;
  prompt: string;
  sourceUrl?: string;
  sourceNote?: string;
  tags: string[];
  recommendedMode: "omni-reference" | "strict-continuation";
  createdAt: string;
};

export async function savePromptRecipe(
  projectId = DEFAULT_PROJECT_ID,
  input: {
    title?: string;
    prompt?: string;
    sourceUrl?: string;
    sourceNote?: string;
    tags?: string[];
    recommendedMode?: "omni-reference" | "strict-continuation";
  }
): Promise<SavedPromptRecipe> {
  const prompt = input.prompt?.trim();
  if (!prompt) throw new Error("Prompt is required");
  const dir = projectRelativePath(projectId, "prompt-recipes");
  const file = projectRelativePath(projectId, "prompt-recipes/custom.json");
  await mkdir(dir, { recursive: true });
  const recipes = await readCustomRecipes(file);
  const recipe: SavedPromptRecipe = {
    id: randomUUID(),
    title: input.title?.trim() || "Untitled recipe",
    prompt,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    sourceNote: input.sourceNote?.trim() || undefined,
    tags: Array.isArray(input.tags) ? input.tags.filter((tag) => typeof tag === "string" && tag.trim()).slice(0, 12) : [],
    recommendedMode: input.recommendedMode === "omni-reference" ? "omni-reference" : "strict-continuation",
    createdAt: new Date().toISOString()
  };
  recipes.unshift(recipe);
  await writeFile(file, JSON.stringify(recipes.slice(0, 200), null, 2), "utf-8");
  return recipe;
}

async function readCustomRecipes(file: string): Promise<SavedPromptRecipe[]> {
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(await readFile(file, "utf-8")) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isSavedRecipe) : [];
  } catch {
    return [];
  }
}

function isSavedRecipe(value: unknown): value is SavedPromptRecipe {
  if (!value || typeof value !== "object") return false;
  const recipe = value as Partial<SavedPromptRecipe>;
  return typeof recipe.id === "string" && typeof recipe.title === "string" && typeof recipe.prompt === "string";
}
