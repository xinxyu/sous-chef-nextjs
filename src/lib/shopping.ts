import type { Recipe } from "./types";

const AMOUNT_RE =
  /^([\d¼½¾⅓⅔⅛⅜⅝⅞.\-/\s]+(?:cups|cup|tablespoons|tablespoon|tbsp|teaspoons|teaspoon|tsp|ounces|ounce|oz|pounds|pound|lbs|lb|cloves|clove|cans|can|packages|package|pinch|dash|slices|slice|pieces|piece)?\s*)/i;

export function getAmountPhrase(ingredient: string): string {
  const match = ingredient.trim().match(AMOUNT_RE);
  if (!match) return "";
  const amount = match[1].trim();
  // Only treat as amount if it contains a number/fraction (avoids ". " or " " as amount)
  return /[\d¼½¾⅓⅔⅛⅜⅝⅞]/.test(amount) ? amount : "";
}

export function normalizeIngredientKey(ingredient: string): string {
  const lower = ingredient.trim().toLowerCase();
  const amount = getAmountPhrase(ingredient);
  if (!amount) return lower;
  const rest = lower.slice(amount.length).replace(/\s+/g, " ").trim();
  // If remainder is empty or a single character (e.g. "2 s" -> "s"), use full string as name
  return !rest || rest.length <= 1 ? lower : rest;
}

export interface CombinedIngredient {
  name: string;
  amounts: string[];
}

export function combineIngredients(recipes: Recipe[]): CombinedIngredient[] {
  const map = new Map<string, string[]>();
  for (const ing of recipes.flatMap((r) => r.ingredients ?? [])) {
    const key = normalizeIngredientKey(ing);
    const displayAmount = getAmountPhrase(ing) || ing.trim();
    const list = map.get(key) ?? [];
    if (!list.includes(displayAmount)) list.push(displayAmount);
    map.set(key, list);
  }
  return [...map.entries()].map(([name, amounts]) => ({ name, amounts })).sort((a, b) => a.name.localeCompare(b.name));
}

export function shoppingListText(recipes: Recipe[]): string {
  const lines = ["Shopping List", ""];
  for (const r of recipes) {
    lines.push(r.title || "Untitled Recipe", "");
    for (const ing of r.ingredients ?? []) lines.push("• " + ing);
    lines.push("");
  }
  return lines.join("\n").trim();
}

/** Menu titles plus shopping list (by recipe), for export to Keep or other apps. */
export function menuAndListText(recipes: Recipe[]): string {
  const lines = ["Menu", "", ...recipes.map((r) => "• " + (r.title || "Untitled Recipe")), ""];
  lines.push(shoppingListText(recipes));
  return lines.join("\n").trim();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
