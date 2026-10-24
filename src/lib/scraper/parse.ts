/**
 * Recipe extraction from HTML. Mirrors what the Flask app got from `recipe-scrapers`
 * (schema.org JSON-LD, then microdata) plus its fallback heuristics in utils/scraping.py.
 */
import { parse, type HTMLElement } from "node-html-parser";

export interface ScrapedRecipe {
  title: string;
  total_time: number | null;
  yields: string;
  ingredients: string[];
  instructions: string[];
  image: string;
  host: string;
  nutrients: Record<string, string> | null;
  source_url?: string;
}

type Json = unknown;
type JsonObject = Record<string, Json>;

const isObject = (v: Json): v is JsonObject => typeof v === "object" && v !== null && !Array.isArray(v);

/** Strip tags, decode entities, collapse whitespace. */
export function cleanText(s: unknown): string {
  if (s == null) return "";
  const raw = String(s);
  const text = /[<&]/.test(raw) ? parse(raw).text : raw;
  return text.replace(/\s+/g, " ").trim();
}

function hasType(node: JsonObject, type: string): boolean {
  const t = node["@type"];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

/** Find the first schema.org Recipe node anywhere in a JSON-LD document. */
function findRecipeNode(data: Json, depth = 0): JsonObject | null {
  if (depth > 6) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(data)) return null;
  if (hasType(data, "Recipe")) return data;
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    if (key in data) {
      const found = findRecipeNode(data[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function parseJsonLoose(raw: string): Json | undefined {
  const text = raw.trim().replace(/^<!--/, "").replace(/-->$/, "").trim();
  try {
    return JSON.parse(text);
  } catch {
    // Some sites emit raw control characters inside strings.
    try {
      return JSON.parse(text.replace(/[\u0000-\u001f]+/g, " "));
    } catch {
      return undefined;
    }
  }
}

function jsonLdRecipe(root: HTMLElement): JsonObject | null {
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    const data = parseJsonLoose(script.rawText);
    const recipe = data === undefined ? null : findRecipeNode(data);
    if (recipe) return recipe;
  }
  return null;
}

/** ISO 8601 duration (PT1H30M, P0DT45M) → minutes. Plain numbers are taken as minutes. */
export function durationToMinutes(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s)) || null;
  const m = s.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return null;
  const [, d, h, min, sec] = m.map((x) => (x ? Number(x) : 0)) as number[];
  const total = Math.round(d * 1440 + h * 60 + min + sec / 60);
  return total > 0 ? total : null;
}

/** Normalize recipeYield like recipe-scrapers: "4" → "4 servings", "1" → "1 serving". */
export function normalizeYields(v: unknown): string {
  const values = (Array.isArray(v) ? v : [v]).map(cleanText).filter(Boolean);
  // Prefer a descriptive value ("12 cookies") over a bare number when both are given.
  const pick = values.find((x) => /[a-z]/i.test(x)) ?? values[0];
  if (!pick) return "";
  if (/^\d+$/.test(pick)) return `${pick} ${pick === "1" ? "serving" : "servings"}`;
  return pick;
}

function imageUrl(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) {
    for (const item of v) {
      const url = imageUrl(item);
      if (url) return url;
    }
    return "";
  }
  if (isObject(v)) return imageUrl(v.url ?? v.contentUrl ?? v["@id"]);
  return "";
}

function ingredientText(ing: unknown): string {
  if (isObject(ing)) {
    const parts = [ing.amount, ing.unit, ing.name ?? ing.ingredient].filter((p) => p != null && p !== "");
    return cleanText(parts.join(" "));
  }
  return cleanText(ing);
}

