export interface Recipe {
  id?: string;
  title: string | null;
  total_time: number | null;
  yields: string | null;
  ingredients: string[];
  instructions: string[] | string;
  image: string | null;
  host: string | null;
  nutrients: Record<string, string> | null;
  source_url?: string | null;
  saved_at?: string;
}

export interface User {
  id: string;
  username: string;
  email?: string | null;
  /** True if the user signed in with or linked Google. */
  google_account?: boolean;
}

export function recipeSteps(r: Recipe | null): string[] {
  if (!r) return [];
  const ins = r.instructions;
  return Array.isArray(ins) ? ins : ins ? [ins] : [];
}
