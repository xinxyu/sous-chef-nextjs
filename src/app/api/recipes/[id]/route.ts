import { getCurrentUserId, isUuid } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { error, json } from "@/lib/http";
import { rowToRecipe, type SavedRecipeRow } from "../shared";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const userId = await getCurrentUserId(req);
  if (!userId) return error("Authentication required", 401);
  const { id } = await params;
  if (!isUuid(id)) return error("Recipe not found", 404);
  try {
    const [row] = await withDb(
      (sql) => sql<SavedRecipeRow[]>`
        SELECT recipe_id, saved_at, title, data FROM saved_recipes
        WHERE user_id = ${userId} AND recipe_id = ${id}`,
    );
    return row ? json(rowToRecipe(row, userId)) : error("Recipe not found", 404);
  } catch (e) {
    console.error("Error getting recipe:", e);
    return error("Failed to get recipe", 500);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const userId = await getCurrentUserId(req);
  if (!userId) return error("Authentication required", 401);
  const { id } = await params;
  if (!isUuid(id)) return error("Recipe not found", 404);
  try {
    const result = await withDb(
      (sql) => sql`DELETE FROM saved_recipes WHERE user_id = ${userId} AND recipe_id = ${id}`,
    );
    return result.count ? json({ message: "Recipe deleted successfully" }) : error("Recipe not found", 404);
  } catch (e) {
    console.error("Error deleting recipe:", e);
    return error("Failed to delete recipe", 500);
  }
}
