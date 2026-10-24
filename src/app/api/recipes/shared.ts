export interface SavedRecipeRow {
  recipe_id: string;
  saved_at: Date;
  title: string | null;
  data: Record<string, unknown>;
}

/** Same shape the Flask API returned: stored data plus id/user_id/saved_at/title from the row. */
export function rowToRecipe(row: SavedRecipeRow, userId: string) {
  return {
    ...row.data,
    id: row.recipe_id,
    user_id: userId,
    saved_at: new Date(row.saved_at).toISOString(),
    ...(row.title != null ? { title: row.title } : {}),
  };
}
