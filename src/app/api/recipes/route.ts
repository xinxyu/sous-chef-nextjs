import type postgres from "postgres";
import { getCurrentUserId, isUuid } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { error, json, readJson } from "@/lib/http";
import { rowToRecipe, type SavedRecipeRow } from "./shared";

export async function GET(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return error("Authentication required", 401);
  try {
    const rows = await withDb(
      (sql) => sql<SavedRecipeRow[]>`
        SELECT recipe_id, saved_at, title, data FROM saved_recipes
        WHERE user_id = ${userId} ORDER BY saved_at DESC`,
    );
    return json(rows.map((r) => rowToRecipe(r, userId)));
  } catch (e) {
    console.error("Error listing recipes:", e);
    return error("Failed to list recipes", 500);
  }
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return error("Authentication required", 401);
  const data = (await readJson(req)) as Record<string, postgres.JSONValue>;
  if (!Object.keys(data).length) return error("Recipe data is required", 400);

  const recipeId = isUuid(data.id) ? data.id : crypto.randomUUID();
  const savedAt = new Date();
  const recipe = {
    id: recipeId,
    user_id: userId,
    title: data.title ?? null,
    total_time: data.total_time ?? null,
    yields: data.yields ?? null,
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    instructions: data.instructions ?? [],
    image: data.image ?? null,
    host: data.host ?? null,
    nutrients: data.nutrients ?? null,
    source_url: data.source_url ?? null,
    saved_at: savedAt.toISOString(),
  };
  const title = typeof recipe.title === "string" ? recipe.title : null;

  try {
    await withDb(
      (sql) => sql`
        INSERT INTO saved_recipes (user_id, recipe_id, saved_at, title, data)
        VALUES (${userId}, ${recipeId}, ${savedAt}, ${title}, ${sql.json(recipe)})
        ON CONFLICT (user_id, recipe_id)
        DO UPDATE SET saved_at = EXCLUDED.saved_at, title = EXCLUDED.title, data = EXCLUDED.data`,
    );
    return json(recipe, 201);
  } catch (e) {
    console.error("Error saving recipe:", e);
    return error("Failed to save recipe", 500);
  }
}