function instructionSteps(v: unknown, depth = 0): string[] {
  if (v == null || depth > 5) return [];
  if (typeof v === "string") {
    // A single blob: split on line breaks (HTML or plain), else keep as one step.
    const withBreaks = v.replace(/<\s*(br|\/p|\/li)\s*\/?>/gi, "\n");
    return withBreaks.split(/\n+/).map(cleanText).filter(Boolean);
  }
  if (Array.isArray(v)) return v.flatMap((x) => instructionSteps(x, depth + 1));
  if (isObject(v)) {
    if (hasType(v, "HowToSection") || (v.itemListElement && !v.text)) {
      return instructionSteps(v.itemListElement, depth + 1);
    }
    const text = v.text ?? v.name ?? v.description;
    return text ? instructionSteps(String(text), depth + 1) : [];
  }
  return [];
}

function nutrients(v: unknown): Record<string, string> | null {
  if (!isObject(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (k.startsWith("@") || val == null || val === "") continue;
    out[k] = cleanText(val);
  }
  return Object.keys(out).length ? out : null;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function fromJsonLd(node: JsonObject, url: string): ScrapedRecipe {
  const ingredients = ((node.recipeIngredient ?? node.ingredients) as unknown[] | string | undefined) ?? [];
  const totalTime =
    durationToMinutes(node.totalTime) ??
    (() => {
      const sum = (durationToMinutes(node.prepTime) ?? 0) + (durationToMinutes(node.cookTime) ?? 0);
      return sum || null;
    })();
  return {
    title: cleanText(node.name ?? node.headline),
    total_time: totalTime,
    yields: normalizeYields(node.recipeYield ?? node.yield),
    ingredients: (Array.isArray(ingredients) ? ingredients : [ingredients]).map(ingredientText).filter(Boolean),
    instructions: instructionSteps(node.recipeInstructions),
    image: imageUrl(node.image ?? node.thumbnailUrl),
    host: hostOf(url),
    nutrients: nutrients(node.nutrition),
  };
}

const elText = (el: HTMLElement) => el.text.replace(/\s+/g, " ").trim();
const attr = (el: HTMLElement | null, name: string) => el?.getAttribute(name)?.trim() ?? "";

function fromMicrodata(root: HTMLElement, url: string): ScrapedRecipe | null {
  const scope =
    root.querySelector('[itemtype*="schema.org/Recipe"]') ??
    (root.querySelector('[itemprop="recipeIngredient"], [itemprop="ingredients"]') ? root : null);
  if (!scope) return null;
  const prop = (name: string) => scope.querySelector(`[itemprop="${name}"]`);
  const propValue = (name: string) => {
    const el = prop(name);
    return el ? attr(el, "content") || attr(el, "datetime") || elText(el) : "";
  };
  const ingredients = scope
    .querySelectorAll('[itemprop="recipeIngredient"], [itemprop="ingredients"]')
    .map((el) => attr(el, "content") || elText(el));
  const instructionEls = scope.querySelectorAll('[itemprop="recipeInstructions"]');
  const instructions = instructionEls.flatMap((el) => {
    const items = el.querySelectorAll("li, p");
    return items.length ? items.map(elText) : [elText(el)];
  });
  const image = prop("image");
  return {
    title: propValue("name"),
    total_time: durationToMinutes(propValue("totalTime")),
    yields: normalizeYields(propValue("recipeYield")),
    ingredients: dedupe(ingredients),
    instructions: instructions.filter(Boolean),
    image: attr(image, "src") || attr(image, "content") || attr(image, "href"),
    host: hostOf(url),
    nutrients: null,
  };
}

const keep = (t: string) => t.length > 2;

/** Port of `_parse_ingredients_from_soup` patterns 2–6 (JSON-LD is handled separately). */
export function fallbackIngredients(root: HTMLElement): string[] {
  const listText = (el: HTMLElement) => elText(el.tagName === "LI" ? el : (el.closest("li") ?? el));

  // data-ingredient-name and AllRecipes / common class selectors
  const selectorGroups = [
    "[data-ingredient-name]",
    "li.mntl-structured-ingredients__list-item",
    "li.ingredients-section__list-item",
    "li[data-testid='ingredient-item']",
    ".mntl-structured-ingredients__list-item",
    ".ingredients-section__list-item",
    "[data-testid='ingredient-item']",
    "li.wprm-recipe-ingredient",
    "li.ingredients-item",
    "li.ingredient",
    ".recipe-ingredients li",
    ".ingredients-list li",
    "ul.ingredients li",
    "div.ingredients li",
    ".ingredients-item",
    ".ingredient",
  ];
  for (const selector of selectorGroups) {
    const found = dedupe(root.querySelectorAll(selector).map(listText).filter(keep));
    if (found.length) return found;
  }

  // Heading-based: <h2|h3>Ingredients</h2> followed by a list
  for (const heading of root.querySelectorAll("h2, h3")) {
    if (!/ingredients/i.test(heading.text)) continue;
    for (let el = heading.nextElementSibling; el; el = el.nextElementSibling) {
      const list = el.tagName === "UL" ? el : el.querySelector("ul");
      if (!list) continue;
      const found = list
        .querySelectorAll("li")
        .map(elText)
        .filter((t) => t.length > 5 && !/^[\d\s/]+$/.test(t));
      if (found.length) return dedupe(found);
    }
  }

  // Any section/div whose class mentions "ingredient"
  const found: string[] = [];
  for (const section of root.querySelectorAll("section, div")) {
    if (!/ingredient/i.test(attr(section, "class"))) continue;
    for (const li of section.querySelectorAll("li")) {
      const t = elText(li);
      if (keep(t) && /\w/.test(t)) found.push(t);
    }
  }
  return dedupe(found);
}

function fallbackInstructions(root: HTMLElement): string[] {
  const selectors = [
    "li.wprm-recipe-instruction",
    ".mntl-sc-block-group--LI p",
    ".recipe-directions li",
    ".instructions li",
    ".directions li",
    "ol.instructions li",
    ".recipe-instructions li",
    ".recipe-method li",
  ];
  for (const selector of selectors) {
    const found = root.querySelectorAll(selector).map(elText).filter(keep);
    if (found.length) return found;
  }
  for (const heading of root.querySelectorAll("h2, h3")) {
    if (!/(instructions|directions|method)/i.test(heading.text)) continue;
    for (let el = heading.nextElementSibling; el; el = el.nextElementSibling) {
      const list = el.tagName === "OL" || el.tagName === "UL" ? el : el.querySelector("ol, ul");
      if (!list) continue;
      const found = list.querySelectorAll("li").map(elText).filter(keep);
      if (found.length) return found;
    }
  }
  return [];
}

function metaContent(root: HTMLElement, key: string): string {
  return attr(root.querySelector(`meta[property="${key}"], meta[name="${key}"]`), "content");
}

/**
 * Extract a recipe from page HTML. Throws if nothing recipe-like is found.
 * Missing fields from structured data are filled from fallback heuristics.
 */
export function parseRecipe(html: string, url: string): ScrapedRecipe {
  const root = parse(html);
  const ld = jsonLdRecipe(root);
  const recipe: ScrapedRecipe = (ld && fromJsonLd(ld, url)) ||
    fromMicrodata(root, url) || {
      title: "",
      total_time: null,
      yields: "",
      ingredients: [],
      instructions: [],
      image: "",
      host: hostOf(url),
      nutrients: null,
    };

  if (!recipe.ingredients.length) recipe.ingredients = fallbackIngredients(root);
  if (!recipe.instructions.length) recipe.instructions = fallbackInstructions(root);
  if (!recipe.title) {
    recipe.title =
      cleanText(metaContent(root, "og:title")) || cleanText(root.querySelector("h1")?.text) || cleanText(root.querySelector("title")?.text);
  }
  if (!recipe.image) recipe.image = metaContent(root, "og:image");
  if (recipe.image) {
    try {
      recipe.image = new URL(recipe.image, url).toString();
    } catch {
      /* leave as-is */
    }
  }

  if (!recipe.ingredients.length && !recipe.instructions.length) {
    throw new Error("No recipe found on this page");
  }
  return recipe;
}
